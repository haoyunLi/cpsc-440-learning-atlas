"""Check published navigation, source coverage, and static reading fallbacks."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json

root = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.exercises = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            assert a['id'] not in self.ids, f'Duplicate id {a["id"]}'
            self.ids.add(a['id'])
        for key in ('href', 'src'):
            if a.get(key):
                self.links.append(a[key])
        if a.get('data-question'):
            self.exercises += 1

paths = list(root.glob('*.html')) + list((root / 'chapters').glob('*.html'))
pages = {p.resolve(): Page(p.read_text()) for p in paths}
count = 0
for path, page in pages.items():
    for link in page.links:
        url = urlsplit(link)
        if url.scheme or url.netloc:
            continue
        target = (path.parent / unquote(url.path)).resolve() if url.path else path
        assert target.is_relative_to(root), f'Escaping link: {path.name}: {link}'
        assert target.exists(), f'Broken link: {path.name}: {link}'
        if url.fragment and target in pages:
            assert unquote(url.fragment) in pages[target].ids, f'Broken anchor: {path.name}: {link}'
        count += 1
questions = json.loads((root / 'content/practice.json').read_text())
assert pages[(root / 'practice.html').resolve()].exercises == len(questions)
for q in questions:
    assert q['prompt'] in (root / 'practice.html').read_text(), q['id']
    assert (root / 'downloads' / f'{q["id"]}.R').exists()
for item in json.loads((root / 'search.json').read_text()):
    url = urlsplit(item['url'])
    page = pages[(root / url.path).resolve()]
    if url.fragment:
        assert url.fragment in page.ids, item['url']
deepening = json.loads((root / 'content/deepening.json').read_text())
assert len({x['chapter'] for x in deepening}) == 10
assert all(x.get('source') for x in deepening)
for p in paths:
    assert '/Users/' not in p.read_text(), f'Private local path leaked in {p.name}'
print(f'{len(pages)} pages, {count} local links/assets, search anchors, {len(questions)} static exercises and 10 source-backed supplements passed.')
