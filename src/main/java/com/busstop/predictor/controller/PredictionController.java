package com.busstop.predictor.controller;

import com.busstop.predictor.ml.MLModelManager;
import com.busstop.predictor.ml.MLService;
import com.busstop.predictor.model.BusStop;
import com.busstop.predictor.model.Prediction;
import com.busstop.predictor.model.User;
import com.busstop.predictor.repository.BusStopRepository;
import com.busstop.predictor.repository.PredictionRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/predictions")
public class PredictionController {

    @Autowired
    private MLService mlService;

    @Autowired
    private MLModelManager modelManager;

    @Autowired
    private PredictionRepository predictionRepository;

    @Autowired
    private BusStopRepository busStopRepository;

    @PostMapping("/predict")
    public ResponseEntity<?> predict(@RequestBody Map<String, Object> request, HttpSession session) {
        try {
            Number busStopIdNum = (Number) request.get("busStopId");
            String dateStr = (String) request.get("date");
            Number timeOfDayNum = (Number) request.get("timeOfDay");
            String weather = (String) request.get("weather");
            Boolean holiday = (Boolean) request.get("holiday");
            Boolean weekend = (Boolean) request.get("weekend");
            Boolean event = (Boolean) request.get("event");

            if (busStopIdNum == null || dateStr == null || timeOfDayNum == null || weather == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Missing required prediction inputs"));
            }

            Long busStopId = busStopIdNum.longValue();
            LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            int timeOfDay = timeOfDayNum.intValue();
            if (timeOfDay < 0 || timeOfDay > 23) {
                return ResponseEntity.badRequest().body(Map.of("message", "Time of day must be between 0 and 23"));
            }

            // Calculate day of week (1 = Monday, 7 = Sunday)
            DayOfWeek day = date.getDayOfWeek();
            int dayOfWeek = day.getValue();

            // Auto-detect weekend
            if (weekend == null) {
                weekend = (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY);
            }
            if (holiday == null) {
                holiday = false;
            }
            if (event == null) {
                event = false;
            }

            // Perform prediction using MLService
            MLService.PredictionResult result = mlService.predict(busStopId, dayOfWeek, timeOfDay, weather, holiday.booleanValue(), weekend.booleanValue(), event.booleanValue());

            BusStop stop = busStopRepository.findById(busStopId).orElseThrow();

            // Save prediction to database
            Prediction prediction = new Prediction(
                    stop, date, timeOfDay, dayOfWeek, weather, holiday, weekend, event,
                    result.getExpectedCount(), result.getOccupancyPercentage(),
                    result.getOccupancyLevel(), result.getConfidenceScore()
            );
            predictionRepository.save(prediction);

            // Compute suggested less crowded times (checking +-2 hours)
            List<Map<String, Object>> suggestions = new ArrayList<>();
            for (int offset = -2; offset <= 2; offset++) {
                if (offset == 0) continue;
                int targetHour = timeOfDay + offset;
                if (targetHour >= 0 && targetHour <= 23) {
                    MLService.PredictionResult adjResult = mlService.predict(busStopId, dayOfWeek, targetHour, weather, holiday.booleanValue(), weekend.booleanValue(), event.booleanValue());
                    // Suggest if this hour has lower occupancy
                    if (adjResult.getExpectedCount() < result.getExpectedCount()) {
                        Map<String, Object> suggestion = new HashMap<>();
                        suggestion.put("timeOfDay", targetHour);
                        suggestion.put("expectedCount", Math.round(adjResult.getExpectedCount()));
                        suggestion.put("occupancyPercentage", Math.round(adjResult.getOccupancyPercentage()));
                        suggestion.put("occupancyLevel", adjResult.getOccupancyLevel());
                        suggestions.add(suggestion);
                    }
                }
            }

            // Sort suggestions by expected count ascending (least busy first)
            suggestions.sort(Comparator.comparingDouble(o -> ((Number) o.get("expectedCount")).doubleValue()));

            Map<String, Object> response = new HashMap<>();
            response.put("id", prediction.getId());
            response.put("busStopId", busStopId);
            response.put("busStopName", stop.getName());
            response.put("capacity", stop.getCapacity());
            response.put("expectedCount", Math.round(result.getExpectedCount()));
            response.put("occupancyPercentage", Math.round(result.getOccupancyPercentage()));
            response.put("occupancyLevel", result.getOccupancyLevel());
            response.put("confidenceScore", Math.round(result.getConfidenceScore()));
            response.put("suggestions", suggestions);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Prediction failed: " + e.getMessage()));
        }
    }

    @GetMapping("/history")
    public List<Prediction> getHistory() {
        // Return latest predictions
        List<Prediction> all = predictionRepository.findAll();
        // Sort descending by id
        all.sort((a, b) -> b.getId().compareTo(a.getId()));
        return all;
    }

    @GetMapping("/metrics")
    public ResponseEntity<?> getMetrics() {
        Map<String, Object> response = new HashMap<>();
        response.put("trained", modelManager.isTrained());
        response.put("metrics", modelManager.getMetrics());
        return ResponseEntity.ok(response);
    }
}
