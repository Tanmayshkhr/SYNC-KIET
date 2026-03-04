from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from utils.jwt import verify_token
from bson import ObjectId
from datetime import datetime
import numpy as np
import base64
import os
import json

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

# Try importing face_recognition (preferred) or fall back to deepface
try:
    import face_recognition
    FR_ENGINE = "face_recognition"
except ImportError:
    try:
        from deepface import DeepFace
        FR_ENGINE = "deepface"
    except ImportError:
        FR_ENGINE = None


def decode_base64_image(base64_str: str):
    """Decode base64 image string to numpy array."""
    import cv2
    # Remove data URL prefix if present
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_bytes = base64.b64decode(base64_str)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img


def get_encoding_fr(img):
    """Get face encoding using face_recognition library."""
    rgb = img[:, :, ::-1]  # BGR to RGB
    encodings = face_recognition.face_encodings(rgb)
    if len(encodings) == 0:
        return None
    return encodings[0].tolist()


def compare_faces_fr(stored_encoding, img):
    """Compare faces using face_recognition library."""
    rgb = img[:, :, ::-1]
    encodings = face_recognition.face_encodings(rgb)
    if len(encodings) == 0:
        return False, 0.0
    result = face_recognition.compare_faces(
        [np.array(stored_encoding)], encodings[0], tolerance=0.5
    )
    distance = face_recognition.face_distance(
        [np.array(stored_encoding)], encodings[0]
    )[0]
    confidence = round((1 - distance) * 100, 1)
    return result[0], confidence


def get_encoding_deepface(img):
    """Get face encoding using deepface."""
    import cv2
    temp_path = "temp_face.jpg"
    cv2.imwrite(temp_path, img)
    try:
        embeddings = DeepFace.represent(temp_path, model_name="Facenet", enforce_detection=True)
        os.remove(temp_path)
        if embeddings and len(embeddings) > 0:
            return embeddings[0]["embedding"]
        return None
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return None


def compare_faces_deepface(stored_encoding, img):
    """Compare faces using deepface (cosine similarity)."""
    new_encoding = get_encoding_deepface(img)
    if new_encoding is None:
        return False, 0.0
    # Cosine similarity
    a = np.array(stored_encoding)
    b = np.array(new_encoding)
    similarity = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    confidence = round(similarity * 100, 1)
    return similarity > 0.6, confidence


@router.post("/register")
async def register_face(data: dict, authorization: str = Header(...)):
    """One-time face registration. Stores face encoding in faculty document."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    if FR_ENGINE is None:
        raise HTTPException(500, "No face recognition library installed. Install face_recognition or deepface.")

    image_b64 = data.get("image")
    if not image_b64:
        raise HTTPException(400, "No image provided")

    img = decode_base64_image(image_b64)
    if img is None:
        raise HTTPException(400, "Invalid image")

    # Extract face encoding
    if FR_ENGINE == "face_recognition":
        encoding = get_encoding_fr(img)
    else:
        encoding = get_encoding_deepface(img)

    if encoding is None:
        raise HTTPException(400, "No face detected in the image. Please try again with a clear photo.")

    # Store encoding in faculty document
    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {
            "face_encoding": encoding,
            "face_registered": True,
            "face_registered_at": datetime.utcnow()
        }}
    )

    return {"message": "Face registered successfully!", "engine": FR_ENGINE}


@router.post("/scan")
async def scan_face(data: dict, authorization: str = Header(...)):
    """Scan face to check in (available) or check out (left)."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    if FR_ENGINE is None:
        raise HTTPException(500, "No face recognition library installed.")

    image_b64 = data.get("image")
    action = data.get("action", "check_in")  # "check_in" or "check_out"

    if not image_b64:
        raise HTTPException(400, "No image provided")

    # Get stored face encoding
    faculty = db.faculty.find_one({"_id": ObjectId(user["id"])})
    if not faculty or not faculty.get("face_encoding"):
        raise HTTPException(400, "Face not registered. Please register your face first.")

    img = decode_base64_image(image_b64)
    if img is None:
        raise HTTPException(400, "Invalid image")

    # Compare faces
    stored_encoding = faculty["face_encoding"]
    if FR_ENGINE == "face_recognition":
        match, confidence = compare_faces_fr(stored_encoding, img)
    else:
        match, confidence = compare_faces_deepface(stored_encoding, img)

    if not match:
        raise HTTPException(403, f"Face not recognized (confidence: {confidence}%). Please try again.")

    # Update faculty status
    new_status = "available" if action == "check_in" else "left"
    db.faculty.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {
            "manual_status": new_status,
            "last_scan_at": datetime.utcnow(),
            "last_scan_action": action
        }}
    )

    # Broadcast update via WebSocket
    try:
        from main import manager
        await manager.broadcast("refresh")
    except Exception as e:
        print("Broadcast error:", e)

    status_label = "Available" if action == "check_in" else "Left"
    return {
        "message": f"Face verified! Status: {status_label}",
        "status": new_status,
        "confidence": confidence,
        "action": action
    }


@router.get("/status")
def get_face_status(authorization: str = Header(...)):
    """Check if face is registered and current scan status."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    faculty = db.faculty.find_one({"_id": ObjectId(user["id"])})
    return {
        "face_registered": faculty.get("face_registered", False),
        "manual_status": faculty.get("manual_status"),
        "last_scan_at": str(faculty.get("last_scan_at", "")),
        "last_scan_action": faculty.get("last_scan_action"),
        "engine": FR_ENGINE or "none"
    }
