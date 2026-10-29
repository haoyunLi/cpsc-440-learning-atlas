import assert from 'node:assert/strict';
import { mountRankLab } from '../assets/ranks.mjs';

// Isolated DOM/timer fixtures exercise the actual mount and event callbacks.
// Browser rendering, keyboard defaults and font metrics are tested separately.
class Element {
  constructor() {
    this.children = []; this.events = {}; this.attrs = {}; this.dataset = {};
    this.value = ''; this.textContent = ''; this.disabled = false;
    this.classList = { add() {}, toggle() {} };
  }
  set innerHTML(value) {
    this.html = value;
    if (this.allocations || this.frequency) {
      if (this.children.includes(document.activeElement)) document.activeElement = document.body;
      this.children = this.allocations
        ? [...value.matchAll(/data-allocation="(\d+)"/g)].map(match => {
          const button = new Element(); button.dataset.allocation = match[1]; button.span = new Element(); return button;
        })
        : [new Element()];
    }
  }
  get innerHTML() { return this.html || ''; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  addEventListener(name, callback) { this.events[name] = callback; }
  querySelector(selector) { return selector === 'span' ? this.span : null; }
  querySelectorAll(selector) { return selector === 'button' ? this.children : []; }
  closest(selector) { return selector === '[data-allocation]' && this.dataset.allocation !== undefined ? this : null; }
}

const names = ['mode', 'tail', 'assumptions', 'observed', 'counting', 'data', 'result', 'step', 'index', 'prev', 'next', 'play', 'reset', 'current', 'status', 'allocations', 'frequency', 'link'];
const elements = Object.fromEntries(names.map(name => [`[data-rank-${name}]`, new Element()]));
elements.svg = new Element();
const el = name => elements[`[data-rank-${name}]`];
el('mode').value = 'rank-sum'; el('tail').value = 'less';
el('allocations').allocations = true; el('frequency').frequency = true;
const root = new Element(); root.querySelector = selector => elements[selector];
const globals = Object.fromEntries(['document', 'matchMedia', 'IntersectionObserver', 'setInterval', 'clearInterval'].map(name => [name, globalThis[name]]));
const visibility = {}, motion = { matches: false, addEventListener(type, callback) { this[type] = callback; } };
let observe, nextTimer = 1;
const timers = new Map();
globalThis.document = { hidden: false, body: new Element(), activeElement: null, addEventListener(type, callback) { visibility[type] = callback; } };
globalThis.matchMedia = () => motion;
globalThis.IntersectionObserver = class { constructor(callback) { observe = callback; } observe(target) { assert.equal(target, root); } };
globalThis.setInterval = callback => { const id = nextTimer++; timers.set(id, callback); return id; };
globalThis.clearInterval = id => timers.delete(id);
const click = name => el(name).events.click();
const change = (name, value) => { el(name).value = value; el(name).events.change(); };
const tick = () => [...timers.values()].forEach(callback => callback());
const stopped = () => {
  assert.equal(timers.size, 0);
  assert.equal(el('play').attrs['aria-pressed'], 'false');
  const before = el('index').textContent; tick(); assert.equal(el('index').textContent, before);
};

try {
  mountRankLab(root);
  assert.equal(el('step').max, '20');
  assert.equal(el('allocations').children.length, 20);
  assert.equal(el('prev').disabled, true);
  assert.match(el('result').innerHTML, /4 \/ 20 = 0.2000/);

  // Browsing and animation must preserve the buttons and the focusable table
  // region. Replacing the region would lose its focus and scroll position.
  const buttons = [...el('allocations').children], table = el('frequency').children[0];
  const initialTable = el('frequency').innerHTML;
  table.scrollLeft = 80; document.activeElement = table;
  click('play'); assert.equal(timers.size, 1); assert.equal(el('play').attrs['aria-pressed'], 'true');
  tick(); assert.equal(el('index').textContent, '2 / 20');
  assert.equal(el('frequency').children[0], table);
  assert.equal(document.activeElement, table); assert.equal(table.scrollLeft, 80);
  assert.equal(el('frequency').innerHTML, initialTable);
  buttons.forEach((button, i) => assert.equal(el('allocations').children[i], button));
  click('play'); stopped();

  // Changing the rejection rule stops the timer and updates the fixed table.
  click('play'); change('tail', 'two'); stopped();
  assert.equal(el('index').textContent, '2 / 20');
  assert.match(el('result').innerHTML, /8 \/ 20 = 0.4000/);
  assert.notEqual(el('frequency').children[0], table);
  const twoTailTable = el('frequency').children[0];
  click('play'); el('step').events.input({ target: { value: '5' } }); stopped();
  assert.equal(el('index').textContent, '5 / 20');
  assert.equal(el('frequency').children[0], twoTailTable);
  document.activeElement = buttons[7];
  el('allocations').events.click({ target: buttons[7] });
  assert.equal(el('index').textContent, '8 / 20');
  assert.equal(el('allocations').children[7], buttons[7]);
  assert.equal(document.activeElement, buttons[7]);
  assert.equal(buttons[7].attrs['aria-pressed'], 'true');
  assert.equal(buttons[6].attrs['aria-pressed'], 'false');

  // A mode change while playing starts a new, paused reference experiment.
  click('play'); change('mode', 'signed-rank'); stopped();
  assert.equal(el('step').max, '32'); assert.equal(el('index').textContent, '1 / 32');
  assert.equal(el('allocations').children.length, 32); assert.equal(el('tail').value, 'two');
  assert.equal(el('prev').disabled, true); assert.equal(el('next').disabled, false);
  assert.match(el('result').innerHTML, /4 \/ 32 = 0.1250/);

  click('play'); for (let i = 0; i < 31; i++) tick(); stopped();
  assert.equal(el('index').textContent, '32 / 32'); assert.equal(el('next').disabled, true);
  assert.match(el('status').textContent, /最后一个/);
  click('play'); assert.equal(el('index').textContent, '1 / 32');
  tick(); assert.equal(el('index').textContent, '2 / 32');

  // Motion preference changes stop playback but preserve manual navigation.
  motion.matches = true; motion.change(); stopped();
  assert.equal(el('play').disabled, true); click('play'); stopped();
  click('next'); assert.equal(el('index').textContent, '3 / 32');
  motion.matches = false; motion.change();
  assert.equal(el('play').disabled, false); stopped();

  click('play'); document.hidden = true; visibility.visibilitychange(); stopped();
  document.hidden = false; visibility.visibilitychange(); stopped();
  click('play'); observe([{ isIntersecting: false }]); stopped();
  observe([{ isIntersecting: true }]); stopped();
  click('play'); click('reset'); stopped(); assert.equal(el('index').textContent, '1 / 32');
  change('mode', 'rank-sum');
  assert.equal(el('step').max, '20'); assert.equal(el('allocations').children.length, 20);
  assert.equal(el('tail').value, 'less'); assert.equal(el('index').textContent, '1 / 20');
  stopped();
} finally {
  for (const [name, value] of Object.entries(globals)) {
    if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
  }
}
console.log('Rank lab lifecycle, finite playback, motion/visibility pauses, mode/rule changes and stable button/table nodes passed.');
