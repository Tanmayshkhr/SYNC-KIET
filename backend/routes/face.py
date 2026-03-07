from fastapi import APIRouter, HTTPException, Header
from pymongo import MongoClient
from utils.jwt import verify_token, create_token
from bson import ObjectId
from datetime import datetime
import base64
import os
import json

router = APIRouter()
client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client["synckiet"]

# Lazy imports for heavy dependencies — server starts even if not installed
np = None
cv2 = None
face_recognition = None
DeepFace = None
FR_ENGINE = None
_face_cascade = None

def _load_deps():
    """Load face recognition dependencies on first use."""
    global np, cv2, face_recognition, DeepFace, FR_ENGINE, _face_cascade
    if FR_ENGINE is not None:
        return
    try:
        import numpy as _np
        np = _np
    except ImportError:
        FR_ENGINE = "none"
        return
    try:
        import cv2 as _cv2
        cv2 = _cv2
    except ImportError:
        FR_ENGINE = "none"
        return
    # Try face_recognition (best accuracy)
    try:
        import face_recognition as _fr
        face_recognition = _fr
        FR_ENGINE = "face_recognition"
        return
    except ImportError:
        pass
    # Try deepface (good accuracy)
    try:
        from deepface import DeepFace as _df
        DeepFace = _df
        FR_ENGINE = "deepface"
        return
    except ImportError:
        pass
    # Fallback: OpenCV Haar + LBP histogram (works with just numpy+cv2)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    if os.path.exists(cascade_path):
        _face_cascade = cv2.CascadeClassifier(cascade_path)
        FR_ENGINE = "opencv"
    else:
        FR_ENGINE = "none"

def _require_deps():
    """Ensure deps are loaded, raise if unavailable."""
    _load_deps()
    if FR_ENGINE == "none" or np is None or cv2 is None:
        raise HTTPException(500, "Face recognition libraries not installed. Install numpy and opencv-python.")


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


# --- OpenCV Haar + LBP histogram face engine ---

def _detect_face_opencv(img):
    """Detect the largest face in an image using Haar cascade. Returns cropped face or None."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Enhance contrast for low-light webcam frames
    gray = cv2.equalizeHist(gray)
    faces = _face_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=3, minSize=(50, 50)
    )
    if len(faces) == 0:
        return None
    # Pick largest face by area
    x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
    face_roi = gray[y:y+h, x:x+w]
    return face_roi


def _face_to_encoding_opencv(face_roi, size=128):
    """Convert a grayscale face ROI to a compact encoding vector.
    Uses resized pixel values + LBP-style histogram for a 256+size*size dim vector.
    """
    resized = cv2.resize(face_roi, (size, size))
    # Normalize to 0-1
    normalized = resized.astype(np.float64) / 255.0
    # LBP histogram (simplified: use intensity histogram of equalized face)
    equalized = cv2.equalizeHist(resized)
    hist = cv2.calcHist([equalized], [0], None, [256], [0, 256]).flatten()
    hist = hist / (hist.sum() + 1e-7)
    # Combine: flattened resized face + histogram
    encoding = np.concatenate([normalized.flatten(), hist])
    return encoding.tolist()


def get_encoding_opencv(img):
    """Get face encoding using OpenCV Haar + histogram approach."""
    face_roi = _detect_face_opencv(img)
    if face_roi is None:
        return None
    return _face_to_encoding_opencv(face_roi)


def compare_faces_opencv(stored_encoding, img):
    """Compare faces using OpenCV encoding (cosine similarity)."""
    new_encoding = get_encoding_opencv(img)
    if new_encoding is None:
        return False, 0.0
    a = np.array(stored_encoding)
    b = np.array(new_encoding)
    # Cosine similarity
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return False, 0.0
    similarity = dot / norm
    confidence = round(similarity * 100, 1)
    # threshold: 0.75 works well for this histogram approach
    return similarity > 0.75, confidence


@router.post("/register")
async def register_face(data: dict, authorization: str = Header(...)):
    """One-time face registration. Stores face encoding in faculty document."""
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    if not user or user["role"] != "faculty":
        raise HTTPException(401, "Unauthorized")

    _require_deps()

    image_b64 = data.get("image")
    if not image_b64:
        raise HTTPException(400, "No image provided")

    img = decode_base64_image(image_b64)
    if img is None:
        raise HTTPException(400, "Invalid image")

    # Extract face encoding
    if FR_ENGINE == "face_recognition":
        encoding = get_encoding_fr(img)
    elif FR_ENGINE == "deepface":
        encoding = get_encoding_deepface(img)
    else:
        encoding = get_encoding_opencv(img)

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

    _require_deps()

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
    elif FR_ENGINE == "deepface":
        match, confidence = compare_faces_deepface(stored_encoding, img)
    else:
        match, confidence = compare_faces_opencv(stored_encoding, img)

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

    _load_deps()
    faculty = db.faculty.find_one({"_id": ObjectId(user["id"])})
    return {
        "face_registered": faculty.get("face_registered", False),
        "manual_status": faculty.get("manual_status"),
        "last_scan_at": str(faculty.get("last_scan_at", "")),
        "last_scan_action": faculty.get("last_scan_action"),
        "engine": FR_ENGINE or "none"
    }


@router.post("/login")
async def face_login(data: dict):
    """Login a faculty member via face recognition (no token required)."""
    _require_deps()

    image_b64 = data.get("image")
    if not image_b64:
        raise HTTPException(400, "No image provided")

    img = decode_base64_image(image_b64)
    if img is None:
        raise HTTPException(400, "Invalid image")

    # Get encoding from the submitted image
    if FR_ENGINE == "face_recognition":
        new_encoding = get_encoding_fr(img)
    elif FR_ENGINE == "deepface":
        new_encoding = get_encoding_deepface(img)
    else:
        new_encoding = get_encoding_opencv(img)

    if new_encoding is None:
        raise HTTPException(400, "No face detected. Ensure good lighting and face the camera clearly.")

    # Search all faculty with registered faces
    registered_faculty = list(db.faculty.find({"face_registered": True, "face_encoding": {"$exists": True}}))
    if not registered_faculty:
        raise HTTPException(404, "No faculty have registered their face yet. Use manual login.")

    best_match = None
    best_confidence = 0.0

    for fac in registered_faculty:
        stored = fac["face_encoding"]
        if FR_ENGINE == "face_recognition":
            match, confidence = compare_faces_fr(stored, img)
        elif FR_ENGINE == "deepface":
            match, confidence = compare_faces_deepface(stored, img)
        else:
            match, confidence = compare_faces_opencv(stored, img)

        if match and confidence > best_confidence:
            best_match = fac
            best_confidence = confidence

    if not best_match:
        raise HTTPException(403, "Face not recognized. Try again with better lighting or use manual login.")

    token = create_token({
        "id": str(best_match["_id"]),
        "role": "faculty",
        "name": best_match["name"]
    })

    # Auto check-in on face login
    db.faculty.update_one(
        {"_id": best_match["_id"]},
        {"$set": {
            "manual_status": "available",
            "last_scan_at": datetime.utcnow(),
            "last_scan_action": "check_in"
        }}
    )

    try:
        from main import manager
        await manager.broadcast("refresh")
    except Exception:
        pass

    return {
        "token": token,
        "name": best_match["name"],
        "role": "faculty",
        "confidence": best_confidence,
        "needs_security_setup": "security_question" not in best_match or not best_match.get("security_question") or not best_match.get("password_changed")
    }
