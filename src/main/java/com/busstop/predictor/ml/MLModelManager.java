package com.busstop.predictor.ml;

import org.springframework.stereotype.Component;
import weka.classifiers.Classifier;
import weka.core.Instances;

import java.util.HashMap;
import java.util.Map;

@Component
public class MLModelManager {

    private Classifier randomForestModel;
    private Classifier decisionTreeModel;
    private Classifier linearRegressionModel;
    private Instances datasetStructure;
    private boolean trained = false;

    private final Map<String, ModelMetrics> metrics = new HashMap<>();

    public static class ModelMetrics {
        private double rmse;
        private double mae;
        private double r2; // Coefficient of determination or correlation squared
        private double accuracy; // Custom regression accuracy (percentage of variation explained or similar)

        public ModelMetrics() {}

        public ModelMetrics(double rmse, double mae, double r2, double accuracy) {
            this.rmse = rmse;
            this.mae = mae;
            this.r2 = r2;
            this.accuracy = accuracy;
        }

        public double getRmse() { return rmse; }
        public void setRmse(double rmse) { this.rmse = rmse; }

        public double getMae() { return mae; }
        public void setMae(double mae) { this.mae = mae; }

        public double getR2() { return r2; }
        public void setR2(double r2) { this.r2 = r2; }

        public double getAccuracy() { return accuracy; }
        public void setAccuracy(double accuracy) { this.accuracy = accuracy; }
    }

    public synchronized void updateModels(Classifier rf, Classifier dt, Classifier lr, Instances structure,
                                          ModelMetrics rfMetrics, ModelMetrics dtMetrics, ModelMetrics lrMetrics) {
        this.randomForestModel = rf;
        this.decisionTreeModel = dt;
        this.linearRegressionModel = lr;
        this.datasetStructure = structure;
        this.trained = true;

        metrics.put("Random Forest", rfMetrics);
        metrics.put("Decision Tree", dtMetrics);
        metrics.put("Linear Regression", lrMetrics);
    }

    public Classifier getRandomForestModel() { return randomForestModel; }
    public Classifier getDecisionTreeModel() { return decisionTreeModel; }
    public Classifier getLinearRegressionModel() { return linearRegressionModel; }
    public Instances getDatasetStructure() { return datasetStructure; }
    public boolean isTrained() { return trained; }
    public Map<String, ModelMetrics> getMetrics() { return metrics; }
}
