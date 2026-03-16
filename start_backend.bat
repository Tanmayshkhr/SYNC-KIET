@echo off
cd C:\Users\asus\sync-kiet\backend
call venv311\Scripts\activate
python -m uvicorn main:app --reload --env-file .env
pause
