// Diagrams advance only after an explicit reader action. Static HTML is complete.
const hosts=[...document.querySelectorAll('[data-walkthrough]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const decode=s=>{const t=document.createElement('textarea');t.innerHTML=s;return t.value;};
function mount(host,walk){
  let index=0,timer=null;
  const scene=host.querySelector('.scene'),counter=host.querySelector('.step-counter');
  const caption=host.querySelector('.step-caption'),equation=host.querySelector('.step-equation');
  const controls=host.querySelector('.walk-controls');
  function button(label,action,secondary=true){
    const b=document.createElement('button');b.type='button';b.textContent=label;
    if(secondary)b.className='secondary';b.addEventListener('click',action);controls.append(b);return b;
  }
  const prev=button('上一步',()=>{stop();show(index-1);});
  const next=button('下一步',()=>{stop();show(index+1);},false);
  const play=button('自动演示',()=>{
    if(timer){stop();return;}
    if(reduced.matches)return;
    if(index===walk.frames.length-1)show(0);
    play.textContent='暂停演示';play.setAttribute('aria-pressed','true');
    timer=setInterval(()=>{show(index+1);if(index===walk.frames.length-1)stop();},4200);
  });
  button('回到第一步',()=>{stop();show(0);});
  const note=document.createElement('p');note.className='motion-note';host.querySelector('figcaption').before(note);
  play.setAttribute('aria-pressed','false');
  function stop(){clearInterval(timer);timer=null;play.textContent='自动演示';play.setAttribute('aria-pressed','false');}
  function motion(){
    if(reduced.matches)stop();play.disabled=reduced.matches;
    note.textContent=reduced.matches?'已按减少动态偏好关闭自动演示；仍可手动逐步查看。':'每一步停留约 4 秒。可随时暂停，或使用上一步、下一步阅读。';
  }
  function show(value){
    index=Math.max(0,Math.min(walk.frames.length-1,value));
    const f=walk.frames[index];scene.innerHTML=f.svg;host.querySelector('.zoom-scene').innerHTML=f.svg;
    counter.textContent=`第 ${index+1} / ${walk.frames.length} 步`;
    caption.textContent=decode(f.caption);equation.textContent=decode(f.equation);
    prev.disabled=index===0;next.disabled=index===walk.frames.length-1;
    host.dataset.step=String(index+1);
  }
  reduced.addEventListener('change',motion);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();}).observe(host);
  motion();show(0);
}
if(hosts.length){
  const source=new URL('../content/walkthroughs.json',import.meta.url);source.searchParams.set('v',hosts[0].dataset.diagramVersion);
  fetch(source).then(r=>{
    if(!r.ok)throw Error('Step diagrams unavailable');return r.json();
  }).then(walks=>{for(const host of hosts){const w=walks.find(w=>w.id===host.dataset.walkthrough);if(w)mount(host,w);}}).catch(()=>{
    for(const host of hosts)host.querySelector('.step-counter').textContent='分步控制未载入；完整图与下方所有步骤仍可阅读。';
  });
}
