from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from utils.jwt import verify_token
from datetime import datetime
import os

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

TIME_SLOTS = {
    1: {"start": "09:10", "end": "10:00"},
    2: {"start": "10:00", "end": "10:50"},
    3: {"start": "10:50", "end": "11:40"},
    4: {"start": "11:40", "end": "12:30"},
    5: {"start": "14:20", "end": "15:10"},
    6: {"start": "15:10", "end": "16:00"},
    7: {"start": "16:00", "end": "16:50"},
}

KIET_TIMETABLE = {
    "VKS": {
        "name": "Mr. Vivek Kumar Sharma",
        "subject": "Design and Analysis of Algorithms",
        "schedule": {
            "MON": [2, 6],
            "TUE": [2],
            "WED": [2, 6],
            "THU": [6],
            "FRI": [4]
        }
    },
    "ATJ": {
        "name": "Dr. Aatif Jamshed",
        "subject": "Web Technology",
        "schedule": {
            "MON": [4],
            "TUE": [3],
            "WED": [3],
            "THU": [2],
            "FRI": []
        }
    },
    "SKR": {
        "name": "Dr. Sunil Kumar",
        "subject": "Computer Networks",
        "schedule": {
            "MON": [1],
            "TUE": [3],
            "WED": [2],
            "THU": [],
            "FRI": [2]
        }
    },
    "DP": {
        "name": "Mr. Dheeraj Pandey",
        "subject": "ANN and Machine Learning",
        "schedule": {
            "MON": [3],
            "TUE": [],
            "WED": [1],
            "THU": [1],
            "FRI": [3]
        }
    },
    "TRL": {
        "name": "Ms. Tarul",
        "subject": "Data Analytics",
        "schedule": {
            "MON": [],
            "TUE": [1],
            "WED": [],
            "THU": [2],
            "FRI": [4]
        }
    }
}

DAYS = ["MON", "TUE", "WED", "THU", "FRI"]

def get_current_day():
    day_map = {
        0: "MON", 1: "TUE", 2: "WED",
        3: "THU", 4: "FRI", 5: "SAT", 6: "SUN"
    }
    return day_map.get(datetime.now().weekday(), "MON")

def get_current_period():
    now = datetime.now().strftime("%H:%M")
    for period, times in TIME_SLOTS.items():
        if times["start"] <= now <= times["end"]:
            return period
    return None

def get_free_slots(faculty_code: str, day: str):
    if faculty_code not in KIET_TIMETABLE:
        return []
    busy_periods = KIET_TIMETABLE[faculty_code]["schedule"].get(day, [])
    free = []
    for period, times in TIME_SLOTS.items():
        if period not in busy_periods:
            free.append({
                "period": period,
                "start": times["start"],
                "end": times["end"],
                "label": f"Period {period} ({times['start']} - {times['end']})"
            })
    return free

@router.get("/faculty-status/{faculty_code}")
def get_faculty_status(faculty_code: str):
    day = get_current_day()
    current_period = get_current_period()

    if faculty_code not in KIET_TIMETABLE:
        raise HTTPException(404, "Faculty not found")

    faculty = KIET_TIMETABLE[faculty_code]
    busy_periods = faculty["schedule"].get(day, [])

    if current_period and current_period in busy_periods:
        status = "busy"
        message = f"In class - {faculty['subject']}"
    elif datetime.now().strftime("%H:%M") < "09:10":
        status = "not_arrived"
        message = "College not started yet"
    elif datetime.now().strftime("%H:%M") > "16:50":
        status = "left"
        message = "College hours over"
    elif "12:30" <= datetime.now().strftime("%H:%M") <= "14:20":
        status = "lunch"
        message = "Lunch break"
    else:
        status = "available"
        message = "Available for doubt sessions"

    free_slots = get_free_slots(faculty_code, day)

    return {
        "faculty_code": faculty_code,
        "faculty_name": faculty["name"],
        "subject": faculty["subject"],
        "status": status,
        "message": message,
        "current_day": day,
        "free_slots_today": free_slots,
        "busy_periods": busy_periods
    }

@router.get("/best-slot/{faculty_code}")
def get_best_slot(faculty_code: str):
    day = get_current_day()
    now = datetime.now().strftime("%H:%M")
    free_slots = get_free_slots(faculty_code, day)

    upcoming = [s for s in free_slots if s["start"] >= now]

    if not upcoming:
        next_day_idx = (DAYS.index(day) + 1) % 5
        next_day = DAYS[next_day_idx]
        next_slots = get_free_slots(faculty_code, next_day)
        if next_slots:
            return {
                "best_slot": next_slots[0],
                "day": next_day,
                "message": f"No slots today, next available: {next_day} at {next_slots[0]['start']}"
            }
        return {"message": "No slots available this week", "best_slot": None}

    return {
        "best_slot": upcoming[0],
        "day": day,
        "message": f"Next available slot: {upcoming[0]['start']} today"
    }

@router.get("/all-faculty-status")
def get_all_faculty_status():
    result = []
    for code in KIET_TIMETABLE:
        status = get_faculty_status(code)
        result.append(status)
    return {"faculty": result}