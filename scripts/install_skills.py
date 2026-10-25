"""Install the nine independent skills without replacing divergent local installations."""
from pathlib import Path
import hashlib
import os
import shutil

root = Path(__file__).resolve().parents[1]
destination = Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'skills'
destination.mkdir(parents=True, exist_ok=True)
for source in sorted((root / 'skills').iterdir()):
    if not source.is_dir():
        continue
    target = destination / source.name
    if target.exists():
        for p in source.rglob('*'):
            if p.is_file() and '__pycache__' not in p.parts:
                q = target / p.relative_to(source)
                if not q.is_file() or hashlib.sha256(p.read_bytes()).digest() != hashlib.sha256(q.read_bytes()).digest():
                    raise SystemExit(f'Existing divergent skill preserved: {target}. Resolve explicitly before installing.')
        print(f'Already installed: {target}')
    else:
        shutil.copytree(source, target, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        print(f'Installed: {target}')
