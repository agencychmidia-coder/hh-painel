/* Painel HH v2: título da página, subabas, busca e a visão geral do Financeiro
   (cartões com gráfico, faixa de 30 dias e vencimentos com detalhe). Só lê dados: não altera nada. */
(function () {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const dm = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
  const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  const somaDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const iniciais = s => String(s || '?').replace(/^dra?\.?\s+/i, '').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
  const fill = (id, txt, cls) => { const e = $(id); if (!e) return; e.classList.remove('dash-skeleton', 't-bad', 't-ok', 't-warn'); if (cls) e.classList.add(cls); e.textContent = txt; };
  const D = id => dash.data(id);

  /* ---------- Título, subtítulo e trilha por seção ---------- */
  const PAG = {
    geral: ['Visão geral', 'Resultado, caixa e compromissos da Holistic Health.'],
    financeiro: ['Financeiro', 'Tudo o que entra, sai e vence — a receber e a pagar.'],
    metas: ['Metas', 'Quanto falta para empatar e para a margem de 40% a 50%.'],
    funil: ['Funil de vendas', 'Oportunidades por etapa, conversão e valor em jogo.'],
    carteira: ['Carteira', 'Quem precisa de atenção hoje, cliente a cliente.']
  };
  function secao(id) {
    const p = PAG[id]; if (!p) return;
    $('page-title').textContent = p[0]; $('page-sub').textContent = p[1]; $('crumb').textContent = p[0];
    document.querySelector('.hh-main').setAttribute('data-sec', id);
    aplicarBusca();
  }
  document.querySelectorAll('.hh-seg button[data-tab]').forEach(b => b.addEventListener('click', () => secao(b.dataset.tab)));

  /* ---------- Subabas ---------- */
  function abrirSub(painel, sub) {
    painel.querySelectorAll('.hh-subtabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sub === sub)));
    painel.querySelectorAll('.hh-sub').forEach(s => { s.hidden = s.dataset.sub !== sub; });
    window.dispatchEvent(new Event('resize')); // redesenha os gráficos que estavam escondidos
    aplicarBusca();
  }
  document.querySelectorAll('.hh-subtabs').forEach(bar => bar.addEventListener('click', e => {
    const b = e.target.closest('button[data-sub]'); if (b) abrirSub(bar.closest('.hh-panel'), b.dataset.sub);
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]'); if (!b) return;
    if (b.dataset.filtro) filtro = b.dataset.filtro;
    abrirSub(b.closest('.hh-panel'), b.dataset.ir);
    desenharVencimentos();
  });

  /* ---------- Busca: esconde linhas e itens que não batem, na tela visível ---------- */
  const busca = $('hh-busca');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function aplicarBusca() {
    const q = norm(busca && busca.value).trim();
    document.querySelectorAll('.hh-panel:not([hidden]) tbody tr, .hh-panel:not([hidden]) .v2-item').forEach(r => {
      r.classList.toggle('hh-oculto-busca', !!q && !norm(r.textContent).includes(q));
    });
  }
  if (busca) busca.addEventListener('input', aplicarBusca);

  /* ---------- Gráficos pequenos (SVG puro) ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, at) => { const e = document.createElementNS(NS, tag); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  function barras(box, pts) {
    box.innerHTML = ''; if (!pts.length) return;
    const W = 240, H = 96, max = Math.max(...pts.map(p => p.v), 1), n = pts.length, bw = Math.min(26, (W / n) * 0.55);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img' });
    pts.forEach((p, i) => {
      const x = (W / n) * i + (W / n - bw) / 2, h = Math.max(4, (p.v / max) * (H - 22));
      const r = svgEl('rect', { x, y: H - 16 - h, width: bw, height: h, rx: bw / 2, fill: i === n - 1 ? 'var(--chart-1)' : 'oklch(0.68 0.12 262 / .45)' });
      const t = svgEl('title', {}); t.textContent = p.l + ': ' + brl.format(p.v); r.appendChild(t); svg.appendChild(r);
      const lb = svgEl('text', { x: x + bw / 2, y: H - 2, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--muted-foreground)' }); lb.textContent = p.l; svg.appendChild(lb);
    });
    box.appendChild(svg);
  }
  function linha(box, pts) {
    box.innerHTML = ''; if (pts.length < 2) return;
    const W = 240, H = 96, vs = pts.map(p => p.v), min = Math.min(...vs), max = Math.max(...vs), amp = max - min || 1;
    const xy = pts.map((p, i) => [8 + (i * (W - 16)) / (pts.length - 1), 10 + (1 - (p.v - min) / amp) * (H - 34)]);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img' });
    const d = xy.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    svg.appendChild(svgEl('path', { d: d + ` L ${xy[xy.length - 1][0]} ${H - 16} L ${xy[0][0]} ${H - 16} Z`, fill: 'oklch(0.68 0.18 262 / .16)' }));
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: 'var(--chart-1)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
    xy.forEach((q, i) => {
      const c = svgEl('circle', { cx: q[0], cy: q[1], r: 3.5, fill: 'var(--background)', stroke: 'var(--chart-1)', 'stroke-width': 2 });
      const t = svgEl('title', {}); t.textContent = pts[i].l + ': ' + brl.format(pts[i].v); c.appendChild(t); svg.appendChild(c);
      const lb = svgEl('text', { x: q[0], y: H - 2, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--muted-foreground)' }); lb.textContent = pts[i].l; svg.appendChild(lb);
    });
    box.appendChild(svg);
  }
  const variacao = (a, b) => { if (!a) return null; return (b - a) / a; };
  const deltaTxt = (box, v, sufixo) => {
    box.innerHTML = '';
    if (v == null) { box.textContent = sufixo; return; }
    const s = el('span', v >= 0 ? 'up' : 'down', (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v * 100).toFixed(0) + '%');
    box.appendChild(s); box.appendChild(document.createTextNode(' ' + sufixo));
  };

  /* ---------- Vencimentos (a receber e a pagar) ---------- */
  let filtro = 'todos', selecionado = null;
  function itens() {
    const L = D('lancamentos'), P = D('parametros');
    if (L.status !== 'ok' || P.status !== 'ok') return null;
    const hoje = (P.data.find(p => p.parametro === 'data_base') || {}).valor || new Date().toISOString().slice(0, 10);
    const lim = somaDias(hoje, 30);
    return { hoje, lista: L.data.filter(r => r.status === 'Previsto' && Number(r.valor_em_aberto) > 0 && r.data <= lim && r.grupo !== 'Retirada de sócio')
      .map(r => ({ ...r, tipo: r.natureza === 'Entrada' ? 'receber' : 'pagar', aberto: Number(r.valor_em_aberto), atraso: dias(r.data, hoje) }))
      .sort((a, b) => a.data.localeCompare(b.data) || b.aberto - a.aberto) };
  }
  function desenharVencimentos() {
    const base = itens();
    document.querySelectorAll('.v2-venc').forEach(box => {
      box.innerHTML = '';
      if (!base) return;
      const todos = base.lista, n = t => todos.filter(i => t === 'todos' || i.tipo === t).length;
      const vis = todos.filter(i => filtro === 'todos' || i.tipo === filtro);
      if (!vis.some(i => i.id === selecionado)) selecionado = vis.length ? vis[0].id : null;

      const pl = el('section', 'v2-painel hh-glass');
      const hd = el('div', 'v2-head'); hd.appendChild(el('h3', null, 'Próximos vencimentos'));
      const fs = el('div', 'v2-filtros'); fs.setAttribute('role', 'group');
      [['todos', 'Todos'], ['receber', 'A receber'], ['pagar', 'A pagar']].forEach(([k, t]) => {
        const b = el('button', null, t); b.setAttribute('aria-pressed', String(filtro === k)); b.appendChild(el('i', null, String(n(k))));
        b.addEventListener('click', () => { filtro = k; desenharVencimentos(); }); fs.appendChild(b);
      });
      hd.appendChild(fs); pl.appendChild(hd);
      pl.appendChild(el('p', 'v2-delta', 'Vencidos e próximos 30 dias, pela data de vencimento na planilha.'));
      const ul = el('ul', 'v2-lista');
      if (!vis.length) ul.appendChild(el('li', 'v2-vazio', 'Nada vencendo nos próximos 30 dias.'));
      vis.forEach(i => {
        const li = el('li', 'v2-item ' + i.tipo); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i.id === selecionado)); li.tabIndex = 0;
        li.appendChild(el('span', 'v2-av', iniciais(i.cliente || i.descricao)));
        const tx = el('div'); tx.appendChild(el('b', null, i.cliente || i.descricao)); tx.appendChild(el('small', null, (i.cliente ? i.descricao + ' · ' : '') + i.grupo)); li.appendChild(tx);
        li.appendChild(el('span', 'v2-tag' + (i.atraso > 0 ? ' atraso' : i.atraso === 0 ? ' hoje' : ''), i.atraso > 0 ? i.atraso + (i.atraso === 1 ? ' dia de atraso' : ' dias de atraso') : i.atraso === 0 ? 'vence hoje' : 'vence ' + dm(i.data)));
        li.appendChild(el('span', 'v2-num' + (i.tipo === 'receber' ? ' entrada' : ''), (i.tipo === 'receber' ? '+ ' : '− ') + brl2.format(i.aberto)));
        const sel = () => { selecionado = i.id; desenharVencimentos(); };
        li.addEventListener('click', sel); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); } });
        ul.appendChild(li);
      });
      pl.appendChild(ul); box.appendChild(pl);
      box.appendChild(detalhe(vis.find(i => i.id === selecionado), base.hoje));
    });
    aplicarBusca();
  }
  function detalhe(i, hoje) {
    const det = el('section', 'v2-det');
    if (!i) { det.appendChild(el('p', 'v2-vazio', 'Selecione um vencimento para ver o detalhe.')); return det; }
    const t = el('div', 't'); const a = el('div');
    a.appendChild(el('small', null, i.tipo === 'receber' ? 'A receber' : 'A pagar'));
    a.appendChild(el('b', null, i.cliente || i.descricao)); t.appendChild(a);
    t.appendChild(el('span', 'v2-tag' + (i.atraso > 0 ? ' atraso' : ''), i.atraso > 0 ? i.atraso + ' dias de atraso' : i.atraso === 0 ? 'vence hoje' : 'em ' + (-i.atraso) + ' dias'));
    det.appendChild(t);
    const g = el('div', 'v2-det-grid');
    [['Em aberto', brl2.format(i.aberto)], ['Valor previsto', brl2.format(Number(i.valor))], ['Vencimento', dm(i.data)],
     ['Competência', i.competencia ? i.competencia.slice(5, 7) + '/' + i.competencia.slice(0, 4) : '—'], ['Conta', i.codigo + ' · ' + i.grupo], ['Descrição', i.descricao || '—']]
      .forEach(([k, v]) => { const c = el('div'); c.appendChild(el('span', null, k)); c.appendChild(el('b', null, v)); g.appendChild(c); });
    det.appendChild(g);
    // Histórico: últimos pagamentos do mesmo cliente (ou da mesma conta).
    const L = D('lancamentos').data;
    const chave = i.cliente ? (r => r.cliente === i.cliente) : (r => r.codigo === i.codigo && r.descricao === i.descricao);
    const hist = L.filter(r => r.status === 'Realizado' && chave(r)).sort((x, y) => y.data.localeCompare(x.data)).slice(0, 4);
    det.appendChild(el('h4', null, i.tipo === 'receber' ? 'Últimos recebimentos deste cliente' : 'Últimos pagamentos desta conta'));
    const ul = el('ul', 'v2-hist');
    if (!hist.length) ul.appendChild(el('li', null, 'Nenhum lançamento realizado encontrado.'));
    hist.forEach(r => { const li = el('li'); li.appendChild(el('span', null, dm(r.data) + '/' + r.data.slice(2, 4) + ' · ' + (r.descricao || r.codigo))); li.appendChild(el('b', null, brl2.format(Number(r.valor)))); ul.appendChild(li); });
    det.appendChild(ul);
    return det;
  }

  /* ---------- Cartões da visão geral ---------- */
  function cartoes() {
    const L = D('lancamentos'), P = D('parametros');
    if (L.status !== 'ok' || P.status !== 'ok') return;
    const hoje = (P.data.find(p => p.parametro === 'data_base') || {}).valor || new Date().toISOString().slice(0, 10);

    // 1. A receber vencido
    const ra = D('recebiveis_atrasados');
    if (ra.status === 'ok') {
      const tot = ra.data.reduce((t, r) => t + r.valor, 0);
      fill('v2-rec-total', brl2.format(tot), tot > 0 ? 't-bad' : 't-ok');
      fill('v2-rec-sub', ra.data.length ? ra.data.length + (ra.data.length === 1 ? ' parcela vencida' : ' parcelas vencidas') : 'Nenhuma mensalidade em atraso');
      const ul = $('v2-rec-lista'); ul.innerHTML = '';
      if (!ra.data.length) ul.appendChild(el('li', 'vazio', 'Tudo em dia'));
      ra.data.slice(0, 3).forEach(r => { const li = el('li'); li.appendChild(el('span', null, r.cliente)); li.appendChild(el('span', null, r.dias + (r.dias === 1 ? ' dia' : ' dias'))); ul.appendChild(li); });
    }
    // 2. Recebido de clientes por mês de caixa (últimos 6 meses)
    const meses = {};
    L.data.filter(r => r.status === 'Realizado' && r.grupo === 'Receita').forEach(r => { meses[r.mes_caixa] = (meses[r.mes_caixa] || 0) + Number(r.valor); });
    const mAtual = hoje.slice(0, 7), ks = Object.keys(meses).filter(m => m <= mAtual).sort().slice(-6);
    const pts = ks.map(m => ({ l: MES[Number(m.slice(5, 7)) - 1], v: meses[m] }));
    if (ks.length) {
      fill('v2-recebido', brl.format(meses[ks[ks.length - 1]] || 0));
      deltaTxt($('v2-recebido-sub'), ks.length > 1 ? variacao(meses[ks[ks.length - 2]], meses[ks[ks.length - 1]]) : null,
        'em ' + MES[Number(ks[ks.length - 1].slice(5, 7)) - 1] + (ks[ks.length - 1] === mAtual ? ' (parcial)' : '') + (ks.length > 1 ? ' vs mês anterior' : ''));
      barras($('v2-recebido-ch'), pts);
    }
    // 3. Ticket médio por mês (MRR ÷ clientes)
    const mm = D('mrr_mensal');
    if (mm.status === 'ok') {
      const serie = mm.data.filter(r => r.clientes > 0 && r.mes <= mAtual).map(r => ({ l: MES[Number(r.mes.slice(5, 7)) - 1], v: r.mrr / r.clientes, mes: r.mes }));
      const at = serie.filter(s => s.mes <= mAtual).pop() || serie[serie.length - 1];
      if (at) {
        fill('v2-ticket', brl.format(at.v));
        const ant = serie[serie.indexOf(at) - 1];
        deltaTxt($('v2-ticket-sub'), ant ? variacao(ant.v, at.v) : null, 'por cliente em ' + at.l + (ant ? ' vs mês anterior' : ''));
        linha($('v2-ticket-ch'), serie);
      }
    }
    // 4. Contas vencidas (a pagar)
    const vc = D('vencidos');
    if (vc.status === 'ok') {
      const tot = vc.data.reduce((t, r) => t + r.valor, 0);
      fill('v2-pag-total', brl2.format(tot), tot > 0 ? 't-bad' : 't-ok');
      fill('v2-pag-sub', vc.data.length ? vc.data.length + (vc.data.length === 1 ? ' conta' : ' contas') + ', inclui dívida com sócios' : 'Nada vencido');
      const ul = $('v2-pag-lista'); ul.innerHTML = '';
      if (!vc.data.length) ul.appendChild(el('li', 'vazio', 'Nada vencido'));
      [...vc.data].sort((a, b) => b.valor - a.valor).slice(0, 3).forEach(r => { const li = el('li'); li.appendChild(el('span', null, r.descricao)); li.appendChild(el('span', null, brl.format(r.valor))); ul.appendChild(li); });
    }
    // Faixa: saldo hoje e próximos 30 dias
    const ca = D('caixa_atual');
    if (ca.status === 'ok') { fill('v2-saldo', brl2.format(ca.data[0].saldo), ca.data[0].saldo < 0 ? 't-bad' : 't-ok'); fill('v2-saldo-sub', 'Conta PJ, pelo extrato conciliado'); }
    const it = itens();
    if (it) {
      const fut = it.lista.filter(i => i.data >= hoje);
      const rec = fut.filter(i => i.tipo === 'receber'), pag = fut.filter(i => i.tipo === 'pagar');
      fill('v2-rec30', brl2.format(rec.reduce((t, i) => t + i.aberto, 0)));
      fill('v2-rec30-sub', rec.length + (rec.length === 1 ? ' parcela' : ' parcelas') + ' até ' + dm(somaDias(hoje, 30)));
      fill('v2-pag30', brl2.format(pag.reduce((t, i) => t + i.aberto, 0)));
      fill('v2-pag30-sub', pag.length + (pag.length === 1 ? ' conta' : ' contas') + ' até ' + dm(somaDias(hoje, 30)) + ', sem retiradas');
    }
  }

  dash.onData(() => { cartoes(); desenharVencimentos(); });
  const ini = location.hash.slice(1);
  secao(PAG[ini] ? ini : 'geral');
})();
