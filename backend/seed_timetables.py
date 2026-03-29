"""
Seed faculty timetables in the exact `faculty.timetable` format consumed by
`backend/routes/timetable.py`.

This script intentionally seeds:
- Monday to Friday only
- no Sunday or Saturday timetable entries
- 8 instructional periods with the lunch break between periods 4 and 5
- at least 5 classes per faculty per working day
"""

from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["synckiet"]

WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

TIME_SLOTS = {
    1: {"start": "09:10", "end": "10:00"},
    2: {"start": "10:00", "end": "10:50"},
    3: {"start": "10:50", "end": "11:40"},
    4: {"start": "11:40", "end": "12:30"},
    5: {"start": "13:30", "end": "14:20"},
    6: {"start": "14:20", "end": "15:10"},
    7: {"start": "15:10", "end": "16:00"},
    8: {"start": "16:00", "end": "16:50"},
}

PATTERN_LIBRARY = [
    {"Monday": [1, 2, 3, 5, 6, 8], "Tuesday": [1, 2, 4, 5, 7], "Wednesday": [2, 3, 4, 6, 7, 8], "Thursday": [1, 3, 4, 5, 6], "Friday": [1, 2, 5, 7, 8]},
    {"Monday": [1, 2, 4, 5, 7], "Tuesday": [1, 3, 4, 6, 7, 8], "Wednesday": [1, 2, 5, 6, 8], "Thursday": [2, 3, 4, 5, 7], "Friday": [1, 3, 5, 6, 7, 8]},
    {"Monday": [1, 3, 4, 5, 6], "Tuesday": [2, 3, 5, 7, 8], "Wednesday": [1, 2, 4, 5, 6], "Thursday": [1, 2, 3, 6, 8], "Friday": [2, 4, 5, 7, 8]},
    {"Monday": [2, 3, 4, 6, 7, 8], "Tuesday": [1, 2, 5, 6, 8], "Wednesday": [1, 3, 4, 5, 7], "Thursday": [2, 3, 5, 6, 7], "Friday": [1, 2, 4, 5, 8]},
    {"Monday": [1, 2, 5, 6, 7], "Tuesday": [1, 3, 4, 5, 8], "Wednesday": [2, 3, 4, 6, 7, 8], "Thursday": [1, 2, 4, 5, 6], "Friday": [1, 3, 5, 7, 8]},
    {"Monday": [1, 4, 5, 6, 8], "Tuesday": [2, 3, 4, 5, 7], "Wednesday": [1, 2, 3, 6, 7, 8], "Thursday": [1, 3, 5, 6, 8], "Friday": [2, 4, 5, 6, 7]},
]

FACULTY_LIST = [
    {"code": "ABG", "name": "Dr. Abhishek Goyal", "subject": "Web Technology"},
    {"code": "ATJ", "name": "Dr. Aatif Jamshed", "subject": "Web Technology"},
    {"code": "ABS", "name": "Mr. Abhishek Sharma", "subject": "Web Technology"},
    {"code": "VKS", "name": "Mr. Vivek Kumar Sharma", "subject": "Design and Analysis of Algorithms"},
    {"code": "RK", "name": "Dr. Raj Kumar", "subject": "Design and Analysis of Algorithms"},
    {"code": "KKA", "name": "Mr. Kuldeep Kumar Atariya", "subject": "Design and Analysis of Algorithms"},
    {"code": "TSH", "name": "Mr. Tarsh Vaibhav", "subject": "Design and Analysis of Algorithms"},
    {"code": "DP", "name": "Mr. Dheeraj Pandey", "subject": "ANN and Machine Learning"},
    {"code": "AM", "name": "Dr. Anurag Mishra", "subject": "ANN and Machine Learning"},
    {"code": "KS", "name": "Ms. Kirti Sharma", "subject": "ANN and Machine Learning"},
    {"code": "BKG", "name": "Mr. Bhagvan Krishan Gupta", "subject": "ANN and Machine Learning"},
    {"code": "AG", "name": "Dr. Akash Goel", "subject": "Web Technology"},
    {"code": "SKR", "name": "Dr. Sunil Kumar", "subject": "Computer Networks"},
    {"code": "RR", "name": "Mr. Rohan Rathore", "subject": "Computer Networks"},
    {"code": "PKP", "name": "Mr. Pawan Kumar Pal", "subject": "Computer Networks"},
    {"code": "NS", "name": "Mr. Nikhil Saraswat", "subject": "Computer Networks"},
    {"code": "TRL", "name": "Ms. Tarul", "subject": "Data Analytics"},
    {"code": "PRI", "name": "Ms. Priya Raghuvanshi", "subject": "Data Analytics"},
    {"code": "MT", "name": "Mr. Mohit Singh Tanwar", "subject": "Data Analytics"},
    {"code": "RA", "name": "Mr. Rahul", "subject": "Data Analytics"},
    {"code": "AS", "name": "Ms. Arti Sharma", "subject": "Universal Human Values"},
    {"code": "ADJ", "name": "Ms. Aditi Joshi", "subject": "Universal Human Values"},
    {"code": "ST", "name": "Mr. Shubham Tyagi", "subject": "Aptitude"},
    {"code": "MK", "name": "Dr. Meetu Kumar", "subject": "Soft Skills"},
    {"code": "HS", "name": "Mr. Himanshu Saxena", "subject": "Soft Skills"},
    {"code": "SG", "name": "Mr. Sreesh Gaur", "subject": "Advance Data Structures"},
]

SECTION_POOLS = {
    "Web Technology": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Design and Analysis of Algorithms": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "ANN and Machine Learning": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Computer Networks": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Data Analytics": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Advance Data Structures": ["CS4A", "CS4B", "CS4C"],
    "Universal Human Values": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Aptitude": ["CS4A", "CS4B", "CS4C", "CS4D"],
    "Soft Skills": ["CS4A", "CS4B", "CS4C", "CS4D"],
}

ROOM_POOLS = {
    "Web Technology": ["C-301", "C-303", "WT-LAB-1"],
    "Design and Analysis of Algorithms": ["C-304", "C-305", "C-307"],
    "ANN and Machine Learning": ["AI-LAB-1", "C-308", "C-309"],
    "Computer Networks": ["CN-LAB-1", "C-310", "C-312"],
    "Data Analytics": ["DA-LAB-1", "C-313", "C-315"],
    "Advance Data Structures": ["C-316", "C-318", "ADS-LAB"],
    "Universal Human Values": ["H-201", "H-202", "Seminar Hall 1"],
    "Aptitude": ["APT-1", "APT-2", "Seminar Hall 2"],
    "Soft Skills": ["SS-101", "Language Lab", "Seminar Hall 3"],
}


def get_class_type(subject, period, faculty_index, day_index):
    if subject in {"Universal Human Values", "Aptitude", "Soft Skills"}:
        return "tutorial" if (faculty_index + day_index + period) % 4 == 0 else "theory"

    if subject in {"Web Technology", "ANN and Machine Learning", "Computer Networks", "Data Analytics"}:
        if period in {5, 6} and (faculty_index + day_index) % 3 == 0:
            return "lab"

    return "theory"


def build_timetable(faculty, faculty_index):
    subject = faculty["subject"]
    sections = SECTION_POOLS[subject]
    rooms = ROOM_POOLS[subject]
    pattern = PATTERN_LIBRARY[faculty_index % len(PATTERN_LIBRARY)]
    timetable = {}

    for day_index, day in enumerate(WORKING_DAYS):
        day_schedule = {}
        periods = pattern[day]

        for slot_index, period in enumerate(periods):
            section = sections[(faculty_index + day_index + slot_index) % len(sections)]
            room = rooms[(faculty_index + day_index + slot_index) % len(rooms)]
            day_schedule[str(period)] = {
                "subject": subject,
                "section": section,
                "type": get_class_type(subject, period, faculty_index, day_index),
                "room": room,
            }

        timetable[day] = day_schedule

    return timetable


def seed_timetables():
    print("Seeding faculty timetables...")
    print("-" * 48)

    seeded = 0
    for faculty_index, faculty in enumerate(FACULTY_LIST):
        timetable = build_timetable(faculty, faculty_index)
        result = db.faculty.update_one(
            {"faculty_code": faculty["code"]},
            {
                "$set": {
                    "timetable": timetable,
                    "timetable_updated": True,
                }
            },
        )

        daily_counts = {day: len(periods) for day, periods in timetable.items()}
        if result.matched_count:
            print(f"[OK] {faculty['code']} -> {daily_counts}")
            seeded += 1
        else:
            print(f"[MISS] {faculty['code']} not found in faculty collection")

    print("-" * 48)
    print(f"Completed: {seeded}/{len(FACULTY_LIST)} faculty timetables seeded")


if __name__ == "__main__":
    seed_timetables()
