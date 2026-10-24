from pathlib import Path
import shutil, json, importlib.util, subprocess, hashlib, os

root = Path('outputs/polo-connect-community-manager')
root.mkdir(parents=True, exist_ok=True)
creator = Path('C:/Users/sebas/.codex/skills/.system/skill-creator')
manifest = []
for source in sorted(Path('work/skill-inspection').glob('*/*')):
    target = root/'skills'/source.name
    shutil.copytree(source, target, dirs_exist_ok=True)
    entry=target/'SKILL.md'
    text=entry.read_text(encoding='utf-8')
    lines=text.splitlines(keepends=True)
    for i,line in enumerate(lines):
        if line.startswith('description: '):
            lines[i]='description: '+json.dumps(line.removeprefix('description: ').strip(),ensure_ascii=False)+'\n'
    entry.write_text(''.join(lines),encoding='utf-8')
    subprocess.run([os.sys.executable, '-X', 'utf8', str(creator/'scripts/generate_openai_yaml.py'), str(target)], check=True)
    manifest.append({'name':source.name,'files':{str(p.relative_to(source)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}})
    test = next((source/'tests').glob('test_*.py'))
    spec = importlib.util.spec_from_file_location(source.name, test)
    mod = importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    func = next(getattr(mod, n) for n in dir(mod) if n.startswith('base_'))
    fixture = func()
    folder=root/'fixtures'/'skill-outputs';folder.mkdir(parents=True, exist_ok=True)
    (folder/(source.name+'.json')).write_text(json.dumps(fixture,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'skills'/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
for name in ['raw','approved','rendered','archive']:
    d=root/'assets'/name;d.mkdir(parents=True,exist_ok=True);(d/'.gitkeep').touch()
print('Created',root.resolve())
