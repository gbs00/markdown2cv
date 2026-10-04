"""Read-only PDF regression verification. No Unicode compatibility normalization allowed."""
from pathlib import Path
import json, re, difflib, shutil, subprocess
from pypdf import PdfReader
import pdfplumber

root = Path(__file__).resolve().parent.parent
host = json.loads((root/'evidence/host-results.json').read_text())
results=[]
pdftotext = shutil.which('pdftotext')
assert pdftotext, 'Poppler pdftotext is required to honor PDF ActualText'
def normal(text):
    return re.sub(r'\s+', '', text).replace('•','')

for fixture,name in [('01-standard','standard.pdf'),('04-pagination','two-page.pdf'),('04b-long-paragraph','long-paragraph.pdf')]:
    pdf=root/'output/pdf'/name
    reader=PdfReader(pdf)
    expected=host['fixtures'][fixture]['pageText']
    actual=[re.sub(r'\s*\d+\s*/\s*\d+\s*$', '', subprocess.check_output([pdftotext,'-f',str(i+1),'-l',str(i+1),str(pdf),'-'],text=True)) for i in range(len(reader.pages))]
    checks={'page_count': len(reader.pages)==len(expected), 'per_page_text_order':len(actual)==len(expected) and all(normal(a)==normal(b) for a,b in zip(actual,expected))}
    fonts=[]; links=[]
    for page in reader.pages:
        fonts.extend(str(f.get_object().get('/BaseFont')) for f in page['/Resources']['/Font'].values())
        links.extend(str(a.get_object().get('/A',{}).get('/URI','')) for a in page.get('/Annots',[]) if a.get_object().get('/Subtype')=='/Link')
    checks['unicode_not_radicals']=not any('\u2e80'<=c<='\u2fdf' for s in actual for c in s)
    checks['font_resources_present']=bool(fonts)  # Actual Source Han loading/embedding is checked by test:font.
    if fixture in ['01-standard','04-pagination']:checks['external_link']=any(u.startswith('https://example.com/') for u in links)
    with pdfplumber.open(pdf) as opened:
        boxes=[{'page':i+1,'x0':min([c['x0'] for c in p.chars],default=0),'x1':max([c['x1'] for c in p.chars],default=0),'top':min([c['top'] for c in p.chars],default=0),'bottom':max([c['bottom'] for c in p.chars],default=0),'width':p.width,'height':p.height} for i,p in enumerate(opened.pages)]
        checks['inside_page']=all(b['x0']>=0 and b['x1']<=b['width']+1 and b['top']>=0 and b['bottom']<=b['height']+1 for b in boxes)
    mismatch=[]
    for i,(a,b) in enumerate(zip(actual,expected)):
        if normal(a)!=normal(b):mismatch.append({'page':i+1,'diff':'\n'.join(difflib.ndiff([normal(b)],[normal(a)]))})
    results.append({'file':str(pdf),'checks':checks,'pages':len(reader.pages),'fonts':sorted(set(fonts)),'links':links,'bounds':boxes,'mismatch':mismatch})
    (root/'evidence'/f'{fixture}-extracted.txt').write_text('\n\n'.join(actual))

snapshot=PdfReader(root/'output/pdf/click-snapshot.pdf')
snapshot_text=subprocess.check_output([pdftotext,str(root/'output/pdf/click-snapshot.pdf'),'-'],text=True)
results.append({'file':'click-snapshot.pdf','checks':{'click_snapshot':'CLICK-TIME-V1' in snapshot_text and 'AFTER-CLICK-V2' not in snapshot_text,'chinese_exact':'中文工作方向页面' in normal(snapshot_text)}})
(root/'evidence/pdf-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
for result in results:print(Path(result['file']).name,result['checks'])
if not all(all(result['checks'].values()) for result in results):raise SystemExit(1)
