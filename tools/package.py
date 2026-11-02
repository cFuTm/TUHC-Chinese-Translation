"""Package only the installable mod folder, then verify the ZIP contents."""
from pathlib import Path
import re
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
# A browser may ignore a bad declaration while UHC rejects the entire stylesheet.
subprocess.run(['node', str(root / 'tools/test-css.cjs')], check=True)
files = ['mod.js', 'style.css', 'formatted.css', 'translations.json', 'build-report.json', 'README.md', 'media-url-report.json']
version = re.search(r"modVersion: '([^']+)'", (root / 'uhc-zh-en/mod.js').read_text(encoding='utf-8'))[1]
target = root / ('uhc-zh-en-' + version + '.zip')
with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        archive.write(root / 'uhc-zh-en' / name, 'uhc-zh-en/' + name)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {'uhc-zh-en/' + n for n in files}
    for name in files:
        assert archive.read('uhc-zh-en/' + name) == (root / 'uhc-zh-en' / name).read_bytes()
print(f'PASS: {target.name}; {target.stat().st_size:,} bytes; install folder, files and CRC verified.')
