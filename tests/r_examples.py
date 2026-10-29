"""Run every downloadable R example in its own clean session and directory.

Requires Rscript on PATH. Warnings fail the check: a runnable example should
not quietly return NaN or depend on objects from a previous lesson.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
rscript = shutil.which('Rscript')
assert rscript, 'Install R and put Rscript on PATH before running this check.'
scripts = sorted((root / 'downloads').rglob('*.R'))
assert scripts and any(p.parent.name == 'chapters' for p in scripts), 'Run tools/build.py first.'


def run(path):
    with tempfile.TemporaryDirectory(prefix='atlas-r-') as directory:
        try:
            result = subprocess.run(
                [rscript, '--vanilla', '-e',
                 'options(warn=2); source(commandArgs(TRUE)[1], print.eval=TRUE)', str(path)],
                cwd=directory, capture_output=True, text=True, timeout=60,
            )
            return path, result.returncode, result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return path, 1, 'Timed out after 60 seconds.'


with ThreadPoolExecutor(max_workers=4) as pool:
    failures = [(path, output) for path, code, output in pool.map(run, scripts) if code]
for path, output in failures:
    print(f'FAILED {path.relative_to(root)}\n{output}')
assert not failures, f'{len(failures)} R examples failed.'
chapter_count = sum(p.parent.name == 'chapters' for p in scripts)
print(f'{len(scripts)} standalone R examples passed ({chapter_count} chapter scripts); no warnings or shared session state.')
