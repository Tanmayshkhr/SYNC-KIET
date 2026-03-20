from google import genai
import os
import json
import math

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# ─── Vector Embedding Helpers ───────────────────────────────────────────

def get_embedding(text: str) -> list:
    """Get vector embedding for a text using Gemini embedding model."""
    try:
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=text
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"Embedding failed: {e}")
        return None


def cosine_similarity(vec_a: list, vec_b: list) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def batch_embeddings(texts: list) -> list:
    """Get embeddings for a batch of texts."""
    try:
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=texts
        )
        return [e.values for e in result.embeddings]
    except Exception as e:
        print(f"Batch embedding failed: {e}")
        return [None] * len(texts)


# ─── Clustering with Vector Similarity ──────────────────────────────────

SIMILARITY_THRESHOLD = 0.82

def cluster_doubts(doubts: list):
    if len(doubts) < 2:
        return {
            "grouped": False,
            "reason": "Not enough similar doubts yet",
            "cluster_name": "",
            "students": []
        }
    try:
        # Build text representations
        texts = [
            f"{d['topic']} {d.get('description', '')} {d.get('subject', '')}"
            for d in doubts
        ]
        embeddings = batch_embeddings(texts)

        # Check if embeddings succeeded
        if any(e is None for e in embeddings):
            raise Exception("Embedding generation failed, falling back")

        # Compute pairwise similarity
        n = len(embeddings)
        similar_pairs = []
        for i in range(n):
            for j in range(i + 1, n):
                sim = cosine_similarity(embeddings[i], embeddings[j])
                if sim >= SIMILARITY_THRESHOLD:
                    similar_pairs.append((i, j, sim))

        if not similar_pairs:
            return {
                "grouped": False,
                "reason": "Topics too different to group",
                "cluster_name": "",
                "students": []
            }

        # Union-Find to form clusters
        parent = list(range(n))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py

        for i, j, _ in similar_pairs:
            union(i, j)

        clusters = {}
        for idx in range(n):
            root = find(idx)
            clusters.setdefault(root, []).append(idx)

        # Find largest cluster with 2+ members
        best_cluster = max(
            [c for c in clusters.values() if len(c) >= 2],
            key=len, default=None
        )

        if not best_cluster:
            return {
                "grouped": False,
                "reason": "No strong similarity found",
                "cluster_name": "",
                "students": []
            }

        avg_sim = sum(
            cosine_similarity(embeddings[i], embeddings[j])
            for idx_i, i in enumerate(best_cluster)
            for j in best_cluster[idx_i + 1:]
        ) / max(len(best_cluster) * (len(best_cluster) - 1) / 2, 1)

        cluster_topics = [doubts[i]["topic"] for i in best_cluster]
        cluster_name = max(set(cluster_topics), key=cluster_topics.count)

        print(f"Vector clustering {len(doubts)} doubts → cluster of {len(best_cluster)} (sim={avg_sim:.2f})")

        return {
            "grouped": True,
            "similarity_score": int(avg_sim * 100),
            "cluster_name": cluster_name,
            "recommendation": f"Group these {len(best_cluster)} students for a common session on {cluster_name}",
            "students": [doubts[i]["student_name"] for i in best_cluster]
        }

    except Exception as e:
        print(f"Vector clustering failed ({e}), using keyword fallback")
        # Keyword-based fallback
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
    """Find groups of similar doubts using vector embeddings + fallback to normalization + AI."""
    if len(doubts) < 2:
        return {"groups": [], "ungrouped": [d["_id"] for d in doubts]}

    groups = []
    ungrouped_ids = []

    # Phase 1: Vector-based similarity clustering
    try:
        texts = [
            f"{d['topic']} {d.get('description', '')} {d.get('subject', '')}"
            for d in doubts
        ]
        embeddings = batch_embeddings(texts)

        if not any(e is None for e in embeddings):
            n = len(embeddings)
            parent = list(range(n))

            def find(x):
                while parent[x] != x:
                    parent[x] = parent[parent[x]]
                    x = parent[x]
                return x

            def union(x, y):
                px, py = find(x), find(y)
                if px != py:
                    parent[px] = py

            for i in range(n):
                for j in range(i + 1, n):
                    sim = cosine_similarity(embeddings[i], embeddings[j])
                    if sim >= SIMILARITY_THRESHOLD:
                        union(i, j)

            clusters = {}
            for idx in range(n):
                root = find(idx)
                clusters.setdefault(root, []).append(idx)

            grouped_indices = set()
            for root, members in clusters.items():
                if len(members) >= 2:
                    grouped_indices.update(members)
                    cluster_topics = [doubts[m]["topic"] for m in members]
                    primary_topic = max(set(cluster_topics), key=cluster_topics.count)

                    # Calculate average similarity within group
                    sims = []
                    for ii in range(len(members)):
                        for jj in range(ii + 1, len(members)):
                            sims.append(cosine_similarity(
                                embeddings[members[ii]], embeddings[members[jj]]
                            ))
                    avg_sim = sum(sims) / len(sims) if sims else 0

                    groups.append({
                        "canonical_topic": primary_topic.title(),
                        "doubts": [
                            {"_id": str(doubts[m]["_id"]) if not isinstance(doubts[m]["_id"], str) else doubts[m]["_id"],
                             "student_name": doubts[m]["student_name"],
                             "topic": doubts[m]["topic"],
                             "subject": doubts[m]["subject"]}
                            for m in members
                        ],
                        "count": len(members),
                        "confidence": "high" if avg_sim >= 0.90 else "medium" if avg_sim >= 0.82 else "low",
                        "similarity": round(avg_sim * 100)
                    })

            ungrouped_ids = [
                str(doubts[i]["_id"]) if not isinstance(doubts[i]["_id"], str) else doubts[i]["_id"]
                for i in range(n) if i not in grouped_indices
            ]
            print(f"Vector grouping: {len(groups)} groups, {len(ungrouped_ids)} ungrouped")
            return {"groups": groups, "ungrouped": ungrouped_ids}
        else:
            raise Exception("Embeddings unavailable")

    except Exception as e:
        print(f"Vector similarity failed ({e}), falling back to normalization")

    # Phase 2 Fallback: Normalize topics and group by canonical name
    topic_map = {}
    for d in doubts:
        canonical = _normalize_topic(d["topic"])
        if canonical not in topic_map:
            topic_map[canonical] = []
        topic_map[canonical].append(d)

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

    # Phase 3: Try AI for remaining ungrouped
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


# ─── Smart Faculty Recommendation ──────────────────────────────────────

def recommend_faculty(topic: str, subject: str, db, get_status_fn):
    """
    Recommend top faculty for a given topic based on:
    1. How many similar doubts they resolved (vector similarity on topic)
    2. Average resolution time
    3. Current availability (free right now?)
    4. Current queue length
    """
    # Hard filter by subject if provided — never recommend unrelated subjects
    if subject and subject.strip():
        subject_lower = subject.strip().lower()
        all_faculties = list(db.faculty.find({}))
        subject_filtered = [
            f for f in all_faculties
            if subject_lower in f.get("subject", "").lower()
            or f.get("subject", "").lower() in subject_lower
        ]
        faculties = subject_filtered if subject_filtered else all_faculties
    else:
        faculties = list(db.faculty.find({}))

    if not faculties:
        return []

    # Normalize the input topic
    query_topic = _normalize_topic(topic)

    # Get embedding for the query topic
    query_embedding = get_embedding(f"{topic} {subject}")

    scored = []

    for fac in faculties:
        fac_id = str(fac["_id"])
        fac_code = fac.get("faculty_code", "")

        # ── 1. Doubt resolution history ──
        # Find completed doubts for this faculty
        completed = list(db.doubts.find({
            "faculty_id": fac_id,
            "status": "completed"
        }))

        # Count topic-relevant resolved doubts using vector similarity
        relevant_count = 0
        total_resolved = len(completed)

        if query_embedding and completed:
            # Get topics from completed doubts
            doubt_topics = list(set(
                f"{d.get('topic', '')} {d.get('subject', '')}" for d in completed
            ))
            if doubt_topics:
                try:
                    topic_embeddings = batch_embeddings(doubt_topics)
                    # Count how many unique topics are similar
                    topic_sim_scores = []
                    for emb in topic_embeddings:
                        if emb:
                            sim = cosine_similarity(query_embedding, emb)
                            topic_sim_scores.append(sim)

                    # Count completed doubts with similar topics
                    similar_topics = set()
                    for i, sim in enumerate(topic_sim_scores):
                        if sim >= 0.75:
                            similar_topics.add(doubt_topics[i])

                    for d in completed:
                        d_text = f"{d.get('topic', '')} {d.get('subject', '')}"
                        if d_text in similar_topics:
                            relevant_count += 1
                except Exception:
                    pass

        # Fallback: keyword matching if embeddings fail
        if relevant_count == 0 and completed:
            for d in completed:
                d_topic = _normalize_topic(d.get("topic", ""))
                d_subject = d.get("subject", "").lower()
                if (query_topic in d_topic or d_topic in query_topic or
                        topic.lower() in d_subject or subject.lower() in d_subject):
                    relevant_count += 1

        # ── 2. Average resolution time ──
        durations = []
        for d in completed:
            if "accepted_at" in d and "completed_at" in d:
                diff = (d["completed_at"] - d["accepted_at"]).seconds // 60
                if 0 < diff < 120:
                    durations.append(diff)
        avg_time = round(sum(durations) / len(durations)) if durations else None

        # ── 3. Current availability ──
        try:
            status_data = get_status_fn(fac_code) if fac_code else None
            if isinstance(status_data, dict):
                current_status = status_data.get("status", "unknown")
            else:
                current_status = "unknown"
        except Exception:
            current_status = "unknown"

        # Check manual override from face scan
        manual = fac.get("manual_status")
        if manual == "available":
            current_status = "available"
        elif manual == "left":
            current_status = "left"

        # ── 4. Queue length ──
        queue_count = db.doubts.count_documents({
            "faculty_id": fac_id,
            "status": "pending"
        })

        # ── Scoring ──
        score = 0

        # Relevant doubts resolved (0-40 points)
        score += min(relevant_count * 4, 40)

        # Fast resolution bonus (0-20 points)
        if avg_time is not None:
            if avg_time <= 10:
                score += 20
            elif avg_time <= 15:
                score += 15
            elif avg_time <= 20:
                score += 10
            elif avg_time <= 30:
                score += 5

        # Availability bonus (0-25 points)
        if current_status == "available":
            score += 25
        elif current_status == "lunch":
            score += 5

        # Short queue bonus (0-15 points)
        if queue_count == 0:
            score += 15
        elif queue_count == 1:
            score += 10
        elif queue_count == 2:
            score += 5

        # Subject match bonus
        fac_subject = fac.get("subject", "").lower()
        if subject.lower() in fac_subject or fac_subject in subject.lower():
            score += 10

        # Build reason string
        reasons = []
        if relevant_count > 0:
            reasons.append(f"{relevant_count} {subject[:20]} doubts resolved")
        elif total_resolved > 0:
            reasons.append(f"{total_resolved} total doubts resolved")
        if avg_time is not None:
            reasons.append(f"Avg {avg_time} mins")
        if current_status == "available":
            reasons.append("Free now")
        elif current_status == "busy":
            reasons.append("In class")
        elif current_status == "lunch":
            reasons.append("At lunch")
        if queue_count > 0:
            reasons.append(f"{queue_count} in queue")
        else:
            reasons.append("No queue")

        scored.append({
            "faculty_id": fac_id,
            "faculty_name": fac.get("name", ""),
            "faculty_code": fac_code,
            "subject": fac.get("subject", ""),
            "cabin": fac.get("cabin", ""),
            "block": fac.get("block", ""),
            "email": fac.get("email", ""),
            "status": current_status,
            "score": score,
            "relevant_resolved": relevant_count,
            "total_resolved": total_resolved,
            "avg_resolution_time": avg_time,
            "queue_count": queue_count,
            "reason": " · ".join(reasons)
        })

    # Sort by score descending, return top 3
    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:3]

    # Add rank medals
    medals = ["🥇", "🥈", "🥉"]
    for i, rec in enumerate(top):
        rec["rank"] = i + 1
        rec["medal"] = medals[i]

    return top