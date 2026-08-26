package com.busstop.predictor.controller;

import com.busstop.predictor.model.BusStop;
import com.busstop.predictor.model.User;
import com.busstop.predictor.repository.BusStopRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stops")
public class BusStopController {

    @Autowired
    private BusStopRepository busStopRepository;

    private boolean isAdmin(HttpSession session) {
        User user = (User) session.getAttribute("user");
        return user != null && "ADMIN".equals(user.getRole());
    }

    @GetMapping
    public List<BusStop> getAllStops() {
        return busStopRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<BusStop> getStopById(@PathVariable Long id) {
        return busStopRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createStop(@RequestBody BusStop stop, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        if (stop.getName() == null || stop.getName().trim().isEmpty() ||
            stop.getLatitude() == null || stop.getLongitude() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid bus stop data"));
        }
        if (stop.getCapacity() == null || stop.getCapacity() <= 0) {
            stop.setCapacity(50);
        }
        BusStop saved = busStopRepository.save(stop);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateStop(@PathVariable Long id, @RequestBody BusStop updatedStop, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        return busStopRepository.findById(id)
                .map(stop -> {
                    if (updatedStop.getName() != null) stop.setName(updatedStop.getName());
                    if (updatedStop.getLatitude() != null) stop.setLatitude(updatedStop.getLatitude());
                    if (updatedStop.getLongitude() != null) stop.setLongitude(updatedStop.getLongitude());
                    if (updatedStop.getCapacity() != null && updatedStop.getCapacity() > 0) {
                        stop.setCapacity(updatedStop.getCapacity());
                    }
                    busStopRepository.save(stop);
                    return ResponseEntity.ok(stop);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStop(@PathVariable Long id, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin privileges required"));
        }
        if (!busStopRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        busStopRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Bus stop deleted successfully"));
    }
}
