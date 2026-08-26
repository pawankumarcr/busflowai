package com.busstop.predictor.controller;

import com.busstop.predictor.model.Feedback;
import com.busstop.predictor.model.Prediction;
import com.busstop.predictor.model.User;
import com.busstop.predictor.repository.FeedbackRepository;
import com.busstop.predictor.repository.PredictionRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private PredictionRepository predictionRepository;

    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestBody Map<String, Object> request, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Login required to submit feedback"));
        }

        Number predictionIdNum = (Number) request.get("predictionId");
        String actualOccupancyLevel = (String) request.get("actualOccupancyLevel");
        Number ratingNum = (Number) request.get("rating");
        String comments = (String) request.get("comments");

        if (predictionIdNum == null || actualOccupancyLevel == null || ratingNum == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Missing required feedback fields"));
        }

        Optional<Prediction> predOpt = predictionRepository.findById(predictionIdNum.longValue());
        if (predOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Prediction record not found"));
        }

        Feedback feedback = new Feedback(
                predOpt.get(),
                user,
                actualOccupancyLevel,
                ratingNum.intValue(),
                comments
        );
        feedbackRepository.save(feedback);

        return ResponseEntity.ok(feedback);
    }

    @GetMapping
    public List<Feedback> getAllFeedback() {
        List<Feedback> all = feedbackRepository.findAll();
        all.sort((a, b) -> b.getId().compareTo(a.getId()));
        return all;
    }
}
