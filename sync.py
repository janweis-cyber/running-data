import requests
import json
import base64
import os
from datetime import datetime, timezone, timedelta

INTERVALS_API_KEY = os.environ["INTERVALS_API_KEY"]
ATHLETE_ID        = os.environ["ATHLETE_ID"]

HEADERS = {
    "Authorization": "Basic " + base64.b64encode(
        f"API_KEY:{INTERVALS_API_KEY}".encode()
    ).decode()
}

def get_latest_activity_direct():
    url = (
        f"https://intervals.icu/api/v1/athlete/{ATHLETE_ID}/activities"
        f"?oldest=2020-01-01&newest=2030-12-31&limit=1"
    )
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    activities = r.json()
    return activities[0] if activities else None

def get_all_activities():
    all_activities = []
    seen_ids = set()
    limit = 200
    newest = "2030-12-31"

    while True:
        url = (
            f"https://intervals.icu/api/v1/athlete/{ATHLETE_ID}/activities"
            f"?oldest=2020-01-01&newest={newest}&limit={limit}"
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
        "&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,windspeed_10m,precipitation"
        "&timezone=Europe%2FStockholm"
        "&start_date=" + date + "&end_date=" + date
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
        print("Weather fetch failed: " + str(e))
    return None

def build_activity_payload(a, laps, garmin_elevation, weather):
    return {
        "synced_at":               datetime.now(timezone.utc).isoformat(),
        "activity":                a,
        "laps":                    laps,
        "garmin_elevation_gain_m": garmin_elevation,
        "weather":                 weather,
    }

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def main():
    print("Syncing at " + datetime.now(timezone.utc).isoformat())
    ensure_dir("activities")

    # Step 1: Always write the true latest activity first, independently
    print("Fetching latest activity directly...")
    latest = get_latest_activity_direct()

    if latest:
        latest_id        = latest.get("id")
        laps             = get_lap_data(latest_id)
        garmin_elevation = get_garmin_elevation(latest_id)
        weather          = get_weather(59.334, 18.063, latest.get("start_date_local", ""))
        payload          = build_activity_payload(latest, laps, garmin_elevation, weather)

        write_json("latest.json", payload)
        write_json("activities/" + latest_id + ".json", payload)
        print("Written latest.json + activities/" + latest_id + ".json")
        print("  Activity: " + str(latest.get("name")) + " - " + latest.get("start_date_local", "")[:10])
        if garmin_elevation is not None:
            print("  Garmin elevation gain: " + str(garmin_elevation) + " m")
    else:
        print("WARNING: Could not fetch latest activity.")
        latest_id = None

    # Step 2: Full history for index + backfill
    print("Fetching full activity list...")
    all_activities = get_all_activities()
    print("Fetched " + str(len(all_activities)) + " activities total")

    # If the list API is lagging, ensure latest is included in the index
    list_ids = {a.get("id") for a in all_activities}
    if latest and latest_id not in list_ids:
        print("Latest activity " + latest_id + " missing from list - prepending for index.")
        all_activities.insert(0, latest)

    # Step 3: Write index
    index = []
    for a in all_activities:
        index.append({
            "id":            a.get("id"),
            "date":          a.get("start_date_local", "")[:10],
            "name":          a.get("name"),
            "type":          a.get("type"),
            "distance_km":   round((a.get("distance") or 0) / 1000, 2),
            "duration_min":  round((a.get("moving_time") or 0) / 60, 1),
            "avg_hr":        a.get("average_heartrate"),
            "avg_pace_km":   round(1000 / a.get("average_speed") / 60, 2) if a.get("average_speed") else None,
            "elevation_m":   round(a.get("total_elevation_gain") or 0),
            "training_load": a.get("icu_training_load"),
        })
    write_json("index.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(index),
        "activities": index
    })
    print("Written index.json")

    # Step 4: Backfill older activity files
    existing = set(os.listdir("activities"))
    new_count = 0
    for a in all_activities:
        activity_id = a.get("id")
        if activity_id == latest_id:
            continue
        filename = activity_id + ".json"
        if filename not in existing:
            laps             = get_lap_data(activity_id)
            garmin_elevation = get_garmin_elevation(activity_id)
            weather          = get_weather(59.334, 18.063, a.get("start_date_local", ""))
            write_json("activities/" + filename,
                       build_activity_payload(a, laps, garmin_elevation, weather))
            new_count += 1
            print("Written activities/" + filename)

    print("Done. " + str(new_count) + " new activity files written.")

if __name__ == "__main__":
    main()
