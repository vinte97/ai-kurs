#!/usr/bin/env python3
"""Check coverage, teaching inputs and distributable files without a browser."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    course = json.loads((ROOT / 'content/course.json').read_text())
    audit = json.loads((ROOT / 'content/day1-alignment.json').read_text())
    day = course['days'][0]
    prompts = {p['id']: p for p in course['prompts']}
    sections = {s['id']: s for s in day['sections']}
    covered = [key for s in sections.values() for key in s['sourceSlides']]
    assert len(audit['slides']) == 27
    assert sorted(covered) == sorted(s['id'] for s in audit['slides'])
    for slide in audit['slides']:
        assert slide['url'].split('#learn-')[1] in sections
    for section in sections.values():
        assert all(key in day['exerciseIds'] for key in section['tasks'])
    assert [c[1] for c in day['safetyCases']] == ['allow', 'allow', 'ask', 'ask', 'deny', 'deny']
    letter = prompts['d1-letter']['promptText']
    assert '11 ноября' in letter and '12 ноября 2026' in letter
    assert '10 часов' in letter and '11 часов' in letter
    assert 'из-за отсутствия' not in letter
    workday = prompts['d1-workday']['promptText']
    assert 'короткую цитату' in workday and 'статус' in workday
    assert 'facts' not in day['exerciseIds'] and 'document' not in day['exerciseIds']
    public_day = json.dumps(day, ensure_ascii=False) + json.dumps([p for p in prompts.values() if p['day'] == 1], ensure_ascii=False)
    public_day += json.dumps([course['materials'][key] for key in day['materials']], ensure_ascii=False)
    assert 'северпром' not in public_day.lower()
    assert day['exerciseAliases'] == {'facts': 'workday', 'document': 'workday'}
    for exercise_id in day['exerciseIds']:
        exercise = course['exercises'][exercise_id]
        ids = [exercise['promptId']] + [v['promptId'] for v in exercise.get('variants', [])] + exercise.get('extraPromptIds', [])
        for pid in ids:
            assert pid in prompts and prompts[pid]['promptText'].strip(), pid
            for material in prompts[pid]['requiredMaterials']:
                assert material in day['materials'], material
                assert (ROOT / 'content' / course['materials'][material]['file']).is_file(), material
    notes_path = ROOT / 'content/files/den1-zapiski.txt'
    for filename, digest in audit['copiedFiles'].items():
        path = ROOT / 'content/files' / filename
        assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, filename
    # Optional freshness check when the presentation checkout is beside the portal.
    source = ROOT.parent / 'presentation-review/source'
    if source.is_dir():
        for filename, digest in audit['sourceHashes'].items():
            assert hashlib.sha256((source / filename).read_bytes()).hexdigest() == digest, 'Presentation changed: ' + filename
    for filename in ['practice-3.txt', 'practice-4.txt', 'homework.txt']:
        text = (ROOT / 'content/files' / filename).read_text()
        assert 'Методические заметки' not in text and 'Требования к слайду' not in text
    assert '80 000' in prompts['d1-trip']['promptText']
    assert 'Ничего не покупай' in prompts['d1-trip']['promptText']
    assert course['exercises']['refine']['exampleHidden']
    assert course['exercises']['homework']['manual']
    print('ok: all 27 slides mapped, 8 activities, 6 quiz cases; no Severprom in day 1')


if __name__ == '__main__':
    main()
