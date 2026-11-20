#!/usr/bin/env python3
"""Extract the first-year 1002-1004 schedule from the source PDF.

This is a development-only helper. The browser consumes the generated static
JavaScript module, so the application has no Python or PDF runtime dependency.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

import pdfplumber
import pymupdf


MONTHS = {
    "OCAK": 1,
    "ŞUBAT": 2,
    "MART": 3,
    "NİSA": 4,  # Source PDF typo in the 12-16 April 2027 header.
    "NİSAN": 4,
    "MAYIS": 5,
    "HAZİRAN": 6,
    "TEMMUZ": 7,
    "AĞUSTOS": 8,
    "EYLÜL": 9,
    "EKİM": 10,
    "KASIM": 11,
    "ARALIK": 12,
}

DATE_PATTERN = re.compile(
    r"\b(\d{1,2})\s+(" + "|".join(MONTHS) + r")\s+(2026|2027)\b",
    re.IGNORECASE,
)

COMMITTEE_MARKERS = {
    "1.2 DERS KURULU": "1002",
    "1.3 DERS KURULU": "1003",
    "1.4 DERS KURULU": "1004",
}

COMMITTEES = [
    {
        "id": "1002",
        "title": "Hücre, Doku ve Organ Sistemleri-I",
        "startDate": "2026-11-09",
        "endDate": "2027-01-13",
        "nextStartDate": "2027-02-08",
    },
    {
        "id": "1003",
        "title": "Hücre, Doku ve Organ Sistemleri-II",
        "startDate": "2027-02-08",
        "endDate": "2027-04-15",
        "nextStartDate": "2027-04-19",
    },
    {
        "id": "1004",
        "title": "Klinik Bilimlere Giriş",
        "startDate": "2027-04-19",
        "endDate": "2027-06-14",
        "nextStartDate": None,
    },
]


def clean(value: str | None) -> str:
    if not value:
        return ""
    value = " ".join(value.replace("\u00a0", " ").split())
    value = value.replace("FİNALSINAVI", "FİNAL SINAVI")
    value = value.replace("SAAT: :", "SAAT:")
    value = value.replace(
        "Atatürk İlkeleri vIIe İnkılap Tarihi",
        "Atatürk İlkeleri ve İnkılap Tarihi II",
    )
    value = value.replace("Türk Dili ve EdebiyatıI II", "Türk Dili ve Edebiyatı II")
    return value.strip()


def dates_in(value: str) -> list[str]:
    found: list[str] = []
    for day, month, year in DATE_PATTERN.findall(value.upper()):
        parsed = date(int(year), MONTHS[month], int(day)).isoformat()
        if parsed not in found:
            found.append(parsed)
    return found


def classify(topic: str, department: str) -> str:
    upper = topic.upper()
    if "SERBEST ÇALIŞMA" in upper:
        return "study"
    if "SINAV" in upper:
        return "exam"
    if any(token in upper for token in ("BAYRAM", "YILBAŞI", "TATİLİ", "TATİL")):
        return "holiday"
    if "TÖREN" in upper:
        return "ceremony"
    if department:
        return "course"
    return "event"


def normalize_department(value: str) -> str:
    aliases = {
        "Ortak Dersler Bölümü": "Ortak Dersler",
        "Ders Kurulu Başkanı": "Ders Kurulu",
        "Ders Kurulu Başkanlığı": "Ders Kurulu",
        "Fizyoloji)": "Fizyoloji",
        "Çocuk ve Ergen Ruh Sağlığı ve": "Çocuk ve Ergen Ruh Sağlığı ve Hastalıkları",
    }
    return aliases.get(value, value)


def normalize_lecturer(value: str) -> str:
    value = re.sub(r"\s+(EKU|MT|RG|Çevrimiçi)$", "", value).strip()
    return value


def extract_rows(pdf_path: Path):
    document = pymupdf.open(pdf_path)
    with pdfplumber.open(pdf_path) as pdf:
        for page_index in range(5):
            plumber_page = pdf.pages[page_index]
            fitz_page = document[page_index]
            words = fitz_page.get_text("words")
            tables = plumber_page.find_tables()
            if not tables:
                continue
            for row in tables[0].rows:
                cells: list[str] = []
                for cell in row.cells:
                    if cell is None:
                        cells.append("")
                    else:
                        x0, top, x1, bottom = cell
                        matches = [
                            word
                            for word in words
                            if x0 <= (word[0] + word[2]) / 2 <= x1
                            and top <= (word[1] + word[3]) / 2 <= bottom
                        ]
                        matches.sort(key=lambda word: (word[5], word[6], word[7]))
                        cells.append(clean(" ".join(word[4] for word in matches)))
                yield page_index + 1, cells


def extract_records(pdf_path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    committee_id: str | None = None
    week_dates: list[str] = []

    for page_number, cells in extract_rows(pdf_path):
        row_text = " ".join(cell for cell in cells if cell)

        heading_cell = cells[0].upper() if cells else ""
        for marker, candidate in COMMITTEE_MARKERS.items():
            if marker in heading_cell:
                committee_id = candidate
                week_dates = []
                break

        header_dates = dates_in(row_text)
        if len(header_dates) >= 3:
            week_dates = header_dates[:5]
            continue

        if committee_id not in {"1002", "1003", "1004"} or len(week_dates) < 5:
            continue

        if "Ders Adı" in cells or "Ana Bilim Dalı" in cells:
            continue

        for day_index in range(5):
            topic_index = 1 + (day_index * 4)
            if topic_index >= len(cells):
                continue
            topic = clean(cells[topic_index])
            if (
                not topic
                or topic in {"Ders Adı", "SINAV / ARA DÖNEM", "DÖNEM"}
                or "1001" in topic
            ):
                continue

            department = normalize_department(clean(cells[topic_index + 1]))
            lecturer = normalize_lecturer(clean(cells[topic_index + 2]))
            topic_upper = topic.upper()
            if topic_upper == "RAMAZAN BAYRAMI TATİLİ":
                record_dates = week_dates
            elif topic_upper == "KURBAN BAYRAMI TATİLİ":
                record_dates = week_dates[:3]
            else:
                record_dates = dates_in(topic) or [week_dates[day_index]]

            for record_date in record_dates:
                records.append(
                    {
                        "committeeId": committee_id,
                        "date": record_date,
                        "topic": topic,
                        "department": department,
                        "lecturer": lecturer,
                        "type": classify(topic, department),
                        "sourcePage": str(page_number),
                    }
                )

    records = merge_fragments(records)
    records = deduplicate(records)
    # Python's stable sort preserves the source row order within each day.
    records.sort(key=lambda item: (item["date"], item["sourcePage"]))

    for index, record in enumerate(records, 1):
        record["id"] = f'{record["committeeId"]}-{record["date"]}-{index:03d}'
        record.pop("sourcePage", None)
    return records


def merge_fragments(records: list[dict[str, str]]) -> list[dict[str, str]]:
    merged: list[dict[str, str]] = []
    fragments = {"SINAVI", "SINAVI SAAT 10:30", "SINAVI SAAT: 10:30"}
    for record in records:
        if record["topic"] == "(Ulusal Egemenlik ve Çocuk Bayramı)":
            previous = next(
                (
                    item
                    for item in reversed(merged)
                    if item["date"] == record["date"]
                    and item["topic"].startswith("23 NİSAN 2027")
                ),
                None,
            )
            if previous:
                previous["topic"] = (
                    "23 NİSAN 2027 CUMA — Ulusal Egemenlik ve Çocuk Bayramı"
                )
                previous["type"] = "holiday"
                continue
        if record["topic"].startswith("Konuşmacılar:"):
            previous = next(
                (
                    item
                    for item in reversed(merged)
                    if item["date"] == record["date"]
                    and item["topic"].startswith("BİLİMSEL PROJE PANELİ")
                ),
                None,
            )
            if previous:
                previous["topic"] = f'{previous["topic"]} — {record["topic"]}'
                continue
        if record["topic"].upper() in fragments:
            previous = next(
                (
                    item
                    for item in reversed(merged)
                    if item["committeeId"] == record["committeeId"]
                    and item["date"] == record["date"]
                    and "SINAV" in item["topic"].upper()
                ),
                None,
            )
            if previous:
                if not previous["topic"].upper().endswith("SINAVI"):
                    previous["topic"] = f'{previous["topic"]} SINAVI'
                continue
        merged.append(record)
    return merged


def deduplicate(records: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, ...]] = set()
    unique: list[dict[str, str]] = []
    for record in records:
        key = (
            record["committeeId"],
            record["date"],
            record["topic"].casefold(),
            record["department"].casefold(),
            record["lecturer"].casefold(),
        )
        if key not in seen:
            seen.add(key)
            unique.append(record)
    return unique


def write_module(output_path: Path, records: list[dict[str, str]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    committees = json.dumps(COMMITTEES, ensure_ascii=False, indent=2)
    schedule = json.dumps(records, ensure_ascii=False, indent=2)
    output_path.write_text(
        "// Generated from guide/CTF 26-27 Preklinik Ders Programı.pdf.\n"
        "// Regenerate with scripts/extract_schedule.py; do not edit by hand.\n\n"
        f"export const committees = {committees};\n\n"
        f"export const schedule = {schedule};\n",
        encoding="utf-8",
    )


def validate(records: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    valid_ids = {item["id"] for item in COMMITTEES}
    for record in records:
        if record["committeeId"] not in valid_ids:
            errors.append(f'Unexpected committee: {record["committeeId"]}')
        if not record["topic"]:
            errors.append(f'Empty topic: {record}')
        if record["committeeId"] == "1001":
            errors.append("1001 record leaked into generated data")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    records = extract_records(args.pdf)
    errors = validate(records)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    write_module(args.output, records)
    counts = {committee["id"]: 0 for committee in COMMITTEES}
    for record in records:
        counts[record["committeeId"]] += 1
    print(f"Generated {len(records)} records: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
