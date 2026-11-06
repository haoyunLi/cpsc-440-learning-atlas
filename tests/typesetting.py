"""Check real static math, local assets, source bindings and readable fallbacks."""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from math_typesetting import RECORDS, WALKS, PRACTICE, PATTERN, validate_sources

chapters=sum([json.loads((ROOT/f'content/part{i}.json').read_text()) for i in range(1,4)],[])
for lesson in json.loads((ROOT/'content/deepening.json').read_text()):
    next(c for c in chapters if c['id']==lesson['chapter'])['lessons'].append(lesson)
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

assert len(RECORDS)==128
assert len(WALKS)==10 and sum(len(w['frames']) for w in WALKS)==40
for c in chapters:
    source=(ROOT/f'chapters/{c["id"]}.html').read_text();doc=Inspect();doc.feed(source)
    assert doc.stories==1
    assert len(doc.ids)==len(set(doc.ids)),c['id']
    walks=[w for w in WALKS if w['chapter']==c['id']]
    expected=sum(r['chapter']==c['id'] for r in RECORDS)+1+sum(1+len(w['frames']) for w in walks)
    assert doc.maths==expected,(c['id'],doc.maths,expected)
    assert not PATTERN.search(source),c['id']
    for w in walks:
        assert w['id'] in doc.ids
        assert 'class="walk-stages"' in source
        for f in w['frames']:
            assert f['title'] in source
    assert 'data-story-plot' in source and 'data-story-summary' in source
    assert 'data-story-config' in source and 'story-input-'+c['id'] in source
    assert 'katex-error' not in source
    assert any('intuition.mjs' in s for s in doc.scripts)
    assert '#intuition' in source
css=ROOT/'assets/vendor/katex/katex.min.css'
for ref in re.findall(r'url\(([^)]+)\)',css.read_text()):assert (css.parent/ref.strip('"\'')).is_file(),ref
assert (css.parent/'LICENSE').is_file()
assert '0.16.22' in (css.parent/'VERSION').read_text()

practice=(ROOT/'practice.html').read_text();doc=Inspect();doc.feed(practice)
assert practice.count('class="exercise-translation"')==93
assert sum('latex' in s for q in PRACTICE for s in q['steps'])==221
assert doc.maths==221+sum('promptLatex' in q for q in PRACTICE)
for q in PRACTICE:
    assert 'readQuestion' in q
print('128 explicit LaTeX source bindings, 40 staged formulas, 221 solution formulas, 93 plain-language guides, prompt MathML and all local math fonts passed.')
