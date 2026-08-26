import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# ==========================================
# SETUP & CONFIGURATION
# ==========================================
np.random.seed(42)
random.seed(42)

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

START_DATE = datetime(2025, 1, 1)
END_DATE = datetime(2025, 12, 31)
DATES = pd.date_range(start=START_DATE, end=END_DATE, freq='D')

NUM_STOPS = 50
NUM_ROUTES = 20
NUM_BUSES = 60
TARGET_OCCUPANCY_RECORDS = 60000 

print(f"Generating synthetic datasets in './{DATA_DIR}'...")

# ==========================================
# 1. BUS STOPS
# ==========================================
stop_types = ['residential', 'commercial', 'railway', 'metro', 'educational', 'hospital', 'interchange']
areas = ['Adyar', 'T. Nagar', 'Velachery', 'Guindy', 'Tambaram', 'Anna Nagar', 'Mylapore', 'OMR', 'Porur', 'Egmore']

bus_stops = pd.DataFrame({
    'bus_stop_id': [f'BS{str(i).zfill(3)}' for i in range(1, NUM_STOPS + 1)],
    'bus_stop_name': [f"Synthetic {random.choice(areas)} Stop {i}" for i in range(1, NUM_STOPS + 1)],
    'area': [random.choice(areas) for _ in range(NUM_STOPS)],
    'latitude': np.round(np.random.uniform(12.8, 13.2, NUM_STOPS), 6),
    'longitude': np.round(np.random.uniform(80.1, 80.3, NUM_STOPS), 6),
    'stop_type': np.random.choice(stop_types, NUM_STOPS),
    'daily_average_passengers': np.random.randint(100, 2500, NUM_STOPS),
    'operating_status': 'ACTIVE'
})
bus_stops.to_csv(f"{DATA_DIR}/bus_stops.csv", index=False)

# ==========================================
# 2. ROUTES
# ==========================================
routes = pd.DataFrame({
    'route_id': [f'R{str(i).zfill(2)}' for i in range(1, NUM_ROUTES + 1)],
    'route_number': [f"{np.random.randint(1, 99)}{random.choice(['A', 'B', 'M', ''])}" for _ in range(NUM_ROUTES)],
    'route_name': [f"Route {i} (Synthetic)" for i in range(1, NUM_ROUTES + 1)],
    'source': [random.choice(areas) for _ in range(NUM_ROUTES)],
    'destination': [random.choice(areas) for _ in range(NUM_ROUTES)],
    'distance_km': np.round(np.random.uniform(8.0, 35.0, NUM_ROUTES), 1),
    'average_travel_time_min': np.random.randint(30, 120, NUM_ROUTES),
    'operating_start': '05:00',
    'operating_end': '23:00',
    'status': 'ACTIVE'
})
# Ensure source and destination aren't the same
routes['destination'] = routes.apply(lambda row: row['destination'] if row['source'] != row['destination'] else random.choice(areas), axis=1)
routes.to_csv(f"{DATA_DIR}/routes.csv", index=False)

# ==========================================
# 3. BUSES
# ==========================================
bus_types = ['ordinary', 'express', 'AC']
buses = pd.DataFrame({
    'bus_id': [f'B{str(i).zfill(3)}' for i in range(1, NUM_BUSES + 1)],
    'registration_number': [f"TN-01-SY-{np.random.randint(1000, 9999)}" for _ in range(NUM_BUSES)],
    'route_id': np.random.choice(routes['route_id'], NUM_BUSES),
    'bus_type': np.random.choice(bus_types, NUM_BUSES, p=[0.5, 0.3, 0.2]),
    'manufacture_year': np.random.randint(2015, 2024, NUM_BUSES),
    'status': 'ACTIVE'
})
buses['bus_capacity'] = buses['bus_type'].map({'ordinary': 50, 'express': 55, 'AC': 40})
buses.to_csv(f"{DATA_DIR}/buses.csv", index=False)

# ==========================================
# 4. ROUTE BUS STOP MAPPING
# ==========================================
route_stop_records = []
for r_id in routes['route_id']:
    num_stops_on_route = np.random.randint(8, 18)
    route_stops = np.random.choice(bus_stops['bus_stop_id'], num_stops_on_route, replace=False)
    dist = 0.0
    for seq, bs_id in enumerate(route_stops, start=1):
        route_stop_records.append({
            'route_id': r_id,
            'bus_stop_id': bs_id,
            'stop_sequence': seq,
            'distance_from_origin_km': round(dist, 1)
        })
        dist += np.random.uniform(0.8, 2.5)

route_bus_stops = pd.DataFrame(route_stop_records)
route_bus_stops.to_csv(f"{DATA_DIR}/route_bus_stops.csv", index=False)

# Pre-map route to stops dictionary for fast lookup
route_to_stops = route_bus_stops.groupby('route_id')['bus_stop_id'].apply(list).to_dict()

# ==========================================
# 6. HOLIDAYS (Generating before Occupancy to use it)
# ==========================================
holiday_dates = random.sample(list(DATES), 15)
holidays = pd.DataFrame({
    'holiday_id': [f'H{str(i).zfill(3)}' for i in range(1, len(holiday_dates) + 1)],
    'date': [d.strftime('%Y-%m-%d') for d in holiday_dates],
    'holiday_name': [f"Synthetic Holiday {i}" for i in range(1, len(holiday_dates) + 1)],
    'holiday_type': np.random.choice(['public_holiday', 'festival', 'national_holiday'], len(holiday_dates)),
    'expected_demand_effect': np.round(np.random.uniform(0.5, 0.9), 2) # Drops demand usually
})
holidays.to_csv(f"{DATA_DIR}/holidays.csv", index=False)

# ==========================================
# 7. WEATHER (Generating before Occupancy)
# ==========================================
weather = pd.DataFrame({
    'weather_id': [f'W{str(i).zfill(3)}' for i in range(1, len(DATES) + 1)],
    'date': DATES.strftime('%Y-%m-%d'),
    'temperature': np.round(np.random.uniform(25.0, 40.0, len(DATES)), 1),
    'humidity': np.random.randint(40, 95, len(DATES)),
    'rainfall_mm': np.where(np.random.rand(len(DATES)) > 0.8, np.round(np.random.uniform(5, 50, len(DATES)), 1), 0),
})
def get_condition(rain):
    if rain > 20: return 'heavy_rain'
    if rain > 0: return 'light_rain'
    return random.choice(['clear', 'cloudy'])
weather['weather_condition'] = weather['rainfall_mm'].apply(get_condition)
weather['wind_speed'] = np.round(np.random.uniform(5, 25, len(DATES)), 1)
weather.to_csv(f"{DATA_DIR}/weather.csv", index=False)

# ==========================================
# 5. HISTORICAL OCCUPANCY
# ==========================================
timestamps = []
for _ in range(TARGET_OCCUPANCY_RECORDS):
    r_date = random.choice(DATES)
    r_hour = np.random.randint(5, 23)
    r_min = np.random.randint(0, 59)
    timestamps.append(pd.Timestamp(r_date) + pd.Timedelta(hours=r_hour, minutes=r_min))

occ = pd.DataFrame({'datetime': timestamps})
occ['date'] = occ['datetime'].dt.strftime('%Y-%m-%d')
occ['time'] = occ['datetime'].dt.strftime('%H:%M:%S')
occ['hour'] = occ['datetime'].dt.hour
occ['day_of_week'] = occ['datetime'].dt.dayofweek
occ['month'] = occ['datetime'].dt.month
occ['is_weekend'] = occ['day_of_week'].isin([5, 6]).astype(int)

# Merge mappings
occ['bus_id'] = np.random.choice(buses['bus_id'], len(occ))
occ = occ.merge(buses[['bus_id', 'route_id', 'bus_capacity']], on='bus_id', how='left')

# Fast lookup for bus_stop_id
occ['bus_stop_id'] = occ['route_id'].apply(lambda r_id: random.choice(route_to_stops[r_id]) if r_id in route_to_stops and route_to_stops[r_id] else None)

occ = occ.merge(holidays[['date', 'expected_demand_effect']], on='date', how='left')
occ['is_holiday'] = occ['expected_demand_effect'].notna().astype(int)
occ['expected_demand_effect'] = occ['expected_demand_effect'].fillna(1.0)

occ = occ.merge(weather[['date', 'weather_condition', 'temperature', 'rainfall_mm']], on='date', how='left')
occ = occ.merge(bus_stops[['bus_stop_id', 'stop_type']], on='bus_stop_id', how='left')

# Peak Hours: 7-10 AM, 5-8 PM
occ['is_peak_hour'] = occ['hour'].isin([7, 8, 9, 17, 18, 19]).astype(int)

# GENERATING REALISTIC PASSENGER DEMAND
type_factor = {'railway': 1.0, 'metro': 0.9, 'commercial': 0.8, 'educational': 0.8, 'interchange': 1.0, 'residential': 0.5, 'hospital': 0.6}
occ['base_f'] = occ['stop_type'].map(type_factor)

occ['time_f'] = np.where(occ['is_peak_hour'] == 1, 1.3, 0.6)
occ.loc[occ['hour'] >= 21, 'time_f'] = 0.3

occ['week_f'] = np.where((occ['is_weekend'] == 1) & (occ['stop_type'] == 'educational'), 0.2, 1.0)
occ['week_f'] = np.where((occ['is_weekend'] == 1) & (occ['stop_type'] == 'commercial'), 1.2, occ['week_f'])

occ['weather_f'] = np.where(occ['weather_condition'] == 'heavy_rain', 0.7, 1.0)

occ['raw_passengers'] = (occ['bus_capacity'] * occ['base_f'] * occ['time_f'] * occ['week_f'] * occ['expected_demand_effect'] * occ['weather_f'])
occ['passengers'] = np.random.poisson(occ['raw_passengers'].clip(lower=1))
occ['passengers'] = np.minimum(occ['passengers'], (occ['bus_capacity'] * 1.3).astype(int))

occ['record_id'] = [f"OCC{str(i).zfill(6)}" for i in range(1, len(occ) + 1)]

occ = occ[['record_id', 'date', 'time', 'bus_stop_id', 'route_id', 'bus_id', 'hour', 'day_of_week', 
           'month', 'is_weekend', 'is_holiday', 'is_peak_hour', 'weather_condition', 'temperature', 
           'rainfall_mm', 'bus_capacity', 'passengers']]

occ.to_csv(f"{DATA_DIR}/historical_occupancy.csv", index=False)

# ==========================================
# 8. PREDICTION RECORDS
# ==========================================
preds = occ.sample(5000, random_state=42).copy()
preds['prediction_id'] = [f"PRD{str(i).zfill(5)}" for i in range(1, len(preds) + 1)]
preds['prediction_timestamp'] = pd.to_datetime(preds['date'] + ' ' + preds['time']) - pd.Timedelta(minutes=30)
preds.rename(columns={'date': 'requested_date', 'time': 'requested_time', 'passengers': 'actual_passengers'}, inplace=True)

error_margin = np.random.randint(-10, 11, len(preds))
preds['predicted_passengers'] = (preds['actual_passengers'] + error_margin).clip(lower=0)

preds['actual_occupancy_percentage'] = np.round((preds['actual_passengers'] / preds['bus_capacity']) * 100, 1)
preds['predicted_occupancy_percentage'] = np.round((preds['predicted_passengers'] / preds['bus_capacity']) * 100, 1)

def get_crowd_level(pct):
    if pct < 40: return 'LOW'
    if pct < 70: return 'MODERATE'
    if pct < 90: return 'HIGH'
    return 'VERY HIGH'

preds['predicted_crowd_level'] = preds['predicted_occupancy_percentage'].apply(get_crowd_level)
preds['model_version'] = np.random.choice(['v1.0', 'v1.1', 'v1.2', 'v1.3'], len(preds), p=[0.1, 0.2, 0.3, 0.4])

preds = preds[['prediction_id', 'prediction_timestamp', 'bus_stop_id', 'route_id', 'requested_date', 'requested_time', 
               'predicted_passengers', 'actual_passengers', 'bus_capacity', 'predicted_occupancy_percentage', 
               'actual_occupancy_percentage', 'predicted_crowd_level', 'model_version']]
preds.to_csv(f"{DATA_DIR}/prediction_records.csv", index=False)

# ==========================================
# 9. ML MODELS
# ==========================================
ml_models = pd.DataFrame({
    'model_id': ['M01', 'M02', 'M03', 'M04', 'M05'],
    'model_version': ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v2.0'],
    'model_name': ['Baseline RF', 'Tuned RF', 'Gradient Boosting', 'XGBoost Synthetic', 'Ensemble Net'],
    'algorithm': ['Random Forest', 'Random Forest', 'Gradient Boosting Regressor', 'XGBoost', 'Neural Network'],
    'training_date': ['2024-10-01', '2024-11-15', '2024-12-10', '2025-01-05', '2025-02-20'],
    'dataset_size': [25000, 30000, 45000, 60000, 60000],
    'feature_count': [8, 12, 14, 15, 18],
    'mae': [8.5, 7.2, 6.1, 5.5, 5.0],
    'rmse': [11.2, 9.8, 8.4, 7.6, 6.9],
    'r2_score': [0.72, 0.78, 0.84, 0.87, 0.90],
    'status': ['ARCHIVED', 'ARCHIVED', 'ARCHIVED', 'ACTIVE', 'IN_TRAINING']
})
ml_models.to_csv(f"{DATA_DIR}/ml_models.csv", index=False)

# ==========================================
# 10. BUS STOP DAILY SUMMARY
# ==========================================
bs_summary = occ.groupby(['date', 'bus_stop_id']).agg(
    total_passengers=('passengers', 'sum'),
    average_passengers=('passengers', 'mean'),
    maximum_passengers=('passengers', 'max'),
    minimum_passengers=('passengers', 'min'),
    peak_hour=('hour', lambda x: x.mode()[0] if not x.mode().empty else None),
).reset_index()

cap_df = occ.groupby(['date', 'bus_stop_id'])['bus_capacity'].mean().reset_index()
bs_summary = bs_summary.merge(cap_df, on=['date', 'bus_stop_id'])
bs_summary['average_occupancy_percentage'] = np.round((bs_summary['average_passengers'] / bs_summary['bus_capacity']) * 100, 1)
bs_summary.drop(columns=['bus_capacity'], inplace=True)
bs_summary['average_passengers'] = np.round(bs_summary['average_passengers'], 1)

bs_summary.to_csv(f"{DATA_DIR}/bus_stop_daily_summary.csv", index=False)

# ==========================================
# 11. ROUTE DAILY SUMMARY
# ==========================================
r_summary = occ.groupby(['date', 'route_id']).agg(
    total_passengers=('passengers', 'sum'),
    average_passengers=('passengers', 'mean'),
    peak_hour=('hour', lambda x: x.mode()[0] if not x.mode().empty else None),
).reset_index()

occ['occ_pct'] = (occ['passengers'] / occ['bus_capacity']) * 100
occ_pct_agg = occ.groupby(['date', 'route_id']).agg(
    average_occupancy_percentage=('occ_pct', 'mean'),
    maximum_occupancy_percentage=('occ_pct', 'max')
).reset_index()

r_summary = r_summary.merge(occ_pct_agg, on=['date', 'route_id'])
r_summary['average_passengers'] = np.round(r_summary['average_passengers'], 1)
r_summary['average_occupancy_percentage'] = np.round(r_summary['average_occupancy_percentage'], 1)
r_summary['maximum_occupancy_percentage'] = np.round(r_summary['maximum_occupancy_percentage'], 1)

r_summary.to_csv(f"{DATA_DIR}/route_daily_summary.csv", index=False)

# ==========================================
# 12. USERS
# ==========================================
users = pd.DataFrame({
    'user_id': [f'U{str(i).zfill(3)}' for i in range(1, 21)],
    'name': [f"Demo User {i}" for i in range(1, 21)],
    'email': [f"citizen{str(i).zfill(3)}@synthetic-example.com" for i in range(1, 18)] + ["admin01@synthetic-example.com", "admin02@synthetic-example.com", "admin03@synthetic-example.com"],
    'role': ['CITIZEN'] * 17 + ['ADMIN'] * 3,
    'account_status': ['ACTIVE'] * 19 + ['SUSPENDED']
})
users.to_csv(f"{DATA_DIR}/users.csv", index=False)

# ==========================================
# VALIDATION & STATISTICS
# ==========================================
print("\n--- SYNTHETIC DATASET GENERATION COMPLETE ---")
print(f"Data Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
print(f"Bus Stops: {len(bus_stops)}")
print(f"Routes: {len(routes)}")
print(f"Buses: {len(buses)}")
print(f"Total Occupancy Records: {len(occ)}")
print("\nFile Row Counts:")
for file in os.listdir(DATA_DIR):
    if file.endswith('.csv'):
        df = pd.read_csv(os.path.join(DATA_DIR, file))
        print(f"  - {file}: {len(df)} records")

print("\nQuality Checks on historical_occupancy.csv:")
print(f"Missing Values: {occ.isna().sum().sum()}")
print(f"Duplicate Rows: {occ.duplicated().sum()}")
print(f"Average Passengers per record: {occ['passengers'].mean():.1f}")
print(f"Max Passengers in a single record: {occ['passengers'].max()}")
print("---------------------------------------------")
