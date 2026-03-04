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
def faculty_login(data: FacultyLogin):
    faculty = db.faculty.find_one({"email": data.email})
    if not faculty:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(data.password.encode("utf-8"), faculty["password"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({
        "id": str(faculty["_id"]),
        "role": "faculty",
        "name": faculty["name"]
    })
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