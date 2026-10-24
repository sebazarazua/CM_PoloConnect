"""Bridge to the original behavioral validators; JSON input/output, no shell interpolation."""
import importlib.util
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {p.name for p in (ROOT / 'skills').iterdir() if p.is_dir()}
request = json.load(sys.stdin)
name = request['skill']
if name not in ALLOWED:
    raise ValueError('unknown skill')
script = next((ROOT / 'skills' / name / 'scripts').glob('validate_*.py'))
spec = importlib.util.spec_from_file_location('skill_validator', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
validate = next(getattr(module, key) for key in vars(module) if key.startswith('validate_'))
print(json.dumps(validate(request['record']), ensure_ascii=False))
