# Bus Stop Occupancy Predictor

TransitFlow AI is a Java and machine learning-powered web application that predicts passenger occupancy levels at bus stops. It helps transit authorities manage fleets/routes and enables passengers to plan travel times with lower congestion.

## Features

### Admin Portal
* **Secure Session Login:** Dual-role authentication.
* **Overview Analytics Dashboard:** Visual KPIs (Total bus stops, active routes, historical records, predictions count), hourly occupancy charts, weekly bar charts, and peak hours.
* **Bus Stop & Route CRUD:** Full creation and modification of active transit nodes and routes.
* **Historical CSV Uploader:** Import historical CSV records to dynamically feed the ML model.
* **ML Model Training Panel:** Direct integration with Weka to train **Random Forest**, **Decision Tree (REPTree)**, and **Linear Regression** algorithms, displaying accuracy metrics (RMSE, MAE, R², Accuracy %) comparisons.
* **CSV Report Generation:** Export full transit audits (stops, routes, feedback logs) in a structured CSV report.

### Passenger Portal
* **Trip Occupancy Predictor:** Select bus stop, date, time, weather, and holiday/event factors to query predicted passenger congestion.
* **Visual Congestion Indicators:** Color-coded badges indicating occupancy levels:
  * **LOW:** < 35% capacity (Green)
  * **MEDIUM:** 35% - 70% capacity (Yellow)
  * **HIGH:** > 70% capacity (Red)
* **Confidence Scores:** Model-accuracy relative to stop capacities.
* **Alternative Travel Time Suggestions:** Identifies less crowded travel hours within ±2 hours of the requested trip.
* **Nearby Stop Search:** Quick textual search of available stops.
* **Feedback Collection System:** Submit actual conditions to continuously evaluate prediction performance.

---

## Technical Stack
* **Backend:** Java 17+, Spring Boot 3.2.5, Spring Data JPA.
* **Machine Learning:** Weka stable 3.8.6 (Random Forest, REPTree, Linear Regression).
* **Database:** Default in-memory H2 database (zero setup required). Ready configuration for MySQL.
* **Frontend:** Single Page Application (SPA) using HTML5, Vanilla CSS, Vanilla JS, Lucide Icons, and Chart.js.

---

## Getting Started

### Prerequisites
* Java JDK 17 or higher
* Internet connection (for initial Gradle wrapper download and CDNs)

### Running the Application
1. In the project directory, run the boot task:
   ```bash
   # Windows
   .\gradlew.bat bootRun
   
   # macOS / Linux
   ./gradlew bootRun
   ```
2. Open your browser and navigate to:
   [http://localhost:8080](http://localhost:8080)

### Seed Accounts
The application automatically seeds sample data on startup (stops, routes, 300+ historical records) so it is immediately operational. Use the following default accounts to log in:
* **Administrator:**
  * **Username:** `admin`
  * **Password:** `admin123`
* **Passenger:**
  * **Username:** `passenger`
  * **Password:** `passenger123`

---

## Database Configuration (Optional MySQL)
To switch to MySQL in production:
1. Open [src/main/resources/application.properties](file:///c:/Users/pawan/projectjava/src/main/resources/application.properties).
2. Comment out the **H2 Database** section.
3. Uncomment the **MySQL Database** section and update your credentials:
   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/bus_stop_predictor?createDatabaseIfNotExist=true
   spring.datasource.username=your_username
   spring.datasource.password=your_password
   ```
4. If setting up manually, you can execute the SQL DDL statements located in [schema.sql](file:///c:/Users/pawan/Documents/bus-stop-predictor-30percent/schema.sql).

---

## Deployment Guide

### Option 1: Docker & Docker Compose (Recommended)

To run the containerized application using Docker:

1. **Build and start the container:**
   ```bash
   docker compose up --build -d
   ```
2. **Access the application:**
   - Web App: [http://localhost:8080](http://localhost:8080)
   - H2 Console: [http://localhost:8080/h2-console](http://localhost:8080/h2-console)

3. **Stop the container:**
   ```bash
   docker compose down
   ```

### Option 2: Standalone Production Executable JAR

1. **Build the production JAR package:**
   ```bash
   # Windows
   .\gradlew.bat bootJar

   # Linux / macOS
   ./gradlew bootJar
   ```
2. **Run the generated executable JAR:**
   ```bash
   java -jar build/libs/predictor-0.0.1-SNAPSHOT.jar
   ```

### Option 3: Cloud Container Hosting (Render, Railway, Fly.io, AWS)

The application includes a production-grade multi-stage `Dockerfile` (Java 21 JDK builder + Java 21 JRE runner). You can connect this GitHub repository directly to services like:
- **Render**: Connect repository, set build command to Docker runtime.
- **Railway**: Deploy via Dockerfile automatically.
- **Fly.io**: Run `fly launch` and select the included `Dockerfile`.
- **AWS App Runner / ECS**: Push container image to ECR and launch.

