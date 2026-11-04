"""Check real static math, local assets, source bindings and readable fallbacks."""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from math_typesetting import RECORDS, validate_sources

chapters=sum([json.loads((ROOT/f'content/part{i}.json').read_text()) for i in range(1,4)],[])
validate_sources(chapters)
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__();self.maths=0;self.tex=[];self.stories=0;self.scripts=[];self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='math':self.maths+=1
        if 'data-intuition' in a:self.stories+=1
        if tag=='script' and 'src' in a:self.scripts.append(a['src'])
        if 'id' in a:self.ids.append(a['id'])

assert len(RECORDS)==79
for c in chapters:
    source=(ROOT/f'chapters/{c["id"]}.html').read_text();doc=Inspect();doc.feed(source)
    assert doc.stories==1
    assert len(doc.ids)==len(set(doc.ids)),c['id']
    expected=sum(r['chapter']==c['id'] for r in RECORDS)+1
    assert doc.maths>=expected,(c['id'],doc.maths,expected)
    assert 'data-story-plot' in source and 'data-story-summary' in source
    assert 'data-story-config' in source and 'story-input-'+c['id'] in source
    assert 'katex-error' not in source
    assert any('intuition.mjs' in s for s in doc.scripts)
    assert '#intuition' in source
css=ROOT/'assets/vendor/katex/katex.min.css'
for ref in re.findall(r'url\(([^)]+)\)',css.read_text()):assert (css.parent/ref.strip('"\'')).is_file(),ref
assert (css.parent/'LICENSE').is_file()
assert '0.16.22' in (css.parent/'VERSION').read_text()
print('79 explicit LaTeX source bindings, static MathML, 10 story fallbacks, unique IDs and all local math fonts passed.')
