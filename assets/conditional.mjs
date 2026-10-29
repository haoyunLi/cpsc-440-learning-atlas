export const conditionalExamples = {
  original: [[18,12,10],[42,88,30]],
  independent: [[12,20,8],[48,80,32]]
};

export function contingencySummary(counts, row = 0, column = 0) {
  if (!Array.isArray(counts) || counts.length !== 2 || counts.some(r => !Array.isArray(r) || r.length !== 3 || r.some(n => !Number.isInteger(n) || n < 0 || n > 10000))) throw new RangeError('六个频数都应是 0–10000 的整数；空白不能自动当作 0。');
  if (![0,1].includes(row) || ![0,1,2].includes(column)) throw new RangeError('请选择表内的事件。');
  const rows = counts.map(r => r.reduce((s, n) => s + n, 0));
  const columns = counts[0].map((_, c) => counts[0][c] + counts[1][c]);
  const total = rows[0] + rows[1];
  if (!total) throw new RangeError('总数为 0，没有记录可供抽取；请至少输入一个正频数。');
  const intersection = counts[row][column], A = rows[row], B = columns[column];
  return { rows, columns, total, A, B, intersection, pA:A/total, pB:B/total, joint:intersection/total,
    aGivenB:B ? intersection/B : null, bGivenA:A ? intersection/A : null,
    // Integer cross products avoid rounding two unequal probabilities to equality.
    independent:intersection*total === A*B };
}

export function conditionalRCode(counts, row=0, column=0) {
  contingencySummary(counts,row,column);
  return `# Uniformly select one record from this finite contingency table.
counts <- matrix(c(${counts.flat().join(',')}), nrow=2, byrow=TRUE,
                 dimnames=list(c("fraud","nonfraud"),c("fire","auto","theft")))
row <- ${row+1}
column <- ${column+1}
N <- sum(counts)
A <- sum(counts[row,])
B <- sum(counts[,column])
intersection <- counts[row,column]
print(addmargins(counts))
# A zero conditioning count gives an undefined conditional probability.
print(c(P_A=A/N, P_B=B/N, joint=intersection/N,
        A_given_B=if(B>0) intersection/B else NA_real_,
        B_given_A=if(A>0) intersection/A else NA_real_))
# Exact identity for this finite table, not a population significance test.
print(c(independent_in_this_table=intersection*N==A*B))`;
}

const rowNames = ['fraud（欺诈）','nonfraud（非欺诈）'];
const columnNames = ['fire（火险）','auto（车险）','theft（盗窃险）'];
const shortColumns = ['fire','auto','theft'];
export const conditionalProbabilityLabel = value => value === null ? '未定义' : value > 0 && value < .0001 ? value.toExponential(3) : value < 1 && value > .9999 ? value.toPrecision(7) : value.toFixed(4);
const probability = conditionalProbabilityLabel;

export function mountConditionalLab(root) {
  if (root.dataset.ready) return;
  root.classList.add('wbench');
  root.innerHTML = `<p>从下面有限记录中<b>等概率抽一条</b>。先选两个事件，再限定“已知”的范围。本实验的概率描述这张表定义的抽签模型；它不是对更大总体做独立性显著检验。</p>
    <div class="conditional-table table-scroll" tabindex="0" role="region" aria-label="可编辑保险频数表，可横向滚动"><table><caption>原创频数表 · 每条记录恰属一个行类别与一个保险类型</caption><thead><tr><th scope="col">记录类别</th>${columnNames.map(name=>`<th scope="col">${name}</th>`).join('')}<th scope="col">行合计</th></tr></thead><tbody>${rowNames.map((name,r)=>`<tr><th scope="row">${name}</th>${shortColumns.map((_,c)=>`<td><input type="number" min="0" max="10000" step="1" inputmode="numeric" data-count="${r}-${c}" aria-label="${name} / ${columnNames[c]} 的频数" value="${conditionalExamples.original[r][c]}"></td>`).join('')}<td data-row-total="${r}"></td></tr>`).join('')}<tr><th scope="row">列合计</th>${shortColumns.map((_,c)=>`<td data-column-total="${c}"></td>`).join('')}<td data-grand-total></td></tr></tbody></table></div>
    <div class="wbench-actions"><button type="button" data-conditional-preset="original">恢复原创表</button><button type="button" data-conditional-preset="independent" class="secondary">加载同边际的独立例</button></div>
    <p class="wbench-note">两个预设都含 200 条记录、40 条 fraud，各保险类型总数也相同；它们的交集不同。编辑频数可以改变这些总数。0 是合法频数；空白与小数不是频数。</p>
    <div class="wbench-controls"><label>事件 A · 行类别<select data-conditional-row>${rowNames.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label>事件 B · 保险类型<select data-conditional-column>${columnNames.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label class="conditional-direction">已知什么？<select data-conditional-direction><option value="B">已知 B：在 B 内找 A，P(A | B)</option><option value="A">已知 A：在 A 内找 B，P(B | A)</option></select></label></div>
    <p class="wbench-error" data-conditional-error role="alert"></p><div class="wbench-result" data-conditional-result aria-live="polite"></div>
    <figure class="conditional-figure"><svg viewBox="0 0 660 290" role="img" aria-label="列联表面积图"></svg><figcaption>整块矩形代表全部记录。列宽按各保险类型总数分配，每列上块是 fraud、下块是 nonfraud，高度按各自在该列内的比例分配；因此每格面积代表联合概率。深绿斜纹是 A∩B，浅绿是条件集合内的其余记录，灰色不在本次条件集合中。</figcaption></figure>
    <div class="conditional-probabilities" data-conditional-probabilities></div><p data-conditional-independence></p>
    <details><summary>用当前表与事件在 R 中复现</summary><button type="button" class="secondary" data-conditional-copy>复制当前 R 代码</button><pre class="wbench-code" data-conditional-code></pre><p class="status" data-conditional-copy-status role="status"></p></details>
    <p><a href="chapters/04.html#conditional">回到完整表格、双向条件概率与独立性的手算 →</a></p>`;
  const $ = selector => root.querySelector(selector);
  const inputs = [...root.querySelectorAll('[data-count]')];
  function update() {
    try {
      const flat = inputs.map(input => {
        const raw = input.value.trim();
        if (!/^\d+$/.test(raw)) throw new RangeError('六个频数都应是 0–10000 的整数；空白不能自动当作 0。');
        return Number(raw);
      });
      const counts = [flat.slice(0,3),flat.slice(3)], row=Number($('[data-conditional-row]').value), column=Number($('[data-conditional-column]').value);
      const s = contingencySummary(counts,row,column), direction=$('[data-conditional-direction]').value;
      const denominator = direction==='B' ? s.B : s.A, answer=direction==='B' ? s.aGivenB : s.bGivenA;
      const givenName=direction==='B' ? columnNames[column] : rowNames[row], targetName=direction==='B' ? rowNames[row] : columnNames[column];
      $('[data-conditional-error]').textContent='';
      $('[data-conditional-code]').textContent=conditionalRCode(counts,row,column);
      $('[data-conditional-copy]').disabled=false;
      $('[data-conditional-copy-status]').textContent='';
      s.rows.forEach((n,r)=>$(`[data-row-total="${r}"]`).textContent=String(n));
      s.columns.forEach((n,c)=>$(`[data-column-total="${c}"]`).textContent=String(n));
      $('[data-grand-total]').textContent=String(s.total);
      $('[data-conditional-result]').innerHTML=`<strong>${direction==='B' ? 'P(A | B)' : 'P(B | A)'} = ${denominator ? `${s.intersection} / ${denominator} = ${probability(answer)}` : '未定义（条件集合为空）'}</strong><span>① 原来有 ${s.total} 条记录。② 已知 ${givenName}，只保留 ${denominator} 条。③ 其中满足 ${targetName} 的有 ${s.intersection} 条。</span><span>${denominator ? `分母是条件集合的 ${denominator}，不自动等于总数 ${s.total}；交集仍为同一个 ${s.intersection}。` : 'P(已知事件)=0，条件概率公式不能除以 0；未定义不等于概率为 0。'}</span>`;
      $('[data-conditional-probabilities]').innerHTML=`<div><b>边际 marginal</b><span>P(A)=${s.A}/${s.total}=${probability(s.pA)}</span><span>P(B)=${s.B}/${s.total}=${probability(s.pB)}</span></div><div><b>联合 joint</b><span>P(A∩B)=${s.intersection}/${s.total}=${probability(s.joint)}</span><span>两个条件同时满足</span></div><div><b>两个方向</b><span>P(A | B)=${s.B ? `${s.intersection}/${s.B}=` : ''}${probability(s.aGivenB)}</span><span>P(B | A)=${s.A ? `${s.intersection}/${s.A}=` : ''}${probability(s.bGivenA)}</span></div>`;
      $('[data-conditional-independence]').textContent=`对本表的抽签模型：交集计数×总数=${s.intersection*s.total}，A总数×B总数=${s.A*s.B}，${s.independent ? '二者相等，所以这两个事件独立' : '二者不等，所以这两个事件不独立'}。等价于核对 P(A∩B) 与 P(A)P(B)，不对显示后四舍五入的数字判等。${!s.A||!s.B ? '这里含概率为0的事件，独立等式可以成立，但以该事件为条件的概率仍未定义。' : ''}`;
      let svg='<defs><pattern id="conditional-intersection" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="white" stroke-width="1"/></pattern></defs>';
      let left=24;
      s.columns.forEach((n,c)=>{
        const width=612*n/s.total, upper=n ? 220*counts[0][c]/n : 0;
        if (width>0) {
          [0,1].forEach(r=>{
            const y=42+(r ? upper : 0),height=r ? 220-upper : upper;
            const numerator=r===row&&c===column, included=direction==='B' ? c===column : r===row;
            const color=numerator ? '#086f68' : included ? '#bbd8ca' : '#e7e8e3';
            svg+=`<rect x="${left}" y="${y}" width="${width}" height="${height}" fill="${color}" stroke="white" stroke-width="2"><title>${rowNames[r]} / ${columnNames[c]}：${counts[r][c]} 条，面积概率 ${counts[r][c]}/${s.total}；${numerator ? '交集' : included ? '条件集合内' : '条件集合外'}</title></rect>`;
            if (numerator&&height>0) svg+=`<rect x="${left}" y="${y}" width="${width}" height="${height}" fill="url(#conditional-intersection)"/>`;
            if (width>=90&&height>=35) svg+=`<text x="${left+width/2}" y="${y+height/2+6}" text-anchor="middle" class="conditional-chart-label" fill="${numerator ? '#fff' : '#183a37'}">${counts[r][c]}</text>`;
          });
          if(width>=70)svg+=`<text x="${left+width/2}" y="27" text-anchor="middle" class="conditional-chart-label">${shortColumns[c]}</text>`;
        }
        left+=width;
      });
      svg+='<rect x="24" y="42" width="612" height="220" fill="none" stroke="#698077"/>';
      $('svg').innerHTML=svg;
      $('svg').setAttribute('aria-label',`全部${s.total}条记录；已知${givenName}后保留${denominator}条，其中交集${s.intersection}条；条件概率${probability(answer)}。完整数值见频数表与结果。`);
    } catch(error) {
      $('[data-conditional-error]').textContent=error.message;
      $('[data-conditional-result]').textContent='等待有效频数。';
      $('[data-conditional-probabilities]').textContent='';
      $('[data-conditional-independence]').textContent='';
      $('[data-conditional-code]').textContent='';$('[data-conditional-copy]').disabled=true;
      $('[data-conditional-copy-status]').textContent='';
      root.querySelectorAll('[data-row-total],[data-column-total],[data-grand-total]').forEach(el=>el.textContent='—');
      $('svg').replaceChildren();$('svg').setAttribute('aria-label','等待有效频数。');
    }
  }
  root.querySelectorAll('input,select').forEach(input=>input.addEventListener('input',update));
  root.querySelectorAll('[data-conditional-preset]').forEach(button=>button.addEventListener('click',()=>{
    const values=conditionalExamples[button.dataset.conditionalPreset].flat();
    inputs.forEach((input,i)=>input.value=String(values[i]));update();
  }));
  $('[data-conditional-copy]').addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText($('[data-conditional-code]').textContent);$('[data-conditional-copy-status]').textContent='已复制当前表与事件的 R 代码。'; }
    catch { $('[data-conditional-copy-status]').textContent='自动复制不可用；请选中上面的完整代码复制。'; }
  });
  update();root.dataset.ready='true';
}

if(typeof document!=='undefined')document.querySelectorAll('[data-conditional-lab]').forEach(mountConditionalLab);
