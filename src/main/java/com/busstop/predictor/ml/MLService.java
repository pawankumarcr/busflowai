package com.busstop.predictor.ml;

import com.busstop.predictor.model.BusStop;
import com.busstop.predictor.model.HistoricalData;
import com.busstop.predictor.repository.BusStopRepository;
import com.busstop.predictor.repository.HistoricalDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import weka.classifiers.Classifier;
import weka.classifiers.Evaluation;
import weka.classifiers.functions.LinearRegression;
import weka.classifiers.trees.REPTree;
import weka.classifiers.trees.RandomForest;
import weka.core.Attribute;
import weka.core.DenseInstance;
import weka.core.Instances;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

@Service
public class MLService {

    @Autowired
    private HistoricalDataRepository historicalDataRepository;

    @Autowired
    private BusStopRepository busStopRepository;

    @Autowired
    private MLModelManager modelManager;

    // We define lists for nominal attributes
    private final List<String> dayOfWeekValues = Arrays.asList("1", "2", "3", "4", "5", "6", "7");
    private final List<String> weatherValues = Arrays.asList("SUNNY", "RAINY", "CLOUDY", "SNOWY");
    private final List<String> binaryValues = Arrays.asList("0", "1");

    public synchronized String trainModels() throws Exception {
        List<HistoricalData> dataList = historicalDataRepository.findAll();
        if (dataList.size() < 10) {
            return "Insufficient historical data for training. At least 10 records are required, found: " + dataList.size();
        }

        // Fetch all active bus stop IDs to create nominal list
        List<BusStop> stops = busStopRepository.findAll();
        List<String> stopIdValues = new ArrayList<>();
        for (BusStop stop : stops) {
            stopIdValues.add(stop.getId().toString());
        }
        if (stopIdValues.isEmpty()) {
            return "No bus stops found in the database. Add bus stops before training.";
        }

        // Define attributes
        ArrayList<Attribute> attributes = new ArrayList<>();
        Attribute attrStop = new Attribute("bus_stop_id", stopIdValues);
        Attribute attrDay = new Attribute("day_of_week", dayOfWeekValues);
        Attribute attrTime = new Attribute("time_of_day"); // numeric (hour: 0-23)
        Attribute attrWeather = new Attribute("weather", weatherValues);
        Attribute attrHoliday = new Attribute("holiday", binaryValues);
        Attribute attrWeekend = new Attribute("weekend", binaryValues);
        Attribute attrEvent = new Attribute("event", binaryValues);
        Attribute attrCount = new Attribute("passenger_count"); // numeric (target)

        attributes.add(attrStop);
        attributes.add(attrDay);
        attributes.add(attrTime);
        attributes.add(attrWeather);
        attributes.add(attrHoliday);
        attributes.add(attrWeekend);
        attributes.add(attrEvent);
        attributes.add(attrCount);

        // Create the dataset
        Instances dataset = new Instances("BusStopOccupancy", attributes, dataList.size());
        dataset.setClassIndex(dataset.numAttributes() - 1); // target is passenger_count

        double sumActual = 0;
        for (HistoricalData record : dataList) {
            // Weka needs bus_stop_id to be matching one of the values in stopIdValues
            String stopIdStr = record.getBusStop().getId().toString();
            if (!stopIdValues.contains(stopIdStr)) {
                continue; // Skip if bus stop is no longer present
            }

            double[] vals = new double[dataset.numAttributes()];
            vals[0] = attrStop.indexOfValue(stopIdStr);
            vals[1] = attrDay.indexOfValue(record.getDayOfWeek().toString());
            vals[2] = record.getTimeOfDay();
            vals[3] = attrWeather.indexOfValue(record.getWeather());
            vals[4] = attrHoliday.indexOfValue(record.getHoliday() ? "1" : "0");
            vals[5] = attrWeekend.indexOfValue(record.getWeekend() ? "1" : "0");
            vals[6] = attrEvent.indexOfValue(record.getEvent() ? "1" : "0");
            vals[7] = record.getPassengerCount();

            dataset.add(new DenseInstance(1.0, vals));
            sumActual += record.getPassengerCount();
        }

        if (dataset.numInstances() < 10) {
            return "Insufficient instances loaded into Weka. Check if the historical data matches the existing bus stops.";
        }

        double meanActual = sumActual / dataset.numInstances();

        // 1. Train Random Forest
        RandomForest rf = new RandomForest();
        rf.buildClassifier(dataset);
        MLModelManager.ModelMetrics rfMetrics = evaluateModel(rf, dataset, meanActual);

        // 2. Train Decision Tree (REPTree)
        REPTree rt = new REPTree();
        rt.buildClassifier(dataset);
        MLModelManager.ModelMetrics dtMetrics = evaluateModel(rt, dataset, meanActual);

        // 3. Train Linear Regression
        LinearRegression lr = new LinearRegression();
        lr.buildClassifier(dataset);
        MLModelManager.ModelMetrics lrMetrics = evaluateModel(lr, dataset, meanActual);

        // Update the singleton model manager
        modelManager.updateModels(rf, rt, lr, dataset, rfMetrics, dtMetrics, lrMetrics);

        return "Successfully trained Random Forest, Decision Tree, and Linear Regression models on " + dataset.numInstances() + " records.";
    }

    private MLModelManager.ModelMetrics evaluateModel(Classifier classifier, Instances dataset, double meanActual) throws Exception {
        Evaluation eval = new Evaluation(dataset);
        eval.crossValidateModel(classifier, dataset, 10, new Random(1));

        double rmse = eval.rootMeanSquaredError();
        double mae = eval.meanAbsoluteError();
        double corr = eval.correlationCoefficient();
        double r2 = Math.max(0.0, corr * corr); // R-squared is correlation squared

        // Custom accuracy percentage based on MAE deviation from mean actual count
        double accuracy = Math.max(0.0, 1.0 - (mae / (meanActual > 0 ? meanActual : 1.0))) * 100.0;

        return new MLModelManager.ModelMetrics(rmse, mae, r2, accuracy);
    }

    public PredictionResult predict(Long busStopId, int dayOfWeek, int timeOfDay, String weather,
                                    boolean holiday, boolean weekend, boolean event) {
        BusStop stop = busStopRepository.findById(busStopId)
                .orElseThrow(() -> new IllegalArgumentException("Bus stop not found with ID: " + busStopId));

        double expectedCount;
        double confidence;

        if (modelManager.isTrained()) {
            try {
                Instances structure = modelManager.getDatasetStructure();
                Attribute attrStop = structure.attribute("bus_stop_id");
                Attribute attrDay = structure.attribute("day_of_week");
                Attribute attrWeather = structure.attribute("weather");
                Attribute attrHoliday = structure.attribute("holiday");
                Attribute attrWeekend = structure.attribute("weekend");
                Attribute attrEvent = structure.attribute("event");

                String stopIdStr = busStopId.toString();

                double[] vals = new double[structure.numAttributes()];
                // Handle case where stop ID was added after model training
                if (attrStop.indexOfValue(stopIdStr) == -1) {
                    vals[0] = 0; // fallback to first stop
                } else {
                    vals[0] = attrStop.indexOfValue(stopIdStr);
                }

                vals[1] = attrDay.indexOfValue(String.valueOf(dayOfWeek));
                vals[2] = timeOfDay;
                vals[3] = attrWeather.indexOfValue(weather);
                vals[4] = attrHoliday.indexOfValue(holiday ? "1" : "0");
                vals[5] = attrWeekend.indexOfValue(weekend ? "1" : "0");
                vals[6] = attrEvent.indexOfValue(event ? "1" : "0");
                vals[7] = 0; // target placeholder

                DenseInstance query = new DenseInstance(1.0, vals);
                query.setDataset(structure);

                expectedCount = modelManager.getRandomForestModel().classifyInstance(query);
                if (expectedCount < 0) {
                    expectedCount = 0;
                }

                // Confidence score based on Random Forest model's MAE relative to stop capacity
                double rfMae = modelManager.getMetrics().get("Random Forest").getMae();
                confidence = Math.max(50.0, (1.0 - (rfMae / stop.getCapacity())) * 100.0);

            } catch (Exception e) {
                // fallback to heuristic on exception
                expectedCount = calculateHeuristic(timeOfDay, weather, holiday, weekend, event);
                confidence = 70.0;
            }
        } else {
            // Heuristic fallback if models not yet trained
            expectedCount = calculateHeuristic(timeOfDay, weather, holiday, weekend, event);
            confidence = 65.0;
        }

        // Limit expected count to stop capacity
        if (expectedCount > stop.getCapacity()) {
            expectedCount = stop.getCapacity();
        }

        double occupancyPercentage = (expectedCount / stop.getCapacity()) * 100.0;
        String occupancyLevel = getOccupancyCategory(occupancyPercentage);

        return new PredictionResult(expectedCount, occupancyPercentage, occupancyLevel, confidence);
    }

    private double calculateHeuristic(int timeOfDay, String weather, boolean holiday, boolean weekend, boolean event) {
        // Base count depends on time of day (rush hours vs off-peak)
        double base = 10.0;

        // Peak times: 7-9 AM, 4-6 PM
        if ((timeOfDay >= 7 && timeOfDay <= 9) || (timeOfDay >= 16 && timeOfDay <= 18)) {
            base += 25.0;
        } else if (timeOfDay >= 10 && timeOfDay <= 15) {
            base += 10.0;
        } else if (timeOfDay >= 20 || timeOfDay < 6) {
            base -= 5.0; // very low at night
        }

        // Weather adjustment (more people wait at shelters in bad weather, or fewer travel overall)
        if ("RAINY".equals(weather)) {
            base += 5.0;
        } else if ("SNOWY".equals(weather)) {
            base -= 3.0;
        }

        // Weekend/Holiday adjustments (less regular commute, more event-driven)
        if (weekend || holiday) {
            base = base * 0.6; // 40% drop in typical commute
        }

        // Event adjustment
        if (event) {
            base += 20.0;
        }

        return Math.max(2.0, base);
    }

    private String getOccupancyCategory(double percentage) {
        if (percentage < 35.0) {
            return "LOW";
        } else if (percentage <= 70.0) {
            return "MEDIUM";
        } else {
            return "HIGH";
        }
    }

    public static class PredictionResult {
        private final double expectedCount;
        private final double occupancyPercentage;
        private final String occupancyLevel;
        private final double confidenceScore;

        public PredictionResult(double expectedCount, double occupancyPercentage, String occupancyLevel, double confidenceScore) {
            this.expectedCount = expectedCount;
            this.occupancyPercentage = occupancyPercentage;
            this.occupancyLevel = occupancyLevel;
            this.confidenceScore = confidenceScore;
        }

        public double getExpectedCount() { return expectedCount; }
        public double getOccupancyPercentage() { return occupancyPercentage; }
        public String getOccupancyLevel() { return occupancyLevel; }
        public double getConfidenceScore() { return confidenceScore; }
    }
}
