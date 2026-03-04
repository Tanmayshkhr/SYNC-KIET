from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, doubts, timetable, faculty, admin
app = FastAPI(title="PuchoKIET API")

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