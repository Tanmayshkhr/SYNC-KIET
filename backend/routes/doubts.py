from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from pymongo import MongoClient
from utils.jwt import verify_token
from utils.ai import cluster_doubts, calculate_wait_time, find_similar_doubts, recommend_faculty
from routes.timetable import TIME_SLOTS, get_faculty_status, is_holiday
from models.doubt import DoubtRequest
from models.user import MessageRequest
from datetime import datetime, timedelta, time
from bson import ObjectId
import os

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
SCHEDULE_LOOKAHEAD_DAYS = 10
SCHEDULE_LIMIT = 12
MIN_SCHEDULE_NOTICE_MINUTES = 30
DEFAULT_REMINDER_MINUTES = 10
RESERVED_DOUBT_STATUSES = ["scheduled", "active"]
DEFAULT_RESOLUTION_MINUTES = 15
MAX_RESOLUTION_MINUTES = 45


def verify_user(authorization: str, roles=None):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user:
        raise HTTPException(401, "Unauthorized")
    if roles and user["role"] not in roles:
        raise HTTPException(401, "Unauthorized")
    return user


def parse_object_id(value: str, field_name: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(400, f"Invalid {field_name}")
    return ObjectId(value)


def serialize_datetime(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def serialize_doubt(doubt, faculty_map=None):
    serialized = dict(doubt)
    serialized["_id"] = str(serialized["_id"])

    for key, value in list(serialized.items()):
        serialized[key] = serialize_datetime(value)

    faculty_info = (faculty_map or {}).get(serialized.get("faculty_id", ""), {})
    serialized["faculty_name"] = faculty_info.get("name", serialized.get("faculty_name", ""))
    serialized["faculty_cabin"] = faculty_info.get("cabin", "")
    serialized["faculty_block"] = faculty_info.get("block", "")
    serialized["faculty_subject"] = faculty_info.get("subject", "")

    return serialized


def _parse_time_value(value):
    if not value:
        return None
    try:
        hour, minute = map(int, str(value).split(":")[:2])
        return hour, minute
    except (TypeError, ValueError):
        return None


def _slot_to_datetime(slot, now):
    parts = _parse_time_value((slot or {}).get("start"))
    if not parts:
        return None
    hour, minute = parts
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


def format_wait_time(minutes):
    minutes = max(0, int(round(minutes or 0)))
    if minutes == 0:
        return "Now"
    if minutes < 60:
        return f"{minutes} min"
    hours, mins = divmod(minutes, 60)
    return f"{hours}h {mins}m" if mins else f"{hours}h"


def format_expected_time(base_time, wait_minutes):
    if base_time is None:
        return None
    target = base_time + timedelta(minutes=max(0, int(round(wait_minutes or 0))))
    return target.strftime("%I:%M %p").lstrip("0")


def get_average_resolution_minutes(faculty_id, limit=20):
    completed = list(db.doubts.find({
        "faculty_id": faculty_id,
        "status": "completed",
        "accepted_at": {"$exists": True},
        "completed_at": {"$exists": True}
    }).sort("completed_at", -1).limit(limit))

    durations = []
    for doubt in completed:
        accepted_at = doubt.get("accepted_at")
        completed_at = doubt.get("completed_at")
        if isinstance(accepted_at, datetime) and isinstance(completed_at, datetime):
            diff = int((completed_at - accepted_at).total_seconds() // 60)
            if 1 <= diff <= 120:
                durations.append(diff)

    if not durations:
        return DEFAULT_RESOLUTION_MINUTES

    average = round(sum(durations) / len(durations))
    return max(5, min(average, MAX_RESOLUTION_MINUTES))


def get_peak_hours(faculty_id, limit=50):
    completed = list(db.doubts.find({
        "faculty_id": faculty_id,
        "status": "completed"
    }).sort("completed_at", -1).limit(limit))

    hour_counts = {}
    for doubt in completed:
        reference = doubt.get("accepted_at") or doubt.get("created_at")
        if isinstance(reference, datetime):
            hour_counts[reference.hour] = hour_counts.get(reference.hour, 0) + 1

    ranked = sorted(hour_counts.items(), key=lambda item: (-item[1], item[0]))[:3]
    return [
        {
            "hour": hour,
            "label": f"{hour:02d}:00-{(hour + 1) % 24:02d}:00",
            "count": count,
        }
        for hour, count in ranked
    ]


def build_wait_prediction(faculty_id, students_ahead):
    status_snapshot = get_faculty_status_snapshot(faculty_id) or {}
    prediction = calculate_wait_time(
        faculty_id,
        max(1, students_ahead + 1),
        db,
        status_snapshot,
    )
    prediction["status"] = status_snapshot.get("status", prediction.get("status", "unknown"))
    return prediction


def build_faculty_lookup(doubts):
    faculty_ids = list({d.get("faculty_id") for d in doubts if d.get("faculty_id")})
    faculty_map = {}

    for faculty_id in faculty_ids:
        if not ObjectId.is_valid(faculty_id):
            continue
        faculty = db.faculty.find_one({"_id": ObjectId(faculty_id)})
        if faculty:
            faculty_map[faculty_id] = {
                "name": faculty.get("name", ""),
                "cabin": faculty.get("cabin", ""),
                "block": faculty.get("block", ""),
                "subject": faculty.get("subject", ""),
                "email": faculty.get("email", ""),
            }

    return faculty_map


def get_slot_start(slot_date, period):
    slot_meta = TIME_SLOTS[period]
    hour, minute = map(int, slot_meta["start"].split(":"))
    return datetime.combine(slot_date, time(hour=hour, minute=minute))


def get_slot_end(slot_date, period):
    slot_meta = TIME_SLOTS[period]
    hour, minute = map(int, slot_meta["end"].split(":"))
    return datetime.combine(slot_date, time(hour=hour, minute=minute))


def get_reserved_periods(field_name, entity_id, slot_date):
    if not entity_id:
        return set()

    day_start = datetime.combine(slot_date, time.min)
    day_end = day_start + timedelta(days=1)

    reserved = set()
    doubts = db.doubts.find(
        {
            field_name: entity_id,
            "status": {"$in": RESERVED_DOUBT_STATUSES},
            "scheduled_for": {"$gte": day_start, "$lt": day_end},
            "scheduled_period": {"$exists": True}
        },
        {"scheduled_period": 1}
    )

    for doubt in doubts:
        try:
            reserved.add(int(doubt.get("scheduled_period")))
        except (TypeError, ValueError):
            continue

    return reserved


def build_slot_payload(slot_date, period, now):
    start_dt = get_slot_start(slot_date, period)
    end_dt = get_slot_end(slot_date, period)
    day_name = slot_date.strftime("%A")

    if slot_date == now.date():
        relative_label = "Today"
    elif slot_date == (now + timedelta(days=1)).date():
        relative_label = "Tomorrow"
    else:
        relative_label = day_name

    return {
        "date": slot_date.isoformat(),
        "day": day_name,
        "period": period,
        "start": TIME_SLOTS[period]["start"],
        "end": TIME_SLOTS[period]["end"],
        "label": f"{relative_label} - Period {period} ({TIME_SLOTS[period]['start']} - {TIME_SLOTS[period]['end']})",
        "relative_label": relative_label,
        "scheduled_for": start_dt.isoformat(),
        "scheduled_until": end_dt.isoformat(),
    }


def get_mutual_slots(faculty, student_id, limit=SCHEDULE_LIMIT):
    timetable = faculty.get("timetable", {})
    if not timetable:
        return []

    now = datetime.now()
    earliest_allowed = now + timedelta(minutes=MIN_SCHEDULE_NOTICE_MINUTES)
    faculty_id = str(faculty.get("_id", ""))
    slots = []

    for offset in range(SCHEDULE_LOOKAHEAD_DAYS):
        slot_date = (now + timedelta(days=offset)).date()
        day_name = slot_date.strftime("%A")

        if day_name not in WORKING_DAYS:
            continue

        if is_holiday(datetime.combine(slot_date, time(hour=12))):
            continue

        day_schedule = timetable.get(day_name, {})
        class_periods = set()
        for period_key in day_schedule.keys():
            try:
                class_periods.add(int(period_key))
            except (TypeError, ValueError):
                continue

        faculty_reserved = get_reserved_periods("faculty_id", faculty_id, slot_date)
        student_reserved = get_reserved_periods("student_id", student_id, slot_date)

        for period in TIME_SLOTS:
            slot_start = get_slot_start(slot_date, period)
            if slot_start < earliest_allowed:
                continue
            if period in class_periods or period in faculty_reserved or period in student_reserved:
                continue

            slots.append(build_slot_payload(slot_date, period, now))
            if len(slots) >= limit:
                return slots

    return slots


def get_faculty_for_schedule(faculty_id):
    faculty = db.faculty.find_one({"_id": parse_object_id(faculty_id, "faculty_id")})
    if not faculty:
        raise HTTPException(404, "Faculty not found")
    return faculty


def get_selected_slot(faculty, student_id, scheduled_date, scheduled_period):
    try:
        selected_period = int(scheduled_period)
    except (TypeError, ValueError):
        raise HTTPException(400, "Invalid scheduled period")

    available_slots = get_mutual_slots(faculty, student_id, limit=100)
    for slot in available_slots:
        if slot["date"] == scheduled_date and slot["period"] == selected_period:
            return slot

    raise HTTPException(409, "Selected slot is no longer available")


def get_faculty_status_snapshot(faculty_id):
    faculty = db.faculty.find_one({"_id": ObjectId(faculty_id)})
    if not faculty:
        return None

    faculty_code = faculty.get("faculty_code", "")
    if not faculty_code:
        return None

    try:
        return get_faculty_status(faculty_code)
    except Exception:
        return None


def promote_due_scheduled_doubts(*, faculty_id=None, student_id=None):
    query = {
        "status": "scheduled",
        "scheduled_for": {"$lte": datetime.now()},
    }

    if faculty_id:
        query["faculty_id"] = faculty_id
    if student_id:
        query["student_id"] = student_id

    result = db.doubts.update_many(
        query,
        {
            "$set": {
                "status": "pending",
                "queue_ready_at": datetime.utcnow(),
            }
        }
    )
    return result.modified_count


def create_scheduled_doubt(user, data: DoubtRequest, slot, *, booking_reason="scheduled"):
    reminder_minutes = max(0, min(int(data.reminder_minutes or DEFAULT_REMINDER_MINUTES), 60))
    scheduled_for = datetime.fromisoformat(slot["scheduled_for"])
    doubt = {
        "student_id": user["id"],
        "student_name": user["name"],
        "subject": data.subject,
        "topic": data.topic,
        "description": data.description,
        "faculty_id": data.faculty_id,
        "duration": data.duration,
        "status": "scheduled",
        "booking_type": "scheduled",
        "created_at": datetime.utcnow(),
        "scheduled_for": scheduled_for,
        "scheduled_until": datetime.fromisoformat(slot["scheduled_until"]),
        "scheduled_date": slot["date"],
        "scheduled_day": slot["day"],
        "scheduled_period": slot["period"],
        "scheduled_start": slot["start"],
        "scheduled_end": slot["end"],
        "slot_label": slot["label"],
        "reminder_minutes": reminder_minutes,
        "reminder_at": scheduled_for - timedelta(minutes=reminder_minutes),
        "reminder_status": "pending_client",
        "schedule_reason": booking_reason,
        "grouped": False,
        "cluster_id": None,
    }

    result = db.doubts.insert_one(doubt)
    timetable_status = get_faculty_status_snapshot(data.faculty_id)

    return {
        "message": "Doubt scheduled successfully",
        "booking_type": "scheduled",
        "doubt_id": str(result.inserted_id),
        "faculty_status": timetable_status["status"] if timetable_status else "unknown",
        "scheduled_slot": slot,
        "reminder": {
            "minutes_before": reminder_minutes,
            "remind_at": serialize_datetime(doubt["reminder_at"]),
            "status": "client_scaffolded"
        }
    }


def submit_pending_doubt(data: DoubtRequest, user):
    doubt = {
        "student_id": user["id"],
        "student_name": user["name"],
        "subject": data.subject,
        "topic": data.topic,
        "description": data.description,
        "faculty_id": data.faculty_id,
        "duration": data.duration,
        "status": "pending",
        "booking_type": "queue",
        "created_at": datetime.utcnow(),
        "grouped": False,
        "cluster_id": None
    }
    result = db.doubts.insert_one(doubt)
    doubt_id = str(result.inserted_id)

    pending_doubts = list(db.doubts.find({
        "faculty_id": data.faculty_id,
        "status": "pending",
        "subject": data.subject,
        "student_id": {"$ne": user["id"]}
    }))

    cluster_result = cluster_doubts(pending_doubts)

    if cluster_result.get("grouped"):
        cluster_id = cluster_result.get("cluster_name", "cluster_" + doubt_id[:8])
        db.doubts.update_many(
            {"_id": {"$in": [ObjectId(d["_id"]) if isinstance(d["_id"], str) else d["_id"] for d in pending_doubts]}},
            {"$set": {
                "grouped": True,
                "cluster_id": cluster_id,
                "cluster_name": cluster_result.get("cluster_name")
            }}
        )

    queue_position = db.doubts.count_documents({
        "faculty_id": data.faculty_id,
        "status": "pending"
    })

    prediction = build_wait_prediction(data.faculty_id, max(0, queue_position - 1))

    return {
        "message": "Doubt submitted successfully",
        "booking_type": "queue",
        "doubt_id": doubt_id,
        "queue_position": queue_position,
        "estimated_wait": prediction["estimated_wait"],
        "estimated_wait_minutes": prediction["estimated_wait_minutes"],
        "expected_free_time": prediction["expected_free_time"],
        "faculty_status": prediction["status"],
        "average_resolution_minutes": prediction["average_resolution_minutes"],
        "next_free_slot": prediction["next_free_slot"],
        "cluster_info": cluster_result
    }


@router.on_event("startup")
async def _noop():
    pass


async def _broadcast():
    try:
        from main import manager
        await manager.broadcast("refresh")
    except Exception as e:
        print("Broadcast error:", e)


@router.get("/available-slots/{faculty_id}")
def get_available_slots(faculty_id: str, authorization: str = Header(...)):
    user = verify_user(authorization, ["student"])
    faculty = get_faculty_for_schedule(faculty_id)
    slots = get_mutual_slots(faculty, user["id"])

    return {
        "faculty_id": faculty_id,
        "faculty_name": faculty.get("name", ""),
        "slots": slots,
        "total_slots": len(slots),
        "min_notice_minutes": MIN_SCHEDULE_NOTICE_MINUTES,
        "reminder_minutes": DEFAULT_REMINDER_MINUTES
    }


@router.post("/submit")
async def submit_doubt(data: DoubtRequest, authorization: str = Header(...)):
    user = verify_user(authorization, ["student"])

    if data.scheduled_date and data.scheduled_period is not None:
        faculty = get_faculty_for_schedule(data.faculty_id)
        slot = get_selected_slot(faculty, user["id"], data.scheduled_date, data.scheduled_period)
        response = create_scheduled_doubt(user, data, slot)
        await _broadcast()
        return response

    status_snapshot = get_faculty_status_snapshot(data.faculty_id) or {}
    now = datetime.now()
    should_auto_schedule = (
        now.weekday() >= 5
        or status_snapshot.get("status") in {"left", "holiday"}
        or now.strftime("%H:%M") >= "17:00"
    )

    if should_auto_schedule:
        faculty = get_faculty_for_schedule(data.faculty_id)
        auto_slots = get_mutual_slots(faculty, user["id"], limit=1)
        if not auto_slots:
            raise HTTPException(409, "No valid future slot is available for scheduling")
        response = create_scheduled_doubt(user, data, auto_slots[0], booking_reason="after_hours")
        await _broadcast()
        return response

    response = submit_pending_doubt(data, user)
    await _broadcast()
    return response


@router.get("/my-doubts")
def get_my_doubts(authorization: str = Header(...)):
    user = verify_user(authorization)
    if user.get("role") == "student":
        promote_due_scheduled_doubts(student_id=user["id"])
    doubts = list(db.doubts.find({"student_id": user["id"]}).sort("created_at", -1))
    faculty_map = build_faculty_lookup(doubts)
    serialized_doubts = []

    for doubt in doubts:
        serialized = serialize_doubt(doubt, faculty_map)
        status = serialized.get("status")
        faculty_id = serialized.get("faculty_id")

        if status == "pending" and faculty_id:
            queue = list(db.doubts.find({
                "faculty_id": faculty_id,
                "status": "pending"
            }))
            queue.sort(key=lambda item: item.get("queue_ready_at") or item.get("created_at") or datetime.min)
            queue_ids = [str(item["_id"]) for item in queue]
            try:
                queue_position = queue_ids.index(serialized["_id"]) + 1
            except ValueError:
                queue_position = None

            if queue_position:
                prediction = build_wait_prediction(faculty_id, queue_position - 1)
                serialized["queue_position"] = queue_position
                serialized["estimated_wait"] = prediction["estimated_wait"]
                serialized["estimated_wait_minutes"] = prediction["estimated_wait_minutes"]
                serialized["expected_free_time"] = prediction["expected_free_time"]
                serialized["next_free_slot"] = prediction["next_free_slot"]
        elif status == "active":
            serialized["queue_position"] = 0
            serialized["estimated_wait"] = "In progress"
            serialized["estimated_wait_minutes"] = 0
        elif status == "scheduled":
            serialized["next_free_slot"] = {
                "day": serialized.get("scheduled_day"),
                "start": serialized.get("scheduled_start"),
                "end": serialized.get("scheduled_end"),
                "label": serialized.get("slot_label"),
            }

        serialized_doubts.append(serialized)

    return {"doubts": serialized_doubts}


@router.get("/faculty-queue")
def get_faculty_queue(authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])
    promote_due_scheduled_doubts(faculty_id=user["id"])

    queue = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": "pending"
    }))
    queue.sort(key=lambda doubt: doubt.get("queue_ready_at") or doubt.get("created_at") or datetime.min)

    scheduled = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": "scheduled"
    }).sort("scheduled_for", 1))

    average_resolution_minutes = get_average_resolution_minutes(user["id"])
    completed_today = db.doubts.count_documents({
        "faculty_id": user["id"],
        "status": "completed",
        "completed_at": {
            "$gte": datetime.combine(datetime.now().date(), time.min),
            "$lt": datetime.combine(datetime.now().date(), time.max),
        }
    })
    peak_hours = get_peak_hours(user["id"])

    return {
        "queue": [serialize_doubt(doubt) for doubt in queue],
        "scheduled": [serialize_doubt(doubt) for doubt in scheduled],
        "total": len(queue),
        "scheduled_total": len(scheduled),
        "stats": {
            "average_resolution_minutes": average_resolution_minutes,
            "average_resolution_time": format_wait_time(average_resolution_minutes),
            "completed_today": completed_today,
            "peak_hours": peak_hours,
        }
    }


@router.put("/accept/{doubt_id}")
async def accept_doubt(doubt_id: str, authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    result = db.doubts.update_one(
        {
            "_id": parse_object_id(doubt_id, "doubt_id"),
            "faculty_id": user["id"],
            "status": {"$in": ["pending", "scheduled"]}
        },
        {"$set": {
            "status": "active",
            "accepted_at": datetime.utcnow(),
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Doubt not found")

    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"status": "busy", "session_started_at": datetime.utcnow()}}
    )
    await _broadcast()
    return {"message": "Session started", "auto_complete_in": "30 minutes"}


@router.put("/complete/{doubt_id}")
async def complete_doubt(doubt_id: str, authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    result = db.doubts.update_one(
        {
            "_id": parse_object_id(doubt_id, "doubt_id"),
            "faculty_id": user["id"]
        },
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Doubt not found")

    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"status": "available"}}
    )
    await _broadcast()
    return {"message": "Session completed"}


class RejectRequest(BaseModel):
    reason: str = "No reason provided"


@router.put("/reject/{doubt_id}")
async def reject_doubt(doubt_id: str, data: RejectRequest = None, authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])
    reason = data.reason if data else "No reason provided"

    result = db.doubts.update_one(
        {
            "_id": parse_object_id(doubt_id, "doubt_id"),
            "faculty_id": user["id"]
        },
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.utcnow(),
            "reject_reason": reason,
            "faculty_message": f"Rejected: {reason}",
            "faculty_name": user.get("name", "")
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Doubt not found")

    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"status": "available"}}
    )
    db.override_logs.insert_one({
        "faculty_id": user["id"],
        "action": "rejected_session",
        "doubt_id": doubt_id,
        "reason": reason,
        "timestamp": datetime.utcnow()
    })
    await _broadcast()
    return {"message": "Doubt rejected with reason"}


@router.post("/send-message/{doubt_id}")
async def send_message(doubt_id: str, data: MessageRequest, authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    result = db.doubts.update_one(
        {
            "_id": parse_object_id(doubt_id, "doubt_id"),
            "faculty_id": user["id"]
        },
        {"$set": {
            "faculty_message": data.message,
            "message_sent_at": datetime.utcnow(),
            "message_read": False
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Doubt not found")

    await _broadcast()
    return {"message": "Message sent successfully"}


@router.get("/find-similar")
def find_similar(authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    doubts = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": "pending"
    }).sort("created_at", 1))

    for doubt in doubts:
        doubt["_id"] = str(doubt["_id"])

    return find_similar_doubts(doubts)


@router.post("/group-doubts")
async def group_doubts(data: dict, authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    doubt_ids = data.get("doubt_ids", [])
    group_name = data.get("group_name", "Grouped Doubts")

    if len(doubt_ids) < 2:
        raise HTTPException(400, "Need at least 2 doubts to group")

    cluster_id = f"manual_{doubt_ids[0][:8]}_{int(datetime.utcnow().timestamp())}"
    grouped_doubts = list(db.doubts.find({"_id": {"$in": [ObjectId(did) for did in doubt_ids]}}))
    student_names = [d.get("student_name", "Student") for d in grouped_doubts]
    notify_msg = f"You have been grouped with {len(student_names) - 1} other student(s) for a group session on '{group_name}'."

    db.doubts.update_many(
        {"_id": {"$in": [ObjectId(did) for did in doubt_ids]}},
        {"$set": {
            "grouped": True,
            "cluster_id": cluster_id,
            "cluster_name": group_name,
            "faculty_message": notify_msg,
            "message_sent_at": datetime.utcnow(),
            "message_read": False
        }}
    )
    await _broadcast()
    return {"message": f"Grouped {len(doubt_ids)} doubts", "cluster_id": cluster_id}


@router.get("/faculty-history")
def get_faculty_history(authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    doubts = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": {"$in": ["completed", "rejected"]}
    }).sort("_id", -1).limit(50))

    total_completed = db.doubts.count_documents({"faculty_id": user["id"], "status": "completed"})
    total_rejected = db.doubts.count_documents({"faculty_id": user["id"], "status": "rejected"})
    grouped_cluster_ids = db.doubts.distinct(
        "cluster_id",
        {"faculty_id": user["id"], "status": "completed", "grouped": True, "cluster_id": {"$ne": None}}
    )

    return {
        "history": [serialize_doubt(doubt) for doubt in doubts],
        "total_completed": total_completed,
        "total_rejected": total_rejected,
        "total_group_sessions": len(grouped_cluster_ids)
    }


class RecommendRequest(BaseModel):
    topic: str
    subject: str = ""


@router.post("/recommend-faculty")
def get_faculty_recommendations(data: RecommendRequest, authorization: str = Header(...)):
    verify_user(authorization, ["student"])

    recommendations = recommend_faculty(
        topic=data.topic,
        subject=data.subject,
        db=db,
        get_status_fn=get_faculty_status
    )

    return {
        "topic": data.topic,
        "subject": data.subject,
        "recommendations": recommendations,
        "count": len(recommendations)
    }
