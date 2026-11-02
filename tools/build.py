"""Build the self-contained mod data from the extracted corpus and local UHC."""
import hashlib
import html
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from html.parser import HTMLParser


class TextCorrections(HTMLParser):
    def __init__(self, replacements):
        super().__init__(convert_charrefs=False)
        self.replacements, self.output = replacements, []
    def handle_starttag(self, tag, attrs): self.output.append(self.get_starttag_text())
    def handle_startendtag(self, tag, attrs): self.output.append(self.get_starttag_text())
    def handle_endtag(self, tag): self.output.append('</' + tag + '>')
    def handle_data(self, data):
        for old,new in self.replacements: data = data.replace(old,new)
        self.output.append(data)
    def handle_entityref(self, name): self.output.append('&' + name + ';')
    def handle_charref(self, name): self.output.append('&#' + name + ';')

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent.parent / 'uhc-zh-en'
source = ROOT / 'locolization/simplified_Chinese/homestuck.simplified.json'
archive = ROOT / 'unofficial-homestuck-collection/Asset_Pack/archive/data/mspa.json'
corpus = json.loads(source.read_text(encoding='utf-8'))['pages']
story = json.loads(archive.read_text(encoding='utf-8'))['story']
overrides_path = OUT.parent / 'local-overrides.json'
overrides = json.loads(overrides_path.read_text(encoding='utf-8'))['pages'] if overrides_path.exists() else {}
pages, recolored, skipped, formatted_css, formatted_count = {}, 0, [], [], 0

for pid, entry in corpus.items():
    if pid not in story or not '001901' <= pid <= '010030':
        skipped.append(pid)
        continue
    page = {}
    if isinstance(entry['title'], str): page['title'] = entry['title']
    content = entry['content']
    if entry['provenance']['content'] == 'blog.xml':
        formatted_count += 1
        if entry.get('formatCss'): formatted_css.append(entry['formatCss'])
    if isinstance(content, str):
        if content and entry['provenance']['content'] == '繁中翻译.txt':
            # Restore only speaker colors found in this exact original page.
            colors = defaultdict(Counter)
            for color, text in re.findall(r'<span\b[^>]*style="[^"]*color:\s*(#[0-9a-fA-F]{6})[^"]*"[^>]*>([^<]*)', story[pid]['content']):
                speaker = re.match(r'\s*([A-Za-z0-9_]+)\s*[:：]', html.unescape(text))
                if speaker: colors[speaker[1].upper()][color] += 1
            lines = []
            colored = False
            for line in entry['text'].splitlines():
                escaped = html.escape(line, quote=False)
                speaker = re.match(r'\s*([A-Za-z0-9_]+)\s*[:：]', line)
                if speaker and speaker[1].upper() in colors:
                    color = colors[speaker[1].upper()].most_common(1)[0][0]
                    escaped = f'<span style="color: {color}">{escaped}</span>'
                    colored = True
                lines.append(escaped)
            content = '<br />\n'.join(lines)
            recolored += int(colored)
        if content:
            marker = re.match(r'^\|([^|]+)\|', story[pid]['content'])
            # Rendering type stays owned by UHC, including AUTHORLOG special pages.
            content = re.sub(r'^\|[^|]+\|\s*(?:<br\s*/?>)?\s*', '', content)
            if marker: content = f'|{marker[1]}|<br />' + content
        page['content'] = content
    if pid in overrides:
        if 'title' in page:
            for old,new in overrides[pid]: page['title'] = page['title'].replace(old,new)
        if page.get('content'):
            parser = TextCorrections(overrides[pid]); parser.feed(page['content']); parser.close()
            page['content'] = ''.join(parser.output)
    if page: pages[pid] = page

data = {'schemaVersion': 1, 'language': 'zh-Hans', 'pages': pages}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'translations.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
(OUT / 'formatted.css').write_text('\n'.join(formatted_css) + '\n', encoding='utf-8')
report = {'inputSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
          'pageEntries': len(pages), 'nonemptyChineseBodies': sum(bool(p.get('content')) for p in pages.values()),
          'bodiesWithRestoredSpeakerColors': recolored, 'excludedArchiveIds': skipped,
          'bodiesFromFormattedXml': formatted_count,
          'localCorrectionPageIds': sorted(overrides),
          'bodyFallbackPageIds': [pid for pid in story if '001901' <= pid <= '010030' and 'content' not in pages.get(pid, {})],
          'note': 'Text-only mod. Translation quality and source formatting are not manually proofread.'}
(OUT / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if not isinstance(v,list)}, ensure_ascii=False, indent=2))
subprocess.run(['node', str(Path(__file__).with_name('restore-media.cjs'))], check=True)
