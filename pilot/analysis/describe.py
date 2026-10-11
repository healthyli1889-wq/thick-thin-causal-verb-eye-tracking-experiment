"""Dependency-free descriptive QA: python3 analysis/describe.py analysis/derived"""
import csv, sys
from pathlib import Path
root = Path(sys.argv[1])
def read(name):
    with (root / f'{name}.csv').open(newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))
participants, trials, windows = read('participants'), read('trials'), read('windows')
ids = {p['session_id'] for p in participants}
assert len(ids) == len(participants), 'Duplicate sessions'
assert all(t['session_id'] in ids for t in trials), 'Broken session joins'
include_synthetic = '--include-synthetic' in sys.argv[2:]
study_ids = {p['session_id'] for p in participants if p.get('mode') != 'preview' and (include_synthetic or p.get('synthetic_test_data') != 'true')}
print(f'Excluded preview/test sessions: {len(ids) - len(study_ids)}')
choices = [t for t in trials if t['task'] == 'choice' and t['session_id'] in study_ids]
print(f'Sessions: {len(ids)}; choices: {len(choices)}')
for c in ('thick', 'thin'):
    selected = [t for t in choices if t['condition'] == c and t['selected_role'] in ('distal', 'proximal')]
    print(c, 'n =', len(selected), 'distal responses =', sum(t['selected_role'] == 'distal' for t in selected))
print('Available verified word windows:', sum(w['session_id'] in study_ids and w['kind'] == 'word_window' and w['available'] == 'true' for w in windows))
print('Descriptive technical QA only. No sample-level independence assumption or inferential test.')
