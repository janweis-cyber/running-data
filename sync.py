import requests
import json
import base64
import os
from datetime import datetime, timezone

INTERVALS_API_KEY = os.environ["INTERVALS_API_KEY"]
ATHLETE_ID        = os.environ["ATHLETE_ID"]

def get_latest_activity():
    headers = {
        "Authorization": "Basic " + base64.b64encode(
            f"API_KEY:{INTERVALS_API_KEY}".encode()
        ).decode()
    }
    url = f"https://intervals.icu/api/v1/athlete/{ATHLETE_ID}/activities?oldest=2026-01-01&newest=2026-12-31&limit=1"
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    activities = r.json()
    return activities[0] if activities else None

def get_lap_data(activity_id):
    headers = {
        "Authorization": "Basic " + base64.b64encode(
            f"API_KEY:{INTERVALS_API_KEY}".encode()
        ).decode()
    }
    url = f"https://intervals.icu/api/v1/activity/{activity_id}/intervals"
    r = requests.get(url, headers=headers)
    return r.json() if r.status_code == 200 else None

def get_weather(lat, lon, start_time):
    date = start_time[:10]
    hour = int(start_time[11:13]) if len(start_time) > 11 else 9
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,windspeed_10m,precipitation"
        f"&timezone=Europe%2FStockholm"
        f"&start_date={date}&end_date={date}"
    )
    r = requests.get(url)
    if r.status_code == 200:
        hourly = r.json().get("hourly", {})
        return {
            "temperature_c":    hourly.get("temperature_2m",      [None]*24)[hour],
            "feels_like_c":     hourly.get("apparent_temperature", [None]*24)[hour],
            "humidity_pct":     hourly.get("relativehumidity_2m",  [None]*24)[hour],
            "wind_kph":         hourly.get("windspeed_10m",        [None]*24)[hour],
            "precipitation_mm": hourly.get("precipitation",        [None]*24)[hour],
        }
    return None

def main():
    print(f"Syncing at {datetime.now(timezone.utc).isoformat()}")
    activity = get_latest_activity()
    if not activity:
        print("No activities found.")
        return
    activity_id = activity.get("id")
    print(f"Activity: {activity.get('name')} ({activity_id})")
    laps    = get_lap_data(activity_id)
    weather = get_weather(59.334, 18.063, activity.get("start_date_local", ""))
    payload = {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "activity":  activity,
        "laps":      laps,
        "weather":   weather,
    }
    with open("latest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print("Written to latest.json")

if __name__ == "__main__":
    main()
