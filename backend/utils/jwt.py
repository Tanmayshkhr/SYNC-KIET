from datetime import datetime, timedelta
import os

SECRET_KEY = os.getenv("SECRET_KEY", "synckiet2024")
ALGORITHM = "HS256"

def create_token(data: dict):
    try:
        from jose import jwt
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(hours=24)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    except Exception as e:
        return str(e)

def verify_token(token: str):
    try:
        from jose import jwt, JWTError
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        return None