/* ============================================================
 *  轻量可视化引擎（原生 Canvas，无第三方依赖）
 *  提供：雷达图、横向条形图、多序列折线图、环形占比图
 * ============================================================ */

const Chart = (() => {
  const DPR = () => window.devicePixelRatio || 1;

  /** 初始化画布（含高分屏适配） */
  function setup(canvas) {
    const dpr = DPR();
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 480;
    const h = rect.height || canvas.clientHeight || 360;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  const hexToRgba = (hex, a) => {
    const m = hex.replace('#', '');
    const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  /** 雷达图 */
  function radar(canvas, items, opt = {}) {
    const { ctx, w, h } = setup(canvas);
    const cx = w / 2;
    const cy = h / 2 + (opt.offsetY || 0);
    const R = Math.min(w, h) / 2 - (opt.padding || 58);
    const n = items.length;
    const max = opt.max || 100;
    const rings = opt.rings || 4;

    // 背景网格
    for (let r = rings; r >= 1; r--) {
      const rr = (R * r) / rings;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = cx + rr * Math.cos(ang);
        const y = cy + rr * Math.sin(ang);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = r % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 轴线
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      ctx.stroke();
    }

    // 数据面
    const pts = items.map((it, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const rr = (Math.max(0, Math.min(max, it.value)) / max) * R;
      return { x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang), ang, it };
    });

    const grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    grad.addColorStop(0, hexToRgba('#5b8def', 0.55));
    grad.addColorStop(1, hexToRgba('#7b6cf6', 0.35));

    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#8fb4ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 顶点与标签
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = p.it.color || '#8fb4ff';
      ctx.fill();
      ctx.strokeStyle = '#0d1220';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.font = '600 13px "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    items.forEach((it, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const lx = cx + (R + 30) * Math.cos(ang);
      const ly = cy + (R + 26) * Math.sin(ang);
      ctx.fillStyle = '#e8edf7';
      ctx.fillText(it.label, lx, ly - 7);
      ctx.font = '700 12px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = it.color || '#8fb4ff';
      ctx.fillText(String(it.value), lx, ly + 9);
      ctx.font = '600 13px "Microsoft YaHei", system-ui, sans-serif';
    });
  }

  /** 横向条形图 */
  function bars(canvas, items, opt = {}) {
    const { ctx, w, h } = setup(canvas);
    const max = opt.max || 100;
    const padL = opt.padL || 92;
    const padR = opt.padR || 44;
    const gap = 14;
    const barH = Math.max(14, (h - gap * (items.length + 1)) / items.length);

    items.forEach((it, i) => {
      const y = gap + i * (barH + gap);
      // 轨道
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(ctx, padL, y, w - padL - padR, barH, barH / 2);
      ctx.fill();

      // 数值条
      const ratio = Math.max(0, Math.min(max, it.value)) / max;
      const bw = Math.max(6, (w - padL - padR) * ratio);
      const g = ctx.createLinearGradient(padL, 0, padL + bw, 0);
      g.addColorStop(0, hexToRgba(it.color || '#5b8def', 0.95));
      g.addColorStop(1, hexToRgba(it.color || '#5b8def', 0.55));
      ctx.fillStyle = g;
      roundRect(ctx, padL, y, bw, barH, barH / 2);
      ctx.fill();

      // 标签
      ctx.font = '600 13px "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#cfd8ea';
      ctx.fillText(it.label, padL - 12, y + barH / 2);

      ctx.textAlign = 'left';
      ctx.font = '700 13px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = it.color || '#8fb4ff';
      ctx.fillText(String(it.value), padL + bw + 10, y + barH / 2);
    });
  }

  /** 环形占比图（单值 0-100） */
  function donut(canvas, value, opt = {}) {
    const { ctx, w, h } = setup(canvas);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 14;
    const lw = opt.lineWidth || 16;
    const start = -Math.PI / 2;
    const end = start + (Math.PI * 2 * Math.max(0, Math.min(100, value))) / 100;

    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = lw;
    ctx.stroke();

    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, opt.color || '#5b8def');
    g.addColorStop(1, opt.color2 || '#7b6cf6');
    ctx.beginPath();
    ctx.arc(cx, cy, R, start, end);
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 26px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opt.center || `${value}`, cx, cy - 6);
    ctx.font = '500 12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(232,237,247,0.7)';
    ctx.fillText(opt.sub || '', cx, cy + 18);
  }

  /** 多序列折线图（历史趋势） */
  function lines(canvas, series, labels, opt = {}) {
    const { ctx, w, h } = setup(canvas);
    const padL = 42, padR = 20, padT = 26, padB = 40;
    const max = opt.max || 100;
    const min = opt.min || 0;
    const iw = w - padL - padR;
    const ih = h - padT - padB;
    const n = Math.max(labels.length, 2);

    // 网格 + Y 轴刻度
    ctx.font = '500 11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (ih * i) / 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,237,247,0.5)';
      ctx.fillText(String(Math.round(max - ((max - min) * i) / 4)), padL - 8, y);
    }

    const X = i => padL + (iw * i) / (n - 1);
    const Y = v => padT + ih - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * ih;

    // X 轴标签
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.forEach((lb, i) => {
      ctx.fillStyle = 'rgba(232,237,247,0.6)';
      ctx.fillText(lb, X(i), padT + ih + 10);
    });

    series.forEach(s => {
      ctx.beginPath();
      s.data.forEach((v, i) => (i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v))));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      s.data.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(X(i), Y(v), 4, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.strokeStyle = '#0d1220';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // 图例
    let lx = padL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 12px "Microsoft YaHei", sans-serif';
    series.forEach(s => {
      ctx.fillStyle = s.color;
      roundRect(ctx, lx, 8, 14, 4, 2);
      ctx.fill();
      ctx.fillStyle = '#cfd8ea';
      ctx.fillText(s.name, lx + 20, 10);
      lx += 24 + ctx.measureText(s.name).width + 14;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { radar, bars, donut, lines, roundRect };
})();
