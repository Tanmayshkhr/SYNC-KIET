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

        prompt = f"""Analyze these student doubts and check if they are about the EXACT SAME concept or very closely related topic. Different algorithms or methods should NOT be grouped even if they are in the same subject.

{doubt_text}

Respond ONLY with a JSON object, no markdown, no explanation:
{{
    "grouped": true or false,
    "similarity_score": 0-100,
    "cluster_name": "name of the common topic",
    "recommendation": "one sentence recommendation",
    "students": ["list of student names to group"]
}}"""

        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt, request_options={"timeout": 8})
        raw = response.text.strip()
        clean = raw.replace("```json", "").replace("```", "").strip()
        print(f"Clustering {len(doubts)} doubts: {[d['topic'] for d in doubts]}")
        print(f"Result: {clean}")
        return json.loads(clean)

    except Exception:
        # Smart keyword-based fallback when AI quota exceeded
        topics = [d["topic"].lower() for d in doubts]

        subject_keywords = {
            "daa": ["bst", "binary", "tree", "sort", "linked", "graph", "stack", "queue",
                    "algorithm", "dynamic", "greedy", "recursion", "knapsack", "dijkstra",
                    "prims", "kruskal", "complexity", "np", "hashing", "heap"],
            "ml": ["supervised", "unsupervised", "learning", "neural", "network", "regression",
                   "classification", "clustering", "knn", "svm", "decision", "random", "forest",
                   "gradient", "backpropagation", "cnn", "rnn", "lstm", "perceptron", "dropout"],
            "cn": ["routing", "protocol", "tcp", "ip", "http", "dns", "subnet", "osi",
                   "ethernet", "wifi", "switching", "congestion", "udp", "firewall", "nat"],
            "web": ["css", "html", "react", "node", "express", "mongodb", "api", "rest",
                    "hooks", "usestate", "useeffect", "redux", "flask", "django", "javascript"],
            "da": ["pandas", "numpy", "visualization", "matplotlib", "seaborn", "preprocessing",
                   "cleaning", "outlier", "feature", "pca", "hypothesis", "regression", "pivot"],
            "uhv": ["values", "harmony", "ethics", "society", "nature", "family", "conduct"],
            "aptitude": ["percentage", "profit", "loss", "time", "speed", "distance", "ratio",
                         "probability", "permutation", "combination", "reasoning"],
            "soft": ["communication", "interview", "resume", "presentation", "leadership", "email"],
            "ds": ["bst", "binary", "tree", "node", "linked",
                   "stack", "queue", "heap", "graph", "insertion",
                   "deletion", "traversal", "inorder", "preorder",
                   "postorder", "avl", "rotation", "search"]
        }

        all_keywords = []
        for kws in subject_keywords.values():
            all_keywords.extend(kws)

        matched = [k for k in all_keywords if any(k in t for t in topics)]

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

    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt, request_options={"timeout": 8})
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

    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt, request_options={"timeout": 8})
    raw = response.text.strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


TOPIC_ALIASES = {
    "bst": "binary search tree",
    "binary search tree": "binary search tree",
    "dll": "doubly linked list",
    "doubly linked list": "doubly linked list",
    "sll": "singly linked list",
    "singly linked list": "singly linked list",
    "ll": "linked list",
    "linked list": "linked list",
    "dp": "dynamic programming",
    "dynamic programming": "dynamic programming",
    "dfs": "depth first search",
    "depth first search": "depth first search",
    "bfs": "breadth first search",
    "breadth first search": "breadth first search",
    "avl": "avl tree",
    "avl tree": "avl tree",
    "rbt": "red black tree",
    "red black tree": "red black tree",
    "knn": "k nearest neighbors",
    "k nearest neighbors": "k nearest neighbors",
    "svm": "support vector machine",
    "support vector machine": "support vector machine",
    "cnn": "convolutional neural network",
    "convolutional neural network": "convolutional neural network",
    "rnn": "recurrent neural network",
    "recurrent neural network": "recurrent neural network",
    "lstm": "long short term memory",
    "long short term memory": "long short term memory",
    "os": "operating system",
    "operating system": "operating system",
    "dbms": "database management system",
    "database management system": "database management system",
    "oops": "object oriented programming",
    "oop": "object oriented programming",
    "object oriented programming": "object oriented programming",
    "tcp": "transmission control protocol",
    "udp": "user datagram protocol",
    "dns": "domain name system",
    "http": "hypertext transfer protocol",
    "ml": "machine learning",
    "machine learning": "machine learning",
    "ai": "artificial intelligence",
    "artificial intelligence": "artificial intelligence",
    "np": "np completeness",
    "np hard": "np completeness",
    "np complete": "np completeness",
    "substitution method": "substitution method",
    "masters theorem": "masters theorem",
    "master theorem": "masters theorem",
}

def _normalize_topic(topic: str) -> str:
    """Normalize a topic using alias mapping and lowercasing."""
    t = topic.strip().lower()
    return TOPIC_ALIASES.get(t, t)

def find_similar_doubts(doubts: list):
    """Find groups of similar doubts in a queue using normalization + AI fallback."""
    if len(doubts) < 2:
        return {"groups": [], "ungrouped": [d["_id"] for d in doubts]}

    # Phase 1: Normalize topics and group by canonical name
    topic_map = {}
    for d in doubts:
        canonical = _normalize_topic(d["topic"])
        if canonical not in topic_map:
            topic_map[canonical] = []
        topic_map[canonical].append(d)

    groups = []
    ungrouped_ids = []

    for canonical, members in topic_map.items():
        if len(members) >= 2:
            groups.append({
                "canonical_topic": canonical.title(),
                "doubts": [
                    {"_id": str(m["_id"]) if not isinstance(m["_id"], str) else m["_id"],
                     "student_name": m["student_name"],
                     "topic": m["topic"],
                     "subject": m["subject"]}
                    for m in members
                ],
                "count": len(members),
                "confidence": "high"
            })
        else:
            ungrouped_ids.extend(
                [str(m["_id"]) if not isinstance(m["_id"], str) else m["_id"] for m in members]
            )

    # Phase 2: Try AI to find less obvious similarities among ungrouped doubts
    ungrouped_doubts = [d for d in doubts
                        if (str(d["_id"]) if not isinstance(d["_id"], str) else d["_id"]) in ungrouped_ids]

    if len(ungrouped_doubts) >= 2:
        try:
            doubt_list = [
                f"ID: {d['_id']}, Student: {d['student_name']}, Topic: {d['topic']}, Subject: {d['subject']}"
                for d in ungrouped_doubts
            ]
            doubt_text = "\n".join(doubt_list)

            prompt = f"""Analyze these student doubts and find groups of topics that are about the SAME concept (including abbreviations, synonyms, rephrased versions).

{doubt_text}

Respond ONLY with a JSON object, no markdown:
{{
    "ai_groups": [
        {{
            "canonical_topic": "Common Topic Name",
            "doubt_ids": ["id1", "id2"],
            "confidence": "high/medium/low"
        }}
    ],
    "ungrouped_ids": ["ids that don't match anything"]
}}"""

            response = client.models.generate_content(
                model="gemini-2.0-flash", contents=prompt,
                request_options={"timeout": 8}
            )
            raw = response.text.strip()
            clean = raw.replace("```json", "").replace("```", "").strip()
            ai_result = json.loads(clean)

            for ag in ai_result.get("ai_groups", []):
                if len(ag.get("doubt_ids", [])) >= 2:
                    members = [d for d in ungrouped_doubts
                               if (str(d["_id"]) if not isinstance(d["_id"], str) else d["_id"]) in ag["doubt_ids"]]
                    if len(members) >= 2:
                        groups.append({
                            "canonical_topic": ag["canonical_topic"],
                            "doubts": [
                                {"_id": str(m["_id"]) if not isinstance(m["_id"], str) else m["_id"],
                                 "student_name": m["student_name"],
                                 "topic": m["topic"],
                                 "subject": m["subject"]}
                                for m in members
                            ],
                            "count": len(members),
                            "confidence": ag.get("confidence", "medium")
                        })
                        matched_ids = {str(m["_id"]) if not isinstance(m["_id"], str) else m["_id"] for m in members}
                        ungrouped_ids = [uid for uid in ungrouped_ids if uid not in matched_ids]

        except Exception as e:
            print(f"AI similarity detection failed: {e}")

    return {"groups": groups, "ungrouped": ungrouped_ids}


def calculate_wait_time(faculty_id: str, queue_position: int, db) -> str:
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