import os
import json
import requests

from fastapi import APIRouter, Query, HTTPException

from const import DATA_FILE


router = APIRouter()

if os.path.exists(DATA_FILE):
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        settlements = json.load(file)
else:
    print("Файл не найден!")


@router.get("/settlements")
def get_settlements():
    return settlements


@router.get("/search")
def search_city(q: str = Query(..., min_length=1)):
    q = q.lower()

    results = [
        s for s in settlements
        if q in s["locality"].lower()
    ]

    return results[:10]


@router.get("/city")
def get_city(name: str):
    for s in settlements:
        if s["locality"].lower() == name.lower():
            return s

    return {"error": "not found"}


@router.get("/weather")
def get_weather(lat: float, lon: float):
    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,wind_speed_10m,precipitation",
        "timezone": "auto"
    }

    try:
        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail="Ошибка Open-Meteo"
            )

        data = response.json()

        return {
            "hourly": {
                "time": data["hourly"]["time"],
                "temperature_2m": data["hourly"]["temperature_2m"],
                "wind_speed_10m": data["hourly"]["wind_speed_10m"],
                "precipitation": data["hourly"]["precipitation"]
            }
        }

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=str(e))
    