from pydantic import BaseModel
from typing import Optional

class DoubtRequest(BaseModel):
    subject: str
    topic: str
    description: str
    faculty_id: str
    duration: str = "medium"
    scheduled_date: Optional[str] = None
    scheduled_period: Optional[int] = None
    reminder_minutes: int = 10
