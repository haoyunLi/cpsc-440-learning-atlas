"""Render explicitly authored LaTeX; leave code and unmatched prose untouched."""
import html
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ALL_RECORDS = json.loads((ROOT / 'content/equations.json').read_text())
RECORDS = [record for record in ALL_RECORDS if 'chapter' in record]
AUXILIARY_SOURCES = ('handbook.html', 'study-case.html')
STORIES = json.loads((ROOT / 'content/intuition.json').read_text())
WALKS = json.loads((ROOT / 'content/walkthroughs.json').read_text())
PRACTICE = json.loads((ROOT / 'content/practice.json').read_text())
PATTERN = re.compile(r'<div class="equation">(.*?)</div>', re.S)


def render_batch(items):
    result = subprocess.run(['node', str(ROOT / 'tools/render_math.cjs')],
                            input=json.dumps(items), text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


authored_tex = list(dict.fromkeys([r['tex'] for r in ALL_RECORDS]
                                 + [f['latex'] for w in WALKS for f in w['frames']]
                                 + [q['promptLatex'] for q in PRACTICE if 'promptLatex' in q]
                                 + [s['latex'] for q in PRACTICE for s in q['steps'] if 'latex' in s]))
rendered_by_tex = dict(zip(authored_tex, render_batch([{'tex': tex} for tex in authored_tex])))


def panel_html(rendered, extra_class=''):
    css = f'equation typeset-equation {extra_class}'.rstrip()
    return f'<div class="{css}" tabindex="0" role="region" aria-label="公式，可横向滚动">{rendered}</div>'


def math_panel(tex, extra_class=''):
    return panel_html(rendered_by_tex[tex], extra_class)


BY_SOURCE = {}
for record in ALL_RECORDS:
    source = record['source'].replace('\\n', '\n')
    replacement = math_panel(record['tex']) + ('<p class="equation-reading">' + html.escape(record['reading']) + '</p>' if record['reading'] else '')
    if source in BY_SOURCE and BY_SOURCE[source] != replacement:
        raise ValueError('Conflicting explicit LaTeX mapping')
    BY_SOURCE[source] = replacement


def typeset_equations(body):
    return PATTERN.sub(lambda match: BY_SOURCE.get(match.group(1), match.group(0)), body)


def validate_sources(chapters):
    actual = {(c['id'], l['id'], i): source for c in chapters for l in c['lessons']
              for i, source in enumerate(PATTERN.findall(l['body'].replace('\\n', '\n')))}
    for page in AUXILIARY_SOURCES:
        body = (ROOT / 'content' / page).read_text()
        actual.update({(page, '', i): source for i, source in enumerate(PATTERN.findall(body))})
    expected = {(r.get('chapter', r.get('page')), r.get('lesson', ''), r['index']): r['source'].replace('\\n', '\n')
                for r in ALL_RECORDS}
    if len(expected) != len(ALL_RECORDS):
        raise ValueError('Duplicate LaTeX source location')
    if actual.keys() != expected.keys():
        raise ValueError(f'Unmapped formula blocks: {sorted(actual.keys()-expected.keys())}; stale locations: {sorted(expected.keys()-actual.keys())}')
    for key, source in actual.items():
        if source != expected[key]:
            raise ValueError(f'Stale LaTeX source: {key}')


def story_sections():
    result = subprocess.run(['node', str(ROOT / 'tools/render_intuition.mjs')],
                            input=json.dumps(STORIES), text=True, capture_output=True, check=True)
    states = json.loads(result.stdout)
    maths = render_batch([{'tex': state['tex']} for state in states])
    sections = {}
    for spec, state, math in zip(STORIES, states, maths):
        esc = lambda s: html.escape(str(s), quote=True)
        cid = spec['chapter']
        choices = ''.join(f'<button type="button" class="secondary" data-story-choice aria-pressed="false" disabled>{esc(choice)}</button>' for choice in spec['choices'])
        config = json.dumps(spec, ensure_ascii=False).replace('<', '\\u003c')
        sections[cid] = f'''<section class="intuition-story" id="intuition" data-intuition aria-labelledby="intuition-title">
<p class="story-kicker">先看一个小故事</p><h2 id="intuition-title">{esc(spec['title'])}</h2>
<p class="story-question">{esc(spec['question'])}</p><p>{esc(spec['story'])}</p>
<div class="story-prediction"><p><b>先猜一下，再动手核对</b></p><div class="story-choices">{choices}</div><p data-story-feedback role="status">选一个判断，会告诉你为什么。</p></div>
<label for="story-input-{cid}">{esc(spec['label'])} <output data-story-value aria-live="off">{esc(spec['value'])}</output></label>
<input disabled id="story-input-{cid}" data-story-input type="range" min="{spec['min']}" max="{spec['max']}" step="{spec['step']}" value="{spec['value']}">
<button type="button" class="secondary" data-story-reset disabled>恢复这个例子的起点</button>
<figure><svg data-story-plot viewBox="0 0 640 320" role="img" aria-label="{esc(state['summary'])}">{state['svg']}</svg><figcaption data-story-summary>{esc(state['summary'])}</figcaption></figure>
<p data-story-explanation>{esc(state['explanation'])}</p>
<details class="story-zoom"><summary>放大看图（可左右滑动）</summary><div tabindex="0" role="region" aria-label="放大的故事图，可横向滚动"><svg data-story-zoom viewBox="0 0 640 320" role="img" aria-label="{esc(state['summary'])}">{state['svg']}</svg></div></details>
<details class="story-math"><summary>把刚才的变化，写成公式</summary><div class="equation typeset-equation" data-story-formula>{math}</div></details>
<p class="story-takeaway"><b>记住这一句：</b>{esc(spec['takeaway'])}</p>
<a class="story-next" href="#{esc(spec['lesson'])}">带着这个直觉，继续看正式讲解 →</a>
<noscript><p>上图与数字是起始例子；启用 JavaScript 后可以调整。公式、解释和正式章节仍可直接阅读。</p></noscript>
<script type="application/json" data-story-config>{config}</script></section>'''
    return sections
