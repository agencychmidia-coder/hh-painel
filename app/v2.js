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
    if (b.dataset.filtro) estado.venc.filtro = b.dataset.filtro;
    abrirSub(b.closest('.hh-panel'), b.dataset.ir);
    desenharListas();
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

  /* ---------- Lista com detalhe ao lado (vencimentos, clientes, oportunidades) ---------- */
  const estado = { venc: { filtro: 'todos', sel: null }, cart: { filtro: 'todos', sel: null }, oport: { filtro: 'abertas', sel: null } };
  function md(box, id, cfg) {
    const st = estado[id], todos = cfg.itens;
    const passa = (i, k) => { const f = cfg.filtros.find(x => x[0] === k); return !f || !f[2] || f[2](i); };
    const vis = todos.filter(i => passa(i, st.filtro));
    if (!vis.some(i => cfg.chave(i) === st.sel)) st.sel = vis.length ? cfg.chave(vis[0]) : null;
    box.innerHTML = '';
    const pl = el('section', 'v2-painel hh-glass');
    const hd = el('div', 'v2-head'); hd.appendChild(el('h3', null, cfg.titulo));
    const fs = el('div', 'v2-filtros'); fs.setAttribute('role', 'group');
    cfg.filtros.forEach(([k, t]) => {
      const b = el('button', null, t); b.setAttribute('aria-pressed', String(st.filtro === k)); b.appendChild(el('i', null, String(todos.filter(i => passa(i, k)).length)));
      b.addEventListener('click', () => { st.filtro = k; desenharListas(); }); fs.appendChild(b);
    });
    hd.appendChild(fs); pl.appendChild(hd);
    if (cfg.nota) pl.appendChild(el('p', 'v2-delta', cfg.nota));
    const ul = el('ul', 'v2-lista'); ul.setAttribute('role', 'listbox');
    if (!vis.length) ul.appendChild(el('li', 'v2-vazio', cfg.vazio));
    vis.forEach(i => {
      const li = el('li', 'v2-item ' + (cfg.classe ? cfg.classe(i) : '')); li.setAttribute('role', 'option'); li.tabIndex = 0;
      li.setAttribute('aria-selected', String(cfg.chave(i) === st.sel));
      cfg.linha(li, i);
      const sel = () => { st.sel = cfg.chave(i); desenharListas(); };
      li.addEventListener('click', sel); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); } });
      ul.appendChild(li);
    });
    pl.appendChild(ul); box.appendChild(pl);
    const atual = vis.find(i => cfg.chave(i) === st.sel);
    const det = el('section', 'v2-det');
    if (!atual) det.appendChild(el('p', 'v2-vazio', 'Selecione um item para ver o detalhe.')); else cfg.detalhe(det, atual);
    box.appendChild(det);
  }
  const linhaPadrao = (li, av, titulo, sub, tag, tagCls, num, numCls) => {
    li.appendChild(el('span', 'v2-av', av));
    const tx = el('div'); tx.appendChild(el('b', null, titulo)); tx.appendChild(el('small', null, sub)); li.appendChild(tx);
    li.appendChild(el('span', 'v2-tag ' + (tagCls || ''), tag));
    li.appendChild(el('span', 'v2-num ' + (numCls || ''), num));
  };
  const cabec = (det, sobre, titulo, tag, tagCls) => {
    const t = el('div', 't'); const a = el('div'); a.appendChild(el('small', null, sobre)); a.appendChild(el('b', null, titulo)); t.appendChild(a);
    if (tag) t.appendChild(el('span', 'v2-tag ' + (tagCls || ''), tag)); det.appendChild(t);
  };
  const grade = (det, pares) => {
    const g = el('div', 'v2-det-grid');
    pares.forEach(([k, v]) => { const c = el('div'); c.appendChild(el('span', null, k)); c.appendChild(el('b', null, v == null || v === '' ? '—' : String(v))); g.appendChild(c); });
    det.appendChild(g);
  };
  const lista = (det, titulo, itens, vazio) => {
    det.appendChild(el('h4', null, titulo));
    const ul = el('ul', 'v2-hist');
    if (!itens.length) ul.appendChild(el('li', null, vazio));
    itens.forEach(([a, b]) => { const li = el('li'); li.appendChild(el('span', null, a)); if (b != null) li.appendChild(el('b', null, b)); ul.appendChild(li); });
    det.appendChild(ul);
  };
  const linkClickUp = (det, url) => { if (!url) return; const a = el('a', 'v2-btn v2-link', 'Abrir no ClickUp ↗'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; det.appendChild(a); };
  const hojeBase = () => { const P = D('parametros'); return P.status === 'ok' ? ((P.data.find(p => p.parametro === 'data_base') || {}).valor || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10); };

  // Vencimentos (a receber e a pagar)
  function itens() {
    const L = D('lancamentos'), P = D('parametros');
    if (L.status !== 'ok' || P.status !== 'ok') return null;
    const hoje = hojeBase(), lim = somaDias(hoje, 30);
    return { hoje, lista: L.data.filter(r => r.status === 'Previsto' && Number(r.valor_em_aberto) > 0 && r.data <= lim && r.grupo !== 'Retirada de sócio')
      .map(r => ({ ...r, tipo: r.natureza === 'Entrada' ? 'receber' : 'pagar', aberto: Number(r.valor_em_aberto), atraso: dias(r.data, hoje) }))
      .sort((a, b) => a.data.localeCompare(b.data) || b.aberto - a.aberto) };
  }
  const prazoTag = n => (n > 0 ? [n + (n === 1 ? ' dia de atraso' : ' dias de atraso'), 'atraso'] : n === 0 ? ['vence hoje', 'hoje'] : null);
  function vencimentos(box) {
    const base = itens(); if (!base) { box.innerHTML = ''; return; }
    md(box, 'venc', {
      titulo: 'Próximos vencimentos', nota: 'Vencidos e próximos 30 dias, pela data de vencimento na planilha.', vazio: 'Nada vencendo nos próximos 30 dias.',
      itens: base.lista, chave: i => i.id, classe: i => i.tipo,
      filtros: [['todos', 'Todos'], ['receber', 'A receber', i => i.tipo === 'receber'], ['pagar', 'A pagar', i => i.tipo === 'pagar']],
      linha: (li, i) => { const pt = prazoTag(i.atraso) || ['vence ' + dm(i.data), ''];
        linhaPadrao(li, iniciais(i.cliente || i.descricao), i.cliente || i.descricao, (i.cliente ? i.descricao + ' · ' : '') + i.grupo, pt[0], pt[1], (i.tipo === 'receber' ? '+ ' : '− ') + brl2.format(i.aberto), i.tipo === 'receber' ? 'entrada' : ''); },
      detalhe: (det, i) => {
        const pt = prazoTag(i.atraso) || ['em ' + (-i.atraso) + ' dias', ''];
        cabec(det, i.tipo === 'receber' ? 'A receber' : 'A pagar', i.cliente || i.descricao, pt[0], pt[1]);
        grade(det, [['Em aberto', brl2.format(i.aberto)], ['Valor previsto', brl2.format(Number(i.valor))], ['Vencimento', dm(i.data)],
          ['Competência', i.competencia ? i.competencia.slice(5, 7) + '/' + i.competencia.slice(0, 4) : ''], ['Conta', i.codigo + ' · ' + i.grupo], ['Descrição', i.descricao]]);
        const L = D('lancamentos').data;
        const mesmo = i.cliente ? (r => r.cliente === i.cliente) : (r => r.codigo === i.codigo && r.descricao === i.descricao);
        const hist = L.filter(r => r.status === 'Realizado' && mesmo(r)).sort((x, y) => y.data.localeCompare(x.data)).slice(0, 4);
        lista(det, i.tipo === 'receber' ? 'Últimos recebimentos deste cliente' : 'Últimos pagamentos desta conta',
          hist.map(r => [dm(r.data) + '/' + r.data.slice(2, 4) + ' · ' + (r.descricao || r.codigo), brl2.format(Number(r.valor))]), 'Nenhum lançamento realizado encontrado.');
      }
    });
  }

  // Carteira: clientes com sinal e detalhe
  const COR = { vermelho: ['Agir hoje', 'atraso'], amarelo: ['Atenção', 'hoje'], verde: ['Em dia', 'ok'], saida: [null, ''] };
  function carteira(box) {
    const d = D('carteira'); if (d.status !== 'ok') { box.innerHTML = ''; return; }
    const hoje = hojeBase();
    md(box, 'cart', {
      titulo: 'Clientes', nota: 'Ordenados por urgência. Clique para ver os sinais.', vazio: 'Nenhum cliente neste filtro.',
      itens: d.data, chave: r => r.cliente, classe: r => 'cor-' + r.cor,
      filtros: [['todos', 'Todos'], ['vermelho', 'Agir hoje', r => r.cor === 'vermelho'], ['amarelo', 'Atenção', r => r.cor === 'amarelo'], ['verde', 'Em dia', r => r.cor === 'verde']],
      linha: (li, r) => { const [t, c] = COR[r.cor] || [r.cor, '']; const motivos = r.motivos ? r.motivos.split(' | ') : [];
        linhaPadrao(li, iniciais(r.cliente), r.cliente, r.fase + (r.growth_os ? ' · Growth OS' : '') + (motivos.length ? ' · ' + motivos.length + (motivos.length === 1 ? ' sinal' : ' sinais') : ''), t || r.fase, c,
          r.proximo_contato ? 'contato ' + dm(r.proximo_contato) : 'sem contato', r.proximo_contato && r.proximo_contato < hoje ? 'vencido' : ''); },
      detalhe: (det, r) => {
        const [t, c] = COR[r.cor] || [r.cor, ''];
        cabec(det, r.fase, r.cliente, t || r.fase, c);
        grade(det, [['Termômetro', r.termometro == null ? 'não preenchido' : r.termometro + ' de 5'], ['Próximo contato', r.proximo_contato ? dm(r.proximo_contato) : 'não marcado'],
          ['Última reunião', r.ult_reuniao ? dm(r.ult_reuniao) + ' (' + dias(r.ult_reuniao, hoje) + ' dias)' : 'nenhuma concluída'],
          ['Mensalidade em atraso', Number(r.atraso_valor) > 0 ? brl2.format(Number(r.atraso_valor)) + ' · ' + r.atraso_dias + ' dias' : 'em dia'],
          ['Tarefas vencidas', String(r.tarefas_vencidas || 0)], ['Growth OS', r.growth_os || 'não usa']]);
        lista(det, 'Por que este sinal', (r.motivos ? r.motivos.split(' | ') : []).map(m => [m, null]), 'Nenhum sinal de risco.');
        if (r.nota) lista(det, 'Nota', [[r.nota, null]], '');
        linkClickUp(det, r.url);
      }
    });
  }

  // Funil: oportunidades com detalhe
  const ABERTA = e => /^[0-5] /.test(e || '');
  function oportunidades(box) {
    const d = D('pipeline'); if (d.status !== 'ok') { box.innerHTML = ''; return; }
    const hoje = hojeBase();
    const its = d.data.map((p, n) => ({ ...p, _k: p.id_oportunidade || String(n), _mrr: Number(p.mrr_fechado) || Number(p.mrr_proposto) || 0 }))
      .sort((a, b) => String(b.etapa).localeCompare(String(a.etapa)) || b._mrr - a._mrr);
    const vencido = p => ABERTA(p.etapa) && (!p.data_proximo_passo || p.data_proximo_passo < hoje);
    md(box, 'oport', {
      titulo: 'Oportunidades', nota: 'Etapa mais avançada primeiro. Próximo passo = data de vencimento da tarefa no ClickUp.', vazio: 'Nenhuma oportunidade neste filtro.',
      itens: its, chave: p => p._k, classe: p => (ABERTA(p.etapa) ? 'aberta' : /^6/.test(p.etapa) ? 'ganha' : 'perdida'),
      filtros: [['abertas', 'Abertas', p => ABERTA(p.etapa)], ['parado', 'Passo vencido ou sem data', vencido], ['ganhas', 'Ganhas', p => /^6/.test(p.etapa)], ['perdidas', 'Perdidas', p => /^7/.test(p.etapa)]],
      linha: (li, p) => { const tag = !ABERTA(p.etapa) ? String(p.etapa).replace(/^\d - /, '') : !p.data_proximo_passo ? 'sem próximo passo' : p.data_proximo_passo < hoje ? 'passo venceu ' + dm(p.data_proximo_passo) : 'passo ' + dm(p.data_proximo_passo);
        linhaPadrao(li, iniciais(p.clinica_cirurgiao), p.clinica_cirurgiao, String(p.etapa || '').replace(/^\d - /, '') + (p.origem_lead ? ' · ' + p.origem_lead : ''), tag, vencido(p) ? 'atraso' : '', p._mrr ? brl.format(p._mrr) : 'sem valor', /^6/.test(p.etapa) ? 'entrada' : ''); },
      detalhe: (det, p) => {
        cabec(det, String(p.etapa || '').replace(/^\d - /, ''), p.clinica_cirurgiao, vencido(p) ? (p.data_proximo_passo ? 'próximo passo vencido' : 'sem próximo passo') : null, 'atraso');
        grade(det, [['MRR proposto', p.mrr_proposto ? brl.format(Number(p.mrr_proposto)) : ''], ['MRR fechado', p.mrr_fechado ? brl.format(Number(p.mrr_fechado)) : ''], ['Próximo passo', p.data_proximo_passo ? dm(p.data_proximo_passo) : 'sem data'],
          ['Origem', p.origem_lead], ['Oferta', p.oferta], ['Cidade', p.cidade], ['Responsável', p.responsavel], ['Entrou em', p.data_entrada ? dm(p.data_entrada) + '/' + p.data_entrada.slice(2, 4) : ''],
          [/^7/.test(p.etapa) ? 'Motivo da perda' : 'Fechamento', /^7/.test(p.etapa) ? p.motivo_perda : (p.data_fechamento ? dm(p.data_fechamento) + '/' + p.data_fechamento.slice(2, 4) : '')]]);
        linkClickUp(det, p.url);
      }
    });
  }

  function desenharListas() {
    document.querySelectorAll('.v2-venc').forEach(vencimentos);
    const c = $('md-carteira'); if (c) carteira(c);
    const o = $('md-oport'); if (o) oportunidades(o);
    aplicarBusca();
  }

  // Visão geral: o que pede ação hoje, com atalho para a tela certa
  function agir() {
    const c = D('carteira');
    if (c.status === 'ok') {
      const v = c.data.filter(r => r.cor === 'vermelho').length, a = c.data.filter(r => r.cor === 'amarelo').length;
      fill('ag-clientes', String(v + a), v ? 't-bad' : a ? 't-warn' : 't-ok');
      fill('ag-clientes-sub', v + ' em vermelho · ' + a + ' em atenção');
    } else { fill('ag-clientes', '—'); fill('ag-clientes-sub', 'Carteira indisponível'); }
    const ra = D('recebiveis_atrasados');
    if (ra.status === 'ok') {
      const tot = ra.data.reduce((t, r) => t + r.valor, 0);
      fill('ag-receber', brl2.format(tot), tot > 0 ? 't-bad' : 't-ok');
      fill('ag-receber-sub', ra.data.length ? ra.data.length + (ra.data.length === 1 ? ' parcela · até ' : ' parcelas · até ') + ra.data[0].dias + (ra.data[0].dias === 1 ? ' dia' : ' dias') : 'Nada em atraso');
    }
    const pp = D('pipeline');
    if (pp.status === 'ok') {
      const hoje = hojeBase(), ab = pp.data.filter(p => ABERTA(p.etapa)), venc = ab.filter(p => !p.data_proximo_passo || p.data_proximo_passo < hoje);
      fill('ag-funil', String(venc.length), venc.length ? 't-warn' : 't-ok');
      fill('ag-funil-sub', 'de ' + ab.length + ' abertas · ' + ab.filter(p => !p.data_proximo_passo).length + ' sem data');
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir-secao]'); if (!b) return;
    const nav = document.querySelector(`.hh-seg button[data-tab="${b.dataset.irSecao}"]`); if (nav) nav.click();
    if (b.dataset.irSub) abrirSub(document.getElementById(b.dataset.irSecao), b.dataset.irSub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

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

  dash.onData(() => { cartoes(); desenharListas(); agir(); });
  const ini = location.hash.slice(1);
  secao(PAG[ini] ? ini : 'geral');
})();
