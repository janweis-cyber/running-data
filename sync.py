import requests
import json
import base64
import os
from datetime import datetime, timezone

INTERVALS_API_KEY = os.environ["INTERVALS_API_KEY"]
ATHLETE_ID        = os.environ["ATHLETE_ID"]

HEADERS = {
    "Authorization": "Basic " + base64.b64encode(
        f"API_KEY:{INTERVALS_API_KEY}".encode()
    ).decode()
}

def get_activities(oldest="2026-01-01", newest="2026-12-31", limit=100):
    url = (
        f"https://intervals.icu/api/v1/athlete/{ATHLETE_ID}/activities"
        f"?oldest={oldest}&newest={newest}&limit={limit}"
    )
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return r.json()

def get_all_activities():
    """Fetch full history in chunks going back to block start (Jan 2026)."""
    all_activities = []
    # Current block
    chunk = get_activities(oldest="2026-01-01", newest="2026-12-31", limit=100)
    all_activities.extend(chunk)
    # Historical (pre-block) — last 2 years for reference
    chunk = get_activities(oldest="2024-01-01", newest="2025-12-31", limit=200)
    all_activities.extend(chunk)
    return all_activities

def get_lap_data(activity_id):
    url = f"https://intervals.icu/api/v1/activity/{activity_id}/intervals"
    r = requests.get(url, headers=HEADERS)
    return r.json() if r.status_code == 200 else None

def get_weather(lat, lon, start_time):
    import time
    time.sleep(0.3)  # avoid hammering Open-Meteo
    date = start_time[:10]
    hour = int(start_time[11:13]) if len(start_time) > 11 else 9
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,windspeed_10m,precipitation"
        f"&timezone=Europe%2FStockholm"
        f"&start_date={date}&end_date={date}"
    )
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            hourly = r.json().get("hourly", {})
            return {
                "temperature_c":    hourly.get("temperature_2m",      [None]*24)[hour],
                "feels_like_c":     hourly.get("apparent_temperature", [None]*24)[hour],
                "humidity_pct":     hourly.get("relativehumidity_2m",  [None]*24)[hour],
                "wind_kph":         hourly.get("windspeed_10m",        [None]*24)[hour],
                "precipitation_mm": hourly.get("precipitation",        [None]*24)[hour],
            }
    except Exception as e:
        print(f"  Weather fetch failed: {e}")
    return None

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def main():
    print(f"Syncing at {datetime.now(timezone.utc).isoformat()}")

    ensure_dir("activities")

    all_activities = get_all_activities()
    print(f"Fetched {len(all_activities)} activities total")

    # Build index — lightweight summary only
    index = []
    for a in all_activities:
        index.append({
    "id":           a.get("id"),
    "date":         a.get("start_date_local", "")[:10],
    "name":         a.get("name"),
    "type":         a.get("type"),
    "distance_km":  round((a.get("distance") or 0) / 1000, 2),
    "duration_min": round((a.get("moving_time") or 0) / 60, 1),
    "avg_hr":       a.get("average_heartrate"),
    "avg_pace_km":  round(1000 / a.get("average_speed") / 60, 2) if a.get("average_speed") else None,
    "elevation_m":  round(a.get("total_elevation_gain") or 0),
    "training_load": a.get("icu_training_load"),
})
    write_json("index.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(index),
        "activities": index
    })
    print("Written index.json")

    # Update latest.json (most recent activity with full data + laps + weather)
    latest = all_activities[0] if all_activities else None
    if latest:
        activity_id = latest.get("id")
        laps    = get_lap_data(activity_id)
        weather = get_weather(59.334, 18.063, latest.get("start_date_local", ""))
        write_json("latest.json", {
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "activity":  latest,
            "laps":      laps,
            "weather":   weather,
        })
        print(f"Written latest.json ({latest.get('name')})")

    # Write/update individual activity files (full data + laps + weather)
    # Only write files that don't exist yet to avoid refetching everything
    existing = set(os.listdir("activities"))
    new_count = 0
    for a in all_activities:
        activity_id = a.get("id")
        filename = f"{activity_id}.json"
        if filename not in existing:
            laps    = get_lap_data(activity_id)
            weather = get_weather(59.334, 18.063, a.get("start_date_local", ""))
            write_json(f"activities/{filename}", {
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "activity":  a,
                "laps":      laps,
                "weather":   weather,
            })
            new_count += 1
            print(f"  Written activities/{filename}")

    print(f"Done. {new_count} new activity files written.")

if __name__ == "__main__":
    main()
