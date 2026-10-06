package com.busstop.predictor.config;

import com.busstop.predictor.ml.MLService;
import com.busstop.predictor.model.*;
import com.busstop.predictor.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BusStopRepository busStopRepository;

    @Autowired
    private RouteRepository routeRepository;

    @Autowired
    private HistoricalDataRepository historicalDataRepository;

    @Autowired
    private MLService mlService;

    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return password;
        }
    }

    @Override
    public void run(String... args) throws Exception {
        // 1. Seed Users
        if (userRepository.count() == 0) {
            User admin = new User("admin", hashPassword("admin123"), "admin@busstop.com", "ADMIN");
            User passenger = new User("passenger", hashPassword("passenger123"), "passenger@busstop.com", "PASSENGER");
            userRepository.save(admin);
            userRepository.save(passenger);
            System.out.println("Seeded Users: admin/admin123, passenger/passenger123");
        }

        // 2. Seed Bus Stops from data/bus_stops.csv if exists
        java.io.File stopsCsv = new java.io.File("data/bus_stops.csv");
        List<BusStop> stops = new ArrayList<>();
        if (busStopRepository.count() == 0) {
            if (stopsCsv.exists()) {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(stopsCsv, StandardCharsets.UTF_8))) {
                    String line;
                    boolean header = true;
                    while ((line = reader.readLine()) != null) {
                        if (line.trim().isEmpty()) continue;
                        if (header) { header = false; continue; }
                        String[] tokens = line.split(",");
                        if (tokens.length >= 6) {
                            String name = tokens[1].trim();
                            double lat = Double.parseDouble(tokens[3].trim());
                            double lng = Double.parseDouble(tokens[4].trim());
                            int cap = 60; // default capacity
                            stops.add(new BusStop(name, lat, lng, cap));
                        }
                    }
                    stops = busStopRepository.saveAll(stops);
                    System.out.println("Seeded " + stops.size() + " Bus Stops from data/bus_stops.csv");
                } catch (Exception e) {
                    System.err.println("Error reading bus_stops.csv: " + e.getMessage());
                }
            }

            if (stops.isEmpty()) {
                stops.add(new BusStop("Koyambedu CMBT", 13.0674, 80.2057, 100));
                stops.add(new BusStop("Guindy Hub", 13.0067, 80.2206, 80));
                stops.add(new BusStop("Central Station Stop", 13.0827, 80.2707, 75));
                stops.add(new BusStop("T. Nagar Depot", 13.0319, 80.2314, 70));
                stops.add(new BusStop("Tambaram Stand", 12.9249, 80.1218, 90));
                stops.add(new BusStop("Adyar Depot", 13.0063, 80.2575, 60));
                stops.add(new BusStop("Velachery Stand", 12.9758, 80.2205, 65));
                stops.add(new BusStop("Broadway Terminus", 13.0894, 80.2878, 85));
                stops = busStopRepository.saveAll(stops);
                System.out.println("Seeded 8 Default Bus Stops");
            }
        } else {
            stops = busStopRepository.findAll();
        }

        // 3. Seed Routes from data/routes.csv if exists
        java.io.File routesCsv = new java.io.File("data/routes.csv");
        if (routeRepository.count() == 0 && !stops.isEmpty()) {
            if (routesCsv.exists()) {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(routesCsv, StandardCharsets.UTF_8))) {
                    String line;
                    boolean header = true;
                    List<Route> routesToSave = new ArrayList<>();
                    int idx = 0;
                    while ((line = reader.readLine()) != null) {
                        if (line.trim().isEmpty()) continue;
                        if (header) { header = false; continue; }
                        String[] tokens = line.split(",");
                        if (tokens.length >= 5) {
                            String routeNum = tokens[1].trim();
                            String routeName = tokens[2].trim();
                            BusStop start = stops.get(idx % stops.size());
                            BusStop end = stops.get((idx + 3) % stops.size());
                            routesToSave.add(new Route(routeNum, routeName, start, end));
                            idx++;
                        }
                    }
                    routeRepository.saveAll(routesToSave);
                    System.out.println("Seeded " + routesToSave.size() + " Routes from data/routes.csv");
                } catch (Exception e) {
                    System.err.println("Error reading routes.csv: " + e.getMessage());
                }
            }

            if (routeRepository.count() == 0 && stops.size() >= 5) {
                routeRepository.save(new Route("101", "CMBT-Guindy Express", stops.get(0), stops.get(1)));
                routeRepository.save(new Route("202", "Central-T.Nagar Connector", stops.get(2), stops.get(3)));
                routeRepository.save(new Route("303", "Tambaram-CMBT Link", stops.get(4), stops.get(0)));
                System.out.println("Seeded 3 Default Routes");
            }
        }

        // 4. Seed Historical Data from data/historical_occupancy.csv if exists
        java.io.File occCsv = new java.io.File("data/historical_occupancy.csv");
        if (historicalDataRepository.count() == 0 && !stops.isEmpty()) {
            List<HistoricalData> historicalRecords = new ArrayList<>();
            if (occCsv.exists()) {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(occCsv, StandardCharsets.UTF_8))) {
                    String line;
                    boolean header = true;
                    int lineCount = 0;
                    while ((line = reader.readLine()) != null && lineCount < 3000) { // import first 3000 for fast startup
                        if (line.trim().isEmpty()) continue;
                        if (header) { header = false; continue; }
                        String[] tokens = line.split(",");
                        if (tokens.length >= 17) {
                            try {
                                LocalDate date = LocalDate.parse(tokens[1].trim());
                                int hour = Integer.parseInt(tokens[6].trim());
                                int dayOfWeek = Integer.parseInt(tokens[7].trim()) + 1; // 1-7 Mon-Sun
                                if (dayOfWeek > 7) dayOfWeek = 7;
                                boolean isWeekend = tokens[9].trim().equals("1");
                                boolean isHoliday = tokens[10].trim().equals("1");
                                String weather = tokens[12].trim().toUpperCase();
                                if (weather.contains("RAIN")) weather = "RAINY";
                                else if (weather.contains("CLEAR")) weather = "SUNNY";
                                else weather = "CLOUDY";

                                int busCapacity = Integer.parseInt(tokens[15].trim());
                                int passengers = Integer.parseInt(tokens[16].trim());

                                BusStop stop = stops.get(lineCount % stops.size());
                                double pct = ((double) passengers / busCapacity) * 100.0;
                                String level = pct < 35.0 ? "LOW" : (pct <= 70.0 ? "MEDIUM" : "HIGH");

                                historicalRecords.add(new HistoricalData(stop, date, hour, dayOfWeek, weather, isHoliday, isWeekend, false, passengers, pct, level));
                                lineCount++;
                            } catch (Exception ex) {}
                        }
                    }
                    historicalDataRepository.saveAll(historicalRecords);
                    System.out.println("Seeded " + historicalRecords.size() + " Historical Records from data/historical_occupancy.csv");
                } catch (Exception e) {
                    System.err.println("Error reading historical_occupancy.csv: " + e.getMessage());
                }
            }

            if (historicalRecords.isEmpty()) {
                Random rand = new Random(42);
                String[] weathers = {"SUNNY", "RAINY", "CLOUDY", "SNOWY"};
                LocalDate startDate = LocalDate.now().minusDays(15);
                int[] hours = {8, 9, 12, 13, 17, 18, 20};

                for (BusStop stop : stops) {
                    int capacity = stop.getCapacity();
                    for (int dayOffset = 0; dayOffset < 15; dayOffset++) {
                        LocalDate date = startDate.plusDays(dayOffset);
                        int dayOfWeek = date.getDayOfWeek().getValue();
                        boolean weekend = (dayOfWeek == 6 || dayOfWeek == 7);
                        boolean holiday = (dayOffset == 4 || dayOffset == 11);

                        for (int hour : hours) {
                            double baseCount = (hour == 8 || hour == 17) ? capacity * 0.7 : ((hour == 9 || hour == 18) ? capacity * 0.6 : (hour == 12 || hour == 13 ? capacity * 0.4 : capacity * 0.2));
                            String weather = weathers[rand.nextInt(weathers.length)];
                            if (weather.equals("RAINY")) baseCount += capacity * 0.1;
                            boolean event = rand.nextDouble() < 0.1;
                            if (event) baseCount += capacity * 0.25;
                            if (weekend || holiday) baseCount *= 0.6;

                            int finalCount = (int) Math.round(baseCount + (rand.nextGaussian() * (capacity * 0.08)));
                            if (finalCount < 2) finalCount = rand.nextInt(3) + 2;
                            if (finalCount > capacity) finalCount = capacity;

                            double pct = ((double) finalCount / capacity) * 100.0;
                            String level = pct < 35.0 ? "LOW" : (pct <= 70.0 ? "MEDIUM" : "HIGH");

                            historicalRecords.add(new HistoricalData(stop, date, hour, dayOfWeek, weather, holiday, weekend, event, finalCount, pct, level));
                        }
                    }
                }
                historicalDataRepository.saveAll(historicalRecords);
                System.out.println("Seeded " + historicalRecords.size() + " Default Historical Records.");
            }

            // 5. Auto-Train AI Models immediately after seeding!
            try {
                String trainingResult = mlService.trainModels();
                System.out.println("Auto-training ML models on startup: " + trainingResult);
            } catch (Exception e) {
                System.err.println("Startup ML training failed: " + e.getMessage());
            }
        }

        System.out.println("\n=================================================================");
        System.out.println(" 🚀 APPLICATION STARTED SUCCESSFULLY!");
        System.out.println(" 🌐 ACCESS SITE HERE : http://localhost:8080");
        System.out.println(" 🗄️ H2 DB CONSOLE    : http://localhost:8080/h2-console");
        System.out.println("=================================================================\n");
    }
}

