from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from utils.jwt import verify_token
from utils.ai import cluster_doubts, calculate_wait_time
from routes.timetable import get_faculty_status
from models.doubt import DoubtRequest
from models.user import MessageRequest
from datetime import datetime
from bson import ObjectId
import os
import asyncio

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

@router.post("/submit")
def submit_doubt(data: DoubtRequest, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "student":
        raise HTTPException(401, "Unauthorized")

    doubt = {
        "student_id": user["id"],
        "student_name": user["name"],
        "subject": data.subject,
        "topic": data.topic,
        "description": data.description,
        "faculty_id": data.faculty_id,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "grouped": False,
        "cluster_id": None
    }
    result = db.doubts.insert_one(doubt)
    doubt_id = str(result.inserted_id)

    pending_doubts = list(db.doubts.find({
        "faculty_id": data.faculty_id,
        "status": "pending",
        "subject": data.subject
    }))

    cluster_result = cluster_doubts(pending_doubts)

    # Save clustering result to MongoDB
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

    try:
        faculty_db = db.faculty.find_one({"_id": ObjectId(data.faculty_id)})
        faculty_code = faculty_db.get("faculty_code", "") if faculty_db else ""
        timetable_status = get_faculty_status(faculty_code) if faculty_code else None
    except:
        timetable_status = None

    wait_time = calculate_wait_time(data.faculty_id, queue_position, db)

    _broadcast()
    return {
        "message": "Doubt submitted successfully",
        "doubt_id": doubt_id,
        "queue_position": queue_position,
        "estimated_wait": wait_time,
        "faculty_status": timetable_status["status"] if timetable_status else "unknown",
        "next_free_slot": timetable_status["free_slots_today"][0] if timetable_status and timetable_status["free_slots_today"] else None,
        "cluster_info": cluster_result
    }

@router.on_event("startup")
async def _noop(): pass  # ensures router can import manager lazily

def _broadcast():
    from main import manager
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(manager.broadcast("refresh"))
    except Exception:
        pass

@router.get("/my-doubts")
def get_my_doubts(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user:
        raise HTTPException(401, "Unauthorized")

    doubts = list(db.doubts.find({"student_id": user["id"]}).sort("created_at", -1))
    for d in doubts:
        d["_id"] = str(d["_id"])
        d["created_at"] = str(d["created_at"])
    return {"doubts": doubts}

@router.get("/faculty-queue")
def get_faculty_queue(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    doubts = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": "pending"
    }).sort("created_at", 1))

    for d in doubts:
        d["_id"] = str(d["_id"])
        d["created_at"] = str(d["created_at"])
    return {"queue": doubts, "total": len(doubts)}

@router.put("/accept/{doubt_id}")
def accept_doubt(doubt_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    db.doubts.update_one(
        {"_id": ObjectId(doubt_id)},
        {"$set": {
            "status": "active",
            "accepted_at": datetime.utcnow(),
        }}
    )
    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"status": "busy", "session_started_at": datetime.utcnow()}}
    )
    _broadcast()
    return {"message": "Session started", "auto_complete_in": "30 minutes"}

@router.put("/complete/{doubt_id}")
def complete_doubt(doubt_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    db.doubts.update_one(
        {"_id": ObjectId(doubt_id)},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"status": "available"}}
    )
    _broadcast()
    return {"message": "Session completed"}

@router.put("/reject/{doubt_id}")
def reject_doubt(doubt_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    db.doubts.update_one(
        {"_id": ObjectId(doubt_id)},
        {"$set": {
            "status": "pending",
            "rejected_at": datetime.utcnow(),
            "priority": "urgent",
            "reject_count": 1
        }}
    )
    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"status": "available"}}
    )
    db.override_logs.insert_one({
        "faculty_id": user["id"],
        "action": "rejected_session",
        "doubt_id": doubt_id,
        "timestamp": datetime.utcnow()
    })
    _broadcast()
    return {"message": "Session rejected, student re-queued as priority"}

@router.post("/send-message/{doubt_id}")
def send_message(doubt_id: str, data: MessageRequest, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    db.doubts.update_one(
        {"_id": ObjectId(doubt_id)},
        {"$set": {
            "faculty_message": data.message,
            "message_sent_at": datetime.utcnow(),
            "message_read": False
        }}
    )
    _broadcast()
    return {"message": "Message sent successfully"}