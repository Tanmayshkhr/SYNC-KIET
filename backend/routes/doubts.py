from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from pymongo import MongoClient
from utils.jwt import verify_token
from utils.ai import cluster_doubts, calculate_wait_time, find_similar_doubts, recommend_faculty
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
async def submit_doubt(data: DoubtRequest, authorization: str = Header(...)):
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
        "duration": data.duration,
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
        "subject": data.subject,
        "student_id": {"$ne": user["id"]}
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

    await _broadcast()
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

async def _broadcast():
    try:
        from main import manager
        await manager.broadcast("refresh")
    except Exception as e:
        print("Broadcast error:", e)

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
async def accept_doubt(doubt_id: str, authorization: str = Header(...)):
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
    await _broadcast()
    return {"message": "Session started", "auto_complete_in": "30 minutes"}

@router.put("/complete/{doubt_id}")
async def complete_doubt(doubt_id: str, authorization: str = Header(...)):
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
    await _broadcast()
    return {"message": "Session completed"}

class RejectRequest(BaseModel):
    reason: str = "No reason provided"

@router.put("/reject/{doubt_id}")
async def reject_doubt(doubt_id: str, data: RejectRequest = None, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    reason = data.reason if data else "No reason provided"

    db.doubts.update_one(
        {"_id": ObjectId(doubt_id)},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.utcnow(),
            "reject_reason": reason,
            "faculty_message": f"Rejected: {reason}",
            "faculty_id": user["id"],
            "faculty_name": user.get("name", "")
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
        "reason": reason,
        "timestamp": datetime.utcnow()
    })
    await _broadcast()
    return {"message": "Doubt rejected with reason"}

@router.post("/send-message/{doubt_id}")
async def send_message(doubt_id: str, data: MessageRequest, authorization: str = Header(...)):
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
    await _broadcast()
    return {"message": "Message sent successfully"}


@router.get("/find-similar")
def find_similar(authorization: str = Header(...)):
    """Analyze the current queue and suggest groups of similar topics."""
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

    result = find_similar_doubts(doubts)
    return result


@router.post("/group-doubts")
async def group_doubts(data: dict, authorization: str = Header(...)):
    """Manually group selected doubts together."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    doubt_ids = data.get("doubt_ids", [])
    group_name = data.get("group_name", "Grouped Doubts")

    if len(doubt_ids) < 2:
        raise HTTPException(400, "Need at least 2 doubts to group")

    cluster_id = f"manual_{doubt_ids[0][:8]}_{int(datetime.utcnow().timestamp())}"

    # Get student count for the notification message
    grouped_doubts = list(db.doubts.find({"_id": {"$in": [ObjectId(did) for did in doubt_ids]}}))
    student_names = [d.get("student_name", "Student") for d in grouped_doubts]
    notify_msg = f"🤝 You've been grouped with {len(student_names) - 1} other student(s) for a group session on \"{group_name}\". Please wait together."

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
    """Get completed/rejected doubt history for faculty."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    doubts = list(db.doubts.find({
        "faculty_id": user["id"],
        "status": {"$in": ["completed", "rejected"]}
    }).sort("_id", -1).limit(50))

    for d in doubts:
        d["_id"] = str(d["_id"])
        d["created_at"] = str(d.get("created_at", ""))
        d["completed_at"] = str(d.get("completed_at", ""))
        d["accepted_at"] = str(d.get("accepted_at", ""))
        d["rejected_at"] = str(d.get("rejected_at", ""))

    total_completed = db.doubts.count_documents({"faculty_id": user["id"], "status": "completed"})
    total_rejected = db.doubts.count_documents({"faculty_id": user["id"], "status": {"$in": ["rejected"]}})

    return {
        "history": doubts,
        "total_completed": total_completed,
        "total_rejected": total_rejected
    }


class RecommendRequest(BaseModel):
    topic: str
    subject: str = ""


@router.post("/recommend-faculty")
def get_faculty_recommendations(data: RecommendRequest, authorization: str = Header(...)):
    """Smart faculty recommendation based on topic, history, availability, and queue."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "student":
        raise HTTPException(401, "Unauthorized")

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