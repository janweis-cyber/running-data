import requests
import json
import base64
import os
from datetime import datetime, timezone, timedelta

INTERVALS_API_KEY = os.environ["INTERVALS_API_KEY"]
ATHLETE_ID = os.environ["ATHLETE_ID"]

KEEP_DAYS = 60  # only keep activity files newer than this

HEADERS = {
    "Authorization": "Basic " + base64.b64encode(
        ("API_KEY:" + INTERVALS_API_KEY).encode()
    ).decode()
}


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
        print("Fetched " + str(len(all_activities)) + " activities so far")
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


def cleanup_old_activity_files(all_activities):
    """Delete activity files older than KEEP_DAYS from the activities/ folder."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    # Build a set of IDs we want to keep
    keep_ids = set()
    for a in all_activities:
        date_str = a.get("start_date_local", "")[:10]
        if not date_str:
            continue
        activity_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if activity_date >= cutoff:
            keep_ids.add(a.get("id") + ".json")

    deleted = 0
    for filename in os.listdir("activities"):
        if filename.endswith(".json") and filename not in keep_ids:
            os.remove("activities/" + filename)
            deleted += 1

    print("Cleanup: deleted " + str(deleted) + " activity files older than " + str(KEEP_DAYS) + " days.")


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    print("Syncing at " + datetime.now(timezone.utc).isoformat())
    ensure_dir("activities")

    print("Fetching all activities...")
    all_activities = get_all_activities()
    print("Fetched " + str(len(all_activities)) + " activities total")

    if not all_activities:
        print("ERROR: No activities returned. Aborting.")
        return

    latest = all_activities[0]
    latest_id = latest.get("id")
    print(
        "Latest: " + str(latest.get("name")) +
        " - " + latest.get("start_date_local", "")[:10] +
        " (" + latest_id + ")"
    )

    # Build index entries
    index = []
    for a in all_activities:
        avg_speed = a.get("average_speed")
        gap = a.get("gap")
        activity_id = a.get("id")

        # HR zone times: list of seconds per zone [z1, z2, z3, z4, z5, z6, z7]
        hr_zone_times = a.get("icu_hr_zone_times")

        # interval_summary: compact rep description e.g. ["10x 5m30s 150bpm"]
        interval_summary = a.get("interval_summary")

        index.append({
            # Identity
            "id": activity_id,
            "url": "https://raw.githubusercontent.com/janweis-cyber/running-data/main/activities/" + activity_id + ".json",
            "date": a.get("start_date_local", "")[:10],
            "name": a.get("name"),
            "type": a.get("type"),
            "device": a.get("device_name"),

            # Volume
            "distance_km": round((a.get("distance") or 0) / 1000, 2),
            "duration_min": round((a.get("moving_time") or 0) / 60, 1),
            "elapsed_min": round((a.get("elapsed_time") or 0) / 60, 1),
            "coasting_sec": a.get("coasting_time"),

            # Pace / speed
            "avg_pace_km": round(1000 / avg_speed / 60, 2) if avg_speed else None,
            "gap_pace_km": round(1000 / gap / 60, 2) if gap else None,
            "max_speed_ms": a.get("max_speed"),

            # Heart rate
            "avg_hr": a.get("average_heartrate"),
            "max_hr": a.get("max_heartrate"),
            "hr_zone_times": hr_zone_times,

            # Effort / load
            "training_load": a.get("icu_training_load"),
            "atl": round(a.get("icu_atl") or 0, 1),
            "ctl": round(a.get("icu_ctl") or 0, 1),
            "trimp": round(a.get("trimp") or 0, 1),
            "intensity": round(a.get("icu_intensity") or 0, 1),
            "rpe": a.get("icu_rpe"),
            "feel": a.get("feel"),
            "polarization_index": a.get("polarization_index"),

            # Elevation
            "elevation_m": round(a.get("total_elevation_gain") or 0),
            "elevation_loss_m": round(a.get("total_elevation_loss") or 0),

            # Cadence / stride
            "avg_cadence": round(a.get("average_cadence") or 0, 1),
            "avg_stride_m": round(a.get("average_stride") or 0, 3),

            # Temperature (device)
            "avg_temp_c": round(a.get("average_temp") or 0, 1) if a.get("average_temp") is not None else None,
            "min_temp_c": a.get("min_temp"),
            "max_temp_c": a.get("max_temp"),

            # Calories
            "calories": a.get("calories"),

            # Interval structure
            "interval_summary": interval_summary,

            # Athlete state
            "weight_kg": a.get("icu_weight"),
        })

    # Write full index
    write_json("index.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(index),
        "activities": index
    })
    print("Written index.json")

    # Write recent.json — last 20 activities only
    write_json("recent.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "activities": index[:20]
    })
    print("Written recent.json -> " + (index[0]["id"] if index else "none"))

    # Delete activity files older than KEEP_DAYS
    cleanup_old_activity_files(all_activities)

    # Fetch full data for any activity files that don't exist yet (within keep window)
    existing = set(os.listdir("activities"))
    new_count = 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    for a in all_activities:
        date_str = a.get("start_date_local", "")[:10]
        if not date_str:
            continue
        activity_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if activity_date < cutoff:
            break  # list is sorted newest-first, so we can stop here
        activity_id = a.get("id")
        filename = activity_id + ".json"
        if filename not in existing:
            fetch_and_write_activity(a)
            new_count += 1
            print("Written activities/" + filename)

    # Always rewrite latest.json from the activity file
    activity_file = "activities/" + latest_id + ".json"
    with open(activity_file, "r", encoding="utf-8") as f:
        latest_payload = json.load(f)
    write_json("latest.json", latest_payload)
    print("Written latest.json -> " + latest_id)
    if latest_payload.get("garmin_elevation_gain_m") is not None:
        print("  Garmin elevation gain: " + str(latest_payload["garmin_elevation_gain_m"]) + " m")

    # Write pointer.json
    write_json("pointer.json", {
        "latest_id": latest_id,
        "latest_url": "https://raw.githubusercontent.com/janweis-cyber/running-data/main/activities/" + latest_id + ".json",
        "synced_at": datetime.now(timezone.utc).isoformat(),
    })
    print("Written pointer.json -> " + latest_id)

    print("Done. " + str(new_count) + " new activity files written.")


if __name__ == "__main__":
    main()
