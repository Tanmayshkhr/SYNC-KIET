from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, doubts, timetable, faculty, admin
from typing import List

app = FastAPI(title="PuchoKIET API")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(doubts.router, prefix="/doubts", tags=["Doubts"])
app.include_router(timetable.router, prefix="/timetable", tags=["Timetable"])
app.include_router(faculty.router, prefix="/faculty", tags=["Faculty"])
app.include_router(admin.router, prefix="/admin")

@app.get("/")
def root():
    return {"message": "PuchoKIET Backend Running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)