import requests
import json
import base64
import os
from datetime import datetime, timezone, timedelta
INTERVALS_API_KEY = os.environ["INTERVALS_API_KEY"]
ATHLETE_ID = os.environ["ATHLETE_ID"]
HEADERS = {
).decode()
"Authorization": "Basic " + base64.b64encode(
("API_KEY:" + INTERVALS_API_KEY).encode()
}
def get_latest_activity_direct():
url = (
"https://intervals.icu/api/v1/athlete/" + ATHLETE_ID + "/activities"
"?oldest=2020-01-01&newest=2030-12-31&limit=10"
)
r = requests.get(url, headers=HEADERS, timeout=30)
r.raise_for_status()
activities = r.json()
if not activities:
return None
activities.sort(key=lambda a: a.get("start_date_local", ""), reverse=True)
return activities[0]
def get_all_activities():
all_activities = []
seen_ids = set()
limit = 200
newest = "2030-12-31"
while True:
url = (
"https://intervals.icu/api/v1/athlete/" + ATHLETE_ID + "/activities"
"?oldest=2020-01-01&newest=" + newest + "&limit=" + str(limit)
)
r = requests.get(url, headers=HEADERS, timeout=30)
r.raise_for_status()
chunk = r.json()
if not chunk:
break
new_in_chunk = [a for a in chunk if a.get("id") not in seen_ids]
if not new_in_chunk:
break
all_activities.extend(new_in_chunk)
seen_ids.update(a.get("id") for a in new_in_chunk)
print("Fetched " + str(len(all_activities)) + " activities so far, newest=" + newest)
if len(chunk) < limit:
break
oldest_date = min(a.get("start_date_local", "")[:10] for a in chunk)
oldest_dt = datetime.strptime(oldest_date, "%Y-%m-%d")
newest = (oldest_dt - timedelta(days=1)).strftime("%Y-%m-%d")
all_activities.sort(key=lambda a: a.get("start_date_local", ""), reverse=True)
return all_activities
def get_lap_data(activity_id):
url = "https://intervals.icu/api/v1/activity/" + activity_id + "/intervals"
try:
r = requests.get(url, headers=HEADERS, timeout=30)
return r.json() if r.status_code == 200 else None
except Exception as e:
print("Lap fetch failed for " + activity_id + ": " + str(e))
return None
def get_garmin_elevation(activity_id):
url = "https://intervals.icu/api/v1/activity/" + activity_id + "/streams"
try:
r = requests.get(url, headers=HEADERS, timeout=30)
if r.status_code != 200:
return None
data = r.json()
altitude = None
if isinstance(data, dict):
altitude = data.get("altitude") or data.get("fixed_altitude")
elif isinstance(data, list):
for stream in data:
if stream.get("type") in ("altitude", "fixed_altitude"):
altitude = stream.get("data")
break
if not altitude or len(altitude) < 2:
return None
gain = 0.0
for i in range(1, len(altitude)):
diff = altitude[i] - altitude[i - 1]
if diff > 0:
gain += diff
return round(gain, 1)
except Exception as e:
print("Elevation stream fetch failed for " + activity_id + ": " + str(e))
return None
def get_weather(lat, lon, start_time):
import time
time.sleep(0.3)
date = start_time[:10]
hour = int(start_time[11:13]) if len(start_time) > 11 else 9
url = (
"https://api.open-meteo.com/v1/forecast"
"?latitude=" + str(lat) + "&longitude=" + str(lon) +
"&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,windspeed_10m,precip
"&timezone=Europe%2FStockholm"
"&start_date=" + date + "&end_date=" + date
)
try:
r = requests.get(url, timeout=10)
if r.status_code == 200:
hourly = r.json().get("hourly", {})
return {
"temperature_c": hourly.get("temperature_2m", [None]*24)[hour],
"feels_like_c": hourly.get("apparent_temperature", [None]*24)[hour],
"humidity_pct": hourly.get("relativehumidity_2m", [None]*24)[hour],
"wind_kph": hourly.get("windspeed_10m", [None]*24)[hour],
"precipitation_mm": hourly.get("precipitation", [None]*24)[hour],
}
except Exception as e:
print("Weather fetch failed: " + str(e))
return None
def build_activity_payload(a, laps, garmin_elevation, weather):
return {
"synced_at": datetime.now(timezone.utc).isoformat(),
"activity": a,
"laps": laps,
"garmin_elevation_gain_m": garmin_elevation,
"weather": weather,
}
def fetch_and_write_activity(a):
activity_id = a.get("id")
laps = get_lap_data(activity_id)
garmin_elevation = get_garmin_elevation(activity_id)
weather = get_weather(59.334, 18.063, a.get("start_date_local", ""))
payload = build_activity_payload(a, laps, garmin_elevation, weather)
write_json("activities/" + activity_id + ".json", payload)
return payload
def ensure_dir(path):
os.makedirs(path, exist_ok=True)
def write_json(path, data):
with open(path, "w", encoding="utf-8") as f:
json.dump(data, f, indent=2, ensure_ascii=False)
def main():
print("Syncing at " + datetime.now(timezone.utc).isoformat())
ensure_dir("activities")
# Step 1: Fetch true latest (sorted by start_date_local, not API order)
print("Fetching latest activity...")
latest = get_latest_activity_direct()
if not latest:
print("WARNING: Could not fetch latest activity.")
latest_id = None
else:
latest_id = latest.get("id")
payload = fetch_and_write_activity(latest)
write_json("latest.json", payload)
print("Written latest.json + activities/" + latest_id + ".json")
print(" Activity: " + str(latest.get("name")) + " - " + latest.get("start_date_local
if payload.get("garmin_elevation_gain_m") is not None:
print(" Garmin elevation gain: " + str(payload["garmin_elevation_gain_m"]) + " m
# Step 2: Full history
print("Fetching full activity list...")
all_activities = get_all_activities()
print("Fetched " + str(len(all_activities)) + " activities total")
# Ensure latest is in index even if list API is lagging
list_ids = {a.get("id") for a in all_activities}
if latest and latest_id not in list_ids:
print("Latest activity " + latest_id + " missing from list API - prepending.")
all_activities.insert(0, latest)
# Step 3: Write index
index = []
for a in all_activities:
index.append({
"id": a.get("id"),
"date": a.get("start_date_local", "")[:10],
"name": a.get("name"),
"type": a.get("type"),
"distance_km": round((a.get("distance") or 0) / 1000, 2),
"duration_min": round((a.get("moving_time") or 0) / 60, 1),
"avg_hr": a.get("average_heartrate"),
"avg_pace_km": round(1000 / a.get("average_speed") / 60, 2) if a.get("average_s
"elevation_m": round(a.get("total_elevation_gain") or 0),
"training_load": a.get("icu_training_load"),
})
write_json("index.json", {
"generated_at": datetime.now(timezone.utc).isoformat(),
"count": len(index),
"activities": index
})
print("Written index.json")
# Step 4: Backfill missing activity files
existing = set(os.listdir("activities"))
new_count = 0
for a in all_activities:
activity_id = a.get("id")
if activity_id == latest_id:
continue
filename = activity_id + ".json"
if filename not in existing:
fetch_and_write_activity(a)
new_count += 1
print("Written activities/" + filename)
# Step 5: Correct latest.json if full list has a newer activity than top-10 slice
if all_activities:
true_latest = all_activities[0]
true_latest_id = true_latest.get("id")
if true_latest_id != latest_id:
print(
"Correcting latest.json: " + str(true_latest_id) +
" (" + true_latest.get("start_date_local", "")[:10] + ")" +
" is newer than " + str(latest_id)
)
activity_file = "activities/" + true_latest_id + ".json"
if os.path.exists(activity_file):
with open(activity_file, "r", encoding="utf-8") as f:
payload = json.load(f)
else:
payload = fetch_and_write_activity(true_latest)
write_json("latest.json", payload)
print("Rewritten latest.json -> " + true_latest_id)
print("Done. " + str(new_count) + " new activity files written.")
if __name__ == "__main__":
main()