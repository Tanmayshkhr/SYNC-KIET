from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from pymongo import MongoClient
from utils.jwt import verify_token
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
import os
import io

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

class TimeSlot(BaseModel):
    day: str
    start: str
    end: str
    subject: str
    section: Optional[str] = ""
    room: Optional[str] = ""
    class_type: Optional[str] = "Lecture"
    type: Optional[str] = "class"

class TimetableUpload(BaseModel):
    faculty_code: str
    slots: List[TimeSlot]

@router.get("/my-schedule")
def get_my_schedule(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")
    faculty = db.faculty.find_one({"_id": ObjectId(user["id"])})
    if not faculty:
        raise HTTPException(404, "Faculty not found")
    faculty_code = faculty.get("faculty_code", "")
    timetable = db.timetables.find_one({"faculty_code": faculty_code})
    today = datetime.now().strftime("%A")
    if not timetable:
        return {"day": today, "slots": [], "weekly": {}}
    slots = timetable.get("slots", [])
    today_slots = sorted([s for s in slots if s.get("day","").lower()==today.lower()], key=lambda x: x.get("start",""))
    days = ["Monday","Tuesday","Wednesday","Thursday","Friday"]
    weekly = {}
    for day in days:
        weekly[day] = sorted([s for s in slots if s.get("day","").lower()==day.lower()], key=lambda x: x.get("start",""))
    return {"day": today, "slots": today_slots, "weekly": weekly, "faculty_code": faculty_code}

@router.get("/all-faculty-status")
def get_all_faculty_status():
    faculties = list(db.faculty.find({}))
    today = datetime.now().strftime("%A")
    current_time = datetime.now().strftime("%H:%M")
    result = []
    for f in faculties:
        fac_id = str(f["_id"])
        faculty_code = f.get("faculty_code", "")
        timetable = db.timetables.find_one({"faculty_code": faculty_code})
        today_slots, free_slots = [], []
        if timetable:
            all_slots = timetable.get("slots", [])
            today_slots = sorted([s for s in all_slots if s.get("day","").lower()==today.lower()], key=lambda x: x.get("start",""))
            free_slots = [s for s in today_slots if s.get("type")=="free"]
        manual_status = f.get("manual_status")
        status = manual_status if manual_status else "available"
        if not manual_status:
            for slot in today_slots:
                if slot.get("type")=="class" and slot.get("start","") <= current_time <= slot.get("end","23:59"):
                    status = "busy"; break
        result.append({
            "_id": fac_id, "faculty_name": f.get("name",""), "faculty_code": faculty_code,
            "subject": f.get("subject",""), "email": f.get("email",""), "cabin": f.get("cabin",""),
            "block": f.get("block",""), "status": status, "manual_status": manual_status,
            "queue_count": db.doubts.count_documents({"faculty_id": fac_id, "status": "pending"}),
            "free_slots_today": free_slots[:3], "message": f.get("status_message","")
        })
    return {"faculty": result}

@router.post("/upload")
def upload_timetable(data: TimetableUpload, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "admin":
        raise HTTPException(401, "Unauthorized")
    faculty = db.faculty.find_one({"faculty_code": data.faculty_code})
    if not faculty:
        raise HTTPException(404, f"Faculty code {data.faculty_code} not found")
    slots = [s.dict() for s in data.slots]
    db.timetables.update_one(
        {"faculty_code": data.faculty_code},
        {"$set": {"faculty_code": data.faculty_code, "faculty_name": faculty.get("name",""), "slots": slots, "updated_at": datetime.utcnow(), "updated_by": user["id"]}},
        upsert=True
    )
    return {"message": f"Saved for {faculty.get('name')}!", "slots_count": len(slots)}

@router.post("/upload-excel")
async def upload_timetable_excel(file: UploadFile = File(...), authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "admin":
        raise HTTPException(401, "Unauthorized")
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Only Excel files (.xlsx, .xls) allowed")
    try:
        import openpyxl
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents))
        ws = wb.active
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        if not rows:
            raise HTTPException(400, "Excel file is empty")
        faculty_slots = {}
        errors = []
        for i, row in enumerate(rows, 2):
            if not row[0]: continue
            try:
                code = str(row[0]).strip()
                day = str(row[1]).strip().capitalize() if row[1] else ""
                start = str(row[2]).strip() if row[2] else ""
                end = str(row[3]).strip() if row[3] else ""
                subject = str(row[4]).strip() if row[4] else ""
                if not all([code, day, start, end, subject]):
                    errors.append(f"Row {i}: Missing fields"); continue
                if code not in faculty_slots:
                    faculty_slots[code] = []
                faculty_slots[code].append({
                    "day": day, "start": start, "end": end, "subject": subject,
                    "section": str(row[5]).strip() if row[5] else "",
                    "room": str(row[6]).strip() if row[6] else "",
                    "class_type": str(row[7]).strip() if row[7] else "Lecture",
                    "type": "class"
                })
            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")
        saved, not_found = [], []
        for code, slots in faculty_slots.items():
            faculty = db.faculty.find_one({"faculty_code": code})
            if not faculty:
                not_found.append(code); continue
            db.timetables.update_one(
                {"faculty_code": code},
                {"$set": {"faculty_code": code, "faculty_name": faculty.get("name",""), "slots": slots, "updated_at": datetime.utcnow(), "updated_by": user["id"]}},
                upsert=True
            )
            saved.append(faculty.get("name", code))
        return {"message": f"Timetables saved for {len(saved)} faculty!", "saved": saved, "not_found": not_found, "errors": errors}
    except ImportError:
        raise HTTPException(500, "Run: pip install openpyxl")
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

@router.get("/all")
def get_all_timetables(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "admin":
        raise HTTPException(401, "Unauthorized")
    timetables = list(db.timetables.find({}))
    for t in timetables:
        t["_id"] = str(t["_id"])
        t["updated_at"] = str(t.get("updated_at",""))
    return {"timetables": timetables, "total": len(timetables)}

@router.delete("/delete/{faculty_code}")
def delete_timetable(faculty_code: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "admin":
        raise HTTPException(401, "Unauthorized")
    db.timetables.delete_one({"faculty_code": faculty_code})
    return {"message": f"Deleted {faculty_code}"}

def get_faculty_status(faculty_code: str):
    timetable = db.timetables.find_one({"faculty_code": faculty_code})
    today = datetime.now().strftime("%A")
    current_time = datetime.now().strftime("%H:%M")
    if not timetable:
        return {"status": "available", "free_slots_today": []}
    slots = timetable.get("slots", [])
    today_slots = sorted([s for s in slots if s.get("day","").lower()==today.lower()], key=lambda x: x.get("start",""))
    status = "available"
    for slot in today_slots:
        if slot.get("type")=="class" and slot.get("start","") <= current_time <= slot.get("end","23:59"):
            status = "busy"; break
    return {"status": status, "free_slots_today": [s for s in today_slots if s.get("type")!="class"]}