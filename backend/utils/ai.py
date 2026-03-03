from google import genai
import os
import json

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
def cluster_doubts(doubts: list):
    if len(doubts) < 2:
        return {
            "grouped": False,
            "reason": "Not enough similar doubts yet",
            "cluster_name": "",
            "students": []
        }
    try:
        doubt_list = [
            f"Student: {d['student_name']}, Topic: {d['topic']}, Description: {d['description']}"
            for d in doubts
        ]
        doubt_text = "\n".join(doubt_list)

        prompt = f"""Analyze these student doubts and check if they are similar enough to group into one session.

{doubt_text}

Respond ONLY with a JSON object, no markdown, no explanation:
{{
    "grouped": true or false,
    "similarity_score": 0-100,
    "cluster_name": "name of the common topic",
    "recommendation": "one sentence recommendation",
    "students": ["list of student names to group"]
}}"""

        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        raw = response.text.strip()
        clean = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)

    except Exception:
        # Smart keyword-based fallback when AI quota exceeded
        topics = [d["topic"].lower() for d in doubts]
        keywords = ["bst", "binary", "tree", "sort", "linked", "graph", "stack", "queue"]
        matched = [k for k in keywords if any(k in t for t in topics)]
        if matched:
            return {
                "grouped": True,
                "similarity_score": 75,
                "cluster_name": f"{matched[0].upper()} related doubts",
                "recommendation": "Group these students for a common session",
                "students": [d["student_name"] for d in doubts]
            }
        return {
            "grouped": False,
            "reason": "Topics too different to group",
            "cluster_name": "",
            "students": []
        }
        
    doubt_list = [
        f"Student: {d['student_name']}, Topic: {d['topic']}, Description: {d['description']}"
        for d in doubts
    ]
    doubt_text = "\n".join(doubt_list)

    prompt = f"""Analyze these student doubts and check if they are similar enough to group into one session.

{doubt_text}

Respond ONLY with a JSON object, no markdown, no explanation:
{{
    "grouped": true or false,
    "similarity_score": 0-100,
    "cluster_name": "name of the common topic",
    "recommendation": "one sentence recommendation",
    "students": ["list of student names to group"]
}}"""

    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
    raw = response.text.strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


def get_doubt_hint(subject: str, topic: str, description: str):
    prompt = f"""A student has a doubt in {subject} about "{topic}".
Description: "{description}"

Give a helpful hint to guide them while they wait for the faculty.
Respond ONLY with a JSON object, no markdown:
{{
    "hint": "one helpful sentence to guide the student",
    "key_concept": "the main concept they should review",
    "estimated_complexity": "easy/medium/hard"
}}"""

    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
    raw = response.text.strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


def find_best_slot(faculty_timetable: list, pending_count: int):
    prompt = f"""Given this faculty timetable: {faculty_timetable}
And {pending_count} students waiting for doubt sessions.

Find the best available slot for a group session.
Respond ONLY with a JSON object, no markdown:
{{
    "best_slot": "time like 2:00 PM",
    "duration_minutes": 30,
    "reason": "why this slot is best"
}}"""

    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
    raw = response.text.strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)
def calculate_wait_time(faculty_id: str, queue_position: int, db) -> str:
    # Get last 10 completed sessions for this faculty
    completed = list(db.doubts.find({
        "faculty_id": faculty_id,
        "status": "completed",
        "accepted_at": {"$exists": True},
        "completed_at": {"$exists": True}
    }).sort("completed_at", -1).limit(10))

    if completed:
        durations = []
        for s in completed:
            if "accepted_at" in s and "completed_at" in s:
                diff = (s["completed_at"] - s["accepted_at"]).seconds // 60
                if diff > 0:
                    durations.append(diff)
        avg_duration = sum(durations) // len(durations) if durations else 15
    else:
        avg_duration = 15

    total_wait = (queue_position - 1) * avg_duration

    if total_wait == 0:
        return "You are next"
    elif total_wait < 60:
        return f"{total_wait} minutes"
    else:
        hours = total_wait // 60
        mins = total_wait % 60
        return f"{hours}h {mins}m"