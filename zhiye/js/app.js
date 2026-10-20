/* ============================================================
 *  职业兴趣与性格测评 —— 交互逻辑
 *  AI Coding 流程中的「代码生成 → 反馈优化」产物
 * ============================================================ */

const ANSWERS = new Array(QUESTIONS.length).fill(null);
let current = 0;
let startTime = 0;

const $ = id => document.getElementById(id);
const STORE_KEY = 'career_test_history_v1';

/* ---------------- 页面切换 ---------------- */
function show(sectionId) {
  ['intro', 'quiz', 'result'].forEach(id => {
    $(id).classList.toggle('active', id === sectionId);
    $(id).hidden = id !== sectionId;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- 初始化 ---------------- */
function init() {
  renderIntroDims();
  renderAnswerSheet();
  bindEvents();
  renderHistory();
  show('intro');
}

function renderIntroDims() {
  $('dimGrid').innerHTML = DIMENSIONS.map(d => `
    <div class="dim-card" style="--accent:${d.color}">
      <div class="dim-icon">${d.icon}</div>
      <h4>${d.short} · ${d.name}</h4>
      <p class="dim-en">${d.en}</p>
      <p>${d.summary}</p>
    </div>`).join('');
}

function renderAnswerSheet() {
  $('answerSheet').innerHTML = QUESTIONS.map((q, i) =>
    `<button class="sheet-item" data-i="${i}" title="第 ${i + 1} 题">${i + 1}</button>`).join('');
  $('answerSheet').addEventListener('click', e => {
    const btn = e.target.closest('.sheet-item');
    if (btn) goTo(Number(btn.dataset.i));
  });
}

function bindEvents() {
  $('btnStart').addEventListener('click', () => {
    startTime = Date.now();
    show('quiz');
    renderQuestion();
  });
  $('btnPrev').addEventListener('click', () => goTo(current - 1));
  $('btnNext').addEventListener('click', () => {
    if (ANSWERS[current] === null) return toast('请先选择一个符合程度的选项');
    if (current === QUESTIONS.length - 1) return finish();
    goTo(current + 1);
  });
  $('btnRestart').addEventListener('click', () => {
    ANSWERS.fill(null);
    current = 0;
    const box = $('analysisBox');
    if (box) box.classList.remove('show');
    refreshSheet();
    show('intro');
    toast('已清空作答，可以重新开始');
  });
  $('btnResultRestart').addEventListener('click', () => {
    ANSWERS.fill(null);
    current = 0;
    show('quiz');
    renderQuestion();
  });
  $('btnExport').addEventListener('click', exportReport);
  $('btnCopy').addEventListener('click', copyReport);
  $('btnPrint').addEventListener('click', () => window.print());
  $('btnClearHistory').addEventListener('click', () => {
    localStorage.removeItem(STORE_KEY);
    renderHistory();
    toast('历史记录已清空');
  });
  window.addEventListener('resize', () => {
    if ($('result').classList.contains('active')) drawCharts(lastResult);
  });
}

/* ---------------- 答题流程 ---------------- */
function goTo(i) {
  if (i < 0 || i >= QUESTIONS.length) return;
  current = i;
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[current];
  const idx = current;
  const pct = ((idx) / QUESTIONS.length) * 100;
  $('progressBar').style.width = `${(ANSWERS.filter(a => a !== null).length / QUESTIONS.length) * 100}%`;
  $('progressText').textContent = `第 ${idx + 1} / ${QUESTIONS.length} 题`;
  $('progressPct').textContent =
    `${Math.round((ANSWERS.filter(a => a !== null).length / QUESTIONS.length) * 100)}%`;

  const dim = DIMENSIONS.find(d => d.key === q.dim);
  $('questionCard').innerHTML = `
    <div class="q-meta">
      <span class="chip" style="--accent:${dim.color}">${dim.icon} ${dim.short} · ${dim.name}</span>
      <span class="q-idx">#${String(q.id).padStart(2, '0')}</span>
    </div>
    <h3 class="q-text">${idx + 1}. ${q.text}</h3>
    <div class="options">
      ${SCALE.map(s => `
        <label class="option ${ANSWERS[idx] === s.value ? 'selected' : ''}" data-v="${s.value}">
          <input type="radio" name="q${idx}" value="${s.value}" ${ANSWERS[idx] === s.value ? 'checked' : ''}>
          <span class="opt-dot"></span>
          <span class="opt-label">${s.label}</span>
          <span class="opt-score">${s.value}</span>
        </label>`).join('')}
    </div>
    <div class="analysis-box ${ANSWERS[idx] !== null ? 'show' : ''}" id="analysisBox">
      <div class="analysis-head">💡 本题解析</div>
      <p>${q.analysis}</p>
    </div>
  `;

  $('questionCard').querySelectorAll('.option').forEach(el => {
    el.addEventListener('click', () => {
      ANSWERS[idx] = Number(el.dataset.v);
      renderQuestion();
      if (idx < QUESTIONS.length - 1) {
        setTimeout(() => goTo(idx + 1), 260);
      }
    });
  });

  $('btnPrev').disabled = idx === 0;
  $('btnNext').textContent = idx === QUESTIONS.length - 1 ? '查看测评报告' : '下一题 →';
  $('btnNext').className = idx === QUESTIONS.length - 1 ? 'btn btn-primary btn-finish' : 'btn btn-primary';
  refreshSheet();
}

function refreshSheet() {
  document.querySelectorAll('.sheet-item').forEach((b, i) => {
    b.classList.toggle('answered', ANSWERS[i] !== null);
    b.classList.toggle('current', i === current);
  });
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ---------------- 计分与结果 ---------------- */
function compute() {
  const raw = {};
  DIMENSIONS.forEach(d => (raw[d.key] = 0));
  const traitSum = { EXT: [], CON: [] };

  QUESTIONS.forEach((q, i) => {
    const v = ANSWERS[i] || 0;
    raw[q.dim] += v;
    if (q.trait) traitSum[q.trait].push(v);
  });

  const scores = DIMENSIONS.map(d => {
    const norm = Math.round(((raw[d.key] - 5) / 20) * 100); // 5 题，5~25 分 → 0~100
    return { ...d, raw: raw[d.key], value: Math.max(0, Math.min(100, norm)) };
  }).sort((a, b) => b.value - a.value);

  const traits = TRAITS.map(t => {
    const arr = traitSum[t.key];
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 3;
    return { ...t, value: Math.round(((avg - 1) / 4) * 100) };
  });

  const top3 = scores.slice(0, 3);
  const code = top3.map(s => s.short).join('');
  const combo = COMBO_TEXT[top3[0].short + top3[1].short] ||
    COMBO_TEXT[top3[1].short + top3[0].short] ||
    `${top3[0].name}与${top3[1].name}的组合较为少见，你的优势更接近${top3[0].name}方向。`;

  // 职业匹配：按维度得分加权
  const careers = CAREERS.map(c => {
    const score = c.match.reduce((sum, key, rank) => {
      const dim = scores.find(s => s.short === key);
      return sum + dim.value * (3 - rank); // 第一位权重 3，第二位 2，第三位 1
    }, 0);
    return { ...c, score: Math.round(score / 6) };
  }).sort((a, b) => b.score - a.score).slice(0, 6);

  const seconds = Math.round((Date.now() - startTime) / 1000);

  return {
    date: new Date().toLocaleString('zh-CN', { hour12: false }),
    scores, traits, top3, code, combo, careers,
    seconds,
    answers: [...ANSWERS]
  };
}

let lastResult = null;

function finish() {
  if (ANSWERS.some(a => a === null)) {
    const first = ANSWERS.findIndex(a => a === null);
    goTo(first);
    return toast('还有未作答的题目，已跳转到第 ' + (first + 1) + ' 题');
  }
  lastResult = compute();
  saveHistory(lastResult);
  renderResult(lastResult);
  show('result');
  requestAnimationFrame(() => drawCharts(lastResult));
}

function renderResult(r) {
  const [t1, t2, t3] = r.top3;
  $('resultHero').innerHTML = `
    <div class="code-badge">
      <span class="code-letter" style="--c:${t1.color}">${t1.short}</span>
      <span class="code-letter" style="--c:${t2.color}">${t2.short}</span>
      <span class="code-letter" style="--c:${t3.color}">${t3.short}</span>
    </div>
    <div class="result-title">
      <h2>你的职业兴趣代码：<b>${r.code}</b></h2>
      <p class="combo">${r.combo}</p>
      <p class="result-sub">主导类型 ${t1.icon} ${t1.name} · 辅助类型 ${t2.name} · ${t3.name}
         ｜ 用时 ${Math.floor(r.seconds / 60)} 分 ${r.seconds % 60} 秒 ｜ ${r.date}</p>
    </div>`;

  $('dimDetail').innerHTML = r.scores.map(s => {
    const level = s.value >= 66 ? 'high' : s.value >= 34 ? 'mid' : 'low';
    return `
      <div class="detail-card" style="--accent:${s.color}">
        <div class="detail-head">
          <span class="detail-icon">${s.icon}</span>
          <div>
            <h4>${s.short} · ${s.name}<em>${s.en}</em></h4>
            <span class="level-tag lv-${level}">${level === 'high' ? '优势维度' : level === 'mid' ? '中性维度' : '相对弱势'}</span>
          </div>
          <span class="detail-score">${s.value}</span>
        </div>
        <div class="detail-bar"><i style="width:${s.value}%;background:${s.color}"></i></div>
        <p class="detail-desc">${s[level]}</p>
        <p class="detail-traits"><b>典型特质：</b>${s.traits}</p>
      </div>`;
  }).join('');

  $('traitCards').innerHTML = r.traits.map(t => `
    <div class="trait-card">
      <h5>${t.icon} ${t.name}</h5>
      <div class="canvas-wrap small"><canvas id="donut-${t.key}"></canvas></div>
      <p>${t.value >= 66 ? t.high : t.value >= 34 ? t.mid : t.low}</p>
      <small>${t.summary}</small>
    </div>`).join('');

  $('careerList').innerHTML = r.careers.map((c, i) => `
    <div class="career-card ${i === 0 ? 'top' : ''}">
      <div class="career-rank">${i + 1}</div>
      <div class="career-body">
        <h4>${c.name} <span class="career-code">${c.match.join(' · ')}</span></h4>
        <p>${c.desc}</p>
      </div>
      <div class="career-fit"><b>${c.score}</b><small>匹配度</small></div>
    </div>`).join('');

  const advice = new Set([...ADVICE[t1.short], ...ADVICE[t2.short]]);
  $('adviceList').innerHTML = [...advice].slice(0, 6).map(a => `<li>${a}</li>`).join('');

  const sorted = [...r.scores].sort((a, b) => a.value - b.value);
  $('swot').innerHTML = `
    <div class="swot-item good">
      <h5>✅ 核心竞争力</h5>
      <p>${t1.traits}在 <b>${t1.name}</b> 上的高分，意味着你在 ${t1.summary.replace('喜欢', '').replace('。', '')} 类任务中效率与满意度都更高。</p>
    </div>
    <div class="swot-item warn">
      <h5>⚠️ 潜在盲区</h5>
      <p><b>${sorted[0].name}</b>得分相对靠后（${sorted[0].value}），在需要${sorted[0].summary.replace('喜欢', '').replace('。', '')}的任务中，建议主动寻求互补的伙伴协作。</p>
    </div>
    <div class="swot-item tip">
      <h5>🧭 环境选择建议</h5>
      <p>优先选择能让你高频使用 <b>${t1.name}</b> 与 <b>${t2.name}</b> 能力的团队；面试时可重点询问岗位的日常任务构成与协作方式。</p>
    </div>`;
}

function drawCharts(r) {
  if (!r) return;
  Chart.radar($('radarCanvas'), r.scores.map(s => ({
    label: `${s.short} ${s.name}`, value: s.value, color: s.color
  })), { padding: 62 });

  Chart.bars($('barCanvas'), [...r.scores].sort((a, b) => b.value - a.value).map(s => ({
    label: `${s.short} ${s.name}`, value: s.value, color: s.color
  })), { padL: 90 });

  r.traits.forEach(t => {
    const c = $(`donut-${t.key}`);
    if (c) Chart.donut(c, t.value, { color: t.color, color2: '#7b6cf6', sub: `${t.name}指数` });
  });

  drawTrend();
}

/* ---------------- 历史记录与趋势 ---------------- */
function saveHistory(r) {
  const list = getHistory();
  list.push({
    date: r.date,
    code: r.code,
    scores: r.scores.reduce((o, s) => (o[s.short] = s.value, o), {}),
    seconds: r.seconds
  });
  localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-10)));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}

function renderHistory() {
  const list = getHistory();
  if (!list.length) {
    $('historyWrap').innerHTML =
      '<p class="empty">暂无历史记录。完成一次测评后，这里会展示你的兴趣变化轨迹。</p>';
    return;
  }
  $('historyWrap').innerHTML = `
    <div class="table-scroll">
      <table class="hist-table">
        <thead><tr><th>#</th><th>时间</th><th>兴趣代码</th>${DIMENSIONS.map(d => `<th>${d.short}</th>`).join('')}<th>用时</th></tr></thead>
        <tbody>
          ${list.map((h, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${h.date}</td>
              <td><b class="code-tag">${h.code}</b></td>
              ${DIMENSIONS.map(d => `<td>${h.scores[d.short] ?? '-'}</td>`).join('')}
              <td>${Math.floor(h.seconds / 60)}′${h.seconds % 60}″</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function drawTrend() {
  const list = getHistory();
  const box = $('trendWrap');
  if (list.length < 2) {
    box.innerHTML = '<p class="empty">完成 2 次以上测评后，将自动生成你的兴趣变化折线图。</p>';
    return;
  }
  box.innerHTML = '<div class="canvas-wrap"><canvas id="trendCanvas"></canvas></div>';
  const canvas = $('trendCanvas');
  canvas.style.height = '300px';
  const lastScores = list[list.length - 1].scores;
  const topDims = [...DIMENSIONS]
    .sort((a, b) => (lastScores[b.short] || 0) - (lastScores[a.short] || 0))
    .slice(0, 3);
  Chart.lines(canvas, topDims.map(d => ({
    name: `${d.short} ${d.name}`,
    color: d.color,
    data: list.map(h => h.scores[d.short] || 0)
  })), list.map((h, i) => `#${i + 1}`));
}

/* ---------------- 报告导出 ---------------- */
function buildReportText(r) {
  const lines = [];
  lines.push('========================================');
  lines.push('      职业兴趣与性格测评 · 分析报告');
  lines.push('========================================');
  lines.push(`测评时间：${r.date}`);
  lines.push(`测评用时：${Math.floor(r.seconds / 60)} 分 ${r.seconds % 60} 秒`);
  lines.push(`题目数量：${QUESTIONS.length} 题（五级量表）`);
  lines.push('');
  lines.push(`【你的 Holland 兴趣代码】 ${r.code}`);
  lines.push(`主导类型：${r.top3[0].name}（${r.top3[0].en}）`);
  lines.push(`画像解读：${r.combo}`);
  lines.push('');
  lines.push('【六维得分】（已标准化为 0-100）');
  [...r.scores].sort((a, b) => b.value - a.value).forEach(s => {
    lines.push(`  ${s.short} ${s.name.padEnd(4, '　')} ${String(s.value).padStart(3)}  ${'█'.repeat(Math.round(s.value / 5))}`);
  });
  lines.push('');
  lines.push('【辅助人格维度】');
  r.traits.forEach(t => lines.push(`  ${t.name}：${t.value} —— ${t.value >= 66 ? t.high : t.value >= 34 ? t.mid : t.low}`));
  lines.push('');
  lines.push('【推荐职业 TOP6】');
  r.careers.forEach((c, i) => lines.push(`  ${i + 1}. ${c.name}（匹配 ${c.score}）— ${c.desc}`));
  lines.push('');
  lines.push('【发展建议】');
  [...new Set([...ADVICE[r.top3[0].short], ...ADVICE[r.top3[1].short]])].slice(0, 6)
    .forEach((a, i) => lines.push(`  ${i + 1}. ${a}`));
  lines.push('');
  lines.push('—— 本报告由「职业兴趣与性格测评」网站自动生成，结果仅供参考。');
  return lines.join('\n');
}

function exportReport() {
  if (!lastResult) return;
  const blob = new Blob([buildReportText(lastResult)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `职业兴趣测评报告_${lastResult.code}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('报告已导出');
}

async function copyReport() {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(buildReportText(lastResult));
    toast('报告已复制到剪贴板');
  } catch {
    toast('复制失败，请改用「导出报告」');
  }
}

document.addEventListener('DOMContentLoaded', init);
