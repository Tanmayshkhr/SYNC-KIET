from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from datetime import datetime
from utils.jwt import verify_token
from bson import ObjectId
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

DAY_MAP = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday",
    3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"
}

def get_current_day():
    return DAY_MAP.get(datetime.now().weekday(), "Monday")

def get_current_period():
    now = datetime.now().strftime("%H:%M")
    for period, times in TIME_SLOTS.items():
        if times["start"] <= now <= times["end"]:
            return period
    return None

def get_status_from_timetable(faculty, timetable):
    day = get_current_day()
    current_period = get_current_period()
    now = datetime.now().strftime("%H:%M")

    # Weekend
    if day in ["Saturday", "Sunday"]:
        return "available", "Weekend - Available for doubt sessions", []

    day_schedule = timetable.get(day, {}) if timetable else {}
    busy_periods = [int(k) for k in day_schedule.keys()]

    # Build free slots
    free_slots = []
    for period, times in TIME_SLOTS.items():
        if period not in busy_periods and times["start"] >= now:
            free_slots.append({
                "period": period,
                "start": times["start"],
                "end": times["end"],
                "label": f"Period {period} ({times['start']} - {times['end']})"
            })

    # Determine status
    if now < "09:10":
        return "not_arrived", "College not started yet", free_slots
    elif now > "16:50":
        return "left", "College hours over", free_slots
    elif "12:30" <= now <= "14:20":
        return "lunch", "Lunch break", free_slots
    elif current_period and current_period in busy_periods:
        return "busy", f"In class - {faculty.get('subject', '')}", free_slots
    else:
        return "available", "Available for doubt sessions", free_slots


@router.get("/faculty-status/{faculty_code}")
def get_faculty_status(faculty_code: str):
    faculty = db.faculty.find_one({"faculty_code": faculty_code})
    if not faculty:
        raise HTTPException(404, "Faculty not found")

    timetable = faculty.get("timetable", {})
    status, message, free_slots = get_status_from_timetable(faculty, timetable)

    # Override with face-scan manual status
    manual = faculty.get("manual_status")
    if manual == "available":
        status = "available"
        message = "Checked in via face scan"
    elif manual == "left":
        status = "left"
        message = "Checked out via face scan"

    return {
        "faculty_code": faculty_code,
        "faculty_name": faculty["name"],
        "subject": faculty.get("subject", ""),
        "cabin": faculty.get("cabin", ""),
        "email": faculty.get("email", ""),
        "status": status,
        "message": message,
        "current_day": get_current_day(),
        "free_slots_today": free_slots,
    }


@router.get("/best-slot/{faculty_code}")
def get_best_slot(faculty_code: str):
    faculty = db.faculty.find_one({"faculty_code": faculty_code})
    if not faculty:
        raise HTTPException(404, "Faculty not found")

    timetable = faculty.get("timetable", {})
    day = get_current_day()
    now = datetime.now().strftime("%H:%M")
    day_schedule = timetable.get(day, {})
    busy_periods = [int(k) for k in day_schedule.keys()]

    free_slots = []
    for period, times in TIME_SLOTS.items():
        if period not in busy_periods and times["start"] >= now:
            free_slots.append({
                "period": period,
                "start": times["start"],
                "end": times["end"],
            })

    if free_slots:
        return {"best_slot": free_slots[0], "day": day,
                "message": f"Next available: {free_slots[0]['start']} today"}

    return {"message": "No slots available today", "best_slot": None}


@router.get("/all-faculty-status")
def get_all_faculty_status():
    faculties = list(db.faculty.find({}))
    result = []

    for faculty in faculties:
        code = faculty.get("faculty_code", "")
        timetable = faculty.get("timetable", {})
        status, message, free_slots = get_status_from_timetable(faculty, timetable)

        # Override with face-scan manual status
        manual = faculty.get("manual_status")
        if manual == "available":
            status = "available"
            message = "Checked in via face scan"
        elif manual == "left":
            status = "left"
            message = "Checked out via face scan"

        queue_count = db.doubts.count_documents({
            "faculty_id": str(faculty["_id"]),
            "status": "pending"
        })

        result.append({
            "_id": str(faculty["_id"]),
            "faculty_code": code,
            "faculty_name": faculty["name"],
            "subject": faculty.get("subject", ""),
            "cabin": faculty.get("cabin", ""),
            "block": faculty.get("block", ""),
            "email": faculty.get("email", f"{code.lower()}@kiet.edu"),
            "status": status,
            "message": message,
            "free_slots_today": free_slots,
            "queue_count": queue_count,
        })

    return {"faculty": result}


@router.get("/my-schedule")
def get_my_schedule(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    faculty = db.faculty.find_one({"_id": ObjectId(user["id"])})
    if not faculty:
        raise HTTPException(404, "Faculty not found")

    timetable = faculty.get("timetable", {})
    day = get_current_day()
    day_schedule = timetable.get(day, {})

    # Build full schedule with all 7 periods
    slots = []
    for period in range(1, 8):
        period_data = day_schedule.get(str(period), None)
        time_info = TIME_SLOTS[period]
        if period_data:
            slots.append({
                "period": period,
                "start": time_info["start"],
                "end": time_info["end"],
                "type": "class",
                "subject": period_data.get("subject", ""),
                "section": period_data.get("section", ""),
                "class_type": period_data.get("type", "theory"),
            })
        else:
            slots.append({
                "period": period,
                "start": time_info["start"],
                "end": time_info["end"],
                "type": "free",
            })

    return {
        "day": day,
        "faculty_name": faculty["name"],
        "slots": slots,
    }