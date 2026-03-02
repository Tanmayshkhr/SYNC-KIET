from pydantic import BaseModel

class DoubtRequest(BaseModel):
    subject: str
    topic: str
    description: str
    faculty_id: str