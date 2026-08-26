package com.busstop.predictor.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "feedback")
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "prediction_id", nullable = false)
    private Prediction prediction;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "actual_occupancy_level", nullable = false, length = 10)
    private String actualOccupancyLevel; // "LOW", "MEDIUM", "HIGH"

    @Column(nullable = false)
    private Integer rating; // 1 - 5 stars

    @Column(length = 500)
    private String comments;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Feedback() {}

    public Feedback(Prediction prediction, User user, String actualOccupancyLevel, Integer rating, String comments) {
        this.prediction = prediction;
        this.user = user;
        this.actualOccupancyLevel = actualOccupancyLevel;
        this.rating = rating;
        this.comments = comments;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Prediction getPrediction() { return prediction; }
    public void setPrediction(Prediction prediction) { this.prediction = prediction; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getActualOccupancyLevel() { return actualOccupancyLevel; }
    public void setActualOccupancyLevel(String actualOccupancyLevel) { this.actualOccupancyLevel = actualOccupancyLevel; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
