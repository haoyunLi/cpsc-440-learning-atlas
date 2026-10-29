import { seeded } from './math.mjs';

export const latinTreatments = ['A','B','C','D'];
export const latinExample = latinTreatments.map((_, r) => latinTreatments.map((_, c) => latinTreatments[(r+c)%4]));
export const latinColumnTrap = Array.from({length:4}, () => [...latinTreatments]);

export function inspectLatinSquare(grid) {
  if (!Array.isArray(grid) || grid.length !== 4 || grid.some(row => !Array.isArray(row) || row.length !== 4 || row.some(value => value !== '' && !latinTreatments.includes(value)))) throw new RangeError('请用空格或 A–D 填写 4×4 方阵。');
  const inspect = values => {
    const counts = Object.fromEntries(latinTreatments.map(t => [t, values.filter(v => v===t).length]));
    return {counts, missing:latinTreatments.filter(t=>counts[t]===0), repeated:latinTreatments.filter(t=>counts[t]>1), valid:latinTreatments.every(t=>counts[t]===1)};
  };
  const rows=grid.map(inspect), columns=latinTreatments.map((_,c)=>inspect(grid.map(row=>row[c])));
  const filled=grid.flat().filter(Boolean).length;
  const conflicts=grid.map((row,r)=>row.map((value,c)=>value!=='' && (rows[r].counts[value]>1 || columns[c].counts[value]>1)));
  return {filled,rows,columns,conflicts,valid:rows.every(r=>r.valid)&&columns.every(c=>c.valid)};
}

export function permuteLatinSquare(grid, seed=441) {
  if (!inspectLatinSquare(grid).valid) throw new RangeError('先完成一个每行、每列都含 A–D 的合法方阵。');
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError('Seed 应是非负整数。');
  const rng=seeded(seed);
  const shuffle=items=>{
    const result=[...items];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  };
  const rows=shuffle([0,1,2,3]),columns=shuffle([0,1,2,3]);
  const labels=Object.fromEntries(latinTreatments.map((name,i)=>[name,i]));
  const names=shuffle(latinTreatments);
  for(const name of latinTreatments)labels[name]=names[labels[name]];
  return {grid:rows.map(r=>columns.map(c=>labels[grid[r][c]])),rows,columns,labels,seed};
}

export function latinRCode(grid) {
  inspectLatinSquare(grid);
  const values=grid.flat().map(value=>value ? `"${value}"` : 'NA_character_');
  return `# Current teaching layout: one independently treated tray per cell.
# Check the realized layout; no random-number generator is needed here.
layout <- matrix(c(${values.join(',')}), nrow=4, byrow=TRUE,
                 dimnames=list(paste0("R",1:4),paste0("C",1:4)))
treatments <- c("A","B","C","D")
print(layout)
counts <- function(x) table(factor(x,levels=treatments))
print(t(apply(layout,1,counts)))
print(t(apply(layout,2,counts)))
valid_line <- function(x) !anyNA(x) && all(counts(x)==1)
row_ok <- apply(layout,1,valid_line)
column_ok <- apply(layout,2,valid_line)
valid <- all(row_ok) && all(column_ok)
print(list(rows_valid=row_ok,columns_valid=column_ok,latin_square=valid))
# These degrees of freedom require a complete additive Latin-square model.
if (valid) print(c(treatment_df=3,row_df=3,column_df=3,error_df=6,total_df=15))
# Layout validity does not verify independence, normality or additivity.
# No responses have been measured, so this code does not run an ANOVA.`;
}

export function mountLatinDesigner(root) {
  if(root.dataset.ready)return;
  root.classList.add('latin-designer');
  root.innerHTML=`<p>原创设计任务：四种育苗处理 A–D，行是四个位置带，列是四个播种批次；每格是一盘单独接受处理的育苗盘。把每种处理安排成<b>每行一次、每列一次</b>。先修复错误例，再试着从空表构建。</p>
    <div class="table-scroll latin-table" tabindex="0" role="region" aria-label="可编辑的四乘四 Latin square"><table><caption>行 R：位置带 · 列 C：批次 · 单元格：处理</caption><thead><tr><th scope="col">R / C</th>${[1,2,3,4].map(c=>`<th scope="col">C${c}</th>`).join('')}</tr></thead><tbody>${latinExample.map((row,r)=>`<tr><th scope="row">R${r+1}</th>${row.map((value,c)=>`<td><select data-latin-cell="${r}-${c}" aria-label="行 ${r+1} 列 ${c+1} 的处理"><option value="">空</option>${latinTreatments.map(t=>`<option value="${t}"${value===t?' selected':''}>${t}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="lab-actions"><button type="button" data-latin-action="clear">清空后自己排</button><button type="button" class="secondary" data-latin-action="trap">载入只有行正确的例子</button><button type="button" class="secondary" data-latin-action="reset">恢复合法示例</button><button type="button" class="secondary" data-latin-action="randomize">合法随机化</button></div>
    <p class="readout" data-latin-result role="status" aria-live="polite"></p>
    <p class="status">有重复的格子使用浅棕底，并在下方列出具体行列；空格也需要补齐。表格只检查排列约束，不能证明模型条件成立。</p>
    <div class="latin-checks"><div><h4>逐行检查</h4><ul data-latin-rows></ul></div><div><h4>逐列检查</h4><ul data-latin-columns></ul></div></div>
    <p data-latin-df></p><p class="status" data-latin-trace></p>
    <details><summary>为什么要整行、整列与处理名称一起置换？</summary><p>合法置换分别打乱行顺序、列顺序和 A–D 的名称对应，原有的“各一次”规则仍成立。每格各自抽字母不保证这个结构；每行独立洗牌也可能造成同列重复。</p><p>按钮从当前合法方阵出发，使用可复现的示例随机数。它不保证在所有 4×4 Latin squares 中均匀抽样。实际实验还应按设计允许的范围随机分配实际单位和运行顺序；满足排列规则的手工表并不等于已经实施随机化。</p></details>
    <details><summary>用当前排列在 R 中检查</summary><button type="button" class="secondary" data-latin-copy>复制当前 R 代码</button><pre data-latin-code></pre><p class="status" data-latin-copy-status role="status"></p></details>
    <p><a href="#latin-square">阅读模型与设计条件</a> · <a href="#latin-square-worked">继续计算完整 ANOVA</a></p>`;
  const $=selector=>root.querySelector(selector),inputs=[...root.querySelectorAll('[data-latin-cell]')];
  let seed=440,trace='当前为固定示例，尚未执行随机化。';
  const grid=()=>Array.from({length:4},(_,r)=>inputs.slice(r*4,r*4+4).map(input=>input.value));
  const describe=(line,index)=>line.valid?`${index+1}：A–D 各一次 ✓`:`${index+1}：${[line.repeated.length?`重复 ${line.repeated.map(t=>`${t}×${line.counts[t]}`).join('、')}`:'',line.missing.length?`缺少 ${line.missing.join('、')}`:''].filter(Boolean).join('；')}`;
  function update(){
    const current=grid(),result=inspectLatinSquare(current);
    inputs.forEach((input,i)=>input.setAttribute('aria-invalid',String(result.conflicts[Math.floor(i/4)][i%4])));
    $('[data-latin-result]').textContent=result.valid?'排列合法：每个处理在每行、每列都恰好出现一次。':`已填 ${result.filled} / 16 格；${result.rows.filter(x=>x.valid).length} / 4 行、${result.columns.filter(x=>x.valid).length} / 4 列合格。请根据下方检查继续调整。`;
    $('[data-latin-rows]').innerHTML=result.rows.map((line,i)=>`<li>行 ${describe(line,i)}</li>`).join('');
    $('[data-latin-columns]').innerHTML=result.columns.map((line,i)=>`<li>列 ${describe(line,i)}</li>`).join('');
    $('[data-latin-df]').textContent=result.valid?'完整加性 Latin square 模型：N=16，treatment、row、column 各 3 df，error 6 df，total 15 df。每 cell 一个观测，不能分别估计重要的交互；误差独立等条件仍需设计依据。':'当前不是完整合法的 Latin square，不能直接套用平衡 Latin square 的 SS 与 error df 公式。先修复排列；缺失观测后的分析另需相应模型。';
    $('[data-latin-action="randomize"]').disabled=!result.valid;
    $('[data-latin-trace]').textContent=trace;
    $('[data-latin-code]').textContent=latinRCode(current);
    $('[data-latin-copy-status]').textContent='';
  }
  function setGrid(values){inputs.forEach((input,i)=>input.value=values[Math.floor(i/4)][i%4]);update();}
  inputs.forEach(input=>input.addEventListener('input',()=>{trace='当前为手动编辑的排列；随机化应在实验实施前按设计记录。';update();}));
  $('[data-latin-action="clear"]').addEventListener('click',()=>{trace='任务：从空表构建一个合法方阵。';setGrid(Array.from({length:4},()=>Array(4).fill('')));});
  $('[data-latin-action="trap"]').addEventListener('click',()=>{trace='任务：每行都正确，为什么仍不是 Latin square？修改各行，使每列也满足约束。';setGrid(latinColumnTrap);});
  $('[data-latin-action="reset"]').addEventListener('click',()=>{seed=440;trace='当前为固定示例，尚未执行随机化。';setGrid(latinExample);});
  $('[data-latin-action="randomize"]').addEventListener('click',()=>{
    if(!inspectLatinSquare(grid()).valid)return;
    const result=permuteLatinSquare(grid(),++seed);
    trace=`Seed=${seed}。新行 R1–R4 分别取原行 ${result.rows.map(r=>r+1).join('、')}；新列 C1–C4 分别取原列 ${result.columns.map(c=>c+1).join('、')}；处理名称 ${latinTreatments.map(t=>`${t}→${result.labels[t]}`).join('、')}。这里的“原”指点击前的排列。`;
    setGrid(result.grid);
  });
  $('[data-latin-copy]').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('[data-latin-code]').textContent);$('[data-latin-copy-status]').textContent='已复制当前排列的 R 检查代码。';}
    catch{$('[data-latin-copy-status]').textContent='请选中上方完整代码复制。';}
  });
  update();root.dataset.ready='true';
}
