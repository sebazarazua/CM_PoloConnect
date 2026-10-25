"""Run current Codex format checks, original tests, and original output validators."""
from pathlib import Path
import importlib.util
import json
import subprocess
import sys
import yaml
import hashlib

sys.dont_write_bytecode = True

root = Path(__file__).resolve().parents[1]
creator = root / 'scripts' / 'vendor' / 'skill-creator'
passed = 0
manifest = json.loads((root / 'skills' / 'manifest.json').read_text(encoding='utf-8'))
for entry in manifest:
    for name, digest in entry['files'].items():
        if '__pycache__' in name or name.endswith('.pyc'):
            continue
        path = root / 'skills' / entry['name'] / name
        expected = entry.get('normalized', {}).get(name, digest)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, f'Skill integrity mismatch: {path}'
for skill in sorted((root / 'skills').iterdir()):
    if not skill.is_dir():
        continue
    subprocess.run([sys.executable, '-X', 'utf8', str(creator / 'quick_validate.py'), str(skill)], check=True)
    metadata = yaml.safe_load((skill / 'agents' / 'openai.yaml').read_text(encoding='utf-8'))
    assert metadata['interface']['short_description']
    test = next((skill / 'tests').glob('test_*.py'))
    spec = importlib.util.spec_from_file_location(skill.name, test)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    count = 0
    for name in sorted(vars(module)):
        if name.startswith('test_'):
            getattr(module, name)()
            count += 1
    script = next((skill / 'scripts').glob('validate_*.py'))
    fixture = root / 'fixtures' / 'skill-outputs' / (skill.name + '.json')
    subprocess.run([sys.executable, '-X', 'utf8', str(script), str(fixture)], check=True)
    print(f'{skill.name}: {count} original tests passed; output validator passed')
    passed += count
print(json.dumps({'skills': 9, 'original_tests_passed': passed}))
