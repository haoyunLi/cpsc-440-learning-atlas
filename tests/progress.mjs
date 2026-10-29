import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizeReadingProgress } from '../assets/atlas.mjs';
import { normalizePracticeProgress } from '../assets/learning.mjs';

const chapters = [1, 2, 3].flatMap(i => JSON.parse(readFileSync(new URL(`../content/part${i}.json`, import.meta.url), 'utf8'))).map(c => c.id);
assert.deepEqual(normalizeReadingProgress(chapters), chapters);
for (const value of [null, {}, 42, '01', true]) assert.deepEqual(normalizeReadingProgress(value), []);
assert.deepEqual(normalizeReadingProgress(['01', '01', '99', null, 4, '11']), ['01', '11']);

const ids = ['p05-01', 'p05-02'];
const mixed = {
  'p05-01': {attempts: 3, correct: true, bookmark: false},
  'p05-02': {attempts: 'bad', correct: 'false', bookmark: true},
  'unknown': {attempts: 10, correct: true, bookmark: true}
};
assert.deepEqual(normalizePracticeProgress(mixed, ids), {
  'p05-01': {attempts: 3, correct: true, bookmark: false},
  'p05-02': {attempts: 0, correct: false, bookmark: true}
});
for (const attempts of [null, {}, '1', -1, 1.5, true, Number.MAX_SAFE_INTEGER + 1]) {
  assert.deepEqual(normalizePracticeProgress({'p05-01': {attempts, correct: true, bookmark: 'false'}}, ids), {});
}
for (const value of [null, [], 42, 'progress']) assert.deepEqual(normalizePracticeProgress(value, ids), {});
assert.deepEqual(normalizePracticeProgress({'p05-01': {attempts: 0, correct: 'false', bookmark: 'false'}}, ids), {});

// Run the real startup code with small DOM fixtures and isolated storage.
// These tests cover lifecycle/state, not browser layout or native form behavior.
const source = name => readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
class Element {
  constructor(text = '') { this.textContent=text; this.events={}; this.dataset={}; this.attrs={}; this.children=[]; this.selectors={}; this.lists={}; this.value=''; this.disabled=false; }
  querySelector(s) { return this.selectors[s] || null; }
  querySelectorAll(s) { return this.lists[s] || []; }
  setAttribute(k,v) { this.attrs[k]=v; }
  addEventListener(k,v) { this.events[k]=v; }
  replaceChildren() { this.children=[]; this.textContent=''; }
  append(e) { this.children.push(e); }
  reset() {}
  scrollIntoView() { this.scrolled=true; }
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function storageFixture(raw, denyRead=false, denyWrite=false) {
  return { raw, getItem() { if(denyRead)throw Error('Storage denied');return this.raw; }, setItem(key,value) { if(denyWrite)throw Error('Quota denied');this.raw=value; } };
}
async function atlasFixture(raw, {chapter=false, failSearch=false, index=[], denyRead=false, denyWrite=false}={}) {
  const els={};
  if(chapter) { els['#complete']=new Element();els['#complete'].dataset.chapter='01';els['#progress-error']=new Element(); }
  else for(const key of ['#progress-count','#search','#search-results'])els[key]=new Element();
  const document={querySelector:s=>els[s]||null,querySelectorAll:()=>[],createElement:()=>new Element()};
  Object.values(els).forEach(element=>element.ownerDocument=document);
  const storage=storageFixture(raw,denyRead,denyWrite);let fetches=0;
  const context={document,URL,localStorage:storage,fetch:()=>{fetches++;return failSearch?Promise.reject(Error('Offline')):Promise.resolve({ok:true,json:()=>Promise.resolve(index)});},matchMedia:()=>({matches:false}),window:{addEventListener(){}},console};
  vm.runInNewContext(source('search.mjs')+'\n'+source('atlas.mjs'),context);
  await settle();
  return {els,storage,fetches};
}
for(const raw of ['null','{}','42','"01"','["01","01","99"]','["99"]']) {
  const home=await atlasFixture(raw);
  assert.equal(typeof home.els['#search'].events.input,'function');
  assert.equal(home.fetches,1);
  assert.match(home.els['#progress-count'].textContent,raw.includes('99')&&raw.includes('01')?/1\/10/:/0\/10/);
  const chapter=await atlasFixture(raw,{chapter:true});
  assert.equal(typeof chapter.els['#complete'].onclick,'function');
}
const read=await atlasFixture('["04","99","04"]',{chapter:true});
read.els['#complete'].onclick();
assert.deepEqual(JSON.parse(read.storage.raw),['04','01']);
const readDenied=await atlasFixture(null,{denyRead:true});
assert.equal(typeof readDenied.els['#search'].events.input,'function');
const writeDenied=await atlasFixture('[]',{chapter:true,denyWrite:true});
writeDenied.els['#complete'].onclick();
assert.match(writeDenied.els['#progress-error'].textContent,/未允许保存/);
for(const options of [{failSearch:true},{index:{}},{index:[{title:'Missing fields'}]}]) {
  const result=await atlasFixture('[]',options);
  assert.match(result.els['#search-results'].children[0].textContent,/未载入/);
  result.els['#search'].value='ANOVA';result.els['#search'].events.input();
  assert.match(result.els['#search-results'].children[0].textContent,/未载入/);
  assert.equal(result.fetches,1);
}
const validSearch=await atlasFixture('null',{index:[{chapter:'Ch 08',title:'ANOVA',text:'Means',url:'chapters/08.html#model'}]});
validSearch.els['#search'].value='ANOVA';validSearch.els['#search'].events.input();
assert.equal(validSearch.els['#search-results'].children[1].children[0].href,'chapters/08.html#model');

function practiceFixture(raw,{denyRead=false,denyWrite=false}={}) {
  const els={},card=new Element('Test question'),app=new Element();
  card.id='p05-01';card.dataset={chapter:'05',level:'基础'};
  for(const key of ['.exercise-solution','.exercise-state','.bookmark','.answer-form','.answer-feedback','.answer-availability'])card.selectors[key]=new Element();
  const controls=[new Element(),new Element()];controls.forEach(e=>e.disabled=true);card.lists['.answer-form input, .answer-form button']=controls;
  app.lists['.exercise']=[card];els['#practice-app']=app;
  for(const name of ['storage','progress','meter','result-count','empty','search'])els['#practice-'+name]=new Element();
  for(const [name,values]of Object.entries({chapter:['all','05','07'],level:['all','基础'],status:['all','correct','review','unanswered']})) {
    const e=els['#practice-'+name]=new Element();e.options=values.map(value=>({value}));e.value='all';
  }
  app.lists['.study-toolbar input, .study-toolbar select']=['chapter','level','status','search'].map(n=>els['#practice-'+n]);
  for(const name of ['mixed-practice','all-practice'])els['#'+name]=new Element();
  els['#practice-grading']=new Element(JSON.stringify({'p05-01':{type:'numeric',answer:1,tolerance:.001}}));
  const document={querySelector:s=>els[s]||null,querySelectorAll:()=>[],createElement:()=>new Element()};
  const location=new URL('http://local.test/practice.html?chapter=07#p05-01');
  const storage=storageFixture(raw,denyRead,denyWrite);
  class FormDataFixture { constructor(form) { this.form=form; } get() { return this.form.answer; } }
  vm.runInNewContext(source('learning.mjs'),{document,localStorage:storage,location,history:{replaceState(state,title,href){location.href=href;}},window:{addEventListener(){}},URL,URLSearchParams,FormData:FormDataFixture,console});
  return {els,card,controls,storage};
}
for(const raw of ['{}','null','[]','{"p05-01":{"attempts":0,"correct":"false","bookmark":"false"}}','{"p05-01":{"attempts":"bad","correct":false}}','{"p05-01":{"attempts":{"toString":"invalid"},"correct":false}}']) {
  const r=practiceFixture(raw);
  assert.ok(r.controls.every(e=>!e.disabled));
  assert.match(r.els['#practice-progress'].textContent,/已练 0 \/ 1 题 · 当前答对 0/);
  assert.equal(r.card.selectors['.exercise-state'].textContent,'尚未作答');
  assert.equal(r.card.selectors['.bookmark'].attrs['aria-pressed'],'false');
  assert.equal(r.els['#practice-chapter'].value,'05');
  assert.equal(r.card.scrolled,true);
}
const healthy=practiceFixture('{"p05-01":{"attempts":3,"correct":false,"bookmark":true}}');
assert.equal(healthy.card.selectors['.exercise-state'].textContent,'待复习');
assert.equal(healthy.card.selectors['.bookmark'].attrs['aria-pressed'],'true');
const denied=practiceFixture(null,{denyRead:true,denyWrite:true});
assert.match(denied.els['#practice-storage'].textContent,/未能读取/);
const form=denied.card.selectors['.answer-form'];form.answer='1';
form.events.submit({currentTarget:form,preventDefault(){}});
assert.match(denied.els['#practice-storage'].textContent,/暂未保存|未能保存/);
assert.match(denied.card.selectors['.answer-feedback'].textContent,/答对/);
assert.match(denied.els['#practice-progress'].textContent,/当前答对 1/);
console.log('Malformed progress schemas, preserved valid records, startup/search/deep links and denied-storage interaction passed in isolated fixtures.');
