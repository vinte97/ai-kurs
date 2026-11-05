#!/usr/bin/env python3
"""Check the staged learner route without publishing teacher materials."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
c = json.loads((ROOT / 'content/course.json').read_text())
d = c['days'][1]
prompts = {p['id']: p for p in c['prompts']}
assert len(d['exerciseIds']) == 11
for n, key in enumerate(d['exerciseIds']):
    e = c['exercises'][key]
    ids = [e['promptId']] + e['extraPromptIds']
    assert e['staged']
    assert len(ids) in ([1] if n == 0 else [2, 3])
    for label in ['Роль:', 'Контекст:', 'Формат:', 'Ограничения:', 'Приёмка:']:
        assert label in prompts[ids[0]]['promptText'], (key, label)
    for pid in ids:
        p = prompts[pid]
        assert p['expectedResult'] and p['acceptanceCriteria']
        assert p['promptText'] in (ROOT / 'files/day2-prompts.txt').read_text()
company = prompts['d2-company-1']['promptText']
for word in ['company уже существует', 'results рядом', 'force', 'reset', 'Git и Python', 'Ничего не удаляй']:
    assert word in company
pdf = prompts['d2-pdf-1']['promptText']
assert 'не используй DOCX как источник' in pdf
assert 'Если подходящего средства нет' in pdf
html = prompts['d2-report-2']['promptText']
for word in ['results/Доклад/index.html', 'внутри файла', 'двойным щелчком', 'Никаких сетевых запросов']:
    assert word in html
assert 'den2-sdelki' not in d['materials']
assert not (ROOT / 'files/den2-sdelki.txt').exists()
for key in d['materials']:
    path = c['materials'][key]['file']
    assert (ROOT / path).read_bytes() == (ROOT / 'content' / path).read_bytes()
for p in (ROOT / 'files').rglob('*'):
    assert not any(w in p.name.lower() for w in ['эталон', 'etalon', 'organizer'])
manifest = json.loads((ROOT / 'content/day2-alignment.json').read_text())
source = ROOT.parent / manifest['source']
if source.exists():
    assert hashlib.sha256(source.read_bytes()).hexdigest() == manifest['sha256'], 'Presentation prompts changed: review again'
assert manifest['source_complete']
assert 'company/14-День_2_практики' in (ROOT / 'day2.html').read_text()
for path in manifest['source_paths'].values():
    local = ROOT.parent / path
    if (ROOT.parent / 'company').exists():
        assert local.is_file(), path
assert len((ROOT / 'files/severprom-overview.md').read_text().split()) < 450
print('ok: 10 staged practices, safe paths, independent PDF, no teacher answers')
