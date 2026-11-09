#!/usr/bin/env python3
"""Check Day 4 against the presentation sources and the published build layout."""
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "presentation-review-4/source"
course = json.loads((ROOT / "content/course.json").read_text())
alignment = json.loads((ROOT / "content/day4-alignment.json").read_text())
day = course["days"][3]
ids = day["exerciseIds"]
assert ids == list(alignment["practice_map"].values())
exercises = [course["exercises"][key] for key in ids]
assert [e["minutes"] for e in exercises] == [15, 12, 15, 10, 15, 15, 15]
prompts = {p["id"]: p["promptText"] for p in course["prompts"] if p["day"] == 4}
materials = {key: course["materials"][key]["file"] for key in day["materials"]}
source_files = {Path(path).name: ROOT / "content" / path for path in materials.values()}
blocks = re.split(r"\n-{20,}\n", source_files["Промпты-дня-4.txt"].read_text().strip())
expected = [block.strip().split("\n\n", 1)[1] for block in blocks]
assert len(expected) == alignment["prompt_count"] == len(prompts) == 15
assert [prompts[pid] for e in exercises for pid in [e["promptId"], *e["extraPromptIds"]]] == expected
assert expected[2] == source_files["Поручение-Конструктор.txt"].read_text().strip()

if SOURCE.is_dir():
    for path, digest in alignment["sources"].items():
        original = SOURCE / path
        assert hashlib.sha256(original.read_bytes()).hexdigest() == digest, path
        if original.name in source_files:
            assert original.read_bytes() == source_files[original.name].read_bytes(), path
    plan = (SOURCE / "src/content/plan.ts").read_text().split("PlanBlock[]=")[1]
    slides = (SOURCE / "src/content/day4.ts").read_text()
    for block in json.JSONDecoder().raw_decode(plan.lstrip())[0]:
        if block["id"] in alignment["practice_map"]:
            exercise = course["exercises"][alignment["practice_map"][block["id"]]]
            assert (exercise["title"], exercise["minutes"]) == (block["title"], block["minutes"])
            assert block["title"] in slides

with zipfile.ZipFile(source_files["day4-workbook.zip"]) as archive:
    expected_names = set(source_files) - {"day4-workbook.zip"}
    assert sorted(archive.namelist()) == sorted(expected_names)
    for name in expected_names:
        assert archive.read(name) == source_files[name].read_bytes()

with tempfile.TemporaryDirectory() as tmp:
    for phase in ("pre-course", "day-1", "day-2", "day-3", "day-4"):
        out = Path(tmp) / phase / "ai-kurs"
        subprocess.run([sys.executable, "tools/build_site.py", "--phase", phase, "--out", str(out)], cwd=ROOT, check=True)
        page = (out / "day4.html").read_text()
        visible = phase == "day-4"
        assert ('id="lesson-app"' in page) == visible
        assert ('"d4-prompt-1"' in (out / "js/prompts.js").read_text()) == visible
        for key in ids:
            assert (f'id="task-{key}"' in page) == visible
        for path in materials.values():
            assert (out / path).is_file() == visible
            if visible:
                assert f'href="{path}"' in page
                assert urljoin("https://example.test/ai-kurs/day4.html", path).startswith("https://example.test/ai-kurs/files/")
                assert (out / path).read_bytes() == (ROOT / "content" / path).read_bytes()
                assert (ROOT / path).read_bytes() == (out / path).read_bytes()

print("ok: Day 4 order, timing, 15 exact prompts, material copies, ZIP and five release phases")
