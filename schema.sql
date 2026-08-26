-- ========================================================
-- DATABASE SCHEMA: BUS STOP OCCUPANCY PREDICTOR (MYSQL)
-- ========================================================

-- CREATE DATABASE (If deploying manually)
-- CREATE DATABASE IF NOT EXISTS bus_stop_predictor;
-- USE bus_stop_predictor;

-- 1. Users Table (Handles Admins and Passengers)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL, -- 'ADMIN' or 'PASSENGER'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bus Stops Table
CREATE TABLE IF NOT EXISTS bus_stops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    capacity INT NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Routes Table (Transit paths between stops)
CREATE TABLE IF NOT EXISTS routes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    route_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    start_stop_id BIGINT,
    end_stop_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_route_start_stop FOREIGN KEY (start_stop_id) REFERENCES bus_stops(id) ON DELETE SET NULL,
    CONSTRAINT fk_route_end_stop FOREIGN KEY (end_stop_id) REFERENCES bus_stops(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Historical Data Table (CSV imports and training store)
CREATE TABLE IF NOT EXISTS historical_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bus_stop_id BIGINT NOT NULL,
    date DATE NOT NULL,
    time_of_day INT NOT NULL, -- Hour (0-23)
    day_of_week INT NOT NULL, -- 1 (Monday) to 7 (Sunday)
    weather VARCHAR(20) NOT NULL, -- 'SUNNY', 'RAINY', 'CLOUDY', 'SNOWY'
    holiday BOOLEAN NOT NULL DEFAULT FALSE,
    weekend BOOLEAN NOT NULL DEFAULT FALSE,
    event BOOLEAN NOT NULL DEFAULT FALSE,
    passenger_count INT NOT NULL,
    occupancy_percentage DOUBLE NOT NULL,
    occupancy_level VARCHAR(10) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
    CONSTRAINT fk_historical_bus_stop FOREIGN KEY (bus_stop_id) REFERENCES bus_stops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Predictions Log Table
CREATE TABLE IF NOT EXISTS predictions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bus_stop_id BIGINT NOT NULL,
    target_date DATE NOT NULL,
    time_of_day INT NOT NULL,
    day_of_week INT NOT NULL,
    weather VARCHAR(20) NOT NULL,
    holiday BOOLEAN NOT NULL DEFAULT FALSE,
    weekend BOOLEAN NOT NULL DEFAULT FALSE,
    event BOOLEAN NOT NULL DEFAULT FALSE,
    predicted_passenger_count DOUBLE NOT NULL,
    predicted_occupancy_percentage DOUBLE NOT NULL,
    predicted_occupancy_level VARCHAR(10) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
    confidence_score DOUBLE NOT NULL, -- e.g., 85.0
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prediction_bus_stop FOREIGN KEY (bus_stop_id) REFERENCES bus_stops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Feedback Table (Passenger rating of prediction accuracies)
CREATE TABLE IF NOT EXISTS feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prediction_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    actual_occupancy_level VARCHAR(10) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
    rating INT NOT NULL, -- 1 to 5 stars
    comments VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedback_prediction FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
