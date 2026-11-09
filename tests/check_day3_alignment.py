#!/usr/bin/env python3
"""Read-only checks of day 3 content, transport safety and generated materials."""
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
c = json.loads((ROOT / 'content/course.json').read_text())
d = c['days'][2]
ps = {p['id']: p for p in c['prompts']}
m = json.loads((ROOT / 'content/day3-alignment.json').read_text())
assert len(d['exerciseIds']) == 9 and len(m['slides']) == 26
for slide in m['slides']:
    anchor = slide['site'].split('#')[1]
    if anchor.startswith('task-'):
        assert anchor[5:] in d['exerciseIds']
    if anchor.startswith('learn-'):
        assert anchor[6:] in {s['id'] for s in d['sections']}
source = ROOT.parent / m['source']
if source.exists():
    assert hashlib.sha256(source.read_bytes()).hexdigest() == m['sha256'], 'Day 3 source changed'
    stages = json.JSONDecoder().raw_decode(source.read_text().split('export const stages:Record<number,Stage[]>=')[1])[0]
    for slide, key in m['stage_map'].items():
        e = c['exercises'][key]
        ids = [e['promptId']] + e['extraPromptIds']
        assert len(ids) == len(stages[slide])
        for pid, stage in zip(ids, stages[slide]):
            p = ps[pid]
            if pid in {'d3-status-1', 'd3-limits-1'}:
                continue  # Basic classroom build uses the notes archive in these stages.
            assert p['promptText'].startswith(stage['prompt'].replace('\\n', '\n'))
            assert p['acceptanceCriteria'] == [stage['check']]
for key in d['exerciseIds']:
    e = c['exercises'][key]
    assert 0 < e['minutes'] <= 15
    for pid in [e['promptId']] + e['extraPromptIds']:
        p = ps[pid]
        assert p['description'] and p['expectedResult'] and p['acceptanceCriteria']
        assert not re.search(r'\b(?:Роль|Контекст|Формат|Ограничения|Приёмка):', p['promptText'])
        assert p['promptText'] in (ROOT / 'files/day3-prompts.txt').read_text()
setup = ps['d3-connect-1']['promptText']
for text in ['MCP.json', 'http://<IP преподавателя>:8765/mcp', 'Streamable HTTP', 'Authorization', 'Basic', 'Base64', 'X-Display-Name', 'encodeURIComponent', 'severprom', 'whoami']:
    assert text in setup
assert 'Первым сообщением спроси' in setup.split('\n\n')[0]
assert 'Дождись ответа, прежде чем менять MCP.json или подключаться' in setup
assert 'не сохраняй их или персональный MCP.json в общем репозитории' in setup
check = ps['lab-ping-1']['promptText']
for text in ['lab_ping', 'whoami', 'profile.name', 'profile.email', 'limit=5', 'notes_search', 'include_knowledge=true']:
    assert text in check
assert 'notes_search' in ps['d3-status-1']['promptText']
assert 'notes_get' in ps['d3-limits-1']['promptText']
assert 'зарегистрированного участника' in ps['d3-draft-3']['promptText']
assert 'Сам этот запрос не является' in ps['d3-draft-3']['promptText']
assert 'delivered_virtual' in ps['d3-draft-3']['promptText'] and 'request_id' in ps['d3-draft-3']['promptText']
assert ps['d3-limits-2']['requiredMaterials'] == ['d3-suspicious']
assert ps['d3-update-2']['requiredMaterials'] == ['d3-response-example']
assert d['exerciseAliases']['lab-read'] == 'd3-inbox'
assert sum(len(s.get('questions', [])) for s in d['sections']) == 5
for key in d['materials']:
    path = c['materials'][key]['file']
    assert (ROOT / path).read_bytes() == (ROOT / 'content' / path).read_bytes()
with zipfile.ZipFile(ROOT / 'files/day3-workbook.zip') as z:
    expected = {str(Path(c['materials'][key]['file']).relative_to('files')) for key in d['materials'] if key != 'd3-pack'}
    assert set(z.namelist()) == expected
    for name in z.namelist():
        assert not any(word in name.lower() for word in ['instructor', 'teacher', 'эталон', 'организатор'])
        assert z.read(name) == (ROOT / 'files' / name).read_bytes()
public = '\n'.join((ROOT / path).read_text() for path in ['day3.html', 'files/day3-prompts.txt', 'files/day3-workbook.md'])
for obsolete in ['Bearer', '192.168.0.106', 'student-XX', 'assignments:read', 'list_assignments', 'get_assignment']:
    assert obsolete not in public, obsolete
assert 'http://127.0.0.1:8765/admin' in (ROOT / 'day3.html').read_text()
assert not m['connection']['live_verified']
print('ok: all 26 slides mapped, 5 practices, client-only setup, read-only diagnostics, safe delivery and materials')

probe = r"""
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync('js/lesson.js', 'utf8');
const fn = code.slice(code.indexOf('  function dayState()'), code.indexOf('  function save()'));
const cleared = [];
const state = {days: {'1': {done: {refine: true}}, '3': {at: 'lab-mail', done: {'lab-mail': true}, marks: {old: true}, summary: {0: true}, finished: true}}};
const ctx = {state, day: {number: 3}, markTask: (id, done) => cleared.push([id, done])};
vm.createContext(ctx); vm.runInContext(fn + '\nresult = dayState();', ctx);
assert.strictEqual(state.days['1'].done.refine, true);
assert.strictEqual(Object.keys(ctx.result.done).length, 0);
assert.strictEqual(ctx.result.finished, false);
assert.deepStrictEqual(cleared, ['lab-ping', 'lab-mail', 'lab-read', 'lab-note'].map(id => [id, false]));
ctx.result.done['d3-inbox'] = true;
vm.runInContext('result = dayState();', ctx);
assert.strictEqual(ctx.result.done['d3-inbox'], true);
assert.strictEqual(cleared.length, 4);
"""
subprocess.run(['node', '-e', probe], cwd=ROOT, check=True)
print('ok: old day-3 marks migrate once; other days and new progress are preserved')
