from pydantic import BaseModel

class StudentSignup(BaseModel):
    name: str
    email: str
    password: str
    roll_no: str
    branch: str
    semester: int
    security_question: str
    security_answer: str

class StudentLogin(BaseModel):
    email: str
    password: str

class FacultySignup(BaseModel):
    name: str
    email: str
    password: str
    subject: str
    department: str
    faculty_code: str
    security_question: str
    security_answer: str

class FacultyLogin(BaseModel):
    email: str
    password: str

class ForgotPassword(BaseModel):
    email: str
    security_answer: str
    new_password: str

class SecuritySetup(BaseModel):
    security_question: str
    security_answer: str

class MessageRequest(BaseModel):
    message: str