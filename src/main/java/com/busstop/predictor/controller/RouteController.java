package com.busstop.predictor.controller;

import com.busstop.predictor.model.BusStop;
import com.busstop.predictor.model.Route;
import com.busstop.predictor.model.User;
import com.busstop.predictor.repository.BusStopRepository;
import com.busstop.predictor.repository.RouteRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    @Autowired
    private RouteRepository routeRepository;

    @Autowired
    private BusStopRepository busStopRepository;

    private boolean isAdmin(HttpSession session) {
        User user = (User) session.getAttribute("user");
        return user != null && "ADMIN".equals(user.getRole());
    }

    @GetMapping
    public List<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Route> getRouteById(@PathVariable Long id) {
        return routeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createRoute(@RequestBody Map<String, Object> request, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }

        String routeNumber = (String) request.get("routeNumber");
        String name = (String) request.get("name");
        Number startStopIdNum = (Number) request.get("startStopId");
        Number endStopIdNum = (Number) request.get("endStopId");

        if (routeNumber == null || routeNumber.trim().isEmpty() ||
            name == null || name.trim().isEmpty() ||
            startStopIdNum == null || endStopIdNum == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid route data"));
        }

        Optional<BusStop> startStopOpt = busStopRepository.findById(startStopIdNum.longValue());
        Optional<BusStop> endStopOpt = busStopRepository.findById(endStopIdNum.longValue());

        if (startStopOpt.isEmpty() || endStopOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Start or end bus stop not found"));
        }

        Route route = new Route(routeNumber, name, startStopOpt.get(), endStopOpt.get());
        Route saved = routeRepository.save(route);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateRoute(@PathVariable Long id, @RequestBody Map<String, Object> request, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }

        return routeRepository.findById(id)
                .map(route -> {
                    String routeNumber = (String) request.get("routeNumber");
                    String name = (String) request.get("name");
                    Number startStopIdNum = (Number) request.get("startStopId");
                    Number endStopIdNum = (Number) request.get("endStopId");

                    if (routeNumber != null) route.setRouteNumber(routeNumber);
                    if (name != null) route.setName(name);

                    if (startStopIdNum != null) {
                        Optional<BusStop> stop = busStopRepository.findById(startStopIdNum.longValue());
                        stop.ifPresent(route::setStartStop);
                    }

                    if (endStopIdNum != null) {
                        Optional<BusStop> stop = busStopRepository.findById(endStopIdNum.longValue());
                        stop.ifPresent(route::setEndStop);
                    }

                    routeRepository.save(route);
                    return ResponseEntity.ok(route);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRoute(@PathVariable Long id, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        if (!routeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        routeRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Route deleted successfully"));
    }
}
