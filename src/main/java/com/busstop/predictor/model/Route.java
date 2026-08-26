package com.busstop.predictor.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "routes")
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "route_number", nullable = false, unique = true, length = 20)
    private String routeNumber;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "start_stop_id", referencedColumnName = "id")
    private BusStop startStop;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "end_stop_id", referencedColumnName = "id")
    private BusStop endStop;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Route() {}

    public Route(String routeNumber, String name, BusStop startStop, BusStop endStop) {
        this.routeNumber = routeNumber;
        this.name = name;
        this.startStop = startStop;
        this.endStop = endStop;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRouteNumber() { return routeNumber; }
    public void setRouteNumber(String routeNumber) { this.routeNumber = routeNumber; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BusStop getStartStop() { return startStop; }
    public void setStartStop(BusStop startStop) { this.startStop = startStop; }

    public BusStop getEndStop() { return endStop; }
    public void setEndStop(BusStop endStop) { this.endStop = endStop; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
