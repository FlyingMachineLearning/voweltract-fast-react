"""Exact vowel-family matching, with transparent dictionary pronunciations."""

import math
import re
from collections import Counter, defaultdict
from functools import lru_cache
import cmudict

# ARPAbet vowels; stress is kept separately, never treated as a vowel family.
VOWELS = {
    "AA": ("ɑ", "father", "#fa8e73"),
    "AE": ("æ", "cat", "#f3b75b"),
    "AH": ("ʌ / ə", "cup / about", "#e2cb79"),
    "AO": ("ɔ", "thought", "#d5df74"),
    "AW": ("aʊ", "now", "#a9d78c"),
    "AY": ("aɪ", "sky", "#7bdbb6"),
    "EH": ("ɛ", "bed", "#68d2d1"),
    "ER": ("ɝ / ɚ", "bird / butter", "#7fbee6"),
    "EY": ("eɪ", "day", "#94a8f4"),
    "IH": ("ɪ", "sit", "#afa0ed"),
    "IY": ("i", "see", "#d69ce4"),
    "OW": ("oʊ", "go", "#ef9fc1"),
    "OY": ("ɔɪ", "boy", "#e99192"),
    "UH": ("ʊ", "book", "#b5be97"),
    "UW": ("u", "blue", "#8bb8c2"),
}
CONSONANTS = set("B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split())
TOKEN = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*['’]?", re.UNICODE)


@lru_cache(maxsize=1)
def dictionary():
    return cmudict.dict()


def normalize(word):
    return word.lower().replace("’", "'")


def validate_overrides(overrides):
    if len(overrides) > 300:
        raise ValueError("At most 300 pronunciation overrides are allowed.")
    clean = {}
    for word, phones in overrides.items():
        if not TOKEN.fullmatch(word) or len(word) > 80 or not isinstance(phones, str):
            raise ValueError(
                "Override keys must be words; values must be ARPAbet strings."
            )
        parts = phones.upper().split()
        if not 1 <= len(parts) <= 80 or not any(
            re.fullmatch(r"(?:" + "|".join(VOWELS) + r")[012]", p) for p in parts
        ):
            raise ValueError(
                f"{word}: include at least one vowel with stress 0, 1, or 2."
            )
        for phone in parts:
            if phone not in CONSONANTS and not (
                phone[:-1] in VOWELS and phone[-1:] in {"0", "1", "2"}
            ):
                raise ValueError(f"{word}: invalid ARPAbet phone {phone}.")
        clean[normalize(word)] = parts
    return clean


def analyze(
    text,
    title="Untitled lyrics",
    stress="stressed",
    line_gap=2,
    repeats=False,
    overrides=None,
):
    custom = validate_overrides(overrides or {})
    lexicon = dictionary()
    lines, tokens, events = [], [], []
    stanza = 0
    unknown, ambiguous, counts = Counter(), set(), Counter()
    for line_index, raw in enumerate(text.splitlines()):
        # Keep physical line numbering; headings and empty lines separate stanzas.
        if not raw.strip() or re.fullmatch(r"\s*\[.*?\]\s*", raw):
            lines.append(
                {
                    "index": line_index,
                    "text": raw,
                    "stanza": stanza,
                    "kind": "heading" if raw.strip() else "blank",
                    "tokens": [],
                    "events": [],
                    "counts": {},
                }
            )
            stanza += 1
            continue
        line_tokens, line_events = [], []
        for match in TOKEN.finditer(raw):
            word = normalize(match.group())
            variants = lexicon.get(word, [])
            # Deduplicate dictionary variants while retaining lexicon order.
            variants = list(dict.fromkeys(" ".join(p) for p in variants))
            phones = custom.get(word) or (variants[0].split() if variants else [])
            if not phones:
                unknown[word] += 1
            if len(variants) > 1 and word not in custom:
                ambiguous.add(word)
            token = {
                "id": len(tokens),
                "word": match.group(),
                "normalized": word,
                "start": match.start(),
                "end": match.end(),
                "line": line_index,
                "phones": " ".join(phones),
                "variants": variants,
                "source": (
                    "override"
                    if word in custom
                    else ("dictionary" if phones else "unknown")
                ),
                "vowels": [],
            }
            for phone in phones:
                if phone[:-1] not in VOWELS or phone[-1:] not in {"0", "1", "2"}:
                    continue
                vowel, level = phone[:-1], int(phone[-1])
                active = (
                    stress == "all"
                    or (stress == "stressed" and level > 0)
                    or (stress == "primary" and level == 1)
                )
                event = {
                    "id": len(events),
                    "token": token["id"],
                    "word": token["word"],
                    "normalized": word,
                    "line": line_index,
                    "stanza": stanza,
                    "vowel": vowel,
                    "stress": level,
                    "active": active,
                    "ordinal": len(line_events),
                }
                token["vowels"].append(event["id"])
                line_events.append(event["id"])
                events.append(event)
                if active:
                    counts[vowel] += 1
            tokens.append(token)
            line_tokens.append(token["id"])
        if len(tokens) > 5000:
            raise ValueError("Limit: 5,000 words per analysis.")
        lines.append(
            {
                "index": line_index,
                "text": raw,
                "stanza": stanza,
                "kind": "lyrics",
                "tokens": line_tokens,
                "events": line_events,
                "counts": dict(
                    Counter(
                        events[e]["vowel"] for e in line_events if events[e]["active"]
                    )
                ),
            }
        )
    if not tokens:
        raise ValueError(
            "No lyric words found. Paste text or use a text-based document."
        )
    if len(lines) > 240:
        raise ValueError("Limit: 240 physical lines per analysis.")
    # Sparse threads: nearest eligible earlier occurrence, rather than every pair.
    history = defaultdict(list)
    links = []
    for event in events:
        if not event["active"]:
            continue
        key = (event["stanza"], event["vowel"])
        history[key] = [
            p
            for p in history[key]
            if event["line"] - p["line"] <= line_gap
            and event["token"] - p["token"] <= 32
        ]
        for previous in reversed(history[key]):
            if previous["token"] == event["token"]:
                continue
            if not repeats and previous["normalized"] == event["normalized"]:
                continue
            links.append(
                {
                    "source": previous["id"],
                    "target": event["id"],
                    "vowel": event["vowel"],
                }
            )
            break
        history[key].append(event)
    connected = {link[k] for link in links for k in ("source", "target")}
    for event in events:
        event["connected"] = event["id"] in connected
    vectors = [line["counts"] for line in lines if line["kind"] == "lyrics"]
    indices = [line["index"] for line in lines if line["kind"] == "lyrics"]
    matrix = []
    for a in vectors:
        row = []
        for b in vectors:
            denominator = math.sqrt(
                sum(v * v for v in a.values()) * sum(v * v for v in b.values())
            )
            row.append(
                round(sum(v * b.get(k, 0) for k, v in a.items()) / denominator, 4)
                if denominator
                else None
            )
        matrix.append(row)
    return {
        "title": title,
        "lines": lines,
        "tokens": tokens,
        "events": events,
        "links": links,
        "families": [
            {
                "id": v,
                "ipa": info[0],
                "example": info[1],
                "color": info[2],
                "count": counts[v],
            }
            for v, info in VOWELS.items()
        ],
        "similarity": {"line_indices": indices, "matrix": matrix},
        "settings": {
            "stress": stress,
            "line_gap": line_gap,
            "repeats": repeats,
            "overrides": {w: " ".join(p) for w, p in custom.items()},
        },
        "stats": {
            "words": len(tokens),
            "known_words": sum(t["source"] != "unknown" for t in tokens),
            "coverage": round(
                100 * sum(t["source"] != "unknown" for t in tokens) / len(tokens), 1
            ),
            "active_vowels": sum(counts.values()),
            "threads": len(links),
            "ambiguous_words": len(ambiguous),
        },
        "unknown_words": [{"word": w, "count": n} for w, n in unknown.most_common()],
    }
