"""Verify knowledge-point routes and the static practice form safety boundary."""
from html.parser import HTMLParser
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
questions = json.loads((root / 'content/practice.json').read_text())
links = json.loads((root / 'content/practice-links.json').read_text())
chapters = sum([json.loads((root / f'content/part{i}.json').read_text()) for i in (1, 2, 3)], [])
for lesson in json.loads((root / 'content/deepening.json').read_text()):
    next(c for c in chapters if c['id'] == lesson['chapter'])['lessons'].append(lesson)
lesson_ids = {c['id']: {l['id'] for l in c['lessons']} for c in chapters}
assert set(links) == {q['id'] for q in questions}
for q in questions:
    assert links[q['id']] in lesson_ids[q['chapter']], q['id']


class Practice(HTMLParser):
    def __init__(self):
        super().__init__()
        self.question = None
        self.in_form = False
        self.routes = {}
        self.notices = set()
        self.disabled_controls = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'article' and a.get('data-question'):
            self.question = a['data-question']
        if self.question and tag == 'form':
            self.in_form = True
        if self.in_form and tag in ('input', 'button'):
            assert 'disabled' in a, f'Static answering control enabled in {self.question}'
            self.disabled_controls += 1
        if self.question and 'answer-availability' in a.get('class', '').split():
            assert 'hidden' not in a
            self.notices.add(self.question)
        if self.question and tag == 'a' and a.get('href', '').startswith('chapters/'):
            self.routes[self.question] = a['href']

    def handle_endtag(self, tag):
        if tag == 'form':
            self.in_form = False
        if tag == 'article':
            self.question = None


page = Practice()
page.feed((root / 'practice.html').read_text())
assert page.notices == set(links)
assert page.disabled_controls >= 3 * len(questions)
for q in questions:
    assert page.routes[q['id']] == f'chapters/{q["chapter"]}.html#{links[q["id"]]}', q['id']

class ChapterPractice(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sections = []
        self.in_practice = False
        self.routes = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'section':
            self.sections.append(a.get('id') if 'lesson' in a.get('class', '').split() else None)
        if tag == 'nav' and 'lesson-practice' in a.get('class', '').split():
            self.in_practice = True
        if tag == 'a' and self.in_practice:
            self.routes.append((next(s for s in reversed(self.sections) if s), a['href']))

    def handle_endtag(self, tag):
        if tag == 'nav':
            self.in_practice = False
        if tag == 'section':
            self.sections.pop()

outward = []
for chapter in chapters:
    parsed = ChapterPractice()
    parsed.feed((root / 'chapters' / f'{chapter["id"]}.html').read_text())
    outward.extend((chapter['id'], lesson, href) for lesson, href in parsed.routes)
expected = [(q['chapter'], links[q['id']], f'../practice.html#{q["id"]}') for q in questions]
assert sorted(outward) == sorted(expected), 'Each question must be reachable from its actual source lesson exactly once.'
print(f'{len(questions)} bidirectional lesson/practice routes and disabled-until-ready static forms passed.')
