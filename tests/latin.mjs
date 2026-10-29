import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {inspectLatinSquare,permuteLatinSquare,latinRCode,latinExample,latinColumnTrap,mountLatinDesigner} from '../assets/latin.mjs';

assert.equal(inspectLatinSquare(latinExample).valid,true);
const trap=inspectLatinSquare(latinColumnTrap);
assert.equal(trap.valid,false);
assert.equal(trap.rows.filter(r=>r.valid).length,4);
assert.equal(trap.columns.filter(c=>c.valid).length,0);
assert.deepEqual(trap.columns[0].missing,['B','C','D']);
assert.deepEqual(trap.columns[0].repeated,['A']);
assert.ok(trap.conflicts.flat().every(Boolean));
const empty=Array.from({length:4},()=>Array(4).fill(''));
assert.equal(inspectLatinSquare(empty).filled,0);
assert.ok(inspectLatinSquare(empty).conflicts.flat().every(value=>!value));
for(const bad of [[],[['A']],Array(4).fill(['A','B','C','E']),Array(4).fill([null,'B','C','D'])])assert.throws(()=>inspectLatinSquare(bad));
assert.throws(()=>permuteLatinSquare(latinColumnTrap));

// Independently enumerate all row permutations and retain those with unique columns.
const permutations = values=>values.length?values.flatMap((v,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];
const rows=permutations(['A','B','C','D']);
let validCount=0;
for(const a of rows)for(const b of rows)for(const c of rows)for(const d of rows){
  if(![0,1,2,3].every(i=>new Set([a[i],b[i],c[i],d[i]]).size===4))continue;
  const grid=[a,b,c,d];validCount++;
  assert.equal(inspectLatinSquare(grid).valid,true);
  for(let r=0;r<4;r++)for(let col=0;col<4;col++){
    const broken=grid.map(row=>[...row]);broken[r][col]=broken[r][(col+1)%4];
    assert.equal(inspectLatinSquare(broken).valid,false);
    assert.equal(inspectLatinSquare(broken).conflicts[r][col],true);
  }
}
assert.equal(validCount,576);
const original=JSON.stringify(latinExample),rCases=[latinExample,latinColumnTrap,empty];
for(let seed=440;seed<1440;seed++){
  const p=permuteLatinSquare(latinExample,seed);
  assert.deepEqual(p,permuteLatinSquare(latinExample,seed));
  assert.equal(inspectLatinSquare(p.grid).valid,true);
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)assert.equal(p.grid[r][c],p.labels[latinExample[p.rows[r]][p.columns[c]]]);
  if(seed<450)rCases.push(p.grid);
}
assert.equal(JSON.stringify(latinExample),original);
for(const grid of rCases){
  const expected=inspectLatinSquare(grid);
  const r=latinRCode(grid)+`\nstopifnot(identical(valid,${expected.valid?'TRUE':'FALSE'}))\nstopifnot(sum(!is.na(layout))==${expected.filled})`;
  execFileSync('Rscript',['--vanilla','-e','options(warn=2)\n'+r],{encoding:'utf8'});
}

// A small DOM fixture executes the real mount. Browser checks cover actual layout.
const attrs=s=>Object.fromEntries([...s.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(m=>[m[1],m[2]??'']));
class Element{
  constructor(tag,attributes={}){this.tag=tag;this.attrs=attributes;this.value='';this.disabled=false;this.listeners={};this.dataset={};}
  set innerHTML(v){this.markup=v;}get innerHTML(){return this.markup;}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
  addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
  emit(event){for(const fn of this.listeners[event]??[])fn();}
  matches(selector){const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m?Object.hasOwn(this.attrs,m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]):selector===this.tag;}
}
class Root extends Element{
  constructor(){super('section');this.classList={add(){}};}
  set innerHTML(markup){
    this.markup=markup;
    this.nodes=[...markup.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)].map(m=>new Element(m[1],attrs(m[2])));
    for(const match of markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)){
      const a=attrs(match[1]),selected=match[2].match(/<option value="([^"]*)" selected/);
      this.querySelector(`[data-latin-cell="${a['data-latin-cell']}"]`).value=selected?selected[1]:'';
    }
  }
  querySelectorAll(selector){return this.nodes.filter(n=>n.matches(selector));}
  querySelector(selector){const n=this.querySelectorAll(selector)[0];assert.ok(n,selector);return n;}
}
const root=new Root();mountLatinDesigner(root);const $=selector=>root.querySelector(selector),cells=root.querySelectorAll('[data-latin-cell]');
assert.equal(cells.length,16);assert.equal(root.dataset.ready,'true');
const first=cells[0];mountLatinDesigner(root);assert.equal(root.querySelectorAll('[data-latin-cell]')[0],first);assert.equal(first.listeners.input.length,1);
const button=name=>$(`[data-latin-action="${name}"]`);
button('trap').emit('click');assert.match($('[data-latin-result]').textContent,/4 \/ 4 行、0 \/ 4 列/);assert.equal(button('randomize').disabled,true);assert.ok(cells.every(c=>c.getAttribute('aria-invalid')==='true'));
assert.match($('[data-latin-df]').textContent,/不能直接套用/);
button('clear').emit('click');assert.ok(cells.every(c=>c.value===''));assert.match($('[data-latin-result]').textContent,/0 \/ 16/);
cells.forEach((cell,i)=>{cell.value=latinExample[Math.floor(i/4)][i%4];cell.emit('input');});
assert.equal(button('randomize').disabled,false);assert.match($('[data-latin-result]').textContent,/排列合法/);assert.match($('[data-latin-df]').textContent,/error 6 df/);
button('randomize').emit('click');assert.match($('[data-latin-trace]').textContent,/Seed=441/);assert.deepEqual(cells.map(c=>c.value),permuteLatinSquare(latinExample,441).grid.flat());
assert.match($('[data-latin-code]').textContent,/latin_square=valid/);
button('reset').emit('click');assert.deepEqual(cells.map(c=>c.value),latinExample.flat());assert.match($('[data-latin-trace]').textContent,/尚未执行随机化/);
button('randomize').emit('click');assert.match($('[data-latin-trace]').textContent,/Seed=441/);
console.log('All 576 Latin squares, 9216 one-cell errors, 1000 reproducible permutations, 13 independent R layouts and mounted editing/reset/repair states passed.');
