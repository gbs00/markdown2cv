"""Inspect only the isolated font-check outputs. Respect PDF ActualText; never NFKC."""
from pathlib import Path
import json, re, shutil, subprocess
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
evidence = root / 'evidence/source-han-font'
host_path = evidence / 'host-results.json'
host = json.loads(host_path.read_text())
assert host['status'] == 'complete', 'Background host check did not finish'
pdftotext = shutil.which('pdftotext')
assert pdftotext, 'Poppler pdftotext is required; pypdf does not honor ActualText here'
pdfkit = json.loads(subprocess.check_output(['swift', str(root/'scripts/check-font-pdf.swift'), str(host_path)], text=True))
(evidence/'pdfkit-results.json').write_text(json.dumps(pdfkit, ensure_ascii=False, indent=2))

def text_only(text):
    return re.sub(r'\s+', '', text)

def content_only(text):
    return re.sub(r'\s*\d+\s*/\s*\d+\s*$', '', text)

def embedded(font):
    if font.get('/Subtype') == '/Type3':
        return bool(font.get('/CharProcs'))
    child = font.get('/DescendantFonts', [font])[0].get_object()
    descriptor = child.get('/FontDescriptor')
    return bool(descriptor and any(key in descriptor.get_object() for key in ('/FontFile', '/FontFile2', '/FontFile3')))

results = []
for item, kit in zip(host['fixtures'], pdfkit):
    file = Path(item['pdf'])
    reader = PdfReader(file)
    actual = [content_only(subprocess.check_output([pdftotext, '-f', str(i+1), '-l', str(i+1), '-enc', 'UTF-8', str(file), '-'], text=True)) for i in range(len(reader.pages))]
    kit_pages = [content_only(page) for page in kit['pages']]
    expected = item['pageText']
    all_text = text_only(''.join(actual))
    fonts = [font.get_object() for page in reader.pages for font in page['/Resources']['/Font'].values()]
    links = [str(annotation.get_object().get('/A', {}).get('/URI', '')) for page in reader.pages for annotation in page.get('/Annots', []) if annotation.get_object().get('/Subtype') == '/Link']
    checks = {
        'page_count_matches_preview': len(actual) == len(expected) == item['previewPages'],
        'poppler_per_page_codepoints': len(actual) == len(expected) and all(text_only(a) == text_only(b) for a,b in zip(actual,expected)),
        'pdfkit_per_page_codepoints': len(kit_pages) == len(expected) and all(text_only(a) == text_only(b) for a,b in zip(kit_pages,expected)),
        'ordinary_hanzi_exact': '工作方向页面长' in all_text,
        'literal_radicals_preserved': '⼯⽅⻚⾯⻓' in all_text,
        'pdfkit_search_and_selection': all(value['matches'] > 0 and value['exactSelection'] for value in kit['searches'].values()),
        'embedded_glyph_programs': bool(fonts) and all(embedded(font) for font in fonts),
        'external_links_preserved': any(link.startswith('https://example.com/') for link in links),
        'a4_pages': all(abs(float(page.mediabox.width)-595.28)<1 and abs(float(page.mediabox.height)-841.89)<2 for page in reader.pages),
        'offline_font_sources': item['offlineFontSources'],
    }
    result = {'name':item['name'], 'file':str(file), 'checks':checks, 'fontTypes':sorted(set(str(font.get('/Subtype')) for font in fonts)), 'actualTextSpans':sum(page.get_contents().get_data().count(b'/ActualText') for page in reader.pages), 'links':links, 'pdfkitSearches':kit['searches'], 'textNormalization':'Compare DOM text, ignoring whitespace only. CSS disc shapes are not text. No Unicode normalization, bullet stripping, or replacement.'}
    if not checks['poppler_per_page_codepoints'] or not checks['pdfkit_per_page_codepoints']:
        result['comparison'] = {'preview':expected, 'poppler':actual, 'pdfkit':kit_pages}
    results.append(result)
    (evidence/(item['name']+'-extracted.txt')).write_text('\n\n'.join(actual))

(evidence/'pdf-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
for result in results:
    print(result['name'], json.dumps(result['checks'], ensure_ascii=False))
assert len(results) == 2 and all(all(result['checks'].values()) for result in results), 'PDF checks failed'
