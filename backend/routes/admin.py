from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from utils.jwt import verify_token
from bson import ObjectId
from datetime import datetime
import bcrypt
import os

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

def verify_admin(authorization: str):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "admin":
        raise HTTPException(401, "Unauthorized")
    return user

@router.get("/stats")
def get_stats(authorization: str = Header(...)):
    verify_admin(authorization)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "total_students": db.students.count_documents({}),
        "total_faculty": db.faculty.count_documents({}),
        "total_doubts": db.doubts.count_documents({}),
        "doubts_today": db.doubts.count_documents({"created_at": {"$gte": today}}),
        "active_sessions": db.doubts.count_documents({"status": "active"}),
        "pending_doubts": db.doubts.count_documents({"status": "pending"}),
        "completed_today": db.doubts.count_documents({"status": "completed", "created_at": {"$gte": today}}),
        "grouped_doubts": db.doubts.count_documents({"grouped": True}),
    }

@router.get("/faculty")
def get_all_faculty(authorization: str = Header(...)):
    verify_admin(authorization)
    faculty = list(db.faculty.find({}))
    for f in faculty:
        f["_id"] = str(f["_id"])
        f["password"] = "hidden"
        f["doubt_count"] = db.doubts.count_documents({"faculty_id": str(f["_id"])})
    return {"faculty": faculty}

@router.get("/students")
def get_all_students(authorization: str = Header(...)):
    verify_admin(authorization)
    students = list(db.students.find({}, {"password": 0, "security_answer": 0}))
    for s in students:
        s["_id"] = str(s["_id"])
        s["doubt_count"] = db.doubts.count_documents({"student_id": str(s["_id"])})
    return {"students": students}

@router.get("/doubts")
def get_all_doubts(authorization: str = Header(...)):
    verify_admin(authorization)
    doubts = list(db.doubts.find({}).sort("created_at", -1).limit(100))
    for d in doubts:
        d["_id"] = str(d["_id"])
        d["created_at"] = str(d["created_at"])
    return {"doubts": doubts}

@router.put("/reset-password")
def reset_password(data: dict, authorization: str = Header(...)):
    verify_admin(authorization)
    role = data.get("role")
    email = data.get("email")
    new_password = data.get("new_password")
    hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt())
    collection = db.students if role == "student" else db.faculty
    result = collection.update_one({"email": email}, {"$set": {"password": hashed}})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "Password reset successfully"}

@router.delete("/doubt/{doubt_id}")
def delete_doubt(doubt_id: str, authorization: str = Header(...)):
    verify_admin(authorization)
    db.doubts.delete_one({"_id": ObjectId(doubt_id)})
    return {"message": "Doubt deleted"}

@router.put("/complete-doubt/{doubt_id}")
def force_complete(doubt_id: str, authorization: str = Header(...)):
    verify_admin(authorization)
    db.doubts.update_one(
        {"_id": ObjectId(doubt_id)},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    return {"message": "Doubt force completed"}

@router.post("/announcement")
def send_announcement(data: dict, authorization: str = Header(...)):
    verify_admin(authorization)
    db.announcements.insert_one({
        "message": data.get("message"),
        "target": data.get("target", "all"),
        "created_at": datetime.utcnow(),
        "created_by": "admin"
    })
    return {"message": "Announcement sent"}

@router.get("/announcements")
def get_announcements():
    announcements = list(db.announcements.find({}).sort("created_at", -1).limit(10))
    for a in announcements:
        a["_id"] = str(a["_id"])
        a["created_at"] = str(a["created_at"])
    return {"announcements": announcements}