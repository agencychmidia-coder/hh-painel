(function () {
  const root = document.getElementById('hh');
  const C1 = 'var(--chart-1)', C2 = 'var(--chart-2)', BAD = 'var(--destructive)', MUTED = 'var(--chart-4)';
  const GRID = 'var(--border)', AXIS = 'var(--muted-foreground)', FG = 'var(--foreground)', MFG = 'var(--muted-foreground)';
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlk = v => Math.abs(v) >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl.format(v);
  const pct = v => v == null ? 'indisponível' : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  const CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  let anoRef = '';
  const ehMes = m => /^\d{4}-\d{2}$/.test(m || '');
  const mes = m => m === 'Hoje' ? 'hoje' : (ehMes(m) ? CURTO[+m.slice(5) - 1] + (anoRef && m.slice(0, 4) !== anoRef ? '/' + m.slice(2, 4) : '') : m);
  const mesLongo = m => ehMes(m) ? LONGO[+m.slice(5) - 1] + (anoRef && m.slice(0, 4) !== anoRef ? ' de ' + m.slice(0, 4) : '') : '—';
  const dm = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) : '—';
  const dmy = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '—';
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  /* ---------- tema: segue o claro/escuro do painel ---------- */
  function isDark() {
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:1px;background:var(--color-bg)';
    document.getElementById('dash-root').appendChild(p);
    const c = getComputedStyle(p).backgroundColor; p.remove();
    const n = (c.match(/-?[\d.]+/g) || []).map(Number);
    if (!n.length) return false;
    if (/oklch|oklab|lab\(/.test(c)) return n[0] > 1 ? n[0] < 50 : n[0] < 0.5;
    const s = /color\(/.test(c) ? 255 : 1;
    return (0.2126 * n[0] * s + 0.7152 * n[1] * s + 0.0722 * n[2] * s) < 128;
  }
  // Fundo escuro fixo por decisão de marca (11/10/2026): o painel fica no tema escuro do Growth OS mesmo com o Claude em tema claro.
  function syncTheme() { root.classList.add('dark'); }
  syncTheme();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme); } catch (e) {}
  try { new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] }); } catch (e) {}

  /* ---------- brilho dos cards de vidro, com fases diferentes ---------- */
  document.querySelectorAll('.hh-glass').forEach((el, i) => {
    ['a', 'b'].forEach(k => { const g = document.createElement('span'); g.className = 'glow ' + k; g.style.animationDelay = (-(i * 3.7 + (k === 'b' ? 7 : 0)) % 21) + 's'; el.prepend(g); });
  });

  /* ---------- explicações ⓘ ---------- */
  const INFO = {
    caixa: ['Caixa hoje', 'Saldo da conta PJ depois do último extrato conciliado.', 'caixa inicial + entradas realizadas − saídas realizadas'],
    vencido: ['Contas vencidas', 'Previstos de meses já encerrados que continuam em aberto, mais dívidas com sócios (código 04.01). Receita e salários dão baixa sozinhos quando o pagamento entra; as demais contas saem daqui quando a linha prevista muda para Realizado.', 'Σ valor em aberto dos previstos vencidos'],
    resultado: ['Resultado operacional', 'Dois últimos meses fechados. Receita do mês a que o serviço se refere menos os custos desse mesmo mês, pagos ou vencidos. Aportes, retiradas e repasses ficam fora.', 'receita − pessoal − custos de serviço − administrativo − impostos e tarifas'],
    margem: ['Margem operacional', 'Quanto da receita sobra depois dos custos da operação. A barra vai de −20% a 60%; os traços marcam 0%, 40% e 50%.', 'resultado ÷ receita'],
    mrr: ['MRR contratado', 'Soma das mensalidades previstas para o próximo mês, um mês cheio sem atrasos. Cliente marcado como Churn na aba Clientes (MRR) entra zerado.', 'Σ mensalidades previstas no próximo mês'],
    queima: ['Queima estrutural', 'Quanto o custo fixo previsto passa da receita recorrente todo mês, antes de qualquer retirada dos sócios.', 'custo fixo do próximo mês − MRR contratado'],
    socios: ['Retirada líquida dos sócios', 'Quanto os sócios tiraram da empresa além do que colocaram, desde o início do controle.', 'retiradas (05.x) − aportes (03.01.01)'],
    projecao: ['Caixa no fim da projeção', 'Estimativa: caixa de hoje mais mensalidades a receber, menos custos previstos, pagando todos os atrasos no mês atual. Sem retiradas de sócios.', 'caixa hoje + previstos em aberto − vencidos'],
    equilibrio: ['Ponto de equilíbrio', 'Quantos clientes no ticket médio atual pagam o custo fixo.', 'custo fixo ÷ ticket médio'],
    concentracao: ['Concentração de receita', 'Participação do maior cliente no MRR. Acima de 25%, a saída de um cliente muda o mês.', 'maior mensalidade ÷ MRR'],
    aberto: ['Pipeline em aberto', 'Soma do MRR proposto das oportunidades nas etapas 1 a 5. É o teto: o que entra se todas fecharem.', 'Σ mrr_proposto (etapas 1–5)'],
    projetado: ['Valor projetado', 'MRR proposto de cada oportunidade aberta multiplicado pela chance da etapa. As chances são premissa, não histórico: Lead 5%, Contato 10%, Diagnóstico agendado 20%, Diagnóstico realizado 35%, Proposta 50%, Negociação 70%. Oportunidade sem MRR proposto entra como zero.', 'Σ mrr_proposto × chance da etapa'],
    receber: ['Mensalidades em atraso', 'Parcelas de clientes previstas na planilha, com vencimento anterior a hoje e ainda sem recebimento lançado. Mensalidade recebe baixa sozinha quando o pagamento do mesmo cliente e competência é lançado como Realizado.', 'Σ valor em aberto das receitas vencidas'],
    conversao: ['Taxa de conversão', 'Só pode ser calculada quando houver oportunidades perdidas registradas no pipeline.', 'ganhos ÷ (ganhos + perdidos)']
  };
  const pop = document.getElementById('hh-pop');
  let openBtn = null, pinned = false, tmr = null;
  function openPop(btn) {
    const [t, x, f] = INFO[btn.dataset.info] || [];
    if (!t) return;
    pop.innerHTML = ''; const b = document.createElement('b'); b.textContent = t; pop.appendChild(b);
    pop.appendChild(document.createTextNode(x));
    if (f) { const c = document.createElement('code'); c.textContent = f; pop.appendChild(c); }
    pop.style.display = 'block';
    const rr = root.getBoundingClientRect(), br = btn.getBoundingClientRect();
    let left = br.right - rr.left - pop.offsetWidth; left = Math.max(12, Math.min(left, root.clientWidth - pop.offsetWidth - 12));
    pop.style.left = left + 'px'; pop.style.top = (br.bottom - rr.top + 8) + 'px';
    if (openBtn && openBtn !== btn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = btn; btn.setAttribute('aria-expanded', 'true');
  }
  function closePop() { pop.style.display = 'none'; if (openBtn) openBtn.setAttribute('aria-expanded', 'false'); openBtn = null; pinned = false; }
  document.querySelectorAll('.hh-info').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('mouseenter', () => { clearTimeout(tmr); tmr = setTimeout(() => { if (!pinned) openPop(btn); }, 120); });
    btn.addEventListener('mouseleave', () => { clearTimeout(tmr); if (!pinned) tmr = setTimeout(closePop, 120); });
    btn.addEventListener('click', e => { e.stopPropagation(); if (pinned && openBtn === btn) closePop(); else { pinned = true; openPop(btn); } });
  });
  document.addEventListener('click', e => { if (pinned && !pop.contains(e.target)) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

  /* ---------- utilitários ---------- */
  const setCls = (el, cls) => { el.classList.remove('t-bad', 't-ok', 't-warn'); if (cls) el.classList.add(cls); };
  const fill = (sel, text, cls) => document.querySelectorAll(sel).forEach(el => { el.classList.remove('dash-skeleton'); el.textContent = text; if (cls !== undefined) setCls(el, cls); });
  const pill = (el, text, kind) => { el.classList.remove('dash-skeleton', 'up', 'down', 'warn'); if (kind) el.classList.add(kind); el.textContent = text; };
  const failBox = el => { el.querySelectorAll('svg,.hh-fail').forEach(n => n.remove()); const d = document.createElement('div'); d.className = 'hh-fail'; d.textContent = 'Failed to load'; el.appendChild(d); };
  const neg = v => v < 0 ? 't-bad' : null;
  // Mapa de calor do funil: uma rampa de azul da marca, do lead (escuro) ao ganho (mais claro e saturado). Perdido fica em vermelho.
  const calor = etapa => { const n = parseInt(etapa, 10); if (n === 7) return BAD; const t = Math.max(0, Math.min(6, n || 0)) / 6; return 'oklch(' + (0.42 + 0.4 * t).toFixed(3) + ' ' + (0.09 + 0.08 * t).toFixed(3) + ' 262)'; };

  function table(id, src, cols) {
    const tbl = document.getElementById(id); if (!tbl) return; const tb = tbl.querySelector('tbody'); tb.innerHTML = '';
    const key = tbl.getAttribute('data-row-key'), d = dash.data(src);
    if (d.status !== 'ok') return;
    d.data.forEach(r => {
      const tr = document.createElement('tr'); tr.setAttribute('data-key', String(r[key]));
      cols.forEach(([k, f, cf]) => { const td = document.createElement('td'); td.textContent = f ? f(r[k]) : r[k]; const c = cf && cf(r[k]); if (c) td.className = c; tr.appendChild(td); });
      tb.appendChild(tr);
    });
  }

  function tipOf(box) { let t = box.querySelector('.hh-tip'); if (!t) { t = document.createElement('div'); t.className = 'hh-tip'; box.appendChild(t); } return t; }
  function showTip(box, head, lines, x, y) {
    const t = tipOf(box); t.innerHTML = '';
    const h = document.createElement('div'); h.className = 't'; h.textContent = head; t.appendChild(h);
    lines.forEach(([c, label, v]) => { const r = document.createElement('div'); r.className = 'row'; if (c) { const s = document.createElement('i'); s.className = 'sw'; s.style.background = c; r.appendChild(s); } r.appendChild(document.createTextNode((label ? label + ': ' : '') + v)); t.appendChild(r); });
    t.style.display = 'block';
    t.style.left = Math.min(Math.max(0, x - t.offsetWidth / 2), box.clientWidth - t.offsetWidth) + 'px';
    t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px';
  }
  const hideTip = box => { const t = box.querySelector('.hh-tip'); if (t) t.style.display = 'none'; };

  function svgIn(el, H) {
    el.querySelectorAll('svg,.hh-fail').forEach(n => n.remove());
    const W = el.clientWidth || 340;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('class', 'hh-grow').style('font-family', "'Geist', var(--font-anthropic-sans)");
    return { svg, W, H };
  }
  function textW(svg, s, size) { const n = svg.append('text').attr('font-size', size || 11).text(s).node(); const w = n.getComputedTextLength(); n.remove(); return w; }
  const T = (g, x, y, s, anchor, col, size, weight) => g.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor || 'middle').attr('font-size', size || 11).style('fill', col || FG).style('font-weight', weight || 400).text(s);
  const L = (g, x1, x2, y1, y2, col, dash) => { const l = g.append('line').attr('x1', x1).attr('x2', x2).attr('y1', y1).attr('y2', y2).style('stroke', col).style('stroke-width', 1); if (dash) l.attr('stroke-dasharray', dash); return l; };
  function yAxis(g, y, x0, x1, fmt) { y.ticks(4).forEach(t => { L(g, x0, x1, y(t), y(t), t === 0 ? AXIS : GRID); T(g, x0 - 6, y(t), fmt(t), 'end', MFG).attr('dy', '0.32em'); }); }
  const hit = (g, x, y, w, h) => g.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).style('fill', 'transparent');

  function vbars(el, rows, xk, series, o) {
    const { svg, W, H } = svgIn(el, 240);
    const tot = r => o.stack ? series.reduce((a, s) => a + r[s.key], 0) : d3.max(series, s => r[s.key]);
    const lo = Math.min(0, d3.min(rows, r => d3.min(series, s => r[s.key])), ...(o.refs || [])), hi = Math.max(0, d3.max(rows, tot), ...(o.refs || []));
    const y = d3.scaleLinear([lo, (hi * 1.1) || 1], [H - 28, 18]).nice();
    const ml = d3.max(y.ticks(4), t => textW(svg, o.fmt(t))) + 10;
    const x = d3.scaleBand(rows.map(r => r[xk]), [ml, W - 8]).paddingInner(0.35).paddingOuter(0.2);
    const g = svg.append('g'); yAxis(g, y, ml, W - 8, o.fmt);
    (o.refs || []).forEach(r => { L(g, ml, W - 8, y(r), y(r), AXIS, '4 3'); T(g, W - 8, y(r) - 4, 'meta ' + o.fmt(r), 'end', MFG); });
    const sub = d3.scaleBand(series.map(s => s.key), [0, x.bandwidth()]).padding(0.14);
    rows.forEach(r => {
      let acc = 0; const cx = x(r[xk]);
      series.forEach((s, i) => {
        const v = r[s.key], col = typeof s.color === 'function' ? s.color(v) : s.color;
        let bx, bw, y0, y1;
        if (o.stack) { bw = Math.min(32, x.bandwidth()); bx = cx + (x.bandwidth() - bw) / 2; y0 = y(acc); y1 = y(acc + v); acc += v; }
        else { bw = Math.min(32, sub.bandwidth()); bx = cx + sub(s.key) + (sub.bandwidth() - bw) / 2; y0 = y(0); y1 = y(v); }
        const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0) - (o.stack && i > 0 ? 2 : 0));
        g.append('rect').attr('x', bx).attr('y', top).attr('width', bw).attr('height', h).attr('rx', o.stack && i < series.length - 1 ? 0 : 4).style('fill', col);
        if (!o.stack) T(g, bx + bw / 2, v < 0 ? y1 + 14 : y1 - 5, o.fmt(v), 'middle', FG, 11, 600);
      });
      if (o.stack) T(g, cx + x.bandwidth() / 2, y(acc) - 5, o.fmt(acc), 'middle', FG, 11, 600);
      T(g, cx + x.bandwidth() / 2, H - 8, mes(r[xk]), 'middle', MFG);
      hit(g, cx, 0, x.bandwidth(), H)
        .on('mousemove', ev => { const p = d3.pointer(ev, el); showTip(el, mes(r[xk]), series.map(s => [typeof s.color === 'function' ? s.color(r[s.key]) : s.color, series.length > 1 ? s.name : '', o.tfmt ? o.tfmt(r[s.key]) : o.fmt(r[s.key])]), p[0], p[1]); })
        .on('mouseleave', () => hideTip(el));
    });
  }

  function waterfall(el, rows) {
    const { svg, W, H } = svgIn(el, 270);
    let run = 0;
    const bars = rows.map(r => { if (r.tipo === 'total') { run = r.valor; return { ...r, y0: 0, y1: r.valor }; } const b = { ...r, y0: run, y1: run + r.valor }; run += r.valor; return b; });
    const lo = Math.min(0, d3.min(bars, b => Math.min(b.y0, b.y1))), hi = d3.max(bars, b => Math.max(b.y0, b.y1));
    const y = d3.scaleLinear([lo, hi * 1.12], [H - 44, 18]).nice();
    const ml = d3.max(y.ticks(4), t => textW(svg, brlk(t))) + 10;
    const x = d3.scaleBand(bars.map(b => b.etapa), [ml, W - 6]).padding(0.28);
    const g = svg.append('g'); yAxis(g, y, ml, W - 6, brlk);
    const narrow = W < 560;
    bars.forEach((b, i) => {
      const bw = Math.min(56, x.bandwidth()), bx = x(b.etapa) + (x.bandwidth() - bw) / 2;
      const col = b.tipo === 'total' ? (b.valor < 0 ? BAD : C1) : MUTED;
      g.append('rect').attr('x', bx).attr('y', y(Math.max(b.y0, b.y1))).attr('width', bw).attr('height', Math.max(1, Math.abs(y(b.y0) - y(b.y1)))).attr('rx', 4).style('fill', col);
      if (i < bars.length - 1) L(g, bx + bw, x(bars[i + 1].etapa) + (x.bandwidth() - bw) / 2, y(b.y1), y(b.y1), AXIS, '2 2');
      T(g, bx + bw / 2, y(Math.max(b.y0, b.y1)) - 6, (b.tipo === 'passo' ? '−' : '') + brlk(Math.abs(b.valor)), 'middle', b.tipo === 'total' && b.valor < 0 ? BAD : FG, 11, 600);
      const w = b.etapa.split(' ');
      if (narrow && w.length > 1) { T(g, bx + bw / 2, H - 26, w[0], 'middle', MFG); T(g, bx + bw / 2, H - 12, w.slice(1).join(' '), 'middle', MFG); }
      else T(g, bx + bw / 2, H - 20, b.etapa, 'middle', MFG);
      hit(g, x(b.etapa), 0, x.bandwidth(), H)
        .on('mousemove', ev => { const p = d3.pointer(ev, el); showTip(el, b.etapa, [[col, '', brl2.format(b.valor)]], p[0], p[1]); }).on('mouseleave', () => hideTip(el));
    });
  }

  function hbars(el, rows, lk, vk, o) {
    const rh = 38, H = rows.length * rh + 6;
    const { svg, W } = svgIn(el, H);
    const lw = d3.max(rows, r => textW(svg, r[lk], 12)) + 12, vw = d3.max(rows, r => textW(svg, o.label ? o.label(r) : o.fmt(r[vk]), 12)) + 12;
    const x = d3.scaleLinear([0, d3.max(rows, r => r[vk]) || 1], [lw, W - vw]);
    rows.forEach((r, i) => {
      const yy = i * rh + 4, v = r[vk], col = o.color(r);
      T(svg, 0, yy + 15, r[lk], 'start', FG, 12).attr('dy', '0.32em');
      svg.append('rect').attr('x', lw).attr('y', yy + 4).attr('height', 22).attr('rx', 4).attr('width', Math.max(2, x(v) - lw)).style('fill', col);
      T(svg, Math.max(lw + 4, x(v) + 6), yy + 15, o.label ? o.label(r) : o.fmt(v), 'start', MFG, 12).attr('dy', '0.32em');
      hit(svg, 0, yy, W, rh).on('mousemove', ev => { const p = d3.pointer(ev, el); showTip(el, r[lk], [[col, '', o.tfmt ? o.tfmt(r) : o.fmt(v)]], p[0], p[1]); }).on('mouseleave', () => hideTip(el));
    });
    el.style.minHeight = H + 'px';
  }

  function lineChart(el, rows, xk, series, o) {
    const { svg, W, H } = svgIn(el, 240);
    const all = rows.flatMap(r => series.map(s => r[s.key]));
    const y = d3.scaleLinear([Math.min(0, d3.min(all)), Math.max(0, d3.max(all))], [H - 28, 16]).nice();
    const ml = d3.max(y.ticks(4), t => textW(svg, brlk(t))) + 10;
    const last = rows[rows.length - 1];
    const endW = o.endLabels ? d3.max(series, s => Math.max(textW(svg, s.short), textW(svg, brlk(last[s.key])))) + 14 : 10;
    const xs = o.time ? d3.scaleUtc(d3.extent(rows, r => r._d), [ml + 4, W - endW]) : d3.scalePoint(rows.map(r => r[xk]), [ml + 10, W - endW]);
    const X = r => o.time ? xs(r._d) : xs(r[xk]);
    const g = svg.append('g'); yAxis(g, y, ml, W - endW, brlk);
    if (o.time) xs.ticks(W < 480 ? 3 : 6).forEach(t => T(g, xs(t), H - 8, d3.utcFormat('%d/%m')(t), 'middle', MFG));
    else rows.forEach(r => T(g, X(r), H - 8, mes(r[xk]), 'middle', MFG));
    series.forEach(s => {
      if (o.area) {
        const gid = 'hhg' + Math.random().toString(36).slice(2, 8);
        const gr = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
        [[0, .26], [.25, .16], [.5, .08], [.75, .03], [1, 0]].forEach(([off, op]) => gr.append('stop').attr('offset', off).attr('style', `stop-color:${s.color};stop-opacity:${op}`));
        g.append('path').attr('d', d3.area().x(X).y0(y(0)).y1(r => y(r[s.key])).curve(d3.curveStepAfter)(rows)).style('fill', `url(#${gid})`);
      }
      g.append('path').attr('d', d3.line().x(X).y(r => y(r[s.key])).curve(o.area ? d3.curveStepAfter : d3.curveLinear)(rows))
        .style('fill', 'none').style('stroke', s.color).style('stroke-width', 2).style('stroke-linecap', 'round').style('stroke-linejoin', 'round');
      if (!o.time) rows.forEach(r => g.append('circle').attr('cx', X(r)).attr('cy', y(r[s.key])).attr('r', 4).style('fill', s.color).style('stroke', 'var(--card)').style('stroke-width', 2));
    });
    if (o.endLabels) {
      const ends = series.map(s => ({ y: y(last[s.key]), s, v: last[s.key] })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 30) ends[i].y = ends[i - 1].y + 30;
      ends.forEach(e => { T(g, W - endW + 8, e.y - 4, e.s.short, 'start', MFG); T(g, W - endW + 8, e.y + 10, brlk(e.v), 'start', e.v < 0 ? BAD : FG, 11, 600); });
    }
    const rule = L(g, 0, 0, 16, H - 28, AXIS).style('display', 'none');
    const dot = g.append('circle').attr('r', 4).style('fill', series[0].color).style('stroke', 'var(--card)').style('stroke-width', 2).style('display', 'none');
    svg.on('mousemove', ev => {
      const p = d3.pointer(ev, el); const r = rows[d3.minIndex(rows, rr => Math.abs(X(rr) - p[0]))];
      rule.style('display', null).attr('x1', X(r)).attr('x2', X(r)); dot.style('display', null).attr('cx', X(r)).attr('cy', y(r[series[0].key]));
      showTip(el, o.time ? d3.utcFormat('%d/%m/%Y')(r._d) : mes(r[xk]), series.map(s => [s.color, series.length > 1 ? s.short : '', brl2.format(r[s.key])]), X(r), y(d3.max(series, s => r[s.key])));
    }).on('mouseleave', () => { hideTip(el); rule.style('display', 'none'); dot.style('display', 'none'); });
  }

  function bullet(el, mrr, cen, proj) {
    proj = proj || 0;
    const { svg, W, H } = svgIn(el, 150);
    const x = d3.scaleLinear([0, Math.max(d3.max(cen, c => c.receita_necessaria), mrr + proj) * 1.06], [8, W - 8]);
    const g = svg.append('g');
    [[0, cen[0].receita_necessaria, 'var(--muted)'], [cen[0].receita_necessaria, cen[1].receita_necessaria, 'var(--accent)'], [cen[1].receita_necessaria, cen[2].receita_necessaria, 'var(--info-soft)']]
      .forEach(([a, b, c]) => g.append('rect').attr('x', x(a)).attr('y', 44).attr('width', Math.max(0, x(b) - x(a))).attr('height', 40).style('fill', c));
    if (proj > 0) {
      g.append('rect').attr('x', x(mrr)).attr('y', 56).attr('width', Math.max(2, x(mrr + proj) - x(mrr))).attr('height', 16).attr('rx', 4).style('fill', C1).style('opacity', 0.38);
      T(g, x(mrr + proj), 18, '+ pipeline ponderado · ' + brlk(mrr + proj), x(mrr + proj) > W * 0.7 ? 'end' : 'start', MFG, 11, 500);
    }
    g.append('rect').attr('x', x(0)).attr('y', 56).attr('width', Math.max(2, x(mrr) - x(0))).attr('height', 16).attr('rx', 4).style('fill', C1);
    T(g, x(mrr), 36, 'MRR hoje · ' + brlk(mrr), x(mrr) < W / 3 ? 'start' : 'middle', FG, 12, 600);
    cen.forEach((c, i) => {
      L(g, x(c.receita_necessaria), x(c.receita_necessaria), 40, 90, FG).style('stroke-width', 2);
      T(g, x(c.receita_necessaria), 108 + (i % 2) * 15, ['empate', 'meta 40%', 'meta 50%'][i] + ' · ' + brlk(c.receita_necessaria), i === 2 ? 'end' : 'middle', MFG);
    });
    hit(g, 0, 0, W, H).on('mousemove', ev => { const p = d3.pointer(ev, el); showTip(el, 'Receita mensal', [['var(--chart-1)', 'MRR hoje', brl.format(mrr)], ...(proj > 0 ? [[null, 'MRR + pipeline ponderado', brl.format(mrr + proj)]] : []), ...cen.map(c => [null, c.cenario, brl.format(c.receita_necessaria)])], p[0], p[1]); }).on('mouseleave', () => hideTip(el));
  }

  function meter(el, v) {
    el.innerHTML = '';
    const sc = d3.scaleLinear([-0.2, 0.6], [0, 100]).clamp(true);
    const b = document.createElement('b'); b.style.width = Math.max(2, sc(v)) + '%'; b.style.background = v >= 0.4 ? 'var(--success)' : 'var(--destructive)'; el.appendChild(b);
    [0, 0.4, 0.5].forEach(t => { const i = document.createElement('i'); i.style.left = sc(t) + '%'; el.appendChild(i); });
  }

  function rotulos() {
    const c = dash.data('contexto');
    if (c.status !== 'ok') return;
    const x = c.data[0];
    anoRef = (x.atual || '').slice(0, 4);
    const ult2 = x.ult2.map(mes).join(' + ') || '—';
    const ult2L = x.ult2.map(mesLongo).join(' + ') || '—';
    const L = {
      ult2, ult2_longo: ult2L, ult2_longo_cap: cap(ult2L), meta_longo: mesLongo(x.meta), atual: mes(x.atual), atual_longo: mesLongo(x.atual),
      proj_fim_longo: mesLongo(x.proj[x.proj.length - 1]), inicio: mes(x.inicio), periodo: cap(mes(x.inicio)) + ' a ' + mes(x.atual),
      ultimo_longo: mesLongo(x.ult2[x.ult2.length - 1]), conc: dm(x.ultima_conciliacao), parcial: cap(mesLongo(x.atual)) + ' está parcial (até ' + dm(x.ultima_conciliacao) + ').', parcial_curto: cap(mesLongo(x.atual)) + ' parcial.'
    };
    document.querySelectorAll('[data-lbl]').forEach(el => { const v = L[el.getAttribute('data-lbl')]; if (v != null) el.textContent = v; });
    const ao = x.fonte === 'ao_vivo';
    const ga = String(x.gerado_em || '');
    const ultima = x.fonte === 'ultima_leitura';
    const quando = dmy(ga) + (ga.length >= 16 ? ' ' + ga.slice(11, 16) : '');
    document.getElementById('chip-atual').textContent = ao ? 'Ao vivo · lido em ' + quando : ultima ? 'Última leitura boa · ' + quando : 'Foto de ' + dmy(x.data_base);
    document.getElementById('chip-conc').textContent = 'Extrato conciliado até ' + dm(x.ultima_conciliacao);
    const cf = document.getElementById('chip-foto');
    cf.hidden = ao;
    if (!ao) {
      const [cod, det] = String(x.motivo_foto || '').split('|');
      const foto = ultima ? ' — mostrando a última leitura boa, de ' + quando : ' — mostrando a foto de ' + dmy(x.data_base);
      const MOT = {
        fonte_nao_configurada: 'Leitura ao vivo ainda não configurada na Vercel',
        url_invalida: 'PAINEL_FONTE_URL não é a URL do App da Web (termina em /exec)',
        url_sem_token: 'PAINEL_FONTE_URL sem o ?t=TOKEN no fim',
        nao_autorizado: 'A planilha recusou o token — confira o ?t= na Vercel',
        planilha_pede_login: 'A planilha pediu login — reimplante com acesso “Qualquer pessoa”',
        implantacao_nao_encontrada: 'App da Web não encontrado — confira a URL /exec',
        falha_leitura: 'Erro ao ler a planilha' + (det ? ': ' + det : ''),
        resposta_invalida_da_planilha: 'Resposta inesperada da planilha' + (det ? ' (' + det.slice(0, 40) + ')' : ''),
        falha_ao_buscar_planilha: 'Não consegui acessar a planilha'
      };
      cf.textContent = (MOT[cod] || 'Planilha fora do ar') + foto;
      cf.title = String(x.motivo_foto || '');
    }
    document.getElementById('foot-atual').textContent = ao ? 'leitura ao vivo de ' + dmy(ga) : ultima ? 'última leitura boa de ' + quando : 'foto de ' + dmy(x.data_base);
  }

  function render() {
    syncTheme();
    rotulos();
    const D = id => dash.data(id);
    const cx = D('caixa_atual'), vt = D('vencido_total'), rc = D('resumo_comp'), mm = D('meta_margem'), eq = D('equilibrio'), pj = D('projecao'), st = D('socios_total'), fr = D('funil_resumo'), va = D('variacao');
    if (cx.status === 'ok') { const c = cx.data[0]; fill('[data-source="caixa_atual"][data-field="saldo"]', brl2.format(c.saldo)); fill('[data-source="caixa_atual"][data-field="entradas"]', brl2.format(c.entradas)); fill('[data-source="caixa_atual"][data-field="saidas"]', brl2.format(c.saidas)); }
    if (vt.status === 'ok') fill('[data-source="vencido_total"][data-field="total"]', brl2.format(vt.data[0].total), 't-bad');
    if (rc.status === 'ok') { const r = rc.data[0]; fill('[data-source="resumo_comp"][data-field="resultado"]', brl2.format(r.resultado), r.resultado < 0 ? 't-bad' : 't-ok'); fill('[data-source="resumo_comp"][data-field="margem"]', pct(r.margem), r.margem >= 0.4 ? 't-ok' : 't-bad'); meter(document.getElementById('meter-marg'), r.margem); }
    if (va.status === 'ok') {
      const v = va.data[0];
      const cx2 = dash.data('contexto'), u = cx2.status === 'ok' ? cx2.data[0].ult2 : [];
      const vs = u.length === 2 ? ' ' + mes(u[1]) + ' vs ' + mes(u[0]) : '';
      if (v.delta_resultado == null) pill(document.getElementById('pill-res'), 'Sem mês anterior para comparar', '');
      else pill(document.getElementById('pill-res'), (v.delta_resultado >= 0 ? '▲ ' : '▼ ') + brl.format(Math.abs(v.delta_resultado)) + vs, v.delta_resultado >= 0 ? 'up' : 'down');
      if (v.delta_margem == null) pill(document.getElementById('pill-marg'), 'Sem mês anterior para comparar', '');
      else pill(document.getElementById('pill-marg'), (v.delta_margem >= 0 ? '▲ ' : '▼ ') + (Math.abs(v.delta_margem) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' p.p.' + vs, v.delta_margem >= 0 ? 'up' : 'down');
    }
    if (mm.status === 'ok') fill('[data-source="meta_margem"][data-field="mrr"]', brl2.format(mm.data[0].mrr));
    if (eq.status === 'ok') {
      const e = eq.data[0];
      fill('[data-source="equilibrio"][data-field="queima"]', brl2.format(e.queima), e.queima > 0 ? 't-bad' : 't-ok');
      fill('[data-source="equilibrio"][data-field="clientes_equilibrio"]', e.clientes_equilibrio.toLocaleString('pt-BR') + ' clientes');
      fill('[data-source="equilibrio"][data-field="clientes"]', String(e.clientes));
      fill('[data-source="equilibrio"][data-field="ticket"]', brl2.format(e.ticket));
      fill('[data-source="equilibrio"][data-field="concentracao"]', pct(e.concentracao), e.concentracao > 0.25 ? 't-warn' : '');
      fill('#conc-nome', e.maior_cliente + ' — perder um cliente desse tamanho muda o mês.');
      pill(document.getElementById('pill-churn'), e.em_saida ? (e.em_saida === 1 ? '1 cliente em saída' : e.em_saida + ' clientes em saída') : 'Sem saídas marcadas', e.em_saida ? 'down' : 'up');
    }
    if (pj.status === 'ok') { const dz = pj.data[pj.data.length - 1]; fill('[data-source="projecao"][data-field="pagando_vencidos"]', brl2.format(dz.pagando_vencidos), dz.pagando_vencidos < 0 ? 't-bad' : 't-ok'); document.getElementById('alert-chip').hidden = !(dz.pagando_vencidos < 0); }
    if (st.status === 'ok') fill('[data-source="socios_total"][data-field="liquido"]', brl2.format(st.data[0].liquido));
    if (fr.status === 'ok') { const f = fr.data[0]; fill('[data-source="funil_resumo"][data-field="abertas"]', String(f.abertas)); fill('[data-source="funil_resumo"][data-field="ganhos"]', String(f.ganhos)); fill('[data-source="funil_resumo"][data-field="conversao"]', pct(f.conversao), f.conversao == null ? 't-warn' : ''); fill('[data-source="funil_resumo"][data-field="share_indicacao"]', pct(f.share_indicacao)); }

    const pv = D('pipeline_valor');
    if (pv.status === 'ok') {
      const v = pv.data[0];
      fill('[data-source="pipeline_valor"][data-field="aberto"]', brl.format(v.aberto));
      fill('[data-source="pipeline_valor"][data-field="ponderado"]', brl.format(v.ponderado));
      pill(document.getElementById('pill-semvalor'), v.sem_valor > 0 ? v.sem_valor + ' de ' + v.abertas + ' abertas sem valor' : 'Todas com valor proposto', v.sem_valor > 0 ? 'warn' : 'up');
    }

    const ra = D('recebiveis_atrasados');
    if (ra.status === 'ok') {
      const tot = ra.data.reduce((t, r) => t + r.valor, 0);
      fill('[data-source="recebiveis_atrasados"][data-field="total"]', brl2.format(tot), tot > 0 ? 't-bad' : 't-ok');
      if (document.getElementById('pill-receber')) pill(document.getElementById('pill-receber'), ra.data.length ? ra.data.length + (ra.data.length === 1 ? ' parcela' : ' parcelas') + ' · até ' + ra.data[0].dias + (ra.data[0].dias === 1 ? ' dia' : ' dias') : 'Nada em atraso', ra.data.length ? 'down' : 'up');
    }

    const take = document.getElementById('take');
    if ([cx, vt, rc, eq].every(d => d.status === 'ok')) {
      take.classList.remove('dash-skeleton'); take.innerHTML = '';
      [['Caixa de ', brl.format(cx.data[0].saldo)], [' contra ', brl.format(vt.data[0].total)], [' vencidos. A operação fechou ' + (dash.data('contexto').status === 'ok' ? dash.data('contexto').data[0].ult2.map(mesLongo).join(' e ') : 'os últimos meses') + ' em ', brl.format(rc.data[0].resultado)], [' antes de qualquer retirada, e o custo fixo supera o MRR em ', brl.format(eq.data[0].queima)], [' por mês.', '']]
        .forEach(([a, b]) => { take.appendChild(document.createTextNode(a)); if (b) { const s = document.createElement('span'); s.className = 'hh-num'; s.textContent = b; take.appendChild(s); } });
    }

    const vis = id => { const e = document.getElementById(id); return !!e && !e.closest('.hh-panel').hidden; };
    const chart = (id, src, draw) => { if (!vis(id)) return; const el = document.getElementById(id), d = D(src); if (d.status === 'ok') draw(el, d.data); else if (d.status === 'error') failBox(el); };
    chart('ch-ponte', 'ponte', (el, rows) => waterfall(el, rows));
    chart('ch-res', 'dre_competencia', (el, rows) => vbars(el, rows, 'competencia', [{ key: 'resultado', color: v => v < 0 ? BAD : C1, name: 'Resultado' }], { fmt: brlk, tfmt: v => brl2.format(v) }));
    chart('ch-ent', 'entradas_origem', (el, rows) => vbars(el, rows, 'mes', [{ key: 'receita', color: C1, name: 'Receita' }, { key: 'aportes', color: C2, name: 'Aportes' }], { stack: true, fmt: brlk, tfmt: v => brl2.format(v) }));
    chart('ch-saldo', 'saldo_diario', (el, rows) => lineChart(el, rows.map(r => ({ ...r, _d: new Date(r.data + 'T12:00:00Z') })), 'data', [{ key: 'saldo', color: C1, short: 'Saldo' }], { time: true, area: true }));
    chart('ch-proj', 'projecao', (el, rows) => lineChart(el, rows, 'mes', [{ key: 'sem_pagar_vencidos', color: C1, short: 'Sem pagar' }, { key: 'pagando_vencidos', color: C2, short: 'Pagando' }], { endLabels: true }));
    chart('ch-custos', 'custos_grupo', (el, rows) => hbars(el, rows, 'grupo', 'valor', { fmt: brlk, tfmt: r => brl2.format(r.valor), color: r => r.grupo === 'Pessoal' ? C1 : MUTED }));
    chart('ch-soc', 'socios', (el, rows) => vbars(el, rows, 'mes', [{ key: 'retiradas', color: C1, name: 'Retiradas' }, { key: 'aportes', color: C2, name: 'Aportes' }], { fmt: brlk, tfmt: v => brl2.format(v) }));
    chart('ch-marg', 'dre_competencia', (el, rows) => vbars(el, rows.filter(r => r.margem != null), 'competencia', [{ key: 'margem', color: v => v >= 0.4 ? C1 : BAD, name: 'Margem' }], { fmt: pct, refs: [0.4, 0.5] }));
    chart('ch-mrr', 'mrr_clientes', (el, rows) => hbars(el, rows, 'cliente', 'mrr', { fmt: brl.format, label: r => r.status === 'saida' ? brl.format(r.mrr) + ' · saída' : (r.status === 'risco' ? brl.format(r.mrr) + ' · risco' : brl.format(r.mrr)), tfmt: r => brl2.format(r.mrr), color: r => r.status === 'saida' ? BAD : (r.status === 'risco' ? MUTED : C1) }));
    chart('ch-funil', 'funil', (el, rows) => hbars(el, rows, 'etapa', 'oportunidades', { fmt: v => String(v), label: r => r.oportunidades + (r.mrr ? ' · ' + brl.format(r.mrr) : ''), tfmt: r => r.oportunidades + ' oportunidade(s)', color: r => calor(r.etapa) }));
    const FAIXA = { '1 a 30 dias': 'var(--warning)', '31 a 60 dias': 'oklch(0.72 0.17 45)', 'Mais de 60 dias': BAD };
    chart('ch-receber', 'recebiveis_faixas', (el, rows) => hbars(el, rows, 'faixa', 'valor', { fmt: brl.format, label: r => r.qtd ? brl.format(r.valor) + ' · ' + r.qtd + (r.qtd === 1 ? ' parcela' : ' parcelas') : '—', tfmt: r => brl2.format(r.valor), color: r => FAIXA[r.faixa] }));
    chart('ch-mrrmes', 'mrr_mensal', (el, rows) => vbars(el, rows, 'mes', [{ key: 'mrr', color: C1, name: 'MRR' }], { fmt: brlk, tfmt: v => brl2.format(v) }));
    if (vis('ch-bullet')) { const el = document.getElementById('ch-bullet'), a = D('meta_cenarios'), b = D('meta_margem'); if (a.status === 'ok' && b.status === 'ok') { const pv = D('pipeline_valor'); bullet(el, b.data[0].mrr, a.data, pv.status === 'ok' ? pv.data[0].ponderado : 0); } else if (a.status === 'error' || b.status === 'error') failBox(el); }

    table('tb-venc', 'vencidos', [['descricao'], ['competencia', mes], ['valor', v => brl2.format(v)]]);
    table('tb-meta', 'meta_cenarios', [['cenario'], ['receita_necessaria', v => brl.format(v)], ['falta', v => brl.format(v), v => v > 0 ? 't-bad' : null], ['clientes', v => v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })]]);
    table('tb-dre', 'dre_competencia', [['competencia', mes], ['receita', v => brl.format(v)], ['pessoal', v => brl.format(-v)], ['custos_adm', v => brl.format(-v)], ['resultado', v => brl.format(v), neg], ['margem', pct, v => v != null && v < 0.4 ? 't-bad' : null]]);
    table('tb-orig', 'origem', [['origem'], ['oportunidades'], ['ganhos'], ['perdidos'], ['conversao', v => v == null ? '—' : pct(v)], ['mrr', v => brl.format(v)]]);
    table('tb-receber', 'recebiveis_atrasados', [['cliente'], ['vencimento', dmy], ['dias', v => v + ' d', v => v > 60 ? 't-bad' : (v > 30 ? 't-warn' : null)], ['valor', v => brl2.format(v)]]);
    if (ra.status === 'ok' && !ra.data.length && document.querySelector('#tb-receber tbody')) { const tb = document.querySelector('#tb-receber tbody'); const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 4; td.textContent = 'Nenhuma mensalidade em atraso.'; tr.appendChild(td); tb.appendChild(tr); }
    table('tb-desp', 'maiores_despesas', [['descricao'], ['grupo'], ['valor', v => brl2.format(v)], ['pct', pct]]);
    table('tb-mrrmes', 'mrr_mensal', [['mes', mes], ['mrr', v => brl.format(v)], ['clientes'], ['novos', v => v == null ? '—' : '+' + v], ['saidas', v => v == null ? '—' : (v ? '−' + v : '0'), v => v > 0 ? 't-bad' : null], ['churn', v => v == null ? '—' : pct(v), v => v > 0 ? 't-bad' : null]]);
  }

  const tabs = Array.from(document.querySelectorAll('.hh-seg button'));
  function show(id, push) {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
    document.querySelectorAll('.hh-panel').forEach(p => p.hidden = p.id !== id);
    closePop();
    if (push) dash.setLink(id);
    render();
  }
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab, true)));
  const start = location.hash.slice(1);
  if (['geral', 'financeiro', 'metas', 'funil'].includes(start)) show(start, false);
  dash.onData(render);
})();
