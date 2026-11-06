#!/usr/bin/env python3
"""Check learner files, copied text, archive contents and actual company paths."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
c = json.loads((ROOT / 'content/course.json').read_text())
d = c['days'][1]
prompts = {p['id']: p for p in c['prompts']}
assert len(d['exerciseIds']) == 11
for n, key in enumerate(d['exerciseIds']):
    e = c['exercises'][key]
    ids = [e['promptId']] + e['extraPromptIds']
    assert e['staged'] and 0 < e['minutes'] <= 15
    assert len(ids) in ([1] if n == 0 else [2, 3])
    for pid in ids:
        p = prompts[pid]
        text = p['promptText']
        assert not re.search(r'\b(?:Роль|Контекст|Формат|Ограничения|Приёмка):', text), pid
        assert not re.search(r'\b(?:company|results|Company|Results)/', text), pid
        assert p['expectedResult'] and p['acceptanceCriteria']
        assert text in (ROOT / 'files/day2-prompts.txt').read_text()
company = prompts['d2-company-1']['promptText']
for word in ['«СеверПром» уже существует', 'Рядом создай папку «Результаты»', 'reset', 'force', 'clean', 'https://github.com/cursorstudent-course/company.git']:
    assert word in company
assert 'не используй docx как источник' in prompts['d2-pdf-1']['promptText'].lower()
for word in ['Результаты/Доклад/index.html', 'внутри файла', 'двойным щелчком', 'Никаких сетевых запросов']:
    assert word in prompts['d2-report-2']['promptText']
for word in ['короткую цитату', 'Ctrl+F', '⌘F']:
    assert word in prompts['d2-meeting-1']['promptText']
for key in d['materials']:
    path = c['materials'][key]['file']
    assert (ROOT / path).read_bytes() == (ROOT / 'content' / path).read_bytes()
with zipfile.ZipFile(ROOT / 'files/day2-workbook.zip') as archive:
    expected = {str(Path(c['materials'][key]['file']).relative_to('files')) for key in d['materials'] if key != 'd2-pack'}
    assert set(archive.namelist()) == expected
    assert all(not any(w in p.lower() for w in ['эталон', 'etalon', 'organizer', '..']) for p in archive.namelist())
    for path in archive.namelist():
        assert archive.read(path) == (ROOT / 'files' / path).read_bytes()
workbook = (ROOT / 'files/day2-workbook.md').read_text()
for heading in ['Задача', 'Мои запросы', 'Что получил', 'Что проверил', 'Что исправил', 'Вывод']:
    assert workbook.count('### ' + heading + '\n') == 11
manifest = json.loads((ROOT / 'content/day2-alignment.json').read_text())
assert manifest['company_commit'] == 'df85e49a75eecbc5e8356aafbeed9970aa00ee9c'
assert manifest['published_verified']
assert manifest['verification']['presentation_stages_matched'] == 18
source = ROOT.parent / manifest['source']
if source.exists():
    assert hashlib.sha256(source.read_bytes()).hexdigest() == manifest['sha256'], 'Presentation prompts changed: review again'
    stages = json.JSONDecoder().raw_decode(source.read_text().split('export const stages:Record<number,PracticeStage[]>=')[1])[0]
    for slide, key in {'10': 'meeting', '12': 'visit', '14': 'expenses', '17': 'offers', '19': 'memo', '22': 'report'}.items():
        for index, stage in enumerate(stages[slide], 1):
            prompt = prompts[f'd2-{key}-{index}']
            assert prompt['promptText'].startswith(stage['prompt'].replace('учебная папка/Результаты/', 'Результаты/'))
            assert prompt['acceptanceCriteria'] == [stage['check']]
company_root = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'company'
if company_root.exists():
    assert not (company_root / 'v2').exists()
    assert not any(p.is_dir() and re.fullmatch(r'версия_[123]', p.name) for p in company_root.rglob('*'))
    references = set(manifest['source_paths'].values())
    for prompt in prompts.values():
        if prompt['day'] == 2:
            references.update(path.split('/', 1)[1] for path in re.findall(r'СеверПром/[^\s«»]+?\.(?:md|txt|xlsx|docx|pdf)', prompt['promptText']))
    missing = [str(p) for p in sorted(references) if not (company_root / p).is_file()]
    if missing:
        print('MISSING in checked company copy:\n' + '\n'.join(missing))
        sys.exit(1)
assert 'company/14-День_2_практики' not in (ROOT / 'day2.html').read_text()
print('ok: Russian paths, copy text without labels, workbook and archive; sources checked at', company_root)
