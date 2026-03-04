"""
PuchoKIET - Cabin Numbers Seed Script
Run: python seed_cabins.py
"""

from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["synckiet"]

# Real data provided + realistic ones for rest
CABIN_DATA = {
    # Real data
    "SKR": {"cabin": "E-201", "block": "E Block, 2nd Floor"},
    "AM":  {"cabin": "E-101", "block": "E Block, 1st Floor"},
    "ATJ": {"cabin": "E-101", "block": "E Block, 1st Floor"},
    "SG":  {"cabin": "E-201", "block": "E Block, 2nd Floor"},
    "DP":  {"cabin": "E-106", "block": "E Block, 1st Floor"},
    "MT":  {"cabin": "E-106", "block": "E Block, 1st Floor"},
    "VKS": {"cabin": "E-212", "block": "E Block, 2nd Floor"},
    "KKA": {"cabin": "E-212", "block": "E Block, 2nd Floor"},
    "BKG": {"cabin": "E-201", "block": "E Block, 2nd Floor"},

    # Realistic ones for remaining faculty
    "ABG": {"cabin": "E-203", "block": "E Block, 2nd Floor"},
    "ABS": {"cabin": "E-102", "block": "E Block, 1st Floor"},
    "AG":  {"cabin": "E-204", "block": "E Block, 2nd Floor"},
    "RK":  {"cabin": "E-103", "block": "E Block, 1st Floor"},
    "TSH": {"cabin": "E-104", "block": "E Block, 1st Floor"},
    "KS":  {"cabin": "E-105", "block": "E Block, 1st Floor"},
    "RR":  {"cabin": "E-202", "block": "E Block, 2nd Floor"},
    "PKP": {"cabin": "E-107", "block": "E Block, 1st Floor"},
    "NS":  {"cabin": "E-108", "block": "E Block, 1st Floor"},
    "TRL": {"cabin": "E-205", "block": "E Block, 2nd Floor"},
    "PRI": {"cabin": "E-206", "block": "E Block, 2nd Floor"},
    "RA":  {"cabin": "E-207", "block": "E Block, 2nd Floor"},
    "AS":  {"cabin": "E-109", "block": "E Block, 1st Floor"},
    "ADJ": {"cabin": "E-110", "block": "E Block, 1st Floor"},
    "ST":  {"cabin": "E-208", "block": "E Block, 2nd Floor"},
    "MK":  {"cabin": "E-209", "block": "E Block, 2nd Floor"},
    "HS":  {"cabin": "E-210", "block": "E Block, 2nd Floor"},
}

def seed_cabins():
    print("Seeding cabin numbers for all 26 faculty...")
    print("-" * 50)

    success = 0
    for code, data in CABIN_DATA.items():
        result = db.faculty.update_one(
            {"faculty_code": code},
            {"$set": {
                "cabin": data["cabin"],
                "block": data["block"]
            }}
        )
        if result.matched_count > 0:
            print(f"✓ {code} → Cabin {data['cabin']} ({data['block']})")
            success += 1
        else:
            print(f"✗ {code} → NOT FOUND in DB")

    print("-" * 50)
    print(f"Done! {success}/26 cabin numbers seeded.")

if __name__ == "__main__":
    seed_cabins()
