package com.busstop.predictor.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "historical_data")
public class HistoricalData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "bus_stop_id", nullable = false)
    private BusStop busStop;

    @Column(nullable = false)
    private LocalDate date;

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

    @Column(name = "passenger_count", nullable = false)
    private Integer passengerCount;

    @Column(name = "occupancy_percentage", nullable = false)
    private Double occupancyPercentage;

    @Column(name = "occupancy_level", nullable = false, length = 10)
    private String occupancyLevel; // "LOW", "MEDIUM", "HIGH"

    public HistoricalData() {}

    public HistoricalData(BusStop busStop, LocalDate date, Integer timeOfDay, Integer dayOfWeek,
                          String weather, Boolean holiday, Boolean weekend, Boolean event,
                          Integer passengerCount, Double occupancyPercentage, String occupancyLevel) {
        this.busStop = busStop;
        this.date = date;
        this.timeOfDay = timeOfDay;
        this.dayOfWeek = dayOfWeek;
        this.weather = weather;
        this.holiday = holiday;
        this.weekend = weekend;
        this.event = event;
        this.passengerCount = passengerCount;
        this.occupancyPercentage = occupancyPercentage;
        this.occupancyLevel = occupancyLevel;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public BusStop getBusStop() { return busStop; }
    public void setBusStop(BusStop busStop) { this.busStop = busStop; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

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

    public Integer getPassengerCount() { return passengerCount; }
    public void setPassengerCount(Integer passengerCount) { this.passengerCount = passengerCount; }

    public Double getOccupancyPercentage() { return occupancyPercentage; }
    public void setOccupancyPercentage(Double occupancyPercentage) { this.occupancyPercentage = occupancyPercentage; }

    public String getOccupancyLevel() { return occupancyLevel; }
    public void setOccupancyLevel(String occupancyLevel) { this.occupancyLevel = occupancyLevel; }
}
