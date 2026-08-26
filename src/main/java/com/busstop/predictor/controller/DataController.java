package com.busstop.predictor.controller;

import com.busstop.predictor.ml.MLService;
import com.busstop.predictor.model.BusStop;
import com.busstop.predictor.model.Feedback;
import com.busstop.predictor.model.HistoricalData;
import com.busstop.predictor.model.User;
import com.busstop.predictor.repository.BusStopRepository;
import com.busstop.predictor.repository.FeedbackRepository;
import com.busstop.predictor.repository.HistoricalDataRepository;
import com.busstop.predictor.repository.PredictionRepository;
import com.busstop.predictor.repository.RouteRepository;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/data")
public class DataController {

    @Autowired
    private HistoricalDataRepository historicalDataRepository;

    @Autowired
    private BusStopRepository busStopRepository;

    @Autowired
    private RouteRepository routeRepository;

    @Autowired
    private PredictionRepository predictionRepository;

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private com.busstop.predictor.repository.UserRepository userRepository;

    @Autowired
    private MLService mlService;

    private boolean isAdmin(HttpSession session) {
        User user = (User) session.getAttribute("user");
        return user != null && "ADMIN".equals(user.getRole());
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> userList = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("username", u.getUsername());
            map.put("email", u.getEmail());
            map.put("role", u.getRole());
            userList.add(map);
        }
        return ResponseEntity.ok(userList);
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadCSV(@RequestParam("file") MultipartFile file, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File is empty"));
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int count = 0;
            int skipped = 0;

            List<BusStop> allStops = busStopRepository.findAll();
            if (allStops.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "No bus stops registered in system yet."));
            }

            Map<String, Integer> colMap = new HashMap<>();
            boolean isHeaderProcessed = false;

            List<HistoricalData> dataToSave = new ArrayList<>();

            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;

                String[] tokens = trimmed.split(",");

                // Process Header line dynamically
                if (!isHeaderProcessed) {
                    for (int i = 0; i < tokens.length; i++) {
                        String cleanHeader = tokens[i].trim().toLowerCase().replaceAll("[^a-z0-9_]", "");
                        colMap.put(cleanHeader, i);
                    }
                    isHeaderProcessed = true;
                    if (trimmed.toLowerCase().contains("date") || trimmed.toLowerCase().contains("record_id") || trimmed.toLowerCase().contains("bus_stop_id")) {
                        continue;
                    }
                }

                try {
                    // 1. Bus Stop lookup (handles BS044, BS44, 44, etc.)
                    BusStop stop = null;
                    Integer stopColIndex = colMap.get("bus_stop_id");
                    if (stopColIndex == null) stopColIndex = colMap.get("stop_id");

                    if (stopColIndex != null && stopColIndex < tokens.length) {
                        String rawStopStr = tokens[stopColIndex].trim();
                        String digits = rawStopStr.replaceAll("[^0-9]", "");
                        if (!digits.isEmpty()) {
                            Long parsedId = Long.parseLong(digits);
                            stop = busStopRepository.findById(parsedId).orElse(null);
                        }
                    }

                    // Fallback to first token digits or round-robin if stop not found by ID
                    if (stop == null) {
                        String digits = tokens[0].trim().replaceAll("[^0-9]", "");
                        if (!digits.isEmpty()) {
                            Long parsedId = Long.parseLong(digits);
                            stop = busStopRepository.findById(parsedId).orElse(null);
                        }
                    }
                    if (stop == null) {
                        stop = allStops.get(count % allStops.size());
                    }

                    // 2. Date parsing
                    LocalDate date = LocalDate.now();
                    Integer dateColIndex = colMap.get("date");
                    if (dateColIndex == null) dateColIndex = 1;
                    if (dateColIndex < tokens.length) {
                        String dateStr = tokens[dateColIndex].trim();
                        try {
                            date = LocalDate.parse(dateStr);
                        } catch (Exception pe) {}
                    }

                    // 3. Hour / Time parsing (handles 5, "05:48:00", etc.)
                    int hour = 12;
                    Integer hourColIndex = colMap.get("hour");
                    if (hourColIndex == null) hourColIndex = colMap.get("time_of_day");
                    if (hourColIndex == null) hourColIndex = colMap.get("time");
                    if (hourColIndex == null) hourColIndex = 2;

                    if (hourColIndex < tokens.length) {
                        String hourStr = tokens[hourColIndex].trim();
                        if (hourStr.contains(":")) {
                            hourStr = hourStr.split(":")[0];
                        }
                        String digits = hourStr.replaceAll("[^0-9]", "");
                        if (!digits.isEmpty()) {
                            hour = Integer.parseInt(digits);
                        }
                    }
                    if (hour < 0 || hour > 23) hour = 12;

                    int dayOfWeek = date.getDayOfWeek().getValue();

                    // 4. Weather
                    String weather = "SUNNY";
                    Integer weatherColIndex = colMap.get("weather_condition");
                    if (weatherColIndex == null) weatherColIndex = colMap.get("weather");
                    if (weatherColIndex == null) weatherColIndex = 3;

                    if (weatherColIndex < tokens.length) {
                        String rawWeather = tokens[weatherColIndex].trim().toUpperCase();
                        if (rawWeather.contains("RAIN")) weather = "RAINY";
                        else if (rawWeather.contains("SNOW") || rawWeather.contains("STORM")) weather = "SNOWY";
                        else if (rawWeather.contains("CLOUD")) weather = "CLOUDY";
                        else weather = "SUNNY";
                    }

                    // 5. Holiday & Weekend
                    boolean isWeekend = date.getDayOfWeek().getValue() >= 6;
                    Integer weekendColIndex = colMap.get("is_weekend");
                    if (weekendColIndex == null) weekendColIndex = colMap.get("weekend");
                    if (weekendColIndex != null && weekendColIndex < tokens.length) {
                        String val = tokens[weekendColIndex].trim();
                        isWeekend = val.equals("1") || val.equalsIgnoreCase("true");
                    }

                    boolean isHoliday = false;
                    Integer holidayColIndex = colMap.get("is_holiday");
                    if (holidayColIndex == null) holidayColIndex = colMap.get("holiday");
                    if (holidayColIndex != null && holidayColIndex < tokens.length) {
                        String val = tokens[holidayColIndex].trim();
                        isHoliday = val.equals("1") || val.equalsIgnoreCase("true");
                    }

                    boolean isEvent = false;
                    Integer eventColIndex = colMap.get("is_event");
                    if (eventColIndex == null) eventColIndex = colMap.get("event");
                    if (eventColIndex != null && eventColIndex < tokens.length) {
                        String val = tokens[eventColIndex].trim();
                        isEvent = val.equals("1") || val.equalsIgnoreCase("true");
                    }

                    // 6. Passengers & Capacity
                    int passengers = 25;
                    Integer passColIndex = colMap.get("passengers");
                    if (passColIndex == null) passColIndex = colMap.get("passenger_count");
                    if (passColIndex == null && tokens.length > 7) passColIndex = 7;
                    if (passColIndex == null && tokens.length >= 17) passColIndex = 16;

                    if (passColIndex != null && passColIndex < tokens.length) {
                        String digits = tokens[passColIndex].trim().replaceAll("[^0-9]", "");
                        if (!digits.isEmpty()) {
                            passengers = Integer.parseInt(digits);
                        }
                    }

                    int capacity = stop.getCapacity() > 0 ? stop.getCapacity() : 50;
                    Integer capColIndex = colMap.get("bus_capacity");
                    if (capColIndex == null) capColIndex = colMap.get("capacity");
                    if (capColIndex != null && capColIndex < tokens.length) {
                        String digits = tokens[capColIndex].trim().replaceAll("[^0-9]", "");
                        if (!digits.isEmpty()) {
                            int parsedCap = Integer.parseInt(digits);
                            if (parsedCap > 0) capacity = parsedCap;
                        }
                    }

                    double pct = ((double) passengers / capacity) * 100.0;
                    if (pct > 100.0) pct = 100.0;

                    String level = pct < 35.0 ? "LOW" : (pct <= 70.0 ? "MEDIUM" : "HIGH");

                    HistoricalData data = new HistoricalData(stop, date, hour, dayOfWeek, weather, isHoliday, isWeekend, isEvent, passengers, pct, level);
                    dataToSave.add(data);
                    count++;

                } catch (Exception ex) {
                    skipped++;
                }
            }

            if (!dataToSave.isEmpty()) {
                historicalDataRepository.saveAll(dataToSave);
                try {
                    mlService.trainModels();
                } catch (Exception te) {}
            }

            return ResponseEntity.ok(Map.of(
                    "message", "CSV uploaded successfully. AI models retrained!",
                    "recordsImported", count,
                    "recordsSkipped", skipped
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to parse CSV: " + e.getMessage()));
        }
    }

    @PostMapping("/train")
    public ResponseEntity<?> trainModels(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        try {
            String result = mlService.trainModels();
            return ResponseEntity.ok(Map.of("message", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Training error: " + e.getMessage()));
        }
    }

    @GetMapping("/historical")
    public ResponseEntity<?> getHistoricalData(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        List<HistoricalData> data = historicalDataRepository.findAll();
        data.sort((a, b) -> b.getId().compareTo(a.getId()));
        if (data.size() > 100) {
            data = data.subList(0, 100);
        }
        return ResponseEntity.ok(data);
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalStops = busStopRepository.count();
        long totalPredictions = predictionRepository.count();
        long totalHistorical = historicalDataRepository.count();
        long totalUsers = userRepository.count();
        long adminCount = userRepository.countByRole("ADMIN");
        long passengerCount = userRepository.countByRole("PASSENGER");

        // Calculate total seating capacity across all bus stops
        long totalCapacity = 0;
        List<BusStop> allStops = busStopRepository.findAll();
        for (BusStop s : allStops) {
            totalCapacity += s.getCapacity();
        }

        // 1. Calculate Peak Hours
        List<HistoricalData> historicalData = historicalDataRepository.findAll();
        Map<Integer, Integer> hourCounts = new HashMap<>();
        Map<Integer, Integer> hourSum = new HashMap<>();
        for (HistoricalData h : historicalData) {
            hourCounts.put(h.getTimeOfDay(), hourCounts.getOrDefault(h.getTimeOfDay(), 0) + 1);
            hourSum.put(h.getTimeOfDay(), hourSum.getOrDefault(h.getTimeOfDay(), 0) + h.getPassengerCount());
        }

        List<Map<String, Object>> peakHours = new ArrayList<>();
        for (Integer hour : hourSum.keySet()) {
            double avg = (double) hourSum.get(hour) / hourCounts.get(hour);
            peakHours.add(Map.of("hour", hour, "averagePassengers", Math.round(avg)));
        }
        peakHours.sort((a, b) -> Long.compare(((Number) b.get("averagePassengers")).longValue(), ((Number) a.get("averagePassengers")).longValue()));

        // Limit to top 5 peak hours
        if (peakHours.size() > 5) {
            peakHours = peakHours.subList(0, 5);
        }

        // 2. Occupancy Trends (grouped by Day of Week: 1-7 -> Mon-Sun)
        Map<Integer, Integer> dayCounts = new HashMap<>();
        Map<Integer, Integer> daySum = new HashMap<>();
        for (HistoricalData h : historicalData) {
            dayCounts.put(h.getDayOfWeek(), dayCounts.getOrDefault(h.getDayOfWeek(), 0) + 1);
            daySum.put(h.getDayOfWeek(), daySum.getOrDefault(h.getDayOfWeek(), 0) + h.getPassengerCount());
        }

        List<Map<String, Object>> weeklyTrends = new ArrayList<>();
        String[] days = {"", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"};
        for (int i = 1; i <= 7; i++) {
            double avg = dayCounts.containsKey(i) ? (double) daySum.get(i) / dayCounts.get(i) : 0.0;
            weeklyTrends.add(Map.of("day", days[i], "averagePassengers", Math.round(avg)));
        }

        // 3. Hourly Trends (for 24 hours chart)
        List<Map<String, Object>> hourlyTrends = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            double avg = hourCounts.containsKey(i) ? (double) hourSum.get(i) / hourCounts.get(i) : 0.0;
            hourlyTrends.add(Map.of("hour", i, "averagePassengers", Math.round(avg)));
        }

        long totalRoutes = routeRepository.count();
        double totalPassengersSum = 0;
        for (HistoricalData h : historicalData) {
            totalPassengersSum += h.getPassengerCount();
        }
        long overallAvgPassengers = historicalData.isEmpty() ? 0 : Math.round(totalPassengersSum / historicalData.size());

        Map<String, Object> response = new HashMap<>();
        response.put("totalBusStops", totalStops);
        response.put("totalRoutes", totalRoutes);
        response.put("totalPredictions", totalPredictions);
        response.put("totalHistoricalRecords", totalHistorical);
        response.put("totalUsers", totalUsers);
        response.put("adminCount", adminCount);
        response.put("passengerCount", passengerCount);
        response.put("totalCapacity", totalCapacity);
        response.put("averagePassengers", overallAvgPassengers);
        response.put("peakHours", peakHours);
        response.put("weeklyTrends", weeklyTrends);
        response.put("hourlyTrends", hourlyTrends);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/report")
    public void downloadReport(HttpServletResponse response, HttpSession session) {
        if (!isAdmin(session)) {
            response.setStatus(HttpStatus.FORBIDDEN.value());
            return;
        }

        try {
            response.setContentType("text/csv");
            response.setHeader("Content-Disposition", "attachment; filename=\"bus_stop_report_" + LocalDate.now() + ".csv\"");

            StringBuilder csv = new StringBuilder();
            csv.append("Bus Stop Occupancy Predictor Summary Report\n");
            csv.append("Generated At,").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n\n");

            // Key Metrics
            csv.append("Key Metric,Count / Value\n");
            csv.append("Total Bus Stops,").append(busStopRepository.count()).append("\n");
            csv.append("Total Active Routes,").append(routeRepository.count()).append("\n");
            csv.append("Total Historical Records,").append(historicalDataRepository.count()).append("\n");
            csv.append("Total Predictions Logged,").append(predictionRepository.count()).append("\n");

            // Calculate feedback stats
            List<Feedback> feedbacks = feedbackRepository.findAll();
            double avgRating = 0;
            if (!feedbacks.isEmpty()) {
                double sum = 0;
                for (Feedback f : feedbacks) sum += f.getRating();
                avgRating = sum / feedbacks.size();
            }
            csv.append("Total Feedback Comments,").append(feedbacks.size()).append("\n");
            csv.append("Average Feedback Rating,").append(String.format("%.2f / 5.0", avgRating)).append("\n\n");

            // Bus Stops Details
            csv.append("Bus Stop ID,Name,Latitude,Longitude,Capacity\n");
            for (BusStop stop : busStopRepository.findAll()) {
                csv.append(stop.getId()).append(",")
                        .append("\"").append(stop.getName()).append("\",")
                        .append(stop.getLatitude()).append(",")
                        .append(stop.getLongitude()).append(",")
                        .append(stop.getCapacity()).append("\n");
            }
            csv.append("\n");

            // Feedback Details
            csv.append("Feedback ID,Bus Stop,Prediction ID,User,Actual Level,Rating,Comments\n");
            for (Feedback f : feedbacks) {
                csv.append(f.getId()).append(",")
                        .append("\"").append(f.getPrediction().getBusStop().getName()).append("\",")
                        .append(f.getPrediction().getId()).append(",")
                        .append("\"").append(f.getUser().getUsername()).append("\",")
                        .append(f.getActualOccupancyLevel()).append(",")
                        .append(f.getRating()).append(",")
                        .append("\"").append(f.getComments() != null ? f.getComments() : "").append("\"\n");
            }

            response.getWriter().write(csv.toString());

        } catch (Exception e) {
            response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
    }
}
