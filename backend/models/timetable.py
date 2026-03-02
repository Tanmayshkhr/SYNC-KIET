from pydantic import BaseModel
from typing import List, Optional

class TimeSlot(BaseModel):
    day: str
    period: int
    start_time: str
    end_time: str
    subject_code: str
    subject_name: str
    room: Optional[str] = ""

class FacultyTimetable(BaseModel):
    faculty_code: str
    slots: List[TimeSlot]