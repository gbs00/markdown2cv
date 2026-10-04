"""Check real photo exports without Unicode replacement or dehyphenation."""
from pathlib import Path
import json
import re
import subprocess

root = Path(__file__).resolve().parent.parent
evidence = root / 'evidence/photo'
host = json.loads((evidence / 'host-results.json').read_text())
assert host['status'] == 'complete'
compact = lambda text: re.sub(r'\s+', '', text)
results = []
for item in host['fixtures']:
    pdf = item['pdf']
    info = subprocess.check_output(['pdfinfo', pdf], text=True)
    count = int(re.search(r'^Pages:\s+(\d+)', info, re.M).group(1))
    width, height = map(float, re.search(r'^Page size:\s+([\d.]+) x ([\d.]+)', info, re.M).groups())
    actual = []
    for index in range(count):
        # Default pdftotext removes hyphens at wrapped words. Layout mode retains
        # the visible source hyphen; only layout whitespace is ignored below.
        text = subprocess.check_output(['pdftotext', '-layout', '-f', str(index + 1), '-l', str(index + 1), pdf, '-'], text=True)
        actual.append(re.sub(r'\s*\d+\s*/\s*\d+\s*$', '', text))
    images = subprocess.check_output(['pdfimages', '-list', pdf], text=True)
    checks = {
        'pagesMatch': count == item['pages'],
        'perPageUnicodeMatches': len(actual) == len(item['text']) and all(compact(a) == compact(b) for a, b in zip(actual, item['text'])),
        'embeddedPhoto': bool(re.search(r'^\s*1\s+\d+\s+image\s', images, re.M)),
        'a4': abs(width - 595.28) < 1 and abs(height - 841.89) < 1,
    }
    results.append({'name': item['name'], 'checks': checks, 'imageList': images, 'pageSizePoints': [width, height]})
    subprocess.run(['pdftoppm', '-r', '110', '-png', pdf, str(evidence / item['name'])], check=True, capture_output=True)
(evidence / 'pdf-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
print(json.dumps([{'name': r['name'], **r['checks']} for r in results], ensure_ascii=False, indent=2))
assert all(all(r['checks'].values()) for r in results)
