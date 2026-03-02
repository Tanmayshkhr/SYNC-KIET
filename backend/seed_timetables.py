"""
SYNC-KIET - Complete Timetable Seed Script
Seeds timetable data for all 26 faculty members
Run: python seed_timetables.py
"""

from pymongo import MongoClient
import random

client = MongoClient("mongodb://localhost:27017")
db = client["synckiet"]

# TIME SLOTS (same as routes/timetable.py)
TIME_SLOTS = {
    1: {"start": "09:10", "end": "10:00"},
    2: {"start": "10:00", "end": "10:50"},
    3: {"start": "10:50", "end": "11:40"},
    4: {"start": "11:40", "end": "12:30"},
    # Period 5 = Lunch 12:30 - 13:20
    5: {"start": "13:20", "end": "14:10"},
    6: {"start": "14:10", "end": "15:00"},
    7: {"start": "15:00", "end": "15:50"},
}

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# All 26 faculty with their subjects
FACULTY_LIST = [
    {"code": "ABG", "name": "Dr. Abhishek Goyal",        "subject": "Web Technology"},
    {"code": "ATJ", "name": "Dr. Aatif Jamshed",         "subject": "Web Technology"},
    {"code": "ABS", "name": "Mr. Abhishek Sharma",       "subject": "Web Technology"},
    {"code": "AG",  "name": "Dr. Akash Goel",            "subject": "Web Technology"},
    {"code": "VKS", "name": "Mr. Vivek Kumar Sharma",    "subject": "Design and Analysis of Algorithms"},
    {"code": "RK",  "name": "Dr. Raj Kumar",             "subject": "Design and Analysis of Algorithms"},
    {"code": "KKA", "name": "Mr. Kuldeep Kumar Atariya", "subject": "Design and Analysis of Algorithms"},
    {"code": "TSH", "name": "Mr. Tarsh Vaibhav",         "subject": "Design and Analysis of Algorithms"},
    {"code": "DP",  "name": "Mr. Dheeraj Pandey",        "subject": "ANN and Machine Learning"},
    {"code": "AM",  "name": "Dr. Anurag Mishra",         "subject": "ANN and Machine Learning"},
    {"code": "KS",  "name": "Ms. Kirti Sharma",          "subject": "ANN and Machine Learning"},
    {"code": "BKG", "name": "Mr. Bhagvan Krishan Gupta", "subject": "ANN and Machine Learning"},
    {"code": "SKR", "name": "Dr. Sunil Kumar",           "subject": "Computer Networks"},
    {"code": "RR",  "name": "Mr. Rohan Rathore",         "subject": "Computer Networks"},
    {"code": "PKP", "name": "Mr. Pawan Kumar Pal",       "subject": "Computer Networks"},
    {"code": "NS",  "name": "Mr. Nikhil Saraswat",       "subject": "Computer Networks"},
    {"code": "TRL", "name": "Ms. Tarul",                 "subject": "Data Analytics"},
    {"code": "PRI", "name": "Ms. Priya Raghuvanshi",     "subject": "Data Analytics"},
    {"code": "MT",  "name": "Mr. Mohit Singh Tanwar",    "subject": "Data Analytics"},
    {"code": "RA",  "name": "Mr. Rahul",                 "subject": "Data Analytics"},
    {"code": "AS",  "name": "Ms. Arti Sharma",           "subject": "Universal Human Values"},
    {"code": "ADJ", "name": "Ms. Aditi Joshi",           "subject": "Universal Human Values"},
    {"code": "ST",  "name": "Mr. Shubham Tyagi",         "subject": "Aptitude"},
    {"code": "MK",  "name": "Dr. Meetu Kumar",           "subject": "Soft Skills"},
    {"code": "HS",  "name": "Mr. Himanshu Saxena",       "subject": "Soft Skills"},
    {"code": "SG",  "name": "Mr. Sreesh Gaur",           "subject": "Advance Data Structures"},
]

# Sections taught per subject (realistic for KIET CS 2nd year)
SECTIONS = ["CS4A", "CS4B", "CS4C", "CS4D"]

def generate_timetable(faculty_code, subject):
    """
    Generate a realistic weekly timetable for a faculty member.
    - Each faculty teaches roughly 4-5 theory periods per week
    - Labs are 2 consecutive periods
    - No two classes same period same day
    - Saturday is usually light (1-2 classes max)
    """
    timetable = {}

    # Decide how many sections this faculty teaches
    # Web Tech / DAA / ML / CN faculty teach 1-2 sections
    # UHV / Aptitude / Soft Skills teach all 4 sections (common subjects)
    if subject in ["Universal Human Values", "Aptitude", "Soft Skills"]:
        sections_teaching = SECTIONS  # all 4
        periods_per_week = 8  # 2 per section
    else:
        sections_teaching = random.sample(SECTIONS, random.choice([1, 2]))
        periods_per_week = len(sections_teaching) * 3  # 3 per section per week

    # Assign periods across days
    assigned = []
    attempts = 0

    while len(assigned) < periods_per_week and attempts < 200:
        attempts += 1
        day = random.choice(DAYS)
        period = random.choice(list(TIME_SLOTS.keys()))

        # Saturday max 2 periods
        saturday_count = sum(1 for a in assigned if a["day"] == "Saturday")
        if day == "Saturday" and saturday_count >= 2:
            continue

        # Max 3 periods per day
        day_count = sum(1 for a in assigned if a["day"] == day)
        if day_count >= 3:
            continue

        # No duplicate day+period
        if any(a["day"] == day and a["period"] == period for a in assigned):
            continue

        section = random.choice(sections_teaching)
        assigned.append({
            "day": day,
            "period": period,
            "section": section,
            "subject": subject
        })

    # Build timetable dict by day
    for day in DAYS:
        day_schedule = {}
        for entry in assigned:
            if entry["day"] == day:
                slot = TIME_SLOTS[entry["period"]]
                day_schedule[str(entry["period"])] = {
                    "subject": entry["subject"],
                    "section": entry["section"],
                    "start": slot["start"],
                    "end": slot["end"],
                    "type": "theory"
                }
        timetable[day] = day_schedule

    return timetable


def seed_timetables():
    print("Seeding timetables for all 26 faculty...")
    print("-" * 50)

    success = 0
    for faculty in FACULTY_LIST:
        code = faculty["code"]
        subject = faculty["subject"]

        # Generate timetable
        timetable = generate_timetable(code, subject)

        # Count total periods
        total_periods = sum(len(v) for v in timetable.values())

        # Update faculty document in MongoDB
        result = db.faculty.update_one(
            {"faculty_code": code},
            {"$set": {
                "timetable": timetable,
                "timetable_updated": True
            }}
        )

        if result.matched_count > 0:
            print(f"✓ {faculty['name']} ({code}) → {total_periods} periods/week")
            success += 1
        else:
            print(f"✗ {faculty['name']} ({code}) → NOT FOUND in DB")

    print("-" * 50)
    print(f"Done! {success}/26 faculty timetables seeded.")


if __name__ == "__main__":
    seed_timetables()
