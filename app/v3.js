/* Painel HH v3: telas Receita por cliente (Carteira), A pagar, Custos e Time (Financeiro).
   Os números vêm de app/v3-calc.js; aqui só se desenha. Só lê dados: não altera nada. */
(function () {
  const C = window.V3calc;
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kfmt = v => (Math.abs(v) >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl.format(v));
  const pct = (v, d = 0) => (v == null ? '—' : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: d }) + '%');
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dm = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
  const mesLongo = ym => MESL[Number(ym.slice(5, 7)) - 1];
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const D = id => dash.data(id);
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, at) => { const e = document.createElementNS(NS, tag); Object.entries(at || {}).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  const titulo = (node, txt) => { const t = sv('title'); t.textContent = txt; node.appendChild(t); return node; };

  // Ícones (traço, 24px) no estilo dos cartões de referência
  const ICO = {
    pessoas: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.9"/>',
    estrela: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    moedas: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.5A6 6 0 1 1 9.5 15.5"/>',
    saida: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/><path d="M4 21h16"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>',
    carrinho: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
    porcento: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    tendencia: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>'
  };
  const icone = n => { const s = sv('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }); s.innerHTML = ICO[n] || ''; return s; };

  /* ---------- Peças ---------- */
  function kpis(box, itens) {
    const g = el('div', 'v3-kpis');
    itens.forEach(k => {
      const c = el('article', 'v3-kpi hh-glass');
      const h = el('header'); h.appendChild(icone(k.ico)); h.appendChild(el('span', null, k.lbl)); c.appendChild(h);
      c.appendChild(el('b', 'v3-val ' + (k.cls || ''), k.val));
      const s = el('p', 'v3-sub');
      if (k.destaque) s.appendChild(el('span', k.destaqueCls || '', k.destaque + ' '));
      s.appendChild(document.createTextNode(k.sub || '')); c.appendChild(s);
      g.appendChild(c);
    });
    box.appendChild(g);
  }
  function cartao(box, tit, nota, cls) {
    const c = el('section', 'v3-card hh-glass ' + (cls || ''));
    const h = el('div', 'v3-card-h'); h.appendChild(el('h3', null, tit)); if (nota) h.appendChild(el('span', 'v3-nota', nota)); c.appendChild(h);
    box.appendChild(c); return c;
  }
  function barrasH(box, linhas) {
    const max = Math.max(...linhas.map(l => l.v), 1), ul = el('ul', 'v3-hbar');
    linhas.forEach(l => {
      const li = el('li', l.cls || '');
      const t = el('div', 'v3-hbar-t'); t.appendChild(el('span', null, l.rot)); t.appendChild(el('b', null, l.txt)); li.appendChild(t);
      const tr = el('div', 'v3-hbar-tr'), f = el('i'); f.style.width = Math.max(2, (l.v / max) * 100) + '%'; tr.appendChild(f); li.appendChild(tr);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  function tabela(box, cab, linhas, vazio) {
    const w = el('div', 'v3-tbl-w'), t = el('table', 'v3-tbl'), th = el('thead'), tr = el('tr');
    cab.forEach(([txt, al]) => { const c = el('th', al || '', txt); tr.appendChild(c); }); th.appendChild(tr); t.appendChild(th);
    const tb = el('tbody');
    if (!linhas.length) { const r = el('tr'), c = el('td', 'v3-vazio', vazio); c.colSpan = cab.length; r.appendChild(c); tb.appendChild(r); }
    linhas.forEach(l => { const r = el('tr'); l.forEach((c, i) => { const td = el('td', (cab[i][1] || '') + ' ' + (c && c.cls || '')); if (c && c.tag) td.appendChild(el('span', 'v3-tag ' + (c.tagCls || ''), c.tag)); else td.textContent = c && typeof c === 'object' ? c.t : c; r.appendChild(td); }); tb.appendChild(r); });
    t.appendChild(tb); w.appendChild(t); box.appendChild(w);
  }
  function colunas(box, pts, destaque) {
    const W = 520, H = 200, max = Math.max(...pts.map(p => p.v), 1), n = pts.length, bw = Math.min(56, (W / n) * 0.55);
    const s = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'v3-svg', role: 'img' });
    pts.forEach((p, i) => {
      const x = (W / n) * i + (W / n - bw) / 2, h = p.v > 0 ? Math.max(4, (p.v / max) * (H - 56)) : 0, y = H - 24 - h;
      s.appendChild(titulo(sv('rect', { x, y, width: bw, height: h, rx: 6, class: i === destaque ? 'v3-col forte' : 'v3-col' }), p.l + ': ' + brl2.format(p.v)));
      const v = sv('text', { x: x + bw / 2, y: y - 8, 'text-anchor': 'middle', class: 'v3-svg-val' + (i === destaque ? ' forte' : '') }); v.textContent = p.v ? kfmt(p.v) : '—'; s.appendChild(v);
      const lb = sv('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'v3-svg-lbl' }); lb.textContent = p.l; s.appendChild(lb);
    });
    box.appendChild(s);
  }
  function linhas2(box, pts, series) {
    const W = 520, H = 210, L = 58, R = 16, T = 18, B = 26;
    const vals = pts.flatMap(p => series.map(s => p[s.k])), max = Math.max(...vals, 1) * 1.12;
    const s = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'v3-svg', role: 'img' });
    const x = i => L + (pts.length < 2 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1)), y = v => T + (1 - v / max) * (H - T - B);
    [0, 0.5, 1].forEach(f => { const v = max * f; s.appendChild(sv('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'v3-grid' }));
      const t = sv('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'v3-svg-lbl' }); t.textContent = kfmt(v); s.appendChild(t); });
    series.forEach(se => {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[se.k]).toFixed(1)).join(' ');
      if (se.area) s.appendChild(sv('path', { d: d + ` L ${x(pts.length - 1)} ${H - B} L ${x(0)} ${H - B} Z`, class: 'v3-area ' + se.cls }));
      s.appendChild(sv('path', { d, class: 'v3-line ' + se.cls + (se.tracejado ? ' tracejado' : '') }));
      pts.forEach((p, i) => s.appendChild(titulo(sv('circle', { cx: x(i), cy: y(p[se.k]), r: 4, class: 'v3-pt ' + se.cls }), se.nome + ' · ' + p.l + ': ' + brl2.format(p[se.k]))));
    });
    pts.forEach((p, i) => { const t = sv('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', class: 'v3-svg-lbl' }); t.textContent = p.l; s.appendChild(t); });
    box.appendChild(s);
  }
  function rosca(box, fatias, centro, sub) {
    const w = el('div', 'v3-rosca'), S = 180, r = 66, c = 2 * Math.PI * r;
    const s = sv('svg', { viewBox: `0 0 ${S} ${S}`, class: 'v3-rosca-svg', role: 'img' });
    s.appendChild(sv('circle', { cx: S / 2, cy: S / 2, r, class: 'v3-rosca-fundo' }));
    let acc = 0;
    fatias.forEach((f, i) => {
      const len = Math.max(0, f.pct * c - 3);
      s.appendChild(titulo(sv('circle', { cx: S / 2, cy: S / 2, r, class: 'v3-fatia f' + (i % 6), 'stroke-dasharray': `${len} ${c - len}`, 'stroke-dashoffset': -acc, transform: `rotate(-90 ${S / 2} ${S / 2})` }), f.rot + ': ' + brl2.format(f.v)));
      acc += f.pct * c;
    });
    const t1 = sv('text', { x: S / 2, y: S / 2, 'text-anchor': 'middle', class: 'v3-rosca-v' }); t1.textContent = centro; s.appendChild(t1);
    const t2 = sv('text', { x: S / 2, y: S / 2 + 18, 'text-anchor': 'middle', class: 'v3-svg-lbl' }); t2.textContent = sub; s.appendChild(t2);
    w.appendChild(s);
    const ul = el('ul', 'v3-legenda');
    fatias.forEach((f, i) => { const li = el('li'); li.appendChild(el('i', 'f' + (i % 6))); li.appendChild(el('span', null, f.rot)); li.appendChild(el('b', null, kfmt(f.v))); ul.appendChild(li); });
    w.appendChild(ul); box.appendChild(w);
  }
  const hojeBase = () => { const P = D('parametros'); const v = P.status === 'ok' ? (P.data.find(p => p.parametro === 'data_base') || {}).valor : ''; return v || new Date().toISOString().slice(0, 10); };
  const naFoto = () => { const P = D('parametros'); return P.status === 'ok' && (P.data.find(p => p.parametro === 'fonte') || {}).valor === 'foto'; };
  const aviso = box => { if (naFoto()) box.appendChild(el('p', 'v3-aviso', 'Mostrando a foto da planilha de 11/10: a leitura ao vivo falhou. Os números abaixo podem estar desatualizados.')); };

  /* ---------- Carteira › Receita por cliente ---------- */
  const ESTADO = { pago: 'Pago', parcial: 'Pago em parte', vencido: 'Vencido', a_vencer: 'A vencer', saiu: 'Mensalidade zerada (saída)', vazio: 'Sem cobrança' };
  function receita(box) {
    const L = D('lancamentos'); if (L.status !== 'ok') return;
    const cart = D('carteira'), cli = D('clientes'), hoje = hojeBase();
    const R = C.receitaClientes(L.data, cart.status === 'ok' ? cart.data : [], cli.status === 'ok' ? cli.data : [], hoje);
    box.innerHTML = ''; aviso(box);
    kpis(box, [
      { ico: 'pessoas', lbl: 'Clientes pagantes', val: String(R.ativos), sub: 'MRR de ' + brl.format(R.mrr) + ' por mês' },
      { ico: 'estrela', lbl: 'Maior cliente', val: R.maior ? pct(R.maior.pct) : '—', cls: R.maior && R.maior.pct > 0.3 ? 't-warn' : '', sub: R.maior ? 'do MRR · ' + R.maior.cliente : 'sem MRR previsto' },
      { ico: 'alerta', lbl: 'Mensalidade em atraso', val: brl.format(R.atraso.total), cls: R.atraso.total > 0 ? 't-bad' : 't-ok', sub: R.atraso.n ? R.atraso.n + (R.atraso.n === 1 ? ' cliente' : ' clientes') + ' devendo' : 'ninguém devendo' },
      { ico: 'moedas', lbl: 'Receita em risco', val: brl.format(R.risco.ano), cls: R.risco.ano > 0 ? 't-bad' : 't-ok', sub: R.risco.n ? 'por ano · ' + R.risco.n + (R.risco.n === 1 ? ' cliente' : ' clientes') + ' saindo ou em vermelho' : 'nenhum cliente saindo ou em vermelho' }
    ]);
    const g = el('div', 'v3-grid'); box.appendChild(g);
    // Mapa mês a mês
    const mapa = cartao(g, 'Mensalidades mês a mês', 'cor = situação da mensalidade de cada competência', 'larga');
    const t = el('table', 'v3-mapa'), th = el('tr');
    th.appendChild(el('th', null, ''));
    R.meses.forEach(m => th.appendChild(el('th', m.atual ? 'atual' : '', m.rotulo.toUpperCase()[0] + m.rotulo.slice(1))));
    th.appendChild(el('th', 'num', 'Pago em dia'));
    const thead = el('thead'); thead.appendChild(th); t.appendChild(thead);
    const tb = el('tbody');
    R.clientes.forEach(c => {
      const tr = el('tr'); tr.appendChild(el('td', 'nome', c.cliente));
      c.celulas.forEach(x => { const td = el('td'), i = el('i', 'cel ' + x.estado);
        i.title = mesLongo(x.mes) + ': ' + ESTADO[x.estado] + (x.previsto ? ' · previsto ' + brl2.format(x.previsto) : '') + (x.pago ? ' · pago ' + brl2.format(x.pago) : '') + (x.aberto > 0 ? ' · em aberto ' + brl2.format(x.aberto) : '');
        td.appendChild(i); tr.appendChild(td); });
      tr.appendChild(el('td', 'num ' + (c.pct_3m == null ? '' : c.pct_3m < 0.999 ? 't-bad' : 't-ok'), c.pct_3m == null ? '—' : pct(c.pct_3m)));
      tb.appendChild(tr);
    });
    t.appendChild(tb); const tw = el('div', 'v3-tbl-w'); tw.appendChild(t); mapa.appendChild(tw);
    const leg = el('ul', 'v3-legenda linha');
    ['pago', 'parcial', 'vencido', 'a_vencer', 'saiu'].forEach(k => { const li = el('li'); li.appendChild(el('i', 'cel ' + k)); li.appendChild(el('span', null, ESTADO[k])); leg.appendChild(li); });
    mapa.appendChild(leg);
    mapa.appendChild(el('p', 'v3-rodape', '“Pago em dia” = recebido ÷ (recebido + o que venceu e não foi pago) nos últimos 3 meses fechados. O controle da planilha começa em agosto/2026.'));
    // Concentração
    const conc = cartao(g, 'Concentração do MRR', R.concentracao.length ? R.concentracao.length + ' clientes' : '');
    barrasH(conc, R.concentracao.map((c, i) => ({ rot: c.cliente, v: c.mrr, txt: pct(c.pct, 1) + ' · ' + brl.format(c.mrr), cls: i === 0 ? 'forte' : '' })));
    if (R.maior) conc.appendChild(el('p', 'v3-rodape', R.maior.pct > 0.3
      ? 'Um cliente sozinho é ' + pct(R.maior.pct) + ' do MRR. Se ele sair, a receita cai ' + brl.format(R.maior.mrr) + ' por mês.'
      : 'Nenhum cliente passa de 30% do MRR.'));
    // Quem precisa de ligação
    const lig = cartao(g, 'Ligar esta semana', 'atraso, saída ou sinal vermelho');
    tabela(lig, [['Cliente'], ['MRR', 'num'], ['Perda/ano', 'num'], ['Últ. pagamento', 'num'], ['Em atraso', 'num'], ['Ação', 'num']],
      R.ligar.map(c => [c.cliente, brl.format(c.mrr), { t: brl.format(c.mrr * 12), cls: 't-bad' }, c.ultimo_pagamento ? dm(c.ultimo_pagamento) : 'nenhum',
        c.atraso > 0 ? { t: brl.format(c.atraso) + ' · ' + c.dias_atraso + ' d', cls: 't-bad' } : '—',
        c.acao === 'cobrar' ? { tag: 'Cobrar hoje', tagCls: 'mau' } : c.acao === 'saindo' ? { tag: 'Saindo', tagCls: 'neutro' } : { tag: 'Ligar hoje', tagCls: 'aviso' }]),
      'Nenhum cliente em atraso, saindo ou em vermelho.');
  }

  /* ---------- Financeiro › A pagar ---------- */
  function apagar(box) {
    const L = D('lancamentos'); if (L.status !== 'ok') return;
    const hoje = hojeBase(), P = C.pagar(L.data, hoje), ca = D('caixa_atual');
    const saldo = ca.status === 'ok' ? ca.data[0].saldo : null;
    const folga = saldo == null ? null : saldo + P.receber30 - P.total30 - P.vencido.total;
    box.innerHTML = ''; aviso(box);
    kpis(box, [
      { ico: 'saida', lbl: 'A pagar (30 dias)', val: brl.format(P.total30), sub: P.n30 + (P.n30 === 1 ? ' conta até ' : ' contas até ') + dm(P.ate) },
      { ico: 'agenda', lbl: 'Vence esta semana', val: brl.format(P.semana.total), sub: dm(P.semana.inicio) + ' a ' + dm(P.semana.fim) + ' · ' + P.semana.n + (P.semana.n === 1 ? ' conta' : ' contas') },
      { ico: 'alerta', lbl: 'Já vencido', val: brl.format(P.vencido.total), cls: P.vencido.total > 0 ? 't-bad' : 't-ok', sub: P.vencido.n ? P.vencido.n + (P.vencido.n === 1 ? ' conta sem pagar' : ' contas sem pagar') + (P.divida_socio.total ? ' + ' + brl.format(P.divida_socio.total) + ' com sócio' : '') : 'nada vencido' },
      { ico: 'escudo', lbl: 'Folga em 30 dias', val: folga == null ? '—' : brl.format(folga), cls: folga == null ? '' : folga < 0 ? 't-bad' : 't-ok',
        sub: 'caixa ' + (saldo == null ? '—' : brl.format(saldo)) + ' + a receber ' + brl.format(P.receber30) + ' − a pagar e vencido' }
    ]);
    const g = el('div', 'v3-grid'); box.appendChild(g);
    // Calendário
    const cal = cartao(g, 'Calendário de vencimentos', 'quanto mais escuro, mais sai');
    const grade = el('div', 'v3-cal');
    ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].forEach(d => grade.appendChild(el('span', 'v3-cal-h', d)));
    const max = Math.max(...P.dias.map(d => d.total), 1);
    P.dias.forEach(d => {
      const c = el('div', 'v3-dia' + (d.passado ? ' passado' : '') + (d.hoje ? ' hoje' : '') + (d.fora ? ' fora' : ''));
      if (d.total > 0) { const n = Math.ceil((d.total / max) * 4); c.classList.add('n' + n); c.title = dm(d.data) + ': ' + brl2.format(d.total) + ' · ' + d.n + (d.n === 1 ? ' conta' : ' contas'); }
      c.appendChild(el('b', null, String(Number(d.data.slice(8, 10)))));
      if (d.hoje) c.appendChild(el('small', null, 'hoje'));
      else if (d.total > 0) c.appendChild(el('small', null, kfmt(d.total)));
      grade.appendChild(c);
    });
    cal.appendChild(grade);
    // Próximas contas
    const pr = cartao(g, 'Próximas contas', P.proximas.length ? 'vencidas primeiro' : '');
    tabela(pr, [['Conta'], ['Vence', 'num'], ['Valor', 'num'], ['Situação', 'num']],
      P.proximas.map(r => [r.descricao, dm(r.data), brl2.format(r.valor),
        r.estado === 'vencida' ? { tag: 'Vencida', tagCls: 'mau' } : r.estado === 'semana' ? { tag: 'Esta semana', tagCls: 'aviso' } : { tag: 'Agendada', tagCls: 'bom' }]),
      'Nenhuma conta vencida ou vencendo nos próximos 30 dias.');
    // Saídas por semana
    const sem = cartao(g, 'Saídas por semana', 'contas previstas, sem retiradas');
    const imax = P.semanas.reduce((m, s, i, a) => (s.total > a[m].total ? i : m), 0);
    colunas(sem, P.semanas.map(s => ({ l: 'sem. ' + dm(s.inicio), v: s.total })), imax);
    // Por categoria
    const cat = cartao(g, 'Por categoria', 'próximos 30 dias');
    if (!P.categorias.length) cat.appendChild(el('p', 'v3-vazio', 'Nada previsto.'));
    barrasH(cat, P.categorias.map((c, i) => ({ rot: c.grupo, v: c.total, txt: brl.format(c.total), cls: i === 0 ? 'forte' : '' })));
    cat.appendChild(el('p', 'v3-rodape', 'Total: ' + brl.format(P.total30) + ' em ' + P.n30 + (P.n30 === 1 ? ' conta.' : ' contas.')));
  }

  /* ---------- Financeiro › Custos ---------- */
  function custos(box) {
    const L = D('lancamentos'); if (L.status !== 'ok') return;
    const hoje = hojeBase(), K = C.custos(L.data, hoje), F = K.fixo_proximo;
    box.innerHTML = ''; aviso(box);
    const ult = K.meses[K.meses.length - 1];
    kpis(box, [
      { ico: 'carrinho', lbl: 'Custo operacional', val: brl.format(K.media_mensal), sub: 'média por mês · ' + K.meses.slice(-3).map(m => m.rotulo).join(', ') },
      { ico: 'porcento', lbl: 'Custo ÷ recebido', val: K.pct_receita_ultimo == null ? '—' : pct(K.pct_receita_ultimo), cls: K.pct_receita_ultimo > 1 ? 't-bad' : K.pct_receita_ultimo > 0.6 ? 't-warn' : 't-ok',
        sub: ult ? 'em ' + mesLongo(ult.mes) + (K.pct_receita_ultimo > 1 ? ' · custou mais do que entrou' : '') : 'sem mês fechado' },
      { ico: 'tendencia', lbl: 'Contas que subiram', val: String(K.subiram.length), cls: K.subiram.length ? 't-warn' : 't-ok', sub: 'mais de 10% acima da própria média' },
      { ico: 'escudo', lbl: 'Custo fixo de ' + mesLongo(F.competencia), val: brl.format(F.total), sub: F.clientes_para_cobrir ? '= ' + F.clientes_para_cobrir.toLocaleString('pt-BR') + ' clientes de ' + brl.format(F.ticket) + ' para empatar' : 'previsto na planilha' }
    ]);
    const g = el('div', 'v3-grid'); box.appendChild(g);
    // O que mudou
    const mud = cartao(g, 'Variação por conta', ult ? mesLongo(ult.mes) + ' vs média dos meses anteriores' : '');
    const top = K.tabela.filter(t => t.ultimo > 0).slice(0, 8);
    barrasH(mud, top.map(t => ({ rot: t.conta, v: t.ultimo, txt: brl.format(t.ultimo) + (t.variacao == null ? ' · novo' : ' · ' + (t.variacao >= 0 ? '+' : '') + pct(t.variacao)),
      cls: t.estado === 'subiu' ? 'mau' : t.estado === 'caiu' ? 'bom' : t.estado === 'novo' ? 'aviso' : '' })));
    // Gasto por grupo
    const gr = cartao(g, 'Gasto por categoria', K.meses.length ? K.meses[0].rotulo + (K.meses.length > 1 ? ' a ' + K.meses[K.meses.length - 1].rotulo : '') : '');
    const totG = K.grupos.reduce((t, x) => t + x.total, 0);
    rosca(gr, K.grupos.map(x => ({ rot: x.grupo, v: x.total, pct: x.pct })), kfmt(totG), 'em ' + K.meses.length + (K.meses.length === 1 ? ' mês' : ' meses'));
    // Tabela
    const tb = cartao(g, 'Conta por conta', 'pago + vencido por competência; retiradas de sócios ficam fora', 'larga');
    tabela(tb, [['Conta'], ['Categoria'], ['Média anterior', 'num'], [ult ? 'Em ' + mesLongo(ult.mes) : 'Último mês', 'num'], ['Variação', 'num'], ['Ação', 'num']],
      K.tabela.map(t => [t.conta, t.grupo, t.media ? brl2.format(t.media) : '—', t.ultimo ? brl2.format(t.ultimo) : '—',
        t.variacao == null || !t.ultimo ? '—' : { t: (t.variacao >= 0 ? '+' : '') + pct(t.variacao), cls: t.variacao > 0.1 ? 't-bad' : t.variacao < -0.1 ? 't-ok' : '' },
        t.estado === 'subiu' ? { tag: 'Revisar', tagCls: 'mau' } : t.estado === 'novo' ? { tag: 'Novo', tagCls: 'aviso' } : t.estado === 'sem_lancamento' ? { tag: 'Sem lançamento', tagCls: 'neutro' } : { tag: 'Ok', tagCls: 'bom' }]),
      'Nenhum custo lançado nos meses fechados.');
    tb.appendChild(el('p', 'v3-rodape', 'Com poucos meses de controle, “subiu” pode ser só uma conta que não foi lançada no mês anterior (condomínio de agosto, por exemplo). Confira na planilha antes de renegociar.'));
  }

  /* ---------- Financeiro › Time ---------- */
  function time(box) {
    const L = D('lancamentos'); if (L.status !== 'ok') return;
    const hoje = hojeBase(), T = C.time(L.data, hoje);
    box.innerHTML = ''; aviso(box);
    kpis(box, [
      { ico: 'pessoas', lbl: 'Custo do time', val: brl.format(T.custo_mes), sub: 'previsto em ' + mesLongo(T.mes) },
      { ico: 'porcento', lbl: 'Time ÷ receita', val: pct(T.pct_receita), cls: T.pct_receita > 0.6 ? 't-bad' : T.pct_receita > 0.4 ? 't-warn' : 't-ok', sub: 'do MRR de ' + brl.format(T.mrr) },
      { ico: 'estrela', lbl: 'Funções pagas', val: String(T.pessoas), sub: 'com pagamento previsto no mês' },
      { ico: 'alerta', lbl: 'Pagamento atrasado ao time', val: brl.format(T.atraso.total), cls: T.atraso.total > 0 ? 't-bad' : 't-ok', sub: T.atraso.n ? T.atraso.n + (T.atraso.n === 1 ? ' parcela vencida' : ' parcelas vencidas') : 'time em dia' }
    ]);
    const g = el('div', 'v3-grid'); box.appendChild(g);
    const ln = cartao(g, 'Custo do time × receita', 'meses fechados e o previsto de ' + mesLongo(T.mes));
    const lg = el('ul', 'v3-legenda linha topo');
    [['receita', 'Receita (MRR)'], ['time', 'Custo do time']].forEach(([k, t]) => { const li = el('li'); li.appendChild(el('i', 'serie ' + k)); li.appendChild(el('span', null, t)); lg.appendChild(li); });
    ln.appendChild(lg);
    linhas2(ln, T.serie.map(p => ({ l: p.rotulo + (p.planejado ? '*' : ''), time: p.time, receita: p.receita })),
      [{ k: 'receita', cls: 'receita', nome: 'Receita', tracejado: true }, { k: 'time', cls: 'time', nome: 'Custo do time', area: true }]);
    ln.appendChild(el('p', 'v3-rodape', '* previsto. Meses fechados: pago + vencido. A meta de margem de 40% a 50% deixa no máximo 50% a 60% da receita para todos os custos somados.'));
    const de = cartao(g, 'De cada R$ 100 de receita', mesLongo(T.mes));
    barrasH(de, T.de100.map(p => ({ rot: p.parte, v: p.de100 || 0, txt: p.de100 == null ? '—' : brl2.format(p.de100), cls: p.parte === 'Time' ? 'forte' : '' })));
    const sb = el('div', 'v3-sobra ' + (T.sobra.valor < 0 ? 'mau' : 'bom'));
    sb.appendChild(el('span', null, T.sobra.valor < 0 ? 'Falta' : 'Sobra'));
    sb.appendChild(el('b', null, T.sobra.de100 == null ? '—' : brl2.format(Math.abs(T.sobra.de100))));
    de.appendChild(sb);
    de.appendChild(el('p', 'v3-rodape', 'Recorrentes pelo previsto do mês; custos variáveis pela média dos meses fechados. Retiradas de sócios ficam fora.'));
    const fn = cartao(g, 'Custo por função', '', 'larga');
    tabela(fn, [['Função'], ['Custo no mês', 'num'], ['Pago nos últimos 3 meses', 'num'], ['% da receita', 'num'], ['Em atraso', 'num'], ['Situação', 'num']],
      T.funcoes.map(f => [f.funcao, f.custo_mes ? brl2.format(f.custo_mes) : '—', brl2.format(f.pago_3m), { t: pct(f.pct_receita, 1), cls: f.pct_receita > 0.3 ? 't-warn' : '' },
        f.atraso ? { t: brl2.format(f.atraso) + ' · ' + f.meses_atraso + (f.meses_atraso === 1 ? ' mês' : ' meses'), cls: 't-bad' } : '—',
        f.estado === 'atraso' ? { tag: 'Pagar', tagCls: 'mau' } : f.estado === 'ok' ? { tag: 'Em dia', tagCls: 'bom' } : { tag: 'Sem previsão', tagCls: 'neutro' }]),
      'Nenhum pagamento de pessoal na planilha.');
  }

  function desenhar() {
    [['v3-receita', receita], ['v3-pagar', apagar], ['v3-custos', custos], ['v3-time', time]].forEach(([id, fn]) => {
      const b = $(id); if (!b) return;
      try { fn(b); } catch (e) { console.error('v3', id, e); b.innerHTML = ''; b.appendChild(el('p', 'v3-aviso', 'Não foi possível montar esta tela: ' + String(e.message || e))); }
    });
  }
  dash.onData(desenhar);
})();
