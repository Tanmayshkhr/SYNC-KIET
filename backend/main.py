from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from routes import auth, doubts, timetable, faculty, admin, face
from typing import List
import asyncio
import os

app = FastAPI(title="PuchoKIET API")

# ── Middleware ─────────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── WebSocket Manager (handles 300+ concurrent connections) ────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        print(f"WS connected. Total: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        print(f"WS disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        """Broadcast to all connections — dead connections auto-cleaned."""
        if not self.active_connections:
            return
        dead = []
        async with self._lock:
            connections = list(self.active_connections)
        results = await asyncio.gather(
            *[self._send(ws, message) for ws in connections],
            return_exceptions=True
        )
        for ws, result in zip(connections, results):
            if isinstance(result, Exception):
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self.active_connections:
                        self.active_connections.remove(ws)

    async def _send(self, websocket: WebSocket, message: str):
        await websocket.send_text(message)

manager = ConnectionManager()

# ── Startup: Create DB indexes for performance ─────────────────────────
@app.on_event("startup")
async def startup():
    from pymongo import MongoClient, ASCENDING, DESCENDING
    client = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
    db = client["synckiet"]

    # Create indexes for fast queries (run once, idempotent)
    try:
        db.doubts.create_index([("faculty_id", ASCENDING), ("status", ASCENDING)])
        db.doubts.create_index([("student_id", ASCENDING)])
        db.doubts.create_index([("status", ASCENDING)])
        db.doubts.create_index([("created_at", DESCENDING)])
        db.doubts.create_index([("grouped", ASCENDING), ("cluster_id", ASCENDING)])
        db.students.create_index([("email", ASCENDING)], unique=True, sparse=True)
        db.faculty.create_index([("email", ASCENDING)], unique=True, sparse=True)
        db.faculty.create_index([("faculty_code", ASCENDING)])
        db.announcements.create_index([("created_at", DESCENDING)])
        print("✅ MongoDB indexes created successfully")
    except Exception as e:
        print(f"Index creation: {e}")

# ── Routes ─────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(doubts.router, prefix="/doubts", tags=["Doubts"])
app.include_router(timetable.router, prefix="/timetable", tags=["Timetable"])
app.include_router(faculty.router, prefix="/faculty", tags=["Faculty"])
app.include_router(admin.router, prefix="/admin")
app.include_router(face.router, prefix="/face", tags=["Face Recognition"])

@app.get("/")
def root():
    return {"message": "PuchoKIET Backend Running", "connections": len(manager.active_connections)}

@app.get("/health")
def health():
    return {"status": "ok", "ws_connections": len(manager.active_connections)}

# ── WebSocket endpoint ─────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.wait_for(websocket.receive_text(), timeout=30)
    except asyncio.TimeoutError:
        # Send ping to keep connection alive
        try:
            await websocket.send_text("ping")
        except:
            await manager.disconnect(websocket)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)