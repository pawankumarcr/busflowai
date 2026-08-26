package com.busstop.predictor.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "predictions")
public class Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "bus_stop_id", nullable = false)
    private BusStop busStop;

    @Column(name = "target_date", nullable = false)
    private LocalDate targetDate;

    @Column(name = "time_of_day", nullable = false)
    private Integer timeOfDay; // Hour (0-23)

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek; // 1 = Monday, 7 = Sunday

    @Column(nullable = false, length = 20)
    private String weather; // "SUNNY", "RAINY", "CLOUDY", "SNOWY"

    @Column(nullable = false)
    private Boolean holiday = false;

    @Column(nullable = false)
    private Boolean weekend = false;

    @Column(nullable = false)
    private Boolean event = false;

    @Column(name = "predicted_passenger_count", nullable = false)
    private Double predictedPassengerCount;

    @Column(name = "predicted_occupancy_percentage", nullable = false)
    private Double predictedOccupancyPercentage;

    @Column(name = "predicted_occupancy_level", nullable = false, length = 10)
    private String predictedOccupancyLevel; // "LOW", "MEDIUM", "HIGH"

    @Column(name = "confidence_score", nullable = false)
    private Double confidenceScore; // percentage (e.g. 0.85 for 85%)

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Prediction() {}

    public Prediction(BusStop busStop, LocalDate targetDate, Integer timeOfDay, Integer dayOfWeek,
                      String weather, Boolean holiday, Boolean weekend, Boolean event,
                      Double predictedPassengerCount, Double predictedOccupancyPercentage,
                      String predictedOccupancyLevel, Double confidenceScore) {
        this.busStop = busStop;
        this.targetDate = targetDate;
        this.timeOfDay = timeOfDay;
        this.dayOfWeek = dayOfWeek;
        this.weather = weather;
        this.holiday = holiday;
        this.weekend = weekend;
        this.event = event;
        this.predictedPassengerCount = predictedPassengerCount;
        this.predictedOccupancyPercentage = predictedOccupancyPercentage;
        this.predictedOccupancyLevel = predictedOccupancyLevel;
        this.confidenceScore = confidenceScore;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public BusStop getBusStop() { return busStop; }
    public void setBusStop(BusStop busStop) { this.busStop = busStop; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }

    public Integer getTimeOfDay() { return timeOfDay; }
    public void setTimeOfDay(Integer timeOfDay) { this.timeOfDay = timeOfDay; }

    public Integer getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public String getWeather() { return weather; }
    public void setWeather(String weather) { this.weather = weather; }

    public Boolean getHoliday() { return holiday; }
    public void setHoliday(Boolean holiday) { this.holiday = holiday; }

    public Boolean getWeekend() { return weekend; }
    public void setWeekend(Boolean weekend) { this.weekend = weekend; }

    public Boolean getEvent() { return event; }
    public void setEvent(Boolean event) { this.event = event; }

    public Double getPredictedPassengerCount() { return predictedPassengerCount; }
    public void setPredictedPassengerCount(Double predictedPassengerCount) { this.predictedPassengerCount = predictedPassengerCount; }

    public Double getPredictedOccupancyPercentage() { return predictedOccupancyPercentage; }
    public void setPredictedOccupancyPercentage(Double predictedOccupancyPercentage) { this.predictedOccupancyPercentage = predictedOccupancyPercentage; }

    public String getPredictedOccupancyLevel() { return predictedOccupancyLevel; }
    public void setPredictedOccupancyLevel(String predictedOccupancyLevel) { this.predictedOccupancyLevel = predictedOccupancyLevel; }

    public Double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
