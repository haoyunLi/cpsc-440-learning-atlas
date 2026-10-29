"""Verify authored-only outlines, stable anchors and byte-preserving enrichment."""

from collections import Counter
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from lesson_outline import collect_ids, enrich_lesson, render_outline


def preserved(before, after, entries):
    """Only the newly assigned id attributes may differ from the source."""
    existing = set(collect_ids(before))
    restored = after
    for entry in entries:
        if entry["id"] not in existing:
            addition = f' id="{escape(entry["id"], quote=True)}"'
            assert restored.count(addition) == 1, entry
            restored = restored.replace(addition, "", 1)
    assert restored == before
    assert re.findall(r"<pre\b.*?</pre>", before, re.S | re.I) == re.findall(r"<pre\b.*?</pre>", after, re.S | re.I)


body = '''<p>Intro before all subtopics.</p>
<H3 class='authored' data-example="x > y">S<sub>xx</sub> &amp; variance</H3>
<p>Alpha &lt; beta. Inline <code>var(x)</code> is a named operation.</p>
<pre><code># Keep literal code byte-for-byte, including \\n and &lt;h3&gt;.
<h3 id="code-heading">PRE_IMPLEMENTATION_TOKEN</h3>
</code></pre>
<script>const x = '<h3 id="script-heading">SCRIPT_TOKEN</h3>';</script>
<style>.demo:before {content: "STYLE_TOKEN";}</style>
<nav><h3 id="nav-heading">NAV_TOKEN</h3></nav>
<figure><h3 id="figure-heading">Figure label</h3></figure>
<details><summary>Supplement</summary><h3 id="hidden-heading">Hidden label</h3></details>
<p class="small source-locator">SOURCE_LOCATOR_TOKEN</p>
<h4>Child <em>topic</em></h4><p>Child body &amp; decoded entity.</p>
<h3 id='keep-this-ID'>Next topic</h3><p>Next body only.</p>'''
reserved = set(collect_ids(body)) | {"main", "example"}
enriched, entries = enrich_lesson(body, "example", reserved)
assert [entry["title"] for entry in entries] == ["Sxx & variance", "Child topic", "Next topic"]
assert [entry["level"] for entry in entries] == [3, 4, 3]
assert entries[-1]["id"] == "keep-this-ID"
assert re.fullmatch(r"sub-example-[0-9a-f]{12}", entries[0]["id"])
assert "Intro before" not in entries[0]["text"]
assert "Alpha < beta" in entries[0]["text"]
assert "var(x)" in entries[0]["text"]
assert "Child topic Child body & decoded entity." in entries[0]["text"]
assert entries[1]["text"] == "Child body & decoded entity."
assert entries[2]["text"] == "Next body only."
for token in ["PRE_IMPLEMENTATION_TOKEN", "SCRIPT_TOKEN", "STYLE_TOKEN", "NAV_TOKEN", "SOURCE_LOCATOR_TOKEN"]:
    assert all(token not in entry["text"] for entry in entries), token
assert set(collect_ids(body)) == {"code-heading", "nav-heading", "figure-heading", "hidden-heading", "keep-this-ID"}
assert all(entry["id"] in reserved for entry in entries)
assert "main" in reserved
preserved(body, enriched, entries)
again, again_entries = enrich_lesson(enriched, "example", reserved)
assert again == enriched and again_entries == entries

# Changing order or inserting an unrelated heading must not renumber links.
blocks = ['<h3>First &amp; one</h3><p>One body.</p>', '<h3>Second</h3><p>Two body.</p>']
def by_title(source, lesson="stable"):
    return {entry["title"]: entry["id"] for entry in enrich_lesson(source, lesson, set())[1]}
base = by_title("".join(blocks))
assert by_title("".join(reversed(blocks))) == base
added = by_title('<h3>Unrelated</h3><p>New.</p>' + "".join(blocks))
assert all(added[title] == identifier for title, identifier in base.items())
assert by_title("".join(blocks), "other") != base
assert by_title("".join(blocks), "a b") != by_title("".join(blocks), "a-b")
assert by_title('<h3> Second </h3><p>Two body.</p>')["Second"] == base["Second"]

# Same titles with distinct section bodies use content-based disambiguation.
duplicates = ['<h3>Repeated</h3><p>Alpha section.</p>', '<h3>Repeated</h3><p>Beta section.</p>']
first = enrich_lesson("".join(duplicates), "duplicates", set())[1]
reversed_entries = enrich_lesson("".join(reversed(duplicates)), "duplicates", set())[1]
assert len({entry["id"] for entry in first}) == 2
assert {entry["text"]: entry["id"] for entry in first} == {entry["text"]: entry["id"] for entry in reversed_entries}
identical = "<h3>Repeated</h3><p>Same.</p>" * 8
identical_html, identical_entries = enrich_lesson(identical, "duplicates", set())
assert len({entry["id"] for entry in identical_entries}) == 8
assert enrich_lesson(identical, "duplicates", set())[1] == identical_entries
preserved(identical, identical_html, identical_entries)

# Pre-existing IDs anywhere in a chapter take priority over generated choices.
plain = '<h3>A heading</h3><p>Body.</p>'
ordinary = enrich_lesson(plain, "collision", set())[1][0]["id"]
registry = {ordinary}
changed, collision_entries = enrich_lesson(plain, "collision", registry)
assert collision_entries[0]["id"] != ordinary and ordinary in registry
assert len(registry) == 3  # Existing ID, generated ID, reserved lesson ID.
preserved(plain, changed, collision_entries)
explicit_collision = '<h3>A heading</h3><div id="' + ordinary + '"></div>'
_, result = enrich_lesson(explicit_collision, "collision", set())
assert result[0]["id"] != ordinary
explicit = '<h3 id="persistent">Edited title &amp; body</h3><p>Revised.</p>'
assert enrich_lesson(explicit, "example", {"persistent"})[0] == explicit

for invalid in ['<h3 id="same">One</h3><p id="same">Two</p>', '<h3 id="">Empty ID</h3>', '<h3 id="a" id="b">Two IDs</h3>', '<h3>Unclosed']:
    try:
        enrich_lesson(invalid, "invalid", set())
    except ValueError:
        pass
    else:
        raise AssertionError(invalid)
assert collect_ids('<p id="same"></p><p id="same"></p>') == ["same", "same"]
assert enrich_lesson('<h3> </h3><p>Empty title remains untouched.</p>', 'empty', set()) == ('<h3> </h3><p>Empty title remains untouched.</p>', [])
# A code-only subsection remains a useful title target, but implementation
# tokens must not leak into its prose index merely to make that index nonempty.
code_only = '<h3>Reproduce the example in R</h3><pre><code>summary(fit)</code></pre>'
code_html, code_entries = enrich_lesson(code_only, "code-only", set())
assert code_entries[0]["title"] == "Reproduce the example in R"
assert code_entries[0]["text"] == ""
preserved(code_only, code_html, code_entries)
assert render_outline([], "Empty") == ""
try:
    enrich_lesson(plain, "example", [])
except TypeError:
    pass
else:
    raise AssertionError("A registry must be a mutable set")


class OutlineParser(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.depth = 0
        self.links = []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        self.tags.append((tag, attributes))
        if tag == "ol":
            self.depth += 1
        if tag == "a":
            self.links.append((unquote(attributes["href"][1:]), self.depth))
    def handle_endtag(self, tag):
        if tag == "ol":
            self.depth -= 1


outline = render_outline(entries, 'A "lesson" & title')
parsed = OutlineParser(outline)
assert parsed.links == [(entries[0]["id"], 1), (entries[1]["id"], 2), (entries[2]["id"], 1)]
assert parsed.tags[0] == ("details", {"class": "lesson-outline"})
assert "本节导读 · 3 个主题" in outline
assert next(attrs for tag, attrs in parsed.tags if tag == "nav")["aria-label"] == 'A "lesson" & title的小节导读'
assert all("id" not in attrs for _, attrs in parsed.tags)
assert all(tag not in {"script", "h3", "h4"} for tag, _ in parsed.tags)
orphan = [{"level": 4, "id": "a&b", "title": "<unsafe>", "text": ""}, {"level": 3, "id": "parent", "title": "Parent", "text": ""}, {"level": 4, "id": "child", "title": "Child", "text": ""}]
orphan_html = render_outline(orphan, "Outline")
assert "&lt;unsafe&gt;" in orphan_html and 'href="#a%26b"' in orphan_html
assert OutlineParser(orphan_html).links == [("a&b", 1), ("parent", 1), ("child", 2)]

# Check all authored content without importing the writing build script.
chapters = {}
for part in range(1, 4):
    for chapter in json.loads((ROOT / f"content/part{part}.json").read_text()):
        chapters[chapter["id"]] = list(chapter["lessons"])
for lesson in json.loads((ROOT / "content/deepening.json").read_text()):
    chapters[lesson["chapter"]].append(lesson)
lesson_count = heading_count = outline_count = explicit_count = code_count = 0
code_hashes_before = []
code_hashes_after = []
for chapter_id, lessons in chapters.items():
    existing = [lesson["id"] for lesson in lessons]
    normalized_bodies = [lesson["body"].replace("\\n", "\n") for lesson in lessons]
    for body in normalized_bodies:
        existing.extend(collect_ids(body))
    assert all(count == 1 for count in Counter(existing).values()), chapter_id
    registry = set(existing) | {"main", "chapter-navigation", "complete", "progress-error"}
    for lesson, body in zip(lessons, normalized_bodies):
        enriched, subtopics = enrich_lesson(body, lesson["id"], registry)
        lesson_count += 1
        heading_count += len(subtopics)
        outline_count += bool(subtopics)
        original_ids = set(collect_ids(body))
        explicit_count += sum(entry["id"] in original_ids for entry in subtopics)
        assert len(set(collect_ids(enriched))) == len(collect_ids(enriched))
        assert all(entry["id"] in collect_ids(enriched) for entry in subtopics)
        assert all(entry["id"] in registry for entry in subtopics)
        assert original_ids <= set(collect_ids(enriched))
        preserved(body, enriched, subtopics)
        assert enrich_lesson(enriched, lesson["id"], registry) == (enriched, subtopics)
        toc = render_outline(subtopics, lesson["title"])
        assert [identifier for identifier, _ in OutlineParser(toc).links] == [entry["id"] for entry in subtopics]
        assert all(isinstance(entry["text"], str) and entry["title"] for entry in subtopics)
        for before, after in zip(re.findall(r"<pre\b.*?</pre>", body, re.S), re.findall(r"<pre\b.*?</pre>", enriched, re.S)):
            code_count += 1
            code_hashes_before.append(sha256(before.encode()).hexdigest())
            code_hashes_after.append(sha256(after.encode()).hexdigest())
        if chapter_id == "11" and lesson["id"] == "lack-fit":
            exact = next(entry for entry in subtopics if entry["title"].startswith("读 quadratic 输出"))
            assert "三个 F" in exact["title"] and "MSPE" in exact["text"]
            assert "summary(fit)" not in exact["text"]
            # An h3 includes its h4 children, but stops at the next h3.
            assert "负的 x 系数" in exact["text"]
            assert "连续 x 的方差诊断" not in exact["text"]
            child = next(entry for entry in subtopics if entry["title"].startswith("负的 x 系数"))
            assert child["level"] == 4 and "局部变化率" in child["text"]
            assert "R²=r² 的 SLR 边界" not in child["text"]
            assert exact["id"] != lesson["id"]
assert (lesson_count, heading_count, outline_count, explicit_count) == (104, 140, 57, 18)
assert code_hashes_before == code_hashes_after
assert code_count >= 81
print(f"Authored outlines: {lesson_count} lessons, {heading_count} subsection anchors, {outline_count} static outlines, {explicit_count} preserved heading IDs and {code_count} byte-identical code blocks; scope, collision/reordering stability, search boundaries and no-JS nesting passed.")
