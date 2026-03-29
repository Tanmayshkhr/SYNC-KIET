## C:\Users\asus\sync-kiet\backend\models\doubt.py

`$lang
from pydantic import BaseModel
from typing import Optional

class DoubtRequest(BaseModel):
    subject: str
    topic: str
    description: str
    faculty_id: str
    duration: str = "medium"
    scheduled_date: Optional[str] = None
    scheduled_period: Optional[int] = None
    reminder_minutes: int = 10
```

## C:\Users\asus\sync-kiet\backend\routes\auth.py

`$lang
from models.user import StudentSignup, StudentLogin, FacultySignup, FacultyLogin, ForgotPassword, SecuritySetup
from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from bson import ObjectId
from utils.jwt import create_token, verify_token
import bcrypt
import os
from datetime import datetime

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

@router.post("/student/signup")
def student_signup(data: StudentSignup):
    if db.students.find_one({"email": data.email}):
        raise HTTPException(400, "Email already exists")
    hashed = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt())
    db.students.insert_one({
        "name": data.name,
        "email": data.email,
        "password": hashed,
        "roll_no": data.roll_no,
        "branch": data.branch,
        "semester": data.semester,
        "security_question": data.security_question,
        "security_answer": bcrypt.hashpw(data.security_answer.lower().encode("utf-8"), bcrypt.gensalt()),
        "created_at": datetime.utcnow()
    })
    return {"message": "Student registered successfully"}

@router.post("/student/login")
def student_login(data: StudentLogin):
    student = db.students.find_one({"email": data.email})
    if not student:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(data.password.encode("utf-8"), student["password"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({
        "id": str(student["_id"]),
        "role": "student",
        "name": student["name"]
    })
    return {
        "token": token,
        "name": student["name"],
        "role": "student",
        "needs_security_setup": "security_question" not in student or not student.get("security_question")
    }

@router.post("/faculty/signup")
def faculty_signup(data: FacultySignup):
    if db.faculty.find_one({"email": data.email}):
        raise HTTPException(400, "Email already exists")
    hashed = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt())
    db.faculty.insert_one({
    "name": data.name,
    "email": data.email,
    "password": hashed,
    "subject": data.subject,
    "department": data.department,
    "faculty_code": data.faculty_code,
    "status": "unavailable"
})
    
    return {"message": "Faculty registered successfully"}

@router.post("/faculty/login")
async def faculty_login(data: FacultyLogin):
    faculty = db.faculty.find_one({"email": data.email})
    if not faculty:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(data.password.encode("utf-8"), faculty["password"]):
        raise HTTPException(401, "Invalid credentials")

    checked_in_at = datetime.utcnow()
    db.faculty.update_one(
        {"_id": faculty["_id"]},
        {"$set": {
            "manual_status": "available",
            "last_scan_at": checked_in_at,
            "last_scan_action": "manual_login"
        }}
    )

    token = create_token({
        "id": str(faculty["_id"]),
        "role": "faculty",
        "name": faculty["name"]
    })

    try:
        from main import manager
        await manager.broadcast("refresh")
    except Exception:
        pass

    return {"token": token, "name": faculty["name"], "role": "faculty",
            "needs_security_setup": "security_question" not in faculty or not faculty.get("security_question") or not faculty.get("password_changed")}
@router.post("/forgot-password/student")
def student_forgot_password(data: ForgotPassword):
    student = db.students.find_one({"email": data.email})
    if not student:
        raise HTTPException(404, "Student not found")
    
    if not bcrypt.checkpw(
        data.security_answer.lower().encode("utf-8"),
        student["security_answer"]
    ):
        raise HTTPException(400, "Security answer incorrect")
    
    new_hashed = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt())
    db.students.update_one(
        {"email": data.email},
        {"$set": {"password": new_hashed}}
    )
    return {"message": "Password reset successfully"}

@router.post("/forgot-password/faculty")
def faculty_forgot_password(data: ForgotPassword):
    faculty = db.faculty.find_one({"email": data.email})
    if not faculty:
        raise HTTPException(404, "Faculty not found")
    
    if not bcrypt.checkpw(
        data.security_answer.lower().encode("utf-8"),
        faculty["security_answer"]
    ):
        raise HTTPException(400, "Security answer incorrect")
    
    new_hashed = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt())
    db.faculty.update_one(
        {"email": data.email},
        {"$set": {"password": new_hashed}}
    )
    return {"message": "Password reset successfully"}

@router.get("/security-question/{role}/{email}")
def get_security_question(role: str, email: str):
    collection = db.students if role == "student" else db.faculty
    user = collection.find_one({"email": email})
    if not user:
        raise HTTPException(404, "User not found")
    return {"security_question": user.get("security_question", "No question set")}
@router.post("/setup-security")
def setup_security(data: SecuritySetup, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user:
        raise HTTPException(401, "Unauthorized")

    hashed_answer = bcrypt.hashpw(
        data.security_answer.lower().encode("utf-8"),
        bcrypt.gensalt()
    )

    update_fields = {
        "security_question": data.security_question,
        "security_answer": hashed_answer,
        "password_changed": True
    }

    # If new password provided, update it too
    if data.new_password:
        update_fields["password"] = bcrypt.hashpw(
            data.new_password.encode("utf-8"),
            bcrypt.gensalt()
        )

    collection = db.students if user["role"] == "student" else db.faculty
    collection.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": update_fields}
    )
    return {"message": "Security setup completed successfully"}

@router.post("/admin/login")
def admin_login(data: StudentLogin):
    admin = db.admin.find_one({"email": data.email})
    if not admin:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(data.password.encode("utf-8"), admin["password"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({
        "id": str(admin["_id"]),
        "role": "admin",
        "name": admin["name"]
    })
    return {
        "token": token,
        "name": admin["name"],
        "role": "admin"
    }
```

## C:\Users\asus\sync-kiet\backend\routes\doubts.py

`$lang
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

    timetable_status = get_faculty_status_snapshot(data.faculty_id)
    wait_time = calculate_wait_time(data.faculty_id, queue_position, db)

    return {
        "message": "Doubt submitted successfully",
        "booking_type": "queue",
        "doubt_id": doubt_id,
        "queue_position": queue_position,
        "estimated_wait": wait_time,
        "faculty_status": timetable_status["status"] if timetable_status else "unknown",
        "next_free_slot": timetable_status["free_slots_today"][0] if timetable_status and timetable_status["free_slots_today"] else None,
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
            "grouped": False,
            "cluster_id": None,
        }

        result = db.doubts.insert_one(doubt)
        timetable_status = get_faculty_status_snapshot(data.faculty_id)
        await _broadcast()

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

    response = submit_pending_doubt(data, user)
    await _broadcast()
    return response


@router.get("/my-doubts")
def get_my_doubts(authorization: str = Header(...)):
    user = verify_user(authorization)
    doubts = list(db.doubts.find({"student_id": user["id"]}).sort("created_at", -1))
    faculty_map = build_faculty_lookup(doubts)

    return {"doubts": [serialize_doubt(doubt, faculty_map) for doubt in doubts]}


@router.get("/faculty-queue")
def get_faculty_queue(authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])

    queue = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": "pending"
    }).sort("created_at", 1))

    scheduled = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": "scheduled"
    }).sort("scheduled_for", 1))

    return {
        "queue": [serialize_doubt(doubt) for doubt in queue],
        "scheduled": [serialize_doubt(doubt) for doubt in scheduled],
        "total": len(queue),
        "scheduled_total": len(scheduled)
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
```

## C:\Users\asus\sync-kiet\backend\routes\timetable.py

`$lang
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from pymongo import MongoClient
from datetime import datetime, timedelta, time
from utils.jwt import verify_token
from bson import ObjectId
from openpyxl import load_workbook
from io import BytesIO
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
    0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday",
    4: "Friday", 5: "Saturday", 6: "Sunday"
}

VALID_DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}


def get_current_day():
    return DAY_MAP.get(datetime.now().weekday(), "Monday")


def get_current_period():
    now = datetime.now().strftime("%H:%M")
    for period, times in TIME_SLOTS.items():
        if times["start"] <= now <= times["end"]:
            return period
    return None


def verify_user(authorization: str, allowed_roles):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] not in allowed_roles:
        raise HTTPException(401, "Unauthorized")
    return user


def build_timetable_from_slots(slots):
    timetable = {}
    for slot in slots:
        day = slot["day"]
        period = str(slot["period"])
        timetable.setdefault(day, {})
        timetable[day][period] = {
            "subject": slot.get("subject", ""),
            "section": slot.get("section", ""),
            "type": slot.get("class_type", "theory"),
            "room": slot.get("room", "")
        }
    return timetable


def merge_timetable(existing_timetable, new_timetable):
    merged = {
        day: dict(periods)
        for day, periods in (existing_timetable or {}).items()
    }

    for day, periods in (new_timetable or {}).items():
        merged.setdefault(day, {})
        merged[day].update(periods)

    return merged


def get_period_from_times(start, end):
    normalized_start = str(start).strip() if start is not None else ""
    normalized_end = str(end).strip() if end is not None else ""
    for period, times in TIME_SLOTS.items():
        if times["start"] == normalized_start and times["end"] == normalized_end:
            return period
    return None


def normalize_class_type(value):
    class_type = str(value).strip().lower() if value is not None else ""
    return class_type or "theory"


def normalize_day(day):
    normalized_day = str(day).strip()
    if not normalized_day:
        raise HTTPException(400, "day is required")
    normalized_day = normalized_day.capitalize()
    if normalized_day not in VALID_DAYS:
        raise HTTPException(400, f"Invalid day: {day}")
    return normalized_day


def normalize_faculty_code(value):
    return str(value).strip().upper() if value is not None else ""


def find_faculty_by_code(faculty_code):
    normalized_code = normalize_faculty_code(faculty_code)
    if not normalized_code:
        return None

    faculty = db.faculty.find_one({"faculty_code": normalized_code})
    if faculty:
        return faculty

    return db.faculty.find_one({
        "faculty_code": {
            "$regex": f"^{normalized_code}$",
            "$options": "i"
        }
    })


def normalize_slot(slot):
    if not slot.get("day"):
        raise HTTPException(400, "Each slot must include day")

    period = slot.get("period")
    if period not in [None, ""]:
        try:
            period = int(period)
        except (TypeError, ValueError):
            raise HTTPException(400, f"Invalid period: {slot.get('period')}")

    if period is None:
        period = get_period_from_times(slot.get("start"), slot.get("end"))

    if period not in TIME_SLOTS:
        start = slot.get("start")
        end = slot.get("end")
        raise HTTPException(400, f"Invalid slot timing: {start} - {end}")

    return {
        "day": normalize_day(slot["day"]),
        "period": period,
        "subject": str(slot.get("subject", "")).strip(),
        "section": str(slot.get("section", "")).strip(),
        "class_type": normalize_class_type(slot.get("class_type") or slot.get("type")),
        "room": str(slot.get("room", "")).strip()
    }


def normalize_slots(slots):
    if not slots:
        raise HTTPException(400, "slots are required")
    return [normalize_slot(slot) for slot in slots]


def flatten_timetable(timetable):
    slots = []
    for day, periods in (timetable or {}).items():
        for period_key, period_data in periods.items():
            try:
                period = int(period_key)
            except (TypeError, ValueError):
                continue
            if period not in TIME_SLOTS:
                continue
            time_info = TIME_SLOTS[period]
            slots.append({
                "day": day,
                "period": period,
                "start": time_info["start"],
                "end": time_info["end"],
                "subject": period_data.get("subject", ""),
                "section": period_data.get("section", ""),
                "class_type": period_data.get("type", "theory"),
                "room": period_data.get("room", ""),
                "type": "class"
            })
    return sorted(slots, key=lambda slot: (slot["day"], slot["period"]))


def is_same_day(first, second):
    return first.date() == second.date()


def is_holiday(now):
    date_variants = [
        now.strftime("%Y-%m-%d"),
        now.strftime("%d-%m-%Y"),
        now.strftime("%Y/%m/%d"),
    ]
    return db.holidays.find_one({
        "$and": [
            {
                "$or": [
                    {"active": {"$exists": False}},
                    {"active": True}
                ]
            },
            {
                "$or": [
                    {"date": {"$in": date_variants}},
                    {"holiday_date": {"$in": date_variants}},
                ]
            }
        ]
    }) is not None


def get_manual_status_for_today(faculty, now):
    manual_status = faculty.get("manual_status")
    last_scan_at = faculty.get("last_scan_at")

    if not manual_status or not isinstance(last_scan_at, datetime):
        return None

    if not is_same_day(last_scan_at, now):
        return None

    return manual_status


def has_active_doubt_session(faculty):
    faculty_id = str(faculty.get("_id", ""))
    if not faculty_id:
        return False

    return db.doubts.count_documents({
        "faculty_id": faculty_id,
        "status": "active"
    }) > 0


def get_reserved_periods_for_day(faculty, target_date):
    faculty_id = str(faculty.get("_id", ""))
    if not faculty_id:
        return set()

    day_start = datetime.combine(target_date, time.min)
    day_end = day_start + timedelta(days=1)

    reserved = set()
    scheduled_doubts = db.doubts.find(
        {
            "faculty_id": faculty_id,
            "status": {"$in": ["scheduled", "active"]},
            "scheduled_for": {"$gte": day_start, "$lt": day_end},
            "scheduled_period": {"$exists": True}
        },
        {"scheduled_period": 1}
    )

    for doubt in scheduled_doubts:
        try:
            reserved.add(int(doubt.get("scheduled_period")))
        except (TypeError, ValueError):
            continue

    return reserved


def group_slots_by_day(slots):
    weekly = {day: [] for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
    for slot in slots:
        weekly.setdefault(slot["day"], [])
        weekly[slot["day"]].append(slot)

    for day_slots in weekly.values():
        day_slots.sort(key=lambda slot: slot["period"])

    return weekly


def save_faculty_timetable(filter_query, slots, merge=False):
    timetable = build_timetable_from_slots(slots)
    if merge:
        faculty = db.faculty.find_one(filter_query, {"timetable": 1})
        existing_timetable = faculty.get("timetable", {}) if faculty else {}
        timetable = merge_timetable(existing_timetable, timetable)

    result = db.faculty.update_one(
        filter_query,
        {"$set": {"timetable": timetable, "updated_at": datetime.utcnow()}}
    )
    return timetable, result


def get_status_from_timetable(faculty, timetable):
    now_dt = datetime.now()
    day = DAY_MAP.get(now_dt.weekday(), "Monday")
    current_period = get_current_period()
    now = now_dt.strftime("%H:%M")
    manual_status = get_manual_status_for_today(faculty, now_dt)
    reserved_periods = get_reserved_periods_for_day(faculty, now_dt.date())

    if day == "Sunday" or is_holiday(now_dt):
        return "holiday", "Holiday - Faculty unavailable", []

    if manual_status == "left" or now >= "17:00":
        return "left", "Faculty has left for the day", []

    if manual_status != "available":
        return "not_checked_in", "Faculty has not checked in today", []

    day_schedule = timetable.get(day, {}) if timetable else {}
    busy_periods = [int(k) for k in day_schedule.keys()]

    free_slots = []
    for period, times in TIME_SLOTS.items():
        if period not in busy_periods and period not in reserved_periods and times["start"] >= now:
            free_slots.append({
                "period": period,
                "start": times["start"],
                "end": times["end"],
                "label": f"Period {period} ({times['start']} - {times['end']})"
            })

    if has_active_doubt_session(faculty):
        return "busy", "Attending a student doubt", free_slots
    elif current_period and current_period in reserved_periods:
        return "busy", "Scheduled doubt session", free_slots
    elif current_period and current_period in busy_periods:
        current_slot = day_schedule.get(str(current_period), {})
        current_subject = current_slot.get("subject") or faculty.get("subject", "")
        return "in_class", f"In class - {current_subject}", free_slots
    elif now < "09:10":
        return "available", "Checked in - Available before first class", free_slots
    elif "12:30" <= now <= "14:20":
        return "available", "Checked in - Available after lunch", free_slots
    else:
        return "available", "Checked in - Available for doubt sessions", free_slots


@router.get("/all")
def get_all_timetables(authorization: str = Header(...)):
    verify_user(authorization, ["admin"])
    faculty_list = list(db.faculty.find({}))
    result = []

    for faculty in faculty_list:
        timetable = faculty.get("timetable", {})
        slots = flatten_timetable(timetable)
        result.append({
            "faculty_code": faculty.get("faculty_code"),
            "faculty_name": faculty.get("name"),
            "email": faculty.get("email"),
            "subject": faculty.get("subject"),
            "timetable": timetable,
            "slots": slots,
            "updated_at": faculty.get("updated_at")
        })

    return {"timetables": result}


@router.post("/upload")
def upload_timetable(data: dict, authorization: str = Header(...)):
    verify_user(authorization, ["admin"])

    faculty_code = normalize_faculty_code(data.get("faculty_code"))
    slots = data.get("slots", [])

    if not faculty_code:
        raise HTTPException(400, "faculty_code is required")

    faculty = find_faculty_by_code(faculty_code)
    if not faculty:
        raise HTTPException(404, "Faculty not found")

    normalized = normalize_slots(slots)
    timetable, result = save_faculty_timetable({"_id": faculty["_id"]}, normalized, merge=True)

    return {
        "message": f"Timetable saved for {faculty.get('faculty_code', faculty_code)}",
        "slots": flatten_timetable(timetable)
    }


@router.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...), authorization: str = Header(...)):
    verify_user(authorization, ["admin"])

    if not file.filename.endswith((".xlsx", ".xlsm", ".xltx", ".xltm")):
        raise HTTPException(400, "Upload a valid Excel file")

    content = await file.read()
    wb = load_workbook(BytesIO(content))
    ws = wb.active

    # Supported headers:
    # faculty_code | day | period | subject | section | class_type | room
    # faculty_code | day | start | end | subject | section | class_type | room
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        raise HTTPException(400, "Excel file is empty")

    headers = [str(h).strip().lower() if h is not None else "" for h in rows[0]]
    required = ["faculty_code", "day", "subject"]
    for col in required:
        if col not in headers:
            raise HTTPException(400, f"Missing required column: {col}")
    has_period = "period" in headers
    has_times = "start" in headers and "end" in headers
    if not has_period and not has_times:
        raise HTTPException(400, "Excel must include either period or start and end columns")

    idx = {h: i for i, h in enumerate(headers)}
    grouped = {}

    for row in rows[1:]:
        if not row or all(cell is None for cell in row):
            continue

        faculty_code = str(row[idx["faculty_code"]]).strip()
        if not faculty_code:
            continue

        subject = str(row[idx["subject"]]).strip() if row[idx["subject"]] is not None else ""
        section = str(row[idx["section"]]).strip() if "section" in idx and row[idx["section"]] else ""
        class_type = str(row[idx["class_type"]]).strip() if "class_type" in idx and row[idx["class_type"]] else "theory"
        room = str(row[idx["room"]]).strip() if "room" in idx and row[idx["room"]] else ""

        slot_payload = {
            "day": row[idx["day"]],
            "subject": subject,
            "section": section,
            "class_type": class_type,
            "room": room
        }

        if has_period:
            slot_payload["period"] = row[idx["period"]]
        else:
            slot_payload["start"] = row[idx["start"]]
            slot_payload["end"] = row[idx["end"]]

        normalized_slot = normalize_slot(slot_payload)

        grouped.setdefault(faculty_code, [])
        grouped[faculty_code].append(normalized_slot)

    saved = []
    for faculty_code, slots in grouped.items():
        _, result = save_faculty_timetable({"faculty_code": faculty_code}, slots)
        if result.matched_count:
            saved.append(faculty_code)

    return {"message": "Excel upload processed", "saved": saved}


@router.delete("/delete/{faculty_code}")
def delete_timetable(faculty_code: str, authorization: str = Header(...)):
    verify_user(authorization, ["admin"])
    result = db.faculty.update_one(
        {"faculty_code": faculty_code},
        {"$unset": {"timetable": ""}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Faculty not found")
    return {"message": f"Timetable deleted for {faculty_code}"}


@router.post("/faculty-upload")
def faculty_upload_timetable(data: dict, authorization: str = Header(...)):
    user = verify_user(authorization, ["faculty"])
    normalized = normalize_slots(data.get("slots", []))
    timetable, result = save_faculty_timetable({"_id": ObjectId(user["id"])}, normalized)
    if result.matched_count == 0:
        raise HTTPException(404, "Faculty not found")
    return {
        "message": "Your timetable was saved successfully",
        "slots": flatten_timetable(timetable)
    }


@router.get("/faculty-status/{faculty_code}")
def get_faculty_status(faculty_code: str):
    faculty = find_faculty_by_code(faculty_code)
    if not faculty:
        raise HTTPException(404, "Faculty not found")

    timetable = faculty.get("timetable", {})
    status, message, free_slots = get_status_from_timetable(faculty, timetable)

    return {
        "faculty_code": faculty.get("faculty_code", faculty_code),
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
        return {"best_slot": free_slots[0], "day": day, "message": f"Next available: {free_slots[0]['start']} today"}

    return {"message": "No slots available today", "best_slot": None}


@router.get("/all-faculty-status")
def get_all_faculty_status():
    faculties = list(db.faculty.find({}))
    result = []

    for faculty in faculties:
        code = faculty.get("faculty_code", "")
        timetable = faculty.get("timetable", {})
        status, message, free_slots = get_status_from_timetable(faculty, timetable)

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
    user = verify_user(authorization, ["faculty"])
    faculty = db.faculty.find_one({"_id": ObjectId(user["id"])})
    if not faculty:
        raise HTTPException(404, "Faculty not found")

    timetable = faculty.get("timetable", {})
    weekly_slots = group_slots_by_day(flatten_timetable(timetable))
    day = get_current_day()
    slots = []
    for period in range(1, 8):
        period_data = timetable.get(day, {}).get(str(period), None)
        time_info = TIME_SLOTS[period]
        slot = {
            "period": period,
            "start": time_info["start"],
            "end": time_info["end"],
        }
        if period_data:
            slot.update({
                "type": "class",
                "subject": period_data.get("subject", ""),
                "section": period_data.get("section", ""),
                "class_type": period_data.get("type", "theory"),
                "room": period_data.get("room", ""),
            })
        else:
            slot["type"] = "free"
        slots.append(slot)

    return {
        "day": day,
        "faculty_name": faculty["name"],
        "slots": slots,
        "weekly": weekly_slots,
        "timetable": timetable
    }
```

## C:\Users\asus\sync-kiet\backend\seed_timetables.py

`$lang
"""
PuchoKIET timetable seed script.

Seeds realistic Monday-Friday timetables directly into faculty documents using
the exact nested `timetable` shape consumed by `backend/routes/timetable.py`.

Run:
    python seed_timetables.py
"""

from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["synckiet"]

WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

PATTERN_LIBRARY = [
    {"Monday": [1, 2, 4, 5, 7], "Tuesday": [1, 3, 5, 6], "Wednesday": [2, 3, 4, 6, 7], "Thursday": [1, 2, 5, 6], "Friday": [2, 3, 4, 5, 7]},
    {"Monday": [1, 3, 4, 5, 6], "Tuesday": [2, 3, 5, 7], "Wednesday": [1, 2, 4, 6, 7], "Thursday": [1, 3, 4, 6], "Friday": [2, 3, 5, 6, 7]},
    {"Monday": [2, 3, 4, 6, 7], "Tuesday": [1, 2, 5, 6], "Wednesday": [1, 3, 4, 5, 7], "Thursday": [2, 3, 4, 7], "Friday": [1, 2, 5, 6, 7]},
    {"Monday": [1, 2, 5, 6, 7], "Tuesday": [1, 4, 5, 6], "Wednesday": [2, 3, 4, 5, 6], "Thursday": [1, 3, 6, 7], "Friday": [1, 2, 3, 5, 7]},
    {"Monday": [1, 3, 5, 6, 7], "Tuesday": [2, 4, 5, 7], "Wednesday": [1, 2, 3, 4, 6], "Thursday": [1, 2, 4, 6], "Friday": [2, 3, 4, 5, 6]},
    {"Monday": [2, 4, 5, 6, 7], "Tuesday": [1, 2, 3, 6], "Wednesday": [1, 3, 4, 5, 7], "Thursday": [2, 4, 5, 6], "Friday": [1, 2, 3, 5, 7]},
]

FACULTY_LIST = [
    {"code": "ABG", "name": "Dr. Abhishek Goyal", "subject": "Web Technology"},
    {"code": "ATJ", "name": "Dr. Aatif Jamshed", "subject": "Web Technology"},
    {"code": "ABS", "name": "Mr. Abhishek Sharma", "subject": "Web Technology"},
    {"code": "VKS", "name": "Mr. Vivek Kumar Sharma", "subject": "Design and Analysis of Algorithms"},
    {"code": "RK", "name": "Dr. Raj Kumar", "subject": "Design and Analysis of Algorithms"},
    {"code": "KKA", "name": "Mr. Kuldeep Kumar Atariya", "subject": "Design and Analysis of Algorithms"},
    {"code": "TSH", "name": "Mr. Tarsh Vaibhav", "subject": "Design and Analysis of Algorithms"},
    {"code": "DP", "name": "Mr. Dheeraj Pandey", "subject": "ANN and Machine Learning"},
    {"code": "AM", "name": "Dr. Anurag Mishra", "subject": "ANN and Machine Learning"},
    {"code": "KS", "name": "Ms. Kirti Sharma", "subject": "ANN and Machine Learning"},
    {"code": "BKG", "name": "Mr. Bhagvan Krishan Gupta", "subject": "ANN and Machine Learning"},
    {"code": "AG", "name": "Dr. Akash Goel", "subject": "Web Technology"},
    {"code": "SKR", "name": "Dr. Sunil Kumar", "subject": "Computer Networks"},
    {"code": "RR", "name": "Mr. Rohan Rathore", "subject": "Computer Networks"},
    {"code": "PKP", "name": "Mr. Pawan Kumar Pal", "subject": "Computer Networks"},
    {"code": "NS", "name": "Mr. Nikhil Saraswat", "subject": "Computer Networks"},
    {"code": "TRL", "name": "Ms. Tarul", "subject": "Data Analytics"},
    {"code": "PRI", "name": "Ms. Priya Raghuvanshi", "subject": "Data Analytics"},
    {"code": "MT", "name": "Mr. Mohit Singh Tanwar", "subject": "Data Analytics"},
    {"code": "RA", "name": "Mr. Rahul", "subject": "Data Analytics"},
    {"code": "AS", "name": "Ms. Arti Sharma", "subject": "Universal Human Values"},
    {"code": "ADJ", "name": "Ms. Aditi Joshi", "subject": "Universal Human Values"},
    {"code": "ST", "name": "Mr. Shubham Tyagi", "subject": "Aptitude"},
    {"code": "MK", "name": "Dr. Meetu Kumar", "subject": "Soft Skills"},
    {"code": "HS", "name": "Mr. Himanshu Saxena", "subject": "Soft Skills"},
    {"code": "SG", "name": "Mr. Sreesh Gaur", "subject": "Advance Data Structures"},
]

SECTION_POOLS = {
    "Web Technology": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Design and Analysis of Algorithms": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "ANN and Machine Learning": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Computer Networks": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Data Analytics": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Advance Data Structures": ["CS4A", "CS4B", "CS4C"],
    "Universal Human Values": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Aptitude": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Soft Skills": ["CS4A", "CS4B", "CS4C", "CS4D"],
}

ROOM_POOLS = {
    "Web Technology": ["C-301", "C-303", "WT-LAB-1"],
    "Design and Analysis of Algorithms": ["C-304", "C-305", "C-307"],
    "ANN and Machine Learning": ["AI-LAB-1", "C-308", "C-309"],
    "Computer Networks": ["CN-LAB-1", "C-310", "C-312"],
    "Data Analytics": ["DA-LAB-1", "C-313", "C-315"],
    "Advance Data Structures": ["C-316", "C-318", "ADS-LAB"],
    "Universal Human Values": ["H-201", "H-202", "Seminar Hall 1"],
    "Aptitude": ["APT-1", "APT-2", "Seminar Hall 2"],
    "Soft Skills": ["SS-101", "Language Lab", "Seminar Hall 3"],
}


def get_slot_type(subject, period, faculty_index, day_index):
    if subject in {"Universal Human Values", "Aptitude", "Soft Skills"}:
        return "tutorial" if (faculty_index + day_index + period) % 4 == 0 else "theory"
    if subject in {"Web Technology", "ANN and Machine Learning", "Computer Networks", "Data Analytics"} and period in {5, 6}:
        return "lab" if (faculty_index + day_index) % 3 == 0 else "theory"
    return "theory"


def build_timetable(faculty, faculty_index):
    subject = faculty["subject"]
    sections = SECTION_POOLS[subject]
    rooms = ROOM_POOLS[subject]
    pattern = PATTERN_LIBRARY[faculty_index % len(PATTERN_LIBRARY)]
    timetable = {}

    for day_index, day in enumerate(WORKING_DAYS):
        day_schedule = {}
        periods = pattern[day]

        for slot_index, period in enumerate(periods):
            section = sections[(faculty_index + day_index + slot_index) % len(sections)]
            room = rooms[(day_index + slot_index + faculty_index) % len(rooms)]
            day_schedule[str(period)] = {
                "subject": subject,
                "section": section,
                "type": get_slot_type(subject, period, faculty_index, day_index),
                "room": room,
            }

        timetable[day] = day_schedule

    return timetable


def seed_timetables():
    print("Seeding realistic timetables...")
    print("-" * 48)

    seeded = 0
    for faculty_index, faculty in enumerate(FACULTY_LIST):
        timetable = build_timetable(faculty, faculty_index)
        result = db.faculty.update_one(
            {"faculty_code": faculty["code"]},
            {"$set": {
                "timetable": timetable,
                "timetable_updated": True
            }}
        )

        lectures_per_week = sum(len(slots) for slots in timetable.values())
        if result.matched_count:
            print(f"[OK] {faculty['code']} -> {lectures_per_week} lectures/week")
            seeded += 1
        else:
            print(f"[MISS] {faculty['code']} not found in faculty collection")

    print("-" * 48)
    print(f"Completed: {seeded}/{len(FACULTY_LIST)} faculty timetables seeded")


if __name__ == "__main__":
    seed_timetables()
```

## C:\Users\asus\sync-kiet\frontend\src\pages\SubmitDoubt.js

`$lang
import { useEffect, useState } from "react";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const PURPLE_LIGHT = "#ede9fe";

const SUBJECT_TOPICS = {
  "Design and Analysis of Algorithms": ["Substitution Method", "Master's Theorem", "Shell Sort", "Tim Sort", "Counting Sort", "Radix Sort", "Bucket Sort", "Fractional Knapsack", "Activity Selection", "Task Scheduling", "Kruskal's Algorithm", "Prim's Algorithm", "Dijkstra's Algorithm", "Bellman Ford", "Dynamic Programming Intro", "0-1 Knapsack", "Coin Change Problem", "LCS", "Matrix Chain Multiplication", "Floyd Warshall", "N-Queen Problem", "Graph Coloring", "Travelling Salesman", "KMP Algorithm", "Rabin Karp", "Boyer Moore", "NP Completeness", "NP Hard"],
  "Computer Networks": ["OSI Model", "TCP/IP Model", "Network Topologies", "Transmission Media", "Switching Techniques", "Framing", "Error Detection", "Error Correction", "Flow Control", "Sliding Window Protocol", "ALOHA", "CSMA/CD", "CSMA/CA", "Ethernet", "WiFi 802.11", "Bluetooth", "Subnetting", "Supernetting", "NAT", "IPv4", "IPv6", "RIP", "OSPF", "BGP", "Distance Vector Routing", "Link State Routing", "UDP", "TCP", "Congestion Control", "Leaky Bucket", "Token Bucket", "DNS", "HTTP", "FTP", "SMTP", "Cryptography", "Symmetric Key", "Asymmetric Key", "Digital Signature"],
  "Web Technology": ["Node.js Basics", "Event Loop", "Callbacks", "Async Programming", "WebSockets", "EventEmitter", "Node Streams", "Express Routing", "Middleware", "EJS Templating", "React Components", "React Hooks", "useState", "useEffect", "Redux", "Context API", "Props vs State", "RESTful API", "HTTP Methods", "MongoDB CRUD", "Mongoose", "SQL vs NoSQL", "Flask Routing", "Jinja2", "Flask REST API", "Django MVC", "Django Models", "Django Views", "URL Routing", "React-Express Integration"],
  "ANN and Machine Learning": ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Linear Regression", "Logistic Regression", "Decision Tree", "Random Forest", "SVM", "K-Means Clustering", "KNN Algorithm", "Naive Bayes", "Gradient Descent", "Overfitting", "Underfitting", "Cross Validation", "Confusion Matrix", "Precision Recall", "Neural Networks Basics", "Activation Functions", "Backpropagation", "CNN", "RNN", "LSTM", "Perceptron", "Multilayer Perceptron", "Dropout", "Batch Normalization"],
  "Data Analytics": ["Data Preprocessing", "Data Cleaning", "Handling Missing Values", "Outlier Detection", "Feature Engineering", "Feature Selection", "Exploratory Data Analysis", "Data Visualization", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Correlation Analysis", "Hypothesis Testing", "Statistical Inference", "Regression Analysis", "Classification", "Clustering", "Dimensionality Reduction", "PCA", "Time Series Analysis", "Data Wrangling", "GroupBy Operations", "Pivot Tables", "Dashboard Creation"],
  "Universal Human Values": ["Human Values Basics", "Self Exploration", "Harmony in Family", "Harmony in Society", "Harmony with Nature", "Right Understanding", "Ethical Human Conduct", "Professional Ethics"],
  "Aptitude": ["Number System", "Percentages", "Profit and Loss", "Time and Work", "Time Speed Distance", "Ratio Proportion", "Averages", "Probability", "Permutation Combination", "Logical Reasoning", "Verbal Ability"],
  "Soft Skills": ["Communication Skills", "Group Discussion", "Interview Skills", "Resume Writing", "Presentation Skills", "Email Writing", "Leadership"],
};

const formatSlotText = (slot) => {
  if (!slot) return "-";
  return `${slot.relative_label || slot.day} | ${slot.day}, ${slot.start} - ${slot.end}`;
};

export default function SubmitDoubt({ user, faculty, onBack, onSubmitted, darkMode, resubmitData }) {
  const bg = darkMode ? "#0f0e1a" : "#f5f3ff";
  const cardBg = darkMode ? "#1e1b4b" : "#fff";
  const textColor = darkMode ? "#f1f5f9" : "#1a1a2e";
  const subColor = darkMode ? "#a5b4fc" : "#64748b";
  const borderColor = darkMode ? "#312e81" : "#ede9fe";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    subject: resubmitData?.subject || faculty?.subject || "",
    topic: resubmitData?.topic || "",
    description: resubmitData?.description || "",
  });
  const [duration, setDuration] = useState("medium");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState("");

  const topics = SUBJECT_TOPICS[form.subject] || [];
  const filteredTopics = topics.filter((topic) => topic.toLowerCase().includes(topicSearch.toLowerCase()));

  useEffect(() => {
    const fetchSlots = async () => {
      if (!faculty?._id || !user?.token) {
        setAvailableSlots([]);
        setSelectedSlot(null);
        setSlotError("Faculty details are missing for scheduling.");
        return;
      }

      setSlotsLoading(true);
      setSlotError("");
      try {
        const res = await fetch(`${API}/doubts/available-slots/${faculty._id}`, {
          headers: { authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load available slots");
        setAvailableSlots(data.slots || []);
        setSelectedSlot((data.slots || [])[0] || null);
        if (!data.slots?.length) {
          setSlotError("No mutually free slots are available right now. Try another faculty or check again later.");
        }
      } catch (err) {
        setAvailableSlots([]);
        setSelectedSlot(null);
        setSlotError(err.message);
      }
      setSlotsLoading(false);
    };

    fetchSlots();
  }, [faculty?._id, user?.token]);

  const submitDoubt = async () => {
    if (!faculty?._id) {
      setError("Faculty details are unavailable.");
      return;
    }
    if (!form.topic || !form.description) {
      setError("Please fill all fields");
      return;
    }
    if (!selectedSlot) {
      setError("Please select one mutually free slot");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/doubts/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          subject: form.subject,
          topic: form.topic,
          description: form.description,
          faculty_id: faculty._id,
          duration,
          scheduled_date: selectedSlot.date,
          scheduled_period: selectedSlot.period,
          reminder_minutes: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to schedule doubt");
      setResult(data);
      setStep("success");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (step === "success" && result) {
    const scheduledSlot = result.scheduled_slot;
    return (
      <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: cardBg, borderRadius: 24, padding: 40, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(124,58,237,0.15)", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(124,58,237,0.3)", fontSize: 36, color: "#fff" }}>S</div>
          <h2 style={{ color: PURPLE, margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Doubt Scheduled!</h2>
          <p style={{ color: subColor, marginBottom: 28, fontSize: 14 }}>Your slot is reserved and the reminder scaffold is ready.</p>

          <div style={{ background: darkMode ? "#0f0e1a" : "#faf5ff", borderRadius: 16, padding: 20, marginBottom: 20, textAlign: "left", border: `1px solid ${borderColor}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE, marginBottom: 12, letterSpacing: 0.5 }}>BOOKING SUMMARY</div>
            {[
              ["Faculty", faculty?.faculty_name || "-"],
              ["Subject", form.subject],
              ["Topic", form.topic],
              ["Slot", formatSlotText(scheduledSlot)],
              ["Reminder", "10 minutes before the slot"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${borderColor}`, fontSize: 13 }}>
                <span style={{ color: subColor }}>{label}</span>
                <span style={{ color: textColor, fontWeight: 600, textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              ["SLOT", `${scheduledSlot?.start || "-"} - ${scheduledSlot?.end || "-"}`, "Booked Time"],
              ["DAY", scheduledSlot?.relative_label || scheduledSlot?.day || "-", "Meeting Day"],
              ["REMIND", "T-10 min", "Reminder"],
            ].map(([icon, value, label]) => (
              <div key={label} style={{ background: darkMode ? "#0f0e1a" : "#faf5ff", borderRadius: 12, padding: "14px 8px", border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: PURPLE, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: PURPLE_DARK }}>{value}</div>
                <div style={{ fontSize: 10, color: subColor, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 14, marginBottom: 16, textAlign: "left" }}>
            <div style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>Only mutually free slots were shown, and this slot is now reserved for the faculty and the student.</div>
          </div>

          <button onClick={onSubmitted} style={{ width: "100%", padding: "14px 0", background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
            View My Doubts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <div style={{ background: cardBg, borderBottom: `1px solid ${borderColor}`, padding: "0 32px", display: "flex", alignItems: "center", gap: 16, height: 64 }}>
        <button onClick={onBack} style={{ padding: "8px 16px", border: `1px solid ${borderColor}`, borderRadius: 8, background: "none", color: subColor, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Back</button>
        <span style={{ fontWeight: 700, color: textColor, fontSize: 15 }}>{resubmitData ? "Re-schedule Doubt" : "Schedule Doubt"}</span>
        {resubmitData && <span style={{ background: "#fef3c7", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>Resubmitting</span>}
      </div>

      <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ background: cardBg, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: PURPLE }}>{faculty?.faculty_name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 700, color: textColor, fontSize: 15 }}>{faculty?.faculty_name}</div>
              <div style={{ fontSize: 12, color: subColor }}>{faculty?.subject}</div>
              {faculty?.cabin && <div style={{ fontSize: 11, color: subColor }}>Cabin {faculty.cabin} | {faculty.block}</div>}
            </div>
          </div>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: faculty?.status === "available" ? "#dcfce7" : "#fef3c7", color: faculty?.status === "available" ? "#16a34a" : "#d97706", fontSize: 12, fontWeight: 700 }}>{faculty?.status || "unknown"}</span>
        </div>

        {resubmitData?.reject_reason && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Previous rejection reason</div>
            <div style={{ fontSize: 13, color: "#991b1b" }}>{resubmitData.reject_reason}</div>
          </div>
        )}

        <div style={{ display: "flex", marginBottom: 24, background: cardBg, borderRadius: 12, padding: 4, border: `1px solid ${borderColor}` }}>
          {[["1", "Topic", 1], ["2", "Describe + Slot", 2], ["3", "Review", "preview"]].map(([num, label, value]) => (
            <div key={label} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, background: step === value ? PURPLE : "transparent", color: step === value ? "#fff" : subColor, fontSize: 13, fontWeight: step === value ? 700 : 500, transition: "all 0.2s" }}>
              {num}. {label}
            </div>
          ))}
        </div>

        <div style={{ background: cardBg, borderRadius: 16, padding: 28, border: `1px solid ${borderColor}`, boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, display: "block", marginBottom: 8 }}>Subject</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, topic: "" })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", background: cardBg, color: textColor }}>
                  {["Web Technology", "Design and Analysis of Algorithms", "ANN and Machine Learning", "Computer Networks", "Data Analytics", "Universal Human Values", "Aptitude", "Soft Skills"].map((subject) => <option key={subject}>{subject}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, display: "block", marginBottom: 8 }}>Topic</label>
                <input value={form.topic} onChange={(e) => { setForm({ ...form, topic: e.target.value }); setTopicSearch(e.target.value); }} placeholder="Type or select a topic..." style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", boxSizing: "border-box", background: cardBg, color: textColor }} />
                {topicSearch && filteredTopics.length > 0 && (
                  <div style={{ border: `1px solid ${borderColor}`, borderRadius: 10, marginTop: 4, maxHeight: 180, overflowY: "auto", background: cardBg, boxShadow: "0 4px 16px rgba(124,58,237,0.1)" }}>
                    {filteredTopics.map((topic) => (
                      <div key={topic} onClick={() => { setForm({ ...form, topic }); setTopicSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: textColor, borderBottom: `1px solid ${borderColor}` }}>
                        {topic}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {topics.slice(0, 6).map((topic) => (
                    <span key={topic} onClick={() => { setForm({ ...form, topic }); setTopicSearch(""); }} style={{ padding: "4px 10px", background: PURPLE_LIGHT, color: PURPLE, borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => form.topic && setStep(2)} style={{ width: "100%", padding: "13px 0", background: form.topic ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})` : "#e2e8f0", color: form.topic ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 700, cursor: form.topic ? "pointer" : "not-allowed", fontSize: 15 }}>Next</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, display: "block", marginBottom: 8 }}>Describe your doubt</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explain what you tried and where you are stuck..." rows={6} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${borderColor}`, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", background: cardBg, color: textColor }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: textColor, marginBottom: 10, display: "block" }}>Estimated duration</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ value: "quick", label: "Quick", sub: "5-10 mins" }, { value: "medium", label: "Medium", sub: "15-20 mins" }, { value: "long", label: "Long", sub: "30+ mins" }].map((option) => (
                    <div key={option.value} onClick={() => setDuration(option.value)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: `2px solid ${duration === option.value ? PURPLE : borderColor}`, background: duration === option.value ? PURPLE_LIGHT : cardBg, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: duration === option.value ? PURPLE : textColor }}>{option.label}</div>
                      <div style={{ fontSize: 11, color: subColor }}>{option.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: textColor }}>Mutually free slots</label>
                  <span style={{ fontSize: 11, color: subColor }}>10-minute reminder scaffolded</span>
                </div>
                {slotsLoading ? (
                  <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${borderColor}`, color: subColor }}>Loading available slots...</div>
                ) : slotError ? (
                  <div style={{ padding: 16, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{slotError}</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {availableSlots.map((slot) => {
                      const selected = selectedSlot?.date === slot.date && selectedSlot?.period === slot.period;
                      return (
                        <button key={`${slot.date}-${slot.period}`} onClick={() => setSelectedSlot(slot)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: selected ? `2px solid ${PURPLE}` : `1px solid ${borderColor}`, background: selected ? PURPLE_LIGHT : cardBg, cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: selected ? PURPLE : textColor }}>{slot.relative_label}</div>
                          <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{slot.day} | Period {slot.period} | {slot.start} - {slot.end}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: "13px 0", background: "none", border: `1.5px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, cursor: "pointer", color: subColor }}>Back</button>
                <button onClick={() => form.description && selectedSlot && setStep("preview")} style={{ flex: 2, padding: "13px 0", background: form.description && selectedSlot ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})` : "#e2e8f0", color: form.description && selectedSlot ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 700, cursor: form.description && selectedSlot ? "pointer" : "not-allowed", fontSize: 15 }}>Review</button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: PURPLE_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>R</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: textColor }}>Review your booking</div>
                <div style={{ fontSize: 13, color: subColor, marginTop: 4 }}>Only the selected mutual slot will be booked.</div>
              </div>
              <div style={{ background: darkMode ? "#0f0e1a" : "#faf5ff", borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${borderColor}` }}>
                {[
                  ["Faculty", faculty?.faculty_name],
                  ["Subject", form.subject],
                  ["Topic", form.topic],
                  ["Duration", duration === "quick" ? "Quick" : duration === "medium" ? "Medium" : "Long"],
                  ["Slot", formatSlotText(selectedSlot)],
                  ["Reminder", "10 minutes before the slot"],
                  ["Description", form.description],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: "8px 0", borderBottom: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: subColor, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 13, color: textColor, fontWeight: label === "Description" ? 400 : 600, lineHeight: 1.5 }}>{value}</div>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: "13px 0", background: "none", border: `1.5px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, cursor: "pointer", color: subColor }}>Edit</button>
                <button onClick={submitDoubt} disabled={loading} style={{ flex: 2, padding: "13px 0", background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 15, opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}>
                  {loading ? "Scheduling..." : "Schedule Doubt"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## C:\Users\asus\sync-kiet\frontend\src\pages\StudentDashboard.js

`$lang
import { useState, useEffect, useRef } from "react";
import SubmitDoubt from "./SubmitDoubt";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const PURPLE_LIGHT = "#ede9fe";
const PURPLE_MID = "#8b5cf6";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes pulseRing { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
  @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  .fac-card{transition:transform 0.2s ease,box-shadow 0.2s ease !important;cursor:pointer}
  .fac-card:hover{transform:translateY(-3px) !important;box-shadow:0 12px 32px rgba(124,58,237,0.14) !important}
  .nav-item{transition:all 0.18s ease;cursor:pointer}
  .nav-item:hover{background:rgba(255,255,255,0.15) !important}
  .skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:shimmer 1.4s ease infinite;border-radius:8px}
  .page-anim{animation:fadeInUp 0.35s ease both}
  .btn-purple{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;transition:opacity 0.2s,transform 0.15s}
  .btn-purple:hover{opacity:0.92;transform:translateY(-1px)}
  .stat-chip{transition:all 0.2s ease;cursor:pointer}
  .stat-chip:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,0.2) !important}
  .calendar-day{transition:all 0.15s ease;cursor:pointer;border-radius:6px}
  .calendar-day:hover{background:#ede9fe !important;color:#7c3aed !important}
  .activity-row{transition:background 0.15s ease;cursor:pointer;border-radius:8px}
  .activity-row:hover{background:#ede9fe !important}
  .announce-item{animation:slideDown 0.3s ease both}
`;

const StatusBadge = ({ status }) => {
  const config = {
    available:{label:"Available",color:"#16a34a",bg:"#dcfce7"},
    in_class:{label:"In Class",color:"#2563eb",bg:"#dbeafe"},
    busy:{label:"Busy",color:"#dc2626",bg:"#fee2e2"},
    scheduled:{label:"Scheduled",color:"#7c3aed",bg:"#ede9fe"},
    lunch:{label:"Lunch",color:"#d97706",bg:"#fef3c7"},
    holiday:{label:"Holiday",color:"#7c3aed",bg:"#ede9fe"},
    not_checked_in:{label:"Not Checked In",color:"#94a3b8",bg:"#f1f5f9"},
    not_arrived:{label:"Not Arrived",color:"#94a3b8",bg:"#f1f5f9"},
    left:{label:"Left",color:"#dc2626",bg:"#fee2e2"},
    pending:{label:"Pending",color:"#d97706",bg:"#fef3c7"},
    active:{label:"Active",color:"#2563eb",bg:"#dbeafe"},
    completed:{label:"Completed",color:"#16a34a",bg:"#dcfce7"},
    rejected:{label:"Rejected",color:"#dc2626",bg:"#fee2e2"},
  }[status] || {label:status,color:"#94a3b8",bg:"#f1f5f9"};
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:config.bg,fontSize:11,fontWeight:700,color:config.color}}>
      {status==="available"&&(<span style={{position:"relative",width:7,height:7,display:"inline-block"}}><span style={{position:"absolute",inset:0,borderRadius:"50%",background:config.color,opacity:0.4,animation:"pulseRing 1.5s ease-out infinite"}}/><span style={{position:"absolute",inset:1,borderRadius:"50%",background:config.color}}/></span>)}
      {(status==="busy"||status==="in_class")&&<span style={{width:7,height:7,borderRadius:"50%",border:`2px solid ${config.color}`,borderTopColor:"transparent",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>}
      {config.label}
    </span>
  );
};

const formatBookedSlot = (doubt) => {
  if (!doubt?.scheduled_day || !doubt?.scheduled_start || !doubt?.scheduled_end) return "";
  return `${doubt.scheduled_day} | ${doubt.scheduled_start} - ${doubt.scheduled_end}`;
};

const Confetti = () => {
  const pieces = Array.from({length:20},(_,i)=>({color:[PURPLE,"#22c55e","#f59e0b","#ef4444","#8b5cf6","#f97316"][i%6],left:`${(i*5)+2}%`,delay:`${i*0.08}s`,size:[8,10,6,12][i%4]}));
  return (<div style={{position:"fixed",top:0,left:0,right:0,pointerEvents:"none",zIndex:9999,height:"100vh",overflow:"hidden"}}>{pieces.map((p,i)=>(<div key={i} style={{position:"absolute",left:p.left,top:"-20px",width:p.size,height:p.size,background:p.color,borderRadius:i%3===0?"50%":2,animation:`confettiFall 2s ease-out ${p.delay} both`}}/>))}</div>);
};

const AIHint = ({ topic }) => {
  const hints = {"Event Loop":"JavaScript Event Loop works by pushing async callbacks to the call stack only when its empty.","KNN":"KNN classifies by finding K nearest neighbors using distance.","Dijkstra Algorithm":"Dijkstra uses a greedy approach — always pick the unvisited node with smallest distance."};
  const key = Object.keys(hints).find(k=>topic?.toLowerCase().includes(k.toLowerCase())||k.toLowerCase().includes(topic?.toLowerCase()||""));
  const hint = hints[key]||`For ${topic}, start by understanding the core definition, then work through a simple example step by step.`;
  return (<div style={{background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",border:"1px solid #ddd6fe",borderRadius:10,padding:12,marginTop:10}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{fontSize:14}}>🤖</span><span style={{fontSize:10,fontWeight:800,color:PURPLE,letterSpacing:0.5}}>AI HINT</span></div><div style={{fontSize:12,color:"#5b21b6",lineHeight:1.6}}>{hint}</div></div>);
};

const MiniCalendar = ({ darkMode, myDoubts, onDateClick }) => {
  const now = new Date(), year=now.getFullYear(), month=now.getMonth(), today=now.getDate();
  const monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
  const cells=[]; for(let i=0;i<firstDay;i++)cells.push(null); for(let d=1;d<=daysInMonth;d++)cells.push(d);
  const activeDays=new Set(myDoubts.filter(d=>d.created_at).map(d=>new Date(d.created_at).getDate()));
  return (
    <div style={{background:darkMode?"#1e1b4b":"#fff",borderRadius:16,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:700,color:darkMode?"#c4b5fd":PURPLE}}>{monthNames[month]} {year}</span>
        <span style={{fontSize:10,color:darkMode?"#a5b4fc":"#94a3b8"}}>Click date for activity</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center"}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(<div key={i} style={{fontSize:10,fontWeight:700,color:darkMode?"#7c3aed":"#94a3b8",padding:"2px 0"}}>{d}</div>))}
        {cells.map((d,i)=>(
          <div key={i} className={d?"calendar-day":""} onClick={()=>d&&onDateClick(d)}
            style={{fontSize:11,padding:"5px 0",fontWeight:d===today?800:400,background:d===today?PURPLE:"transparent",color:d===today?"#fff":darkMode?"#e2e8f0":"#374151",position:"relative"}}>
            {d||""}
            {d&&activeDays.has(d)&&d!==today&&(<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:PURPLE}}/>)}
          </div>
        ))}
      </div>
    </div>
  );
};

const DateActivityModal = ({ date, doubts, onClose, darkMode }) => {
  const cardBg=darkMode?"#1e1b4b":"#fff", textColor=darkMode?"#f1f5f9":"#1a1a2e", subColor=darkMode?"#a5b4fc":"#64748b", borderColor=darkMode?"#312e81":"#ede9fe";
  const now=new Date();
  const dateDoubts=doubts.filter(d=>{if(!d.created_at)return false;const dd=new Date(d.created_at);return dd.getDate()===date&&dd.getMonth()===now.getMonth()&&dd.getFullYear()===now.getFullYear();});
  const monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:cardBg,borderRadius:20,padding:28,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div><h3 style={{margin:0,fontWeight:800,color:textColor}}>Activity on {date} {monthNames[now.getMonth()]}</h3><div style={{fontSize:12,color:subColor,marginTop:2}}>{dateDoubts.length} doubt{dateDoubts.length!==1?"s":""} submitted</div></div>
          <button onClick={onClose} style={{background:PURPLE_LIGHT,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:PURPLE,fontWeight:700}}>✕</button>
        </div>
        {dateDoubts.length===0?(
          <div style={{textAlign:"center",padding:24,color:subColor}}><div style={{fontSize:32,marginBottom:8}}>📭</div>No activity on this day</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {dateDoubts.map((d,i)=>(
              <div key={i} style={{background:darkMode?"#0f0e1a":"#fafaf9",borderRadius:10,padding:12,border:`1px solid ${borderColor}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontWeight:700,fontSize:13,color:textColor}}>{d.topic}</div><div style={{fontSize:11,color:subColor}}>{d.subject}</div>{d.faculty_name&&<div style={{fontSize:11,color:PURPLE,marginTop:2}}>👨‍🏫 {d.faculty_name}</div>}</div>
                  <StatusBadge status={d.status}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function StudentDashboard({ user, setUser, darkMode, setDarkMode }) {
  const isDark=darkMode;
  const bg=isDark?"#0f0e1a":"#f5f3ff", cardBg=isDark?"#1e1b4b":"#fff", textColor=isDark?"#f1f5f9":"#1a1a2e", subColor=isDark?"#a5b4fc":"#64748b", borderColor=isDark?"#312e81":"#ede9fe";

  const [page,setPage]=useState("home");
  const [faculty,setFaculty]=useState([]);
  const [selectedFaculty,setSelectedFaculty]=useState(null);
  const [myDoubts,setMyDoubts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [subjectFilter,setSubjectFilter]=useState("");
  const [availFilter,setAvailFilter]=useState("");
  const [sortBy,setSortBy]=useState("default");
  const [showConfetti,setShowConfetti]=useState(false);
  const [announcements,setAnnouncements]=useState([]);
  const [showAllAnnouncements,setShowAllAnnouncements]=useState(false);
  const [notifDismissed,setNotifDismissed]=useState(localStorage.getItem("notifDismissed")==="true");
  const wsRef=useRef(null);
  const [recommendTopic,setRecommendTopic]=useState("");
  const [recommendSubject,setRecommendSubject]=useState("");
  const [recommendations,setRecommendations]=useState(null);
  const [recLoading,setRecLoading]=useState(false);
  const [showRecommend,setShowRecommend]=useState(false);
  const [selectedDate,setSelectedDate]=useState(null);
  const [resubmitDoubt,setResubmitDoubt]=useState(null);

  const filteredFaculty=faculty
    .filter(f=>f.faculty_name?.toLowerCase().includes(search.toLowerCase()))
    .filter(f=>subjectFilter?f.subject===subjectFilter:true)
    .filter(f=>availFilter?f.status===availFilter:true)
    .sort((a,b)=>{
      if(sortBy==="available"){const o={available:0,in_class:1,busy:2,lunch:3,not_checked_in:4,holiday:5,not_arrived:6,left:7};return(o[a.status]??8)-(o[b.status]??8);}
      if(sortBy==="name")return a.faculty_name?.localeCompare(b.faculty_name);
      if(sortBy==="queue")return(a.queue_count||0)-(b.queue_count||0);
      return 0;
    });

  useEffect(()=>{
    requestNotificationPermission(); fetchFaculty(); fetchMyDoubts(); fetchAnnouncements();
    const connectWS=()=>{
      const ws=new WebSocket("ws://localhost:8000/ws"); wsRef.current=ws;
      ws.onopen=()=>console.log("WebSocket connected");
      ws.onmessage=()=>{fetchFaculty();fetchMyDoubts();fetchAnnouncements();};
      ws.onclose=()=>{setTimeout(connectWS,2000);};
      ws.onerror=(err)=>{console.error(err);ws.close();};
    };
    connectWS();
    return()=>{if(wsRef.current)wsRef.current.close();};
  },[]);

  useEffect(()=>{
    const remindForScheduledDoubts=()=>{
      const now=Date.now();
      myDoubts
        .filter(d=>d.status==="scheduled"&&d.reminder_at&&d.scheduled_for)
        .forEach(doubt=>{
          const reminderAt=new Date(doubt.reminder_at).getTime();
          const scheduledFor=new Date(doubt.scheduled_for).getTime();
          const reminderKey=`doubt-reminder-${doubt._id}`;
          if(Number.isNaN(reminderAt)||Number.isNaN(scheduledFor))return;
          if(now>=reminderAt&&now<=scheduledFor+5*60*1000&&!localStorage.getItem(reminderKey)){
            sendNotification("Doubt reminder",`${doubt.topic} with ${doubt.faculty_name||"faculty"} starts at ${doubt.scheduled_start}.`);
            localStorage.setItem(reminderKey,"sent");
          }
        });
    };

    remindForScheduledDoubts();
    const timer=setInterval(remindForScheduledDoubts,60000);
    return()=>clearInterval(timer);
  },[myDoubts]);

  const requestNotificationPermission=async()=>{if("Notification"in window)await Notification.requestPermission();};
  const sendNotification=(title,body)=>{if("Notification"in window&&Notification.permission==="granted")new Notification(title,{body,icon:"/favicon.ico"});};
  const fetchFaculty=async()=>{try{const res=await fetch(`${API}/timetable/all-faculty-status`);const data=await res.json();setFaculty(data.faculty||[]);}catch{}setLoading(false);};
  const fetchAnnouncements=async()=>{try{const res=await fetch(`${API}/admin/announcements`);const data=await res.json();setAnnouncements(data.announcements||[]);}catch{}};
  const fetchMyDoubts=async()=>{
    try{
      const res=await fetch(`${API}/doubts/my-doubts`,{headers:{authorization:`Bearer ${user.token}`}});
      const data=await res.json(); const newDoubts=data.doubts||[];
      newDoubts.forEach(nd=>{
        const od=myDoubts.find(d=>d._id===nd._id);
        if(od&&od.status!==nd.status){
          if(nd.status==="scheduled")sendNotification("Doubt scheduled",`${nd.topic} is booked for ${formatBookedSlot(nd) || `${nd.scheduled_day} at ${nd.scheduled_start}`}.`);
          if(nd.status==="active")sendNotification("Your turn!",`${nd.topic} session started!`);
          if(nd.status==="completed"){sendNotification("Done!",`${nd.topic} resolved.`);setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3000);}
          if(nd.status==="rejected")sendNotification("Rejected",`${nd.topic}: ${nd.reject_reason||""}`);
        }
      });
      setMyDoubts(newDoubts);
    }catch{}
  };
  const logout=()=>{localStorage.clear();setUser(null);};
  const fetchRecommendations=async()=>{
    if(!recommendTopic.trim())return; setRecLoading(true);
    try{
      const res=await fetch(`${API}/doubts/recommend-faculty`,{method:"POST",headers:{"Content-Type":"application/json",authorization:`Bearer ${user.token}`},body:JSON.stringify({topic:recommendTopic,subject:recommendSubject})});
      const data=await res.json(); if(res.ok)setRecommendations(data.recommendations||[]);
    }catch{}
    setRecLoading(false);
  };

  if(resubmitDoubt){
    const fac=faculty.find(f=>f._id===resubmitDoubt.faculty_id||f.faculty_name===resubmitDoubt.faculty_name);
    return(<SubmitDoubt darkMode={darkMode} user={user} faculty={fac||selectedFaculty} resubmitData={{topic:resubmitDoubt.topic,subject:resubmitDoubt.subject,description:resubmitDoubt.description,reject_reason:resubmitDoubt.reject_reason}} onBack={()=>setResubmitDoubt(null)} onSubmitted={()=>{setResubmitDoubt(null);setPage("mydoubts");fetchMyDoubts();}}/>);
  }
  if(page==="submit")return(<SubmitDoubt darkMode={darkMode} user={user} faculty={selectedFaculty} onBack={()=>setPage("home")} onSubmitted={()=>{setPage("mydoubts");fetchMyDoubts();}}/>);

  const navItems=[{id:"home",icon:"⊞",label:"Dashboard"},{id:"mydoubts",icon:"📋",label:"My Doubts"},{id:"analytics",icon:"📊",label:"Analytics"}];
  const pendingCount=myDoubts.filter(d=>d.status==="pending").length;
  const scheduledCount=myDoubts.filter(d=>d.status==="scheduled").length;
  const activeCount=myDoubts.filter(d=>d.status==="active").length;
  const completedCount=myDoubts.filter(d=>d.status==="completed").length;
  const availableFaculty=faculty.filter(f=>f.status==="available").length;

  return (
    <div style={{display:"flex",minHeight:"100vh",background:bg,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif"}}>
      <style dangerouslySetInnerHTML={{__html:styles}}/>
      {showConfetti&&<Confetti/>}
      {selectedDate&&<DateActivityModal date={selectedDate} doubts={myDoubts} onClose={()=>setSelectedDate(null)} darkMode={isDark}/>}

      {/* SIDEBAR */}
      <div style={{width:220,minHeight:"100vh",background:`linear-gradient(160deg,${PURPLE} 0%,${PURPLE_DARK} 100%)`,display:"flex",flexDirection:"column",padding:"28px 16px",position:"fixed",left:0,top:0,bottom:0,zIndex:100,boxShadow:"4px 0 24px rgba(124,58,237,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:40,padding:"0 8px"}}>
          <div style={{width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:18,color:"#fff"}}>P</div>
          <span style={{fontWeight:800,fontSize:17,color:"#fff",letterSpacing:-0.3}}>PuchoKIET</span>
        </div>
        <nav style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
          {navItems.map(item=>(
            <div key={item.id} className="nav-item" onClick={()=>setPage(item.id)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:12,background:page===item.id?"rgba(255,255,255,0.22)":"transparent"}}>
              <span style={{fontSize:16}}>{item.icon}</span>
              <span style={{fontSize:14,fontWeight:page===item.id?700:500,color:page===item.id?"#fff":"rgba(255,255,255,0.72)"}}>{item.label}</span>
              {item.id==="mydoubts"&&(pendingCount+scheduledCount+activeCount)>0&&(<span style={{marginLeft:"auto",background:"#fbbf24",color:"#1a1a1a",fontSize:10,fontWeight:800,borderRadius:10,padding:"1px 6px"}}>{pendingCount+scheduledCount+activeCount}</span>)}
            </div>
          ))}
        </nav>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.15)",paddingTop:16,marginTop:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 8px",marginBottom:12}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#fff",flexShrink:0}}>{user.name?.[0]?.toUpperCase()}</div>
            <div style={{overflow:"hidden"}}><div style={{fontSize:12,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Student</div></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setDarkMode(!darkMode)} style={{flex:1,padding:"8px 0",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:14}}>{darkMode?"☀️":"🌙"}</button>
            <button onClick={logout} style={{flex:2,padding:"8px 0",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"rgba(255,255,255,0.85)",cursor:"pointer",fontSize:12,fontWeight:600}}>Logout</button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{marginLeft:220,flex:1,padding:"32px 28px",maxWidth:"calc(100vw - 220px)"}}>

        {!notifDismissed&&"Notification"in window&&Notification.permission!=="granted"&&(
          <div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #fbbf24",borderRadius:12,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>🔔</span><div><div style={{fontSize:13,fontWeight:700,color:"#92400e"}}>Enable Notifications</div><div style={{fontSize:11,color:"#a16207"}}>Get notified when your doubt is resolved</div></div></div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{Notification.requestPermission();setNotifDismissed(true);localStorage.setItem("notifDismissed","true");}} style={{padding:"6px 14px",background:"#f59e0b",color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12}}>Allow</button>
              <button onClick={()=>{setNotifDismissed(true);localStorage.setItem("notifDismissed","true");}} style={{background:"transparent",border:"none",color:"#a16207",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
          </div>
        )}

        {/* HOME PAGE */}
        {page==="home"&&(
          <div className="page-anim">
            {/* Welcome Banner */}
            <div style={{background:`linear-gradient(135deg,${PURPLE} 0%,${PURPLE_MID} 60%,#a78bfa 100%)`,borderRadius:20,padding:"28px 32px",marginBottom:24,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-30,right:-30,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:4}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
              <h2 style={{fontSize:26,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>Welcome back, {user.name?.split(" ")[0]}! 👋</h2>
              <p style={{color:"rgba(255,255,255,0.75)",margin:0,fontSize:14}}>Always stay updated in your student portal</p>
              <div style={{display:"flex",gap:16,marginTop:20,flexWrap:"wrap"}}>
                {[
                  {label:"Available Faculty",value:availableFaculty,color:"#a7f3d0",action:()=>{setAvailFilter("available");document.getElementById("faculty-grid")?.scrollIntoView({behavior:"smooth"});}},
                  {label:"My Pending",value:pendingCount,color:"#fde68a",action:()=>setPage("mydoubts")},
                  {label:"Resolved",value:completedCount,color:"#c4b5fd",action:()=>setPage("analytics")},
                ].map((s,i)=>(
                  <div key={i} className="stat-chip" onClick={s.action} style={{background:"rgba(255,255,255,0.12)",borderRadius:12,padding:"10px 18px",backdropFilter:"blur(8px)",boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}>
                    <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:2}}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:20}}>
              <div>
                {/* Announcements */}
                {announcements.length>0&&(
                  <div style={{background:cardBg,borderRadius:16,padding:18,marginBottom:20,border:`1px solid ${borderColor}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📢</div>
                        <span style={{fontWeight:700,fontSize:14,color:textColor}}>Announcements</span>
                        <span style={{background:"#fef3c7",color:"#d97706",fontSize:10,fontWeight:800,padding:"2px 6px",borderRadius:10}}>{announcements.length}</span>
                      </div>
                      {announcements.length>1&&(<button onClick={()=>setShowAllAnnouncements(!showAllAnnouncements)} style={{background:"none",border:"none",color:PURPLE,fontSize:12,fontWeight:600,cursor:"pointer"}}>{showAllAnnouncements?`Show less ↑`:`View all ${announcements.length} ↓`}</button>)}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {(showAllAnnouncements?announcements:announcements.slice(0,3)).map((ann,i)=>(
                        <div key={i} className="announce-item" style={{background:isDark?"#0f0e1a":"#fffbeb",borderRadius:10,padding:"10px 14px",border:`1px solid ${isDark?"#312e81":"#fde68a"}`,animationDelay:`${i*0.05}s`}}>
                          <div style={{fontSize:13,color:textColor,fontWeight:i===0?600:400}}>{ann.message}</div>
                          {ann.created_at&&<div style={{fontSize:10,color:subColor,marginTop:3}}>{new Date(ann.created_at).toLocaleDateString("en-US",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Faculty Finder */}
                <div style={{background:cardBg,borderRadius:16,padding:20,marginBottom:20,border:`1px solid ${borderColor}`,boxShadow:"0 2px 12px rgba(124,58,237,0.06)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showRecommend?16:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:PURPLE_LIGHT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
                      <div><div style={{fontWeight:700,fontSize:14,color:textColor}}>AI Faculty Finder</div><div style={{fontSize:12,color:subColor}}>Get the best faculty recommendation for your doubt</div></div>
                    </div>
                    <button onClick={()=>{setShowRecommend(!showRecommend);setRecommendations(null);}} className="btn-purple" style={{padding:"7px 16px",fontSize:12}}>{showRecommend?"✕ Close":"Try it ✨"}</button>
                  </div>
                  {showRecommend&&(
                    <div>
                      <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                        <select value={recommendSubject} onChange={e=>setRecommendSubject(e.target.value)} style={{padding:"9px 12px",borderRadius:10,border:`1.5px solid ${borderColor}`,fontSize:13,outline:"none",color:textColor,background:cardBg,minWidth:170}}>
                          <option value="">Any Subject</option>
                          {["Design and Analysis of Algorithms","Computer Networks","Web Technology","ANN and Machine Learning","Data Analytics","Universal Human Values","Aptitude","Soft Skills"].map(s=><option key={s}>{s}</option>)}
                        </select>
                        <input value={recommendTopic} onChange={e=>setRecommendTopic(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fetchRecommendations()} placeholder="e.g. Dijkstra, KNN, BST" style={{flex:1,minWidth:160,padding:"9px 14px",borderRadius:10,border:`1.5px solid ${borderColor}`,fontSize:13,outline:"none",background:cardBg,color:textColor}}/>
                        <button onClick={fetchRecommendations} disabled={recLoading||!recommendTopic.trim()} className="btn-purple" style={{padding:"9px 18px",fontSize:13,opacity:(recLoading||!recommendTopic.trim())?0.6:1}}>{recLoading?"Finding...":"🔍 Find"}</button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                        {["Dijkstra","Binary Search Tree","KNN","React Hooks","OSI Model","Dynamic Programming"].map(t=>(<span key={t} onClick={()=>setRecommendTopic(t)} style={{padding:"4px 10px",background:PURPLE_LIGHT,color:PURPLE,borderRadius:20,fontSize:11,cursor:"pointer",fontWeight:600}}>{t}</span>))}
                      </div>
                      {recommendations&&recommendations.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{fontSize:11,fontWeight:700,color:subColor,textTransform:"uppercase",letterSpacing:0.5}}>Top {recommendations.length} for "{recommendTopic}"</div>
                          {recommendations.map((rec,i)=>(
                            <div key={rec.faculty_id} className="fac-card" onClick={()=>{const fac=faculty.find(f=>f._id===rec.faculty_id);if(fac){setSelectedFaculty(fac);setPage("submit");}}}
                              style={{background:i===0?`linear-gradient(135deg,${PURPLE_LIGHT},#ddd6fe)`:isDark?"#0f0e1a":"#fafaf9",borderRadius:12,padding:14,border:i===0?`2px solid ${PURPLE}`:`1px solid ${borderColor}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{display:"flex",alignItems:"center",gap:12}}>
                                <div style={{width:40,height:40,borderRadius:10,background:i===0?PURPLE:i===1?"#94a3b8":"#cd7f32",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{rec.medal}</div>
                                <div><div style={{fontWeight:700,fontSize:14,color:textColor}}>{rec.faculty_name}</div><div style={{fontSize:11,color:subColor}}>{rec.subject}</div><div style={{fontSize:11,color:PURPLE,fontWeight:600}}>{rec.reason}</div></div>
                              </div>
                              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                                <StatusBadge status={rec.status}/>
                                <button className="btn-purple" onClick={e=>{e.stopPropagation();const fac=faculty.find(f=>f._id===rec.faculty_id);if(fac){setSelectedFaculty(fac);setPage("submit");}}} style={{padding:"5px 12px",fontSize:11}}>Submit →</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {recommendations&&recommendations.length===0&&(<div style={{background:isDark?"#0f0e1a":"#fafaf9",borderRadius:10,padding:14,textAlign:"center",color:subColor,fontSize:13}}>No faculty found. Try a different topic.</div>)}
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div style={{background:cardBg,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${borderColor}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <input placeholder="🔍 Search faculty..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:180,padding:"9px 14px",borderRadius:10,border:`1.5px solid ${borderColor}`,fontSize:13,outline:"none",background:cardBg,color:textColor}}/>
                  <select value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)} style={{padding:"9px 12px",borderRadius:10,border:`1.5px solid ${borderColor}`,fontSize:12,outline:"none",color:subColor,background:cardBg}}>
                    <option value="">All Subjects</option>
                    {[...new Set(faculty.map(f=>f.subject))].sort().map(s=><option key={s}>{s}</option>)}
                  </select>
                  <select value={availFilter} onChange={e=>setAvailFilter(e.target.value)} style={{padding:"9px 12px",borderRadius:10,border:`1.5px solid ${borderColor}`,fontSize:12,outline:"none",color:subColor,background:cardBg}}>
                    <option value="">All Status</option>
                    <option value="available">Available Now</option>
                    <option value="in_class">In Class</option>
                    <option value="busy">Busy</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="not_checked_in">Not Checked In</option>
                    <option value="left">Left</option>
                  </select>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"9px 12px",borderRadius:10,border:`1.5px solid ${borderColor}`,fontSize:12,outline:"none",color:subColor,background:cardBg}}>
                    <option value="default">Sort: Default</option>
                    <option value="available">Available First</option>
                    <option value="name">Name A-Z</option>
                    <option value="queue">Least Queue</option>
                  </select>
                  <span style={{fontSize:12,color:subColor}}>{filteredFaculty.length} found</span>
                </div>

                {/* Faculty Grid */}
                <div id="faculty-grid">
                  {loading?(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                      {[1,2,3,4].map(i=>(<div key={i} style={{background:cardBg,borderRadius:14,padding:18,border:`1px solid ${borderColor}`}}><div className="skeleton" style={{height:16,width:"60%",marginBottom:10}}/><div className="skeleton" style={{height:12,width:"40%",marginBottom:16}}/><div className="skeleton" style={{height:36,width:"100%"}}/></div>))}
                    </div>
                  ):filteredFaculty.length===0?(
                    <div style={{background:cardBg,borderRadius:14,padding:40,textAlign:"center",color:subColor,border:`1px solid ${borderColor}`}}><div style={{fontSize:32,marginBottom:8}}>🔍</div>No faculty matching your filters</div>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                      {filteredFaculty.map((f,i)=>(
                        <div key={i} className="fac-card" style={{background:cardBg,borderRadius:14,padding:18,border:f.status==="available"?`2px solid ${PURPLE}`:`1px solid ${borderColor}`,boxShadow:f.status==="available"?"0 4px 20px rgba(124,58,237,0.1)":"0 2px 8px rgba(0,0,0,0.04)"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${PURPLE_LIGHT},#ddd6fe)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:PURPLE}}>{f.faculty_name?.[0]?.toUpperCase()}</div>
                              <div><div style={{fontWeight:700,fontSize:14,color:textColor}}>{f.faculty_name}</div><div style={{fontSize:11,color:subColor,marginTop:1}}>{f.subject?.slice(0,28)}{f.subject?.length>28?"…":""}</div></div>
                            </div>
                            <StatusBadge status={f.status}/>
                          </div>
                          {f.cabin&&<div style={{fontSize:11,color:subColor,marginBottom:4}}>📍 Cabin {f.cabin} · {f.block}</div>}
                          {f.free_slots_today?.length>0&&(<div style={{fontSize:11,color:"#059669",background:"#f0fdf4",borderRadius:6,padding:"4px 8px",display:"inline-block",marginBottom:8}}>🕒 Next free: <b>{f.free_slots_today[0]?.start}</b></div>)}
                          {f.queue_count>0&&<div style={{fontSize:11,color:"#d97706",background:"#fef3c7",borderRadius:6,padding:"3px 8px",display:"inline-block",marginBottom:8}}>👥 {f.queue_count} in queue</div>}
                          <button onClick={()=>{setSelectedFaculty(f);setPage("submit");}} className="btn-purple" style={{width:"100%",padding:"10px 0",fontSize:13,marginTop:8,borderRadius:10}}>Submit Doubt →</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <MiniCalendar darkMode={isDark} myDoubts={myDoubts} onDateClick={setSelectedDate}/>
                <div style={{background:cardBg,borderRadius:16,padding:16,border:`1px solid ${borderColor}`}}>
                  <div style={{fontWeight:700,fontSize:14,color:textColor,marginBottom:12}}>My Activity</div>
                  {[
                    {label:"Total Doubts",value:myDoubts.length,color:PURPLE,action:()=>setPage("mydoubts")},
                    {label:"Pending",value:pendingCount,color:"#d97706",action:()=>setPage("mydoubts")},
                    {label:"Active",value:activeCount,color:"#2563eb",action:()=>setPage("mydoubts")},
                    {label:"Resolved",value:completedCount,color:"#16a34a",action:()=>setPage("analytics")},
                  ].map((s,i)=>(
                    <div key={i} className="activity-row" onClick={s.action} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 8px",borderBottom:i<3?`1px solid ${borderColor}`:"none"}}>
                      <span style={{fontSize:13,color:subColor}}>{s.label}</span>
                      <span style={{fontWeight:800,fontSize:16,color:s.color}}>{s.value}</span>
                    </div>
                  ))}
                </div>
                {myDoubts.length>0&&(
                  <div style={{background:cardBg,borderRadius:16,padding:16,border:`1px solid ${borderColor}`}}>
                    <div style={{fontWeight:700,fontSize:14,color:textColor,marginBottom:12}}>Recent Doubts</div>
                    {myDoubts.slice(0,4).map((d,i)=>(
                      <div key={i} style={{padding:"8px 0",borderBottom:i<3?`1px solid ${borderColor}`:"none"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div><div style={{fontSize:12,fontWeight:600,color:textColor}}>{d.topic?.slice(0,20)}{d.topic?.length>20?"…":""}</div><div style={{fontSize:10,color:subColor}}>{d.faculty_name||d.subject?.slice(0,18)}</div></div>
                          <StatusBadge status={d.status}/>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>setPage("mydoubts")} style={{width:"100%",marginTop:10,padding:"8px 0",background:PURPLE_LIGHT,color:PURPLE,border:"none",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer"}}>View All →</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MY DOUBTS PAGE */}
        {page==="mydoubts"&&(
          <div className="page-anim">
            <div style={{marginBottom:24}}><h2 style={{fontSize:22,fontWeight:800,color:textColor,margin:0}}>My Doubts</h2><p style={{color:subColor,marginTop:4,fontSize:13}}>Track your doubt sessions and queue position</p></div>
            {myDoubts.length===0?(
              <div style={{background:cardBg,borderRadius:16,padding:48,textAlign:"center",color:subColor,border:`1px solid ${borderColor}`}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontWeight:700,fontSize:16,color:textColor,marginBottom:6}}>No doubts yet</div>
                <button onClick={()=>setPage("home")} className="btn-purple" style={{marginTop:16,padding:"10px 24px",fontSize:13}}>Go to Dashboard</button>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {myDoubts.map((d,i)=>(
                  <div key={i} style={{background:cardBg,borderRadius:14,padding:18,border:`1px solid ${borderColor}`,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontWeight:700,fontSize:15,color:textColor}}>{d.topic}</span>
                          {d.grouped&&<span style={{fontSize:10,padding:"2px 8px",background:PURPLE_LIGHT,color:PURPLE,borderRadius:10,fontWeight:700}}>🤝 GROUPED</span>}
                        </div>
                        <div style={{fontSize:12,color:subColor}}>{d.subject} · {d.created_at?.slice(0,10)}</div>
                        {d.faculty_name&&(<div style={{fontSize:12,color:PURPLE,fontWeight:600,marginTop:4}}>👨‍🏫 {d.faculty_name}{d.faculty_cabin?` · Cabin ${d.faculty_cabin}`:""}</div>)}
                        <div style={{fontSize:12,color:subColor,marginTop:4}}>{d.description?.slice(0,70)}…</div>
                        {d.status==="rejected"&&d.reject_reason&&(<div style={{marginTop:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:11,fontWeight:700,color:"#dc2626",marginBottom:4}}>❌ Rejection Reason</div><div style={{fontSize:13,color:"#991b1b"}}>{d.reject_reason}</div></div>)}
                        {d.faculty_message&&d.status!=="rejected"&&(<div style={{marginTop:10,background:PURPLE_LIGHT,border:"1px solid #ddd6fe",borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:11,fontWeight:700,color:PURPLE,marginBottom:4}}>💬 Faculty Message</div><div style={{fontSize:13,color:PURPLE_DARK}}>{d.faculty_message}</div></div>)}
                        {d.status==="pending"&&<AIHint topic={d.topic}/>}
                        {d.status==="rejected"&&(<button onClick={()=>setResubmitDoubt(d)} style={{marginTop:12,padding:"8px 16px",background:PURPLE_LIGHT,color:PURPLE,border:"1.5px solid #ddd6fe",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12}}>🔄 Re-submit to Another Faculty</button>)}
                      </div>
                      <StatusBadge status={d.status}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS PAGE */}
        {page==="analytics"&&(()=>{
          const completed=myDoubts.filter(d=>d.status==="completed");
          const rejected=myDoubts.filter(d=>d.status==="rejected");
          const pending=myDoubts.filter(d=>d.status==="pending");
          const active=myDoubts.filter(d=>d.status==="active");
          const resolutionRate=myDoubts.length>0?Math.round((completed.length/myDoubts.length)*100):0;
          const subjectStats=Object.entries(myDoubts.reduce((acc,d)=>{if(!acc[d.subject])acc[d.subject]={total:0,completed:0,rejected:0};acc[d.subject].total++;if(d.status==="completed")acc[d.subject].completed++;if(d.status==="rejected")acc[d.subject].rejected++;return acc;},{})).sort((a,b)=>b[1].total-a[1].total);
          const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          const dayBreakdown=myDoubts.reduce((acc,d)=>{if(d.created_at){const day=new Date(d.created_at).getDay();acc[day]=(acc[day]||0)+1;}return acc;},{});
          const maxDayCount=Math.max(...Object.values(dayBreakdown),1);
          return(
            <div className="page-anim">
              <div style={{marginBottom:24}}><h2 style={{fontSize:22,fontWeight:800,color:textColor,margin:0}}>Analytics</h2><p style={{color:subColor,marginTop:4,fontSize:13}}>Your doubt history insights & patterns</p></div>
              {myDoubts.length===0?(
                <div style={{background:cardBg,borderRadius:16,padding:48,textAlign:"center",color:subColor,border:`1px solid ${borderColor}`}}><div style={{fontSize:40,marginBottom:12}}>📊</div>Submit your first doubt to see analytics!</div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:14}}>
                    {[
                      {label:"Total",value:myDoubts.length,icon:"📝",color:PURPLE,bg:PURPLE_LIGHT,action:()=>setPage("mydoubts")},
                      {label:"Resolved",value:completed.length,icon:"✅",color:"#16a34a",bg:"#dcfce7",action:()=>setPage("mydoubts")},
                      {label:"Pending",value:pending.length,icon:"⏳",color:"#d97706",bg:"#fef3c7",action:()=>setPage("mydoubts")},
                      {label:"Active",value:active.length,icon:"🔵",color:"#2563eb",bg:"#dbeafe",action:()=>setPage("mydoubts")},
                      {label:"Rejected",value:rejected.length,icon:"❌",color:"#dc2626",bg:"#fee2e2",action:()=>setPage("mydoubts")},
                      {label:"Rate",value:`${resolutionRate}%`,icon:"📈",color:resolutionRate>=70?"#16a34a":"#d97706",bg:resolutionRate>=70?"#dcfce7":"#fef3c7",action:null},
                    ].map((s,i)=>(
                      <div key={i} className={s.action?"stat-chip":""} onClick={s.action||undefined} style={{background:cardBg,borderRadius:14,padding:16,textAlign:"center",border:`1px solid ${borderColor}`,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",cursor:s.action?"pointer":"default"}}>
                        <div style={{width:36,height:36,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,margin:"0 auto 8px"}}>{s.icon}</div>
                        <div style={{fontSize:26,fontWeight:800,color:s.color}}>{s.value}</div>
                        <div style={{fontSize:11,color:subColor,marginTop:2}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:cardBg,borderRadius:14,padding:20,border:`1px solid ${borderColor}`}}>
                    <div style={{fontWeight:700,color:textColor,marginBottom:16,fontSize:14}}>📚 Subject Breakdown</div>
                    {subjectStats.slice(0,6).map(([subject,stats],i)=>(
                      <div key={i} style={{marginBottom:14}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:textColor,fontWeight:600}}>{subject}</span><span style={{color:subColor,fontSize:11}}>{stats.total} total · {stats.completed} resolved</span></div>
                        <div style={{display:"flex",gap:2,height:8,borderRadius:20,overflow:"hidden",background:borderColor}}>
                          {stats.completed>0&&<div style={{height:"100%",background:"#22c55e",width:`${(stats.completed/stats.total)*100}%`,transition:"width 0.8s ease"}}/>}
                          {stats.rejected>0&&<div style={{height:"100%",background:"#ef4444",width:`${(stats.rejected/stats.total)*100}%`}}/>}
                          {(stats.total-stats.completed-stats.rejected)>0&&<div style={{height:"100%",background:"#f59e0b",width:`${((stats.total-stats.completed-stats.rejected)/stats.total)*100}%`}}/>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:cardBg,borderRadius:14,padding:20,border:`1px solid ${borderColor}`}}>
                    <div style={{fontWeight:700,color:textColor,marginBottom:16,fontSize:14}}>📅 Day-wise Activity</div>
                    <div style={{display:"flex",alignItems:"flex-end",gap:8,height:110}}>
                      {dayNames.map((day,i)=>{const count=dayBreakdown[i]||0;const height=count>0?Math.max((count/maxDayCount)*90,10):4;return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><span style={{fontSize:10,fontWeight:700,color:count>0?PURPLE:subColor}}>{count||""}</span><div style={{width:"100%",maxWidth:32,borderRadius:"6px 6px 0 0",height:`${height}px`,background:count>0?`linear-gradient(180deg,${PURPLE},${PURPLE_MID})`:borderColor,transition:"height 0.6s ease"}}/><span style={{fontSize:10,color:subColor,fontWeight:600}}>{day}</span></div>);})}
                    </div>
                  </div>
                  <div style={{background:cardBg,borderRadius:14,padding:20,border:`1px solid ${borderColor}`}}>
                    <div style={{fontWeight:700,color:textColor,marginBottom:16,fontSize:14}}>🕒 Recent Activity</div>
                    {myDoubts.slice(0,8).map((d,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<7?`1px solid ${borderColor}`:"none"}}>
                        <div><div style={{fontSize:13,fontWeight:600,color:textColor}}>{d.topic}</div><div style={{fontSize:11,color:subColor}}>{d.faculty_name?`👨‍🏫 ${d.faculty_name} · `:""}{d.subject} · {d.created_at?.slice(0,10)}</div></div>
                        <StatusBadge status={d.status}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
```

## C:\Users\asus\sync-kiet\frontend\src\pages\FacultyDashboard.js

`$lang
import { useState, useEffect, useRef } from "react";
import ToastContainer, { useToast } from "../components/Toast";
import FaceScanner from "../components/FaceScanner";

const API = "http://localhost:8000";
const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";
const ACCENT = "#a78bfa";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";
const PINK = "#ec4899";
const TIMETABLE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIMETABLE_PERIODS = [
  { period: 1, start: "09:10", end: "10:00", label: "Period 1 (09:10 - 10:00)" },
  { period: 2, start: "10:00", end: "10:50", label: "Period 2 (10:00 - 10:50)" },
  { period: 3, start: "10:50", end: "11:40", label: "Period 3 (10:50 - 11:40)" },
  { period: 4, start: "11:40", end: "12:30", label: "Period 4 (11:40 - 12:30)" },
  { period: 5, start: "14:20", end: "15:10", label: "Period 5 (14:20 - 15:10)" },
  { period: 6, start: "15:10", end: "16:00", label: "Period 6 (15:10 - 16:00)" },
  { period: 7, start: "16:00", end: "16:50", label: "Period 7 (16:00 - 16:50)" },
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes timerPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 70%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
  @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  .fade-up { animation: fadeUp 0.3s ease both; }
  .nav-link { transition: all 0.15s ease; cursor: pointer; border-radius: 10px; }
  .queue-card { transition: transform 0.2s ease, border-color 0.2s ease; }
  .queue-card:hover { transform: translateY(-2px); }
  .btn-primary { background: linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; transition:all 0.15s; }
  .btn-primary:hover { opacity:0.88; transform:translateY(-1px); }
  .clickable-header { transition: opacity 0.15s ease; cursor: pointer; }
  .clickable-header:hover { opacity: 0.82; }
  .timetable-slot { transition: all 0.15s ease; }
  .timetable-slot:hover { transform: scale(1.01); z-index: 2; }
`;

// ── Theme helper ────────────────────────────────────────────────────────
const theme = (dark) => ({
  bg:          dark ? "#0d0f1a" : "#f0f2ff",
  navBg:       dark ? "#0a0c14" : "#ffffff",
  cardBg:      dark ? "#13162a" : "#ffffff",
  surface:     dark ? "#1a1d30" : "#f8f9ff",
  border:      dark ? "#252840" : "#e8eaff",
  text:        dark ? "#f0f2ff" : "#0d0f1a",
  subText:     dark ? "#6b7099" : "#6366f1",
  muted:       dark ? "#3d4060" : "#9ca3af",
  navText:     dark ? "#8b8fb8" : "#6b7280",
  shadow:      dark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(99,102,241,0.1)",
});

const createEmptyEditableSlot = () => ({
  period: TIMETABLE_PERIODS[0].period,
  subject: "",
  section: "",
  room: "",
  class_type: "theory",
});

const normalizeScheduleResponse = (data = {}) => ({
  day: data.day || "",
  slots: data.slots || [],
  weekly: data.weekly || {},
});

const buildEditableWeekFromSchedule = (schedule) => {
  const next = Object.fromEntries(TIMETABLE_DAYS.map(day => [day, []]));
  const weekly = schedule?.weekly || {};
  TIMETABLE_DAYS.forEach(day => {
    next[day] = (weekly[day] || [])
      .filter(slot => slot.type === "class")
      .map(slot => ({
        day,
        period: Number(slot.period),
        subject: slot.subject || "",
        section: slot.section || "",
        room: slot.room || "",
        class_type: slot.class_type || "theory",
      }))
      .sort((a, b) => a.period - b.period);
  });
  return next;
};

// ── Live Clock ─────────────────────────────────────────────────────────
const LiveClock = ({ dark }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const T = theme(dark);
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums", letterSpacing: -1, lineHeight: 1 }}>
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
        {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
      </div>
    </div>
  );
};

// ── Status Dot ─────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const map = {
    available: { c: GREEN, l: "Available" },
    busy:      { c: RED,   l: "Busy"      },
    lunch:     { c: AMBER, l: "Lunch"     },
    left:      { c: RED,   l: "Left"      },
  };
  const s = map[status] || { c: "#64748b", l: "Offline" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: `${s.c}18`, border: `1px solid ${s.c}44`, fontSize: 11, fontWeight: 700, color: s.c }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, display: "inline-block", animation: status === "available" ? "pulse 2s infinite" : "none" }} />
      {s.l}
    </span>
  );
};

// ── Weekly Timetable Grid ──────────────────────────────────────────────
const WeeklyTimetable = ({ schedule, dark }) => {
  const T = theme(dark);
  const days = TIMETABLE_DAYS;
  const rows = [
    ...TIMETABLE_PERIODS.map(slot => ({ label: slot.start, key: slot.start, lunch: false })),
    { label: "12:30", key: "lunch", lunch: true },
  ];
  
  const todayName = schedule.day || "";

  // Build slot map from weekly data (preferred) or today's slots
  const slotMap = {};
  const weekly = schedule.weekly || {};

  if (Object.keys(weekly).length > 0) {
    // Use full weekly data from API
    days.forEach(day => {
      (weekly[day] || []).forEach(slot => {
        const key = `${day}-${slot.start?.slice(0,5)}`;
        slotMap[key] = { ...slot, day };
      });
    });
  } else {
    // Fallback: use today's slots
    (schedule.slots || []).forEach(slot => {
      const key = `${todayName}-${slot.start?.slice(0,5)}`;
      slotMap[key] = { ...slot, day: todayName };
    });
  }

  const classColors = [
    { bg: "#7c3aed", border: "#5b21b6", text: "#fff" },
    { bg: "#3b82f6", border: "#1d4ed8", text: "#fff" },
    { bg: "#f59e0b", border: "#d97706", text: "#fff" },
    { bg: "#ec4899", border: "#db2777", text: "#fff" },
    { bg: "#22c55e", border: "#16a34a", text: "#fff" },
  ];
  const subjectColors = {};
  let colorIdx = 0;
  const getColor = (subject) => {
    if (!subjectColors[subject]) {
      subjectColors[subject] = classColors[colorIdx % classColors.length];
      colorIdx++;
    }
    return subjectColors[subject];
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 700 }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "60px repeat(5,1fr)", gap: 4, marginBottom: 4 }}>
          <div />
          {days.map(d => {
            const isToday = d === todayName;
            return (
              <div key={d} style={{ fontSize: 12, fontWeight: isToday ? 800 : 700, color: isToday ? PURPLE : T.subText, textAlign: "center", padding: "6px 0", background: isToday ? `${PURPLE}18` : "transparent", borderRadius: 8 }}>
                {d.slice(0,3)}
                {isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: PURPLE, margin: "2px auto 0" }} />}
              </div>
            );
          })}
        </div>
        {/* Time rows */}
        {rows.map(row => (
          <div key={row.key} style={{ display: "grid", gridTemplateColumns: "60px repeat(5,1fr)", gap: 4, marginBottom: 4, minHeight: 52 }}>
            <div style={{ fontSize: 10, color: T.muted, paddingTop: 6, textAlign: "right", paddingRight: 8 }}>{row.label}</div>
            {days.map(day => {
              if (row.lunch) {
                return (
                  <div key={day} style={{ background: dark ? "#2d1f00" : "#fef9c3", borderRadius: 8, padding: "6px 8px", border: `1px solid ${AMBER}44`, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: AMBER }}>Lunch</div>
                  </div>
                );
              }
              const slot = slotMap[`${day}-${row.key}`];
              if (slot && slot.type === "class") {
                const c = getColor(slot.subject);
                return (
                  <div key={day} className="timetable-slot" style={{ background: c.bg, borderRadius: 8, padding: "6px 8px", cursor: "default", border: `1px solid ${c.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{slot.subject?.slice(0,18)}</div>
                    {slot.section && <div style={{ fontSize: 9, color: `${c.text}cc`, marginTop: 2 }}>{slot.section}</div>}
                  </div>
                );
              }
              if (false) {
                return (
                  <div key={day} style={{ background: dark ? "#2d1f00" : "#fef9c3", borderRadius: 8, padding: "6px 8px", border: `1px solid ${AMBER}44`, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: AMBER }}>🍽 Lunch</div>
                  </div>
                );
              }
              return <div key={day} style={{ background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }} />;
            })}
          </div>
        ))}
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(subjectColors).map(([subj, c]) => (
            <div key={subj} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bg }} />
              <span style={{ fontSize: 10, color: T.muted }}>{subj?.slice(0, 20)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Today's Schedule (right panel like fd2) ────────────────────────────
const TodayQueue = ({ queue, history, dark }) => {
  const T = theme(dark);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
      {queue.slice(0, 8).map((d, i) => (
        <div key={d._id} style={{ background: T.surface, borderRadius: 10, padding: "10px 14px", border: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>#{i + 1} {d.student_name}</div>
            <div style={{ fontSize: 11, color: T.muted }}>{d.topic?.slice(0, 24)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            {d.priority === "urgent" && <span style={{ fontSize: 9, padding: "1px 6px", background: `${RED}22`, color: RED, borderRadius: 8, fontWeight: 800 }}>URGENT</span>}
            <span style={{ fontSize: 10, color: T.muted }}>
              {d.duration === "quick" ? "⚡" : d.duration === "long" ? "🔍" : "📖"}
            </span>
          </div>
        </div>
      ))}
      {queue.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: T.muted }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
          <div style={{ fontSize: 12 }}>No students in queue</div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────
export default function FacultyDashboard({ user, setUser, darkMode, setDarkMode }) {
  const { toasts, addToast } = useToast();
  const T = theme(darkMode);

  const [queue, setQueue] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scheduledDoubts, setScheduledDoubts] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [messagePopup, setMessagePopup] = useState(null);
  const [customMessage, setCustomMessage] = useState("");
  const [groupModal, setGroupModal] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState({});
  const [rejectPopup, setRejectPopup] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({ total_completed: 0, total_rejected: 0, total_group_sessions: 0 });
  const [schedule, setSchedule] = useState({ day: "", slots: [] });
  const [editableWeek, setEditableWeek] = useState(() => buildEditableWeekFromSchedule({ weekly: {} }));
  const [editorDay, setEditorDay] = useState("Monday");
  const [editorSlot, setEditorSlot] = useState(createEmptyEditableSlot());
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [notifDismissed, setNotifDismissed] = useState(localStorage.getItem("notifDismissed") === "true");
  const [faceStatus, setFaceStatus] = useState({ face_registered: false, manual_status: null });
  const [faceScanner, setFaceScanner] = useState(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const wsRef = useRef(null);

  const authH = { authorization: `Bearer ${user.token}` };
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const logout = () => { localStorage.clear(); setUser(null); };
  const sendNotif = (t, b) => { if ("Notification" in window && Notification.permission === "granted") new Notification(t, { body: b }); };

  useEffect(() => {
    fetchQueue(); fetchHistory(); fetchSchedule(); fetchAnnouncements(); fetchFaceStatus();
    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws"); wsRef.current = ws;
      ws.onopen = () => console.log("WS connected");
      ws.onmessage = () => { fetchQueue(); fetchAnnouncements(); };
      ws.onclose = () => setTimeout(connectWS, 2000);
      ws.onerror = e => { ws.close(); };
    };
    connectWS();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  useEffect(() => {
    let t;
    if (activeSession) {
      t = setInterval(() => setTimer(s => { if (s >= 1800) { completeSession(); return 0; } return s + 1; }), 1000);
    } else setTimer(0);
    return () => clearInterval(t);
  }, [activeSession]);

  useEffect(() => {
    setEditableWeek(buildEditableWeekFromSchedule(schedule));
    if (schedule.day && TIMETABLE_DAYS.includes(schedule.day)) {
      setEditorDay(schedule.day);
    }
  }, [schedule]);

  const fetchAnnouncements = async () => { try { const r = await fetch(`${API}/admin/announcements`); const d = await r.json(); setAnnouncements(d.announcements || []); } catch {} };
  const fetchFaceStatus = async () => { try { const r = await fetch(`${API}/face/status`, { headers: authH }); const d = await r.json(); setFaceStatus(d); } catch {} };
  const fetchQueue = async () => {
    try {
      const r = await fetch(`${API}/doubts/faculty-queue`, { headers: authH });
      const d = await r.json(); const nq = d.queue || []; const ns = d.scheduled || [];
      if (nq.length > queue.length && nq.length > 0) sendNotif("New Doubt", `${nq[nq.length - 1].student_name} - ${nq[nq.length - 1].topic}`);
      if (ns.length > scheduledDoubts.length && ns.length > 0) sendNotif("Scheduled Doubt", `${ns[ns.length - 1].student_name} booked ${ns[ns.length - 1].scheduled_day} at ${ns[ns.length - 1].scheduled_start}`);
      setQueue(nq);
      setScheduledDoubts(ns);
    } catch {}
    setLoading(false);
  };
  const fetchHistory = async () => { try { const r = await fetch(`${API}/doubts/faculty-history`, { headers: authH }); const d = await r.json(); setHistory(d.history || []); setHistoryStats({ total_completed: d.total_completed || 0, total_rejected: d.total_rejected || 0, total_group_sessions: d.total_group_sessions || 0 }); } catch {} };
  const fetchSchedule = async () => { try { const r = await fetch(`${API}/timetable/my-schedule`, { headers: authH }); const d = await r.json(); setSchedule(normalizeScheduleResponse(d)); } catch {} };

  useEffect(() => {
    if (page !== "dashboard" && page !== "timetable") return;

    fetchSchedule();
  }, [page]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (page === "dashboard" || page === "timetable") {
        fetchSchedule();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleWindowFocus);
    };
  }, [page]);

  const addOrUpdateTimetableSlot = () => {
    if (!editorSlot.subject.trim()) {
      addToast("Enter the subject for this slot", "warning");
      return;
    }

    setEditableWeek(prev => {
      const existing = prev[editorDay] || [];
      const nextDay = [
        ...existing.filter(slot => slot.period !== editorSlot.period),
        {
          day: editorDay,
          period: editorSlot.period,
          subject: editorSlot.subject.trim(),
          section: editorSlot.section.trim(),
          room: editorSlot.room.trim(),
          class_type: editorSlot.class_type,
        }
      ].sort((a, b) => a.period - b.period);

      return { ...prev, [editorDay]: nextDay };
    });

    setEditorSlot(createEmptyEditableSlot());
  };

  const removeTimetableSlot = (day, period) => {
    setEditableWeek(prev => ({
      ...prev,
      [day]: (prev[day] || []).filter(slot => slot.period !== period)
    }));
  };

  const saveTimetable = async () => {
    const slots = TIMETABLE_DAYS.flatMap(day =>
      (editableWeek[day] || []).map(slot => ({
        day,
        period: slot.period,
        subject: slot.subject,
        section: slot.section,
        room: slot.room,
        class_type: slot.class_type,
      }))
    );

    if (slots.length === 0) {
      addToast("Add at least one class slot before saving", "warning");
      return;
    }

    setSavingTimetable(true);
    try {
      const r = await fetch(`${API}/timetable/faculty-upload`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const d = await r.json();
      if (!r.ok) {
        addToast(d.detail || "Failed to save timetable", "error");
      } else {
        addToast(d.message || "Timetable saved", "success");
        await fetchSchedule();
      }
    } catch {
      addToast("Failed to save timetable", "error");
    }
    setSavingTimetable(false);
  };

  const acceptDoubt = async (doubt, groupDoubts = null) => {
    try {
      if (groupDoubts && groupDoubts.length > 1) {
        await Promise.all(groupDoubts.map(d => fetch(`${API}/doubts/accept/${d._id}`, { method: "PUT", headers: authH })));
        setActiveSession({ ...doubt, groupDoubts, isGroup: true });
      } else {
        await fetch(`${API}/doubts/accept/${doubt._id}`, { method: "PUT", headers: authH });
        setActiveSession(doubt);
      }
      addToast("Session started!", "success"); fetchQueue();
    } catch (e) { console.error(e); }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    try { await fetch(`${API}/doubts/complete/${activeSession._id}`, { method: "PUT", headers: authH }); setActiveSession(null); addToast("Session completed!", "success"); fetchQueue(); fetchHistory(); } catch (e) { console.error(e); }
  };

  const rejectDoubt = async (doubt, reason) => {
    try { await fetch(`${API}/doubts/reject/${doubt._id}`, { method: "PUT", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason || "No reason" }) }); setActiveSession(null); setRejectPopup(null); setRejectReason(""); addToast("Rejected", "info"); setTimeout(() => fetchQueue(), 500); } catch (e) { console.error(e); }
  };

  const QUICK_MESSAGES = ["Come in 5 minutes", "Come in 10 minutes", "Come in 15 minutes", "Please wait, finishing current session", "Your doubt needs more detail, please resubmit", "Grouping you with others, arrive in 5 mins", "Group session starting in 10 minutes"];
  const sendMessage = async (doubtId, message) => { try { await fetch(`${API}/doubts/send-message/${doubtId}`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); setMessagePopup(null); setCustomMessage(""); addToast("Message sent!", "success"); } catch {} };

  const findSimilar = async () => {
    setGroupLoading(true);
    try { const r = await fetch(`${API}/doubts/find-similar`, { headers: authH }); const d = await r.json(); const init = {}; (d.groups || []).forEach((g, gi) => g.doubts.forEach(dbt => { init[dbt._id] = gi; })); setSelectedForGroup(init); setGroupModal(d); } catch { addToast("Failed to find similar doubts", "error"); }
    setGroupLoading(false);
  };

  const confirmGroup = async (group) => {
    const ids = group.doubts.filter(d => selectedForGroup[d._id] !== undefined).map(d => d._id);
    if (ids.length < 2) { addToast("Select at least 2 doubts", "warning"); return; }
    try { await fetch(`${API}/doubts/group-doubts`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ doubt_ids: ids, group_name: group.canonical_topic }) }); setGroupModal(null); setSelectedForGroup({}); fetchQueue(); } catch {}
  };

  const confirmAllGroups = async () => {
    if (!groupModal) return;
    for (const g of groupModal.groups) {
      const ids = g.doubts.filter(d => selectedForGroup[d._id] !== undefined).map(d => d._id);
      if (ids.length >= 2) await fetch(`${API}/doubts/group-doubts`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ doubt_ids: ids, group_name: g.canonical_topic }) });
    }
    setGroupModal(null); setSelectedForGroup({}); fetchQueue();
  };

  const toggleDoubtSelection = (doubtId, gi) => setSelectedForGroup(prev => { const n = { ...prev }; if (n[doubtId] !== undefined) delete n[doubtId]; else n[doubtId] = gi; return n; });

  const currentStatus = activeSession ? "busy" : faceStatus.manual_status || "offline";

  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "history", icon: "📋", label: "History" },
    { id: "timetable", icon: "📅", label: "Timetable" },
    { id: "stats", icon: "📊", label: "Stats" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", color: T.text, transition: "background 0.3s,color 0.3s" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ToastContainer toasts={toasts} />

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <div style={{ width: 220, minHeight: "100vh", background: T.navBg, display: "flex", flexDirection: "column", padding: "24px 14px", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, borderRight: `1px solid ${T.border}`, boxShadow: T.shadow }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "0 8px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>P</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>PuchoKIET</div>
            <div style={{ fontSize: 9, color: PURPLE, fontWeight: 700, letterSpacing: 1 }}>FACULTY</div>
          </div>
        </div>

        {/* Faculty card */}
        <div style={{ background: T.surface, borderRadius: 12, padding: 14, marginBottom: 24, border: `1px solid ${T.border}` }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff", margin: "0 auto 8px" }}>{user.name?.[0]?.toUpperCase()}</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>{user.name}</div>
            <StatusDot status={currentStatus} />
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => (
            <div key={item.id} className="nav-link" onClick={() => setPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: page === item.id ? `${PURPLE}22` : "transparent", color: page === item.id ? ACCENT : T.navText, fontWeight: page === item.id ? 700 : 500, fontSize: 13 }}>
              <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
              {item.id === "dashboard" && queue.length > 0 && (
                <span style={{ marginLeft: "auto", background: AMBER, color: "#000", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 6px" }}>{queue.length}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom controls */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ flex: 1, padding: "8px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>{darkMode ? "☀️" : "🌙"}</button>
            <button onClick={logout} style={{ flex: 2, padding: "8px", background: "#450a0a", border: "1px solid #991b1b", borderRadius: 8, color: RED, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Logout</button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div style={{ marginLeft: 220, flex: 1, padding: "28px", minHeight: "100vh" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>
              {page === "dashboard" ? "Dashboard" : page === "history" ? "History" : page === "timetable" ? "Timetable" : "Stats"}
            </h1>
            <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {!notifDismissed && "Notification" in window && Notification.permission !== "granted" && (
              <button onClick={() => { Notification.requestPermission(); setNotifDismissed(true); localStorage.setItem("notifDismissed", "true"); }}
                style={{ padding: "7px 14px", background: "#78350f", border: "1px solid #92400e", borderRadius: 8, color: AMBER, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>🔔 Enable Alerts</button>
            )}
            <LiveClock dark={darkMode} />
          </div>
        </div>

        {/* ══ DASHBOARD PAGE ══════════════════════════════════════ */}
        {page === "dashboard" && (
          <div className="fade-up">

            {/* Announcement banner — CLICKABLE shows all */}
            {announcements.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="clickable-header" onClick={() => setShowAnnouncements(!showAnnouncements)}
                  style={{ background: `linear-gradient(135deg,${PURPLE}33,${BLUE}22)`, borderRadius: showAnnouncements ? "12px 12px 0 0" : 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${PURPLE}44`, cursor: "pointer" }}>
                  <span style={{ fontSize: 20 }}>📢</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: 1, marginBottom: 2 }}>ANNOUNCEMENT</div>
                    <div style={{ fontSize: 13, color: T.text }}>{announcements[0].message}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {announcements.length > 1 && <span style={{ fontSize: 11, color: T.muted, background: `${PURPLE}22`, padding: "2px 8px", borderRadius: 10 }}>{announcements.length} total</span>}
                    <span style={{ fontSize: 16, color: ACCENT, transition: "transform 0.2s", transform: showAnnouncements ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
                  </div>
                </div>
                {showAnnouncements && (
                  <div style={{ background: T.cardBg, border: `1px solid ${PURPLE}44`, borderTop: "none", borderRadius: "0 0 12px 12px", maxHeight: 300, overflowY: "auto" }}>
                    {announcements.map((ann, i) => (
                      <div key={i} style={{ padding: "12px 18px", borderBottom: i < announcements.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 16, marginTop: 1 }}>📢</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{ann.message}</div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>
                            {ann.target && <span style={{ background: `${PURPLE}22`, color: ACCENT, padding: "1px 6px", borderRadius: 8, marginRight: 6, fontWeight: 700 }}>{ann.target}</span>}
                            {ann.created_at?.slice(0, 16)?.replace("T", " ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Hero Row: Welcome + 4 stats */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {/* Welcome */}
              <div style={{ background: `linear-gradient(135deg,${PURPLE},${PURPLE_DARK})`, borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                <div style={{ position: "absolute", bottom: -30, right: 60, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>WELCOME BACK</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                  Hello, {(() => {
                    const parts = (user.name || "").split(" ");
                    const honorifics = ["mr.", "mrs.", "ms.", "dr.", "prof.", "mr", "mrs", "ms", "dr", "prof"];
                    const firstName = parts.find(p => !honorifics.includes(p.toLowerCase())) || parts[0] || "Faculty";
                    return firstName;
                  })()}!
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>{user.subject || "Faculty"} · KIET</div>
                <StatusDot status={currentStatus} />
              </div>

              {/* Stat cards */}
              {[
                { label: "Queue", value: queue.length, color: AMBER, icon: "👥", bg: darkMode ? "#1f1500" : "#fef9c3", action: () => document.getElementById("queue-section")?.scrollIntoView({ behavior: "smooth" }) },
                { label: "Session", value: activeSession ? "Active" : "Idle", color: activeSession ? RED : GREEN, icon: activeSession ? "🔴" : "🟢", bg: darkMode ? activeSession ? "#1a0505" : "#052e16" : activeSession ? "#fef2f2" : "#f0fdf4", action: () => document.getElementById("session-section")?.scrollIntoView({ behavior: "smooth" }) },
                { label: "Timer", value: activeSession ? fmt(timer) : "--:--", color: timer > 1500 ? RED : ACCENT, icon: "⏱️", bg: darkMode ? "#1e1b4b" : "#ede9fe", action: null },
                { label: "Resolved", value: historyStats.total_completed, color: GREEN, icon: "✅", bg: darkMode ? "#052e16" : "#f0fdf4", action: () => setPage("history") },
              ].map((s, i) => (
                <div key={i} className="clickable-header" onClick={s.action || undefined}
                  style={{ background: T.cardBg, borderRadius: 16, padding: 18, border: `1px solid ${T.border}`, cursor: s.action ? "pointer" : "default" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontSize: s.label === "Timer" ? 20 : 28, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Face Scan Card — CLICKABLE */}
            <div className="clickable-header" onClick={() => { if (!faceStatus.face_registered) setFaceScanner("register"); else if (faceStatus.manual_status !== "available") setFaceScanner("check_in"); else setFaceScanner("check_out"); }}
              style={{ background: T.cardBg, borderRadius: 14, padding: 18, marginBottom: 20, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: faceStatus.manual_status === "available" ? darkMode ? "#052e16" : "#dcfce7" : darkMode ? "#1e1b4b" : "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {faceStatus.manual_status === "available" ? "🟢" : faceStatus.manual_status === "left" ? "🔴" : "📷"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>
                    {!faceStatus.face_registered ? "Face Not Registered" : faceStatus.manual_status === "available" ? "Checked In ✅" : faceStatus.manual_status === "left" ? "Checked Out 🔴" : "Not Scanned Today"}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {!faceStatus.face_registered ? "Click to register face for check-in/out" : faceStatus.last_scan_at ? `Last: ${faceStatus.last_scan_at?.slice(0, 16)?.replace("T", " ")}` : "Click to scan face"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                {!faceStatus.face_registered ? (
                  <button onClick={() => setFaceScanner("register")} className="btn-primary" style={{ padding: "8px 16px", fontSize: 12 }}>📷 Register Face</button>
                ) : (
                  <>
                    {faceStatus.manual_status !== "available" && <button onClick={() => setFaceScanner("check_in")} style={{ padding: "8px 14px", background: darkMode ? "#052e16" : "#dcfce7", border: `1px solid ${GREEN}44`, borderRadius: 8, color: GREEN, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🟢 Check In</button>}
                    {faceStatus.manual_status === "available" && <button onClick={() => setFaceScanner("check_out")} style={{ padding: "8px 14px", background: darkMode ? "#450a0a" : "#fee2e2", border: `1px solid ${RED}44`, borderRadius: 8, color: RED, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🔴 Check Out</button>}
                    <button onClick={() => setFaceScanner("register")} style={{ padding: "8px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Re-register</button>
                  </>
                )}
              </div>
            </div>

            {/* Main 2-col: Active Session + Queue */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              {/* Active Session */}
              <div id="session-section" style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  Active Session
                  {activeSession && <span style={{ width: 8, height: 8, borderRadius: "50%", background: RED, display: "inline-block", animation: "pulse 1s infinite" }} />}
                </div>
                {activeSession ? (
                  <>
                    <div style={{ background: T.surface, borderRadius: 12, padding: 16, marginBottom: 14, border: `1px solid ${T.border}` }}>
                      {activeSession.isGroup ? (
                        <>
                          <div style={{ fontWeight: 700, color: ACCENT, marginBottom: 8, fontSize: 13 }}>🤝 Group ({activeSession.groupDoubts.length} students)</div>
                          {activeSession.groupDoubts.map(gd => <div key={gd._id} style={{ fontSize: 12, color: T.muted, background: T.cardBg, borderRadius: 6, padding: "4px 10px", marginBottom: 3 }}>👤 {gd.student_name}</div>)}
                        </>
                      ) : <div style={{ fontWeight: 700, color: T.text, fontSize: 15, marginBottom: 4 }}>{activeSession.student_name}</div>}
                      <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{activeSession.topic}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{activeSession.subject}</div>
                    </div>
                    <div className={timer > 1500 ? "timer-warn" : ""} style={{ textAlign: "center", fontSize: 40, fontWeight: 800, color: timer > 1500 ? RED : ACCENT, marginBottom: 10, fontFamily: "monospace", background: T.surface, borderRadius: 12, padding: "14px 0", letterSpacing: 2, border: `1px solid ${T.border}` }}>
                      {fmt(timer)}
                    </div>
                    {timer > 1500 && <div style={{ textAlign: "center", fontSize: 11, color: RED, marginBottom: 10, fontWeight: 600 }}>⚠️ Auto-completing in {fmt(1800 - timer)}</div>}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={completeSession} style={{ flex: 1, padding: "12px 0", background: darkMode ? "#052e16" : "#dcfce7", border: `1px solid ${GREEN}44`, borderRadius: 10, color: GREEN, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✅ Complete</button>
                      <button onClick={() => setRejectPopup(activeSession)} style={{ padding: "12px 16px", background: darkMode ? "#450a0a" : "#fee2e2", border: `1px solid ${RED}44`, borderRadius: 10, color: RED, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Reject</button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💤</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No active session</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Accept a doubt from the queue</div>
                  </div>
                )}
              </div>

              {/* Queue */}
              <div id="queue-section" style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
                    Queue <span style={{ fontSize: 12, color: T.muted }}>({queue.length})</span>
                  </div>
                  {queue.length >= 2 && !activeSession && (
                    <button onClick={findSimilar} disabled={groupLoading} className="btn-primary" style={{ padding: "6px 12px", fontSize: 11, opacity: groupLoading ? 0.6 : 1 }}>
                      {groupLoading ? "Scanning..." : "🔍 Find Similar"}
                    </button>
                  )}
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: 40, color: T.muted }}>Loading...</div>
                ) : queue.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No students in queue</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto" }}>
                    {(() => {
                      const groups = {}, singles = [];
                      queue.forEach(d => { if (d.grouped && d.cluster_id) { if (!groups[d.cluster_id]) groups[d.cluster_id] = []; groups[d.cluster_id].push(d); } else singles.push(d); });
                      return (
                        <>
                          {Object.entries(groups).map(([cid, gd]) => (
                            <div key={cid} className="queue-card" style={{ border: `2px solid ${BLUE}`, background: darkMode ? "#0c1a3a" : "#eff6ff", borderRadius: 12, padding: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontWeight: 700, color: BLUE, fontSize: 13 }}>🤝 GROUP SESSION</span>
                                <span style={{ fontSize: 10, padding: "1px 7px", background: `${BLUE}22`, color: BLUE, borderRadius: 10, fontWeight: 700 }}>{gd.length} students</span>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>{gd[0].topic} · {gd[0].subject}</div>
                              {gd.map(g => <div key={g._id} style={{ fontSize: 11, color: T.muted, background: T.cardBg, borderRadius: 6, padding: "4px 10px", marginBottom: 3 }}>👤 {g.student_name}</div>)}
                              {!activeSession && (
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <button onClick={() => acceptDoubt(gd[0], gd)} className="btn-primary" style={{ flex: 1, padding: "8px 0", fontSize: 12 }}>Accept Group</button>
                                  <button onClick={() => setRejectPopup(gd[0])} style={{ padding: "8px 12px", background: darkMode ? "#450a0a" : "#fee2e2", border: "none", borderRadius: 8, color: RED, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Reject</button>
                                </div>
                              )}
                            </div>
                          ))}
                          {singles.map((d, i) => (
                            <div key={d._id} className="queue-card" style={{ border: d.priority === "urgent" ? `2px solid ${RED}` : `1px solid ${T.border}`, background: d.priority === "urgent" ? darkMode ? "#1a0505" : "#fff5f5" : T.surface, borderRadius: 12, padding: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>#{i + 1} {d.student_name}</span>
                                    {d.priority === "urgent" && <span style={{ fontSize: 9, padding: "1px 6px", background: `${RED}22`, color: RED, borderRadius: 8, fontWeight: 800, border: `1px solid ${RED}44` }}>URGENT</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                                    {d.topic}
                                    {d.duration && <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 8, background: d.duration === "quick" ? darkMode ? "#052e16" : "#dcfce7" : d.duration === "long" ? darkMode ? "#450a0a" : "#fee2e2" : darkMode ? "#1f1500" : "#fef9c3", color: d.duration === "quick" ? GREEN : d.duration === "long" ? RED : AMBER, fontWeight: 700 }}>{d.duration === "quick" ? "⚡" : d.duration === "long" ? "🔍" : "📖"} {d.duration}</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: T.muted }}>{d.subject}</div>
                                </div>
                              </div>
                              {!activeSession && (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => setMessagePopup(d)} style={{ padding: "7px 10px", background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>💬</button>
                                  <button onClick={() => acceptDoubt(d)} className="btn-primary" style={{ flex: 1, padding: "7px 0", fontSize: 12 }}>{d.priority === "urgent" ? "Accept (Priority)" : "Accept"}</button>
                                  <button onClick={() => setRejectPopup(d)} style={{ padding: "7px 10px", background: darkMode ? "#450a0a" : "#fee2e2", border: "none", borderRadius: 8, color: RED, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Reject</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Timetable Section on Dashboard — like fd2! */}
            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
              <div className="clickable-header" onClick={() => setPage("timetable")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>📅 Weekly Timetable</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Today: {schedule.day || "—"} · Click to expand</div>
                </div>
                <span style={{ fontSize: 12, color: PURPLE, fontWeight: 600 }}>View full →</span>
              </div>
              <WeeklyTimetable schedule={schedule} dark={darkMode} />
            </div>
          </div>
        )}

        {/* ══ HISTORY PAGE ════════════════════════════════════════ */}
        {page === "history" && (
          <div className="fade-up">
            {/* Clickable stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Resolved", value: historyStats.total_completed, color: GREEN, bg: darkMode ? "#052e16" : "#dcfce7", icon: "✅" },
                { label: "Total Rejected", value: historyStats.total_rejected, color: RED, bg: darkMode ? "#450a0a" : "#fee2e2", icon: "❌" },
                { label: "Group Sessions", value: historyStats.total_group_sessions, color: ACCENT, bg: darkMode ? "#1e1b4b" : "#ede9fe", icon: "🤝" },
              ].map((s, i) => (
                <div key={i} style={{ background: T.cardBg, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
                  <div><div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 12, color: T.muted }}>{s.label}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background: T.cardBg, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Session History</div>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: T.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>No history yet</div>
              ) : history.map((d, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < history.length - 1 ? `1px solid ${T.border}` : "none", background: i % 2 === 0 ? "transparent" : T.surface }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{d.student_name} → {d.topic}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{d.subject} · {d.created_at?.slice(0, 10)}</div>
                    {d.grouped && <span style={{ fontSize: 9, padding: "1px 7px", background: `${PURPLE}22`, color: ACCENT, borderRadius: 6, fontWeight: 700, marginTop: 4, display: "inline-block" }}>🤝 Group</span>}
                    {d.status === "rejected" && d.reject_reason && <div style={{ fontSize: 11, color: RED, marginTop: 3 }}>Reason: {d.reject_reason}</div>}
                  </div>
                  <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: d.status === "completed" ? darkMode ? "#052e16" : "#dcfce7" : darkMode ? "#450a0a" : "#fee2e2", color: d.status === "completed" ? GREEN : RED, border: `1px solid ${d.status === "completed" ? GREEN : RED}44` }}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ TIMETABLE PAGE ══════════════════════════════════════ */}
        {page === "timetable" && (
          <div className="fade-up">
            <div className="clickable-header" onClick={() => setPage("dashboard")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>📅 Weekly Schedule</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Today: {schedule.day || "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ l: "Class", c: PURPLE }, { l: "Free", c: GREEN }, { l: "Lunch", c: AMBER }].map(x => (
                  <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c }} />
                    <span style={{ fontSize: 11, color: T.muted }}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}` }}>
              <WeeklyTimetable schedule={schedule} dark={darkMode} />
            </div>

            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}`, marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Edit Weekly Timetable</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Changes here save to the same timetable used across faculty status and admin views.</div>
                </div>
                <button onClick={saveTimetable} className="btn-primary" disabled={savingTimetable} style={{ padding: "10px 16px", opacity: savingTimetable ? 0.6 : 1 }}>
                  {savingTimetable ? "Saving..." : "Save Weekly Timetable"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
                <div style={{ background: T.surface, borderRadius: 12, padding: 16, border: `1px solid ${T.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <select value={editorDay} onChange={e => setEditorDay(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardBg, color: T.text }}>
                      {TIMETABLE_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <select
                      value={editorSlot.period}
                      onChange={e => setEditorSlot({ ...editorSlot, period: Number(e.target.value) })}
                      style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardBg, color: T.text }}
                    >
                      {TIMETABLE_PERIODS.map(slot => <option key={slot.period} value={slot.period}>{slot.label}</option>)}
                    </select>
                    <input value={editorSlot.subject} onChange={e => setEditorSlot({ ...editorSlot, subject: e.target.value })} placeholder="Subject" style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardBg, color: T.text }} />
                    <input value={editorSlot.section} onChange={e => setEditorSlot({ ...editorSlot, section: e.target.value })} placeholder="Section" style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardBg, color: T.text }} />
                    <input value={editorSlot.room} onChange={e => setEditorSlot({ ...editorSlot, room: e.target.value })} placeholder="Room" style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardBg, color: T.text }} />
                    <select value={editorSlot.class_type} onChange={e => setEditorSlot({ ...editorSlot, class_type: e.target.value })} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.cardBg, color: T.text }}>
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                      <option value="tutorial">Tutorial</option>
                    </select>
                  </div>
                  <button onClick={addOrUpdateTimetableSlot} className="btn-primary" style={{ width: "100%", padding: "10px 0" }}>
                    Add Or Replace Slot
                  </button>
                </div>

                <div style={{ background: T.surface, borderRadius: 12, padding: 16, border: `1px solid ${T.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 10 }}>{editorDay} Slots</div>
                  {(editableWeek[editorDay] || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: T.muted }}>No classes added for this day yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(editableWeek[editorDay] || []).map(slot => {
                        const periodMeta = TIMETABLE_PERIODS.find(item => item.period === slot.period);
                        return (
                          <div key={`${editorDay}-${slot.period}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: T.cardBg, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.border}` }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{slot.subject}</div>
                              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                                {periodMeta?.label || `Period ${slot.period}`} {slot.section ? `· ${slot.section}` : ""} {slot.room ? `· Room ${slot.room}` : ""}
                              </div>
                            </div>
                            <button onClick={() => removeTimetableSlot(editorDay, slot.period)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontWeight: 700 }}>
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Today's slots list */}
            <div style={{ background: T.cardBg, borderRadius: 16, padding: 24, border: `1px solid ${T.border}`, marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 16 }}>Today's Classes</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                {schedule.slots.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 13 }}>No schedule loaded</div>
                ) : schedule.slots.map((slot, i) => (
                  <div key={i} style={{ background: slot.type === "class" ? `${BLUE}18` : T.surface, border: `1px solid ${slot.type === "class" ? BLUE : T.border}44`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>{slot.start} – {slot.end}</div>
                    {slot.type === "class" ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{slot.subject}</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{slot.section} · {slot.class_type}</div>
                      </>
                    ) : <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Free Slot</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ STATS PAGE ══════════════════════════════════════════ */}
        {page === "stats" && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Total Resolved", value: historyStats.total_completed, color: GREEN, icon: "✅", action: () => setPage("history") },
                { label: "Pending Queue", value: queue.length, color: AMBER, icon: "⏳", action: () => setPage("dashboard") },
                { label: "Group Sessions", value: historyStats.total_group_sessions, color: ACCENT, icon: "🤝", action: () => setPage("history") },
                { label: "Urgent Doubts", value: queue.filter(d => d.priority === "urgent").length, color: RED, icon: "🚨", action: () => setPage("dashboard") },
              ].map((s, i) => (
                <div key={i} className="clickable-header" onClick={s.action} style={{ background: T.cardBg, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: T.cardBg, borderRadius: 14, padding: 20, border: `1px solid ${T.border}` }}>
              <div className="clickable-header" onClick={() => setPage("dashboard")} style={{ fontWeight: 700, color: T.text, marginBottom: 16, fontSize: 14, cursor: "pointer" }}>
                📋 Queue by Subject <span style={{ fontSize: 11, color: PURPLE }}>→ View Queue</span>
              </div>
              {queue.length === 0 ? <div style={{ color: T.muted, fontSize: 13 }}>No pending doubts right now</div> :
                Object.entries(queue.reduce((acc, d) => { acc[d.subject] = (acc[d.subject] || 0) + 1; return acc; }, {})).map(([subject, count], i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: T.text, fontWeight: 600 }}>{subject}</span>
                      <span style={{ color: T.muted }}>{count} student{count > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ background: T.surface, borderRadius: 20, height: 6 }}>
                      <div style={{ height: "100%", borderRadius: 20, background: `linear-gradient(90deg,${PURPLE},${ACCENT})`, width: `${(count / queue.length) * 100}%`, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────── */}

      {/* Message Modal */}
      {messagePopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: T.cardBg, borderRadius: 16, padding: 28, width: 420, border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>💬 Send Message</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>To: {messagePopup.student_name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {QUICK_MESSAGES.map((msg, i) => (
                <button key={i} onClick={() => sendMessage(messagePopup._id, msg)}
                  style={{ padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 12, color: T.text, fontWeight: 500, transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = PURPLE}
                  onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                  {msg}
                </button>
              ))}
            </div>
            <input placeholder="Or type custom message..." value={customMessage} onChange={e => setCustomMessage(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12, background: T.surface, color: T.text }} />
            <div style={{ display: "flex", gap: 10 }}>
              {customMessage && <button onClick={() => sendMessage(messagePopup._id, customMessage)} className="btn-primary" style={{ flex: 1, padding: "11px 0", fontSize: 13 }}>Send</button>}
              <button onClick={() => { setMessagePopup(null); setCustomMessage(""); }} style={{ flex: 1, padding: "11px 0", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: T.muted, fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: T.cardBg, borderRadius: 16, padding: 28, width: 440, border: `1px solid ${RED}44`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: RED, marginBottom: 4 }}>❌ Reject Doubt</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Student: <b style={{ color: T.text }}>{rejectPopup.student_name}</b> · {rejectPopup.topic}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {["Topic not in my subject area", "Please refer to class notes first", "Duplicate doubt — already resolved", "Come during office hours instead", "Not enough detail — please resubmit with more info"].map((reason, i) => (
                <button key={i} onClick={() => setRejectReason(reason)}
                  style={{ padding: "10px 14px", background: rejectReason === reason ? `${RED}18` : T.surface, border: rejectReason === reason ? `1.5px solid ${RED}` : `1px solid ${T.border}`, borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 12, color: rejectReason === reason ? RED : T.text, fontWeight: 500 }}>
                  {reason}
                </button>
              ))}
            </div>
            <textarea placeholder="Or type custom reason (max 50 words)..." value={rejectReason}
              onChange={e => { const w = e.target.value.split(/\s+/).filter(Boolean); if (w.length <= 50) setRejectReason(e.target.value); }}
              rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 4, background: T.surface, color: T.text, resize: "none", fontFamily: "inherit" }} />
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 12, textAlign: "right" }}>{rejectReason.split(/\s+/).filter(Boolean).length}/50 words</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => rejectDoubt(rejectPopup, rejectReason)} disabled={!rejectReason.trim()}
                style={{ flex: 1, padding: "11px 0", background: rejectReason.trim() ? `linear-gradient(135deg,${RED},#dc2626)` : T.surface, color: rejectReason.trim() ? "#fff" : T.muted, border: "none", borderRadius: 8, fontWeight: 700, cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>
                Reject with Reason
              </button>
              <button onClick={() => { setRejectPopup(null); setRejectReason(""); }} style={{ padding: "11px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: T.muted, fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {groupModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: T.cardBg, borderRadius: 16, padding: 28, width: 540, maxHeight: "80vh", overflowY: "auto", border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>🔍 Similar Doubts Found</div>
              <button onClick={() => { setGroupModal(null); setSelectedForGroup({}); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.muted }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Review and confirm to group students for a joint session.</div>
            {groupModal.groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: T.muted }}><div style={{ fontSize: 32, marginBottom: 10 }}>🤷</div>No similar doubts found.</div>
            ) : (
              <>
                {groupModal.groups.map((group, gi) => (
                  <div key={gi} style={{ border: `2px solid ${PURPLE}`, background: `${PURPLE}0a`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: ACCENT, fontSize: 13 }}>🤝 {group.canonical_topic}</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{group.count} students · Confidence: {group.confidence}</div>
                      </div>
                      <button onClick={() => confirmGroup(group)} className="btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>Group These</button>
                    </div>
                    {group.doubts.map(d => {
                      const isSel = selectedForGroup[d._id] !== undefined;
                      return (
                        <div key={d._id} onClick={() => toggleDoubtSelection(d._id, gi)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: isSel ? `${PURPLE}18` : T.surface, border: isSel ? `1.5px solid ${PURPLE}` : `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: isSel ? `2px solid ${PURPLE}` : `2px solid ${T.border}`, background: isSel ? PURPLE : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{isSel && "✓"}</div>
                          <div><div style={{ fontWeight: 600, fontSize: 12, color: T.text }}>{d.student_name}</div><div style={{ fontSize: 10, color: T.muted }}>{d.topic} · {d.subject}</div></div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={confirmAllGroups} className="btn-primary" style={{ flex: 1, padding: "12px 0", fontSize: 14 }}>Group All ({groupModal.groups.length})</button>
                  <button onClick={() => { setGroupModal(null); setSelectedForGroup({}); }} style={{ padding: "12px 20px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", color: T.muted, fontSize: 14 }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Face Scanner */}
      {faceScanner && (
        <FaceScanner user={user} action={faceScanner} darkMode={darkMode} onClose={() => setFaceScanner(null)}
          onComplete={data => {
            setFaceScanner(null); fetchFaceStatus();
            if (data.action === "check_in") addToast("Checked in! Status: Available", "success");
            else if (data.action === "check_out") addToast("Checked out! Status: Left", "success");
            else addToast("Face registered!", "success");
          }} />
      )}
    </div>
  );
}
```

