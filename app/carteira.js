/* Aba Carteira: quem agir hoje. Os sinais e as regras ficam em /api/dados (montarCarteira); aqui só desenha. */
(function () {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const par = n => { const d = dash.data('parametros'); const p = d.status === 'ok' ? d.data.find(x => x.parametro === n) : null; return p ? String(p.valor || '') : ''; };
  const dm = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
  const COR = { vermelho: ['Agir hoje', 'down'], amarelo: ['Atenção', 'warn'], verde: ['Em dia', 'up'], saida: ['Em saída', ''] };
  const set = (id, txt, cls) => { const el = document.getElementById(id); if (!el) return; el.classList.remove('dash-skeleton', 't-bad', 't-warn', 't-ok'); if (cls) el.classList.add(cls); el.textContent = txt; };
  function draw() {
    const tb = document.querySelector('#tb-carteira tbody'), nota = document.getElementById('carteira-fonte');
    if (!tb || dash.data('parametros').status !== 'ok') return;
    const d = dash.data('carteira'), rows = d.status === 'ok' ? d.data : [];
    const erro = par('carteira_erro'), gerro = par('growthos_erro');
    nota.textContent = erro ? 'Carteira indisponível: ' + erro + '.'
      : 'Fontes: ClickUp (lista Carteira de Clientes, tarefas e reuniões), planilha financeira' + (gerro ? ' — Growth OS fora (' + gerro + ').' : ' e Growth OS.');
    const n = c => rows.filter(r => r.cor === c).length;
    set('kpi-cart-verm', String(n('vermelho')), n('vermelho') ? 't-bad' : 't-ok');
    set('kpi-cart-amar', String(n('amarelo')), n('amarelo') ? 't-warn' : '');
    set('kpi-cart-verde', String(n('verde')));
    const atr = rows.filter(r => r.cor !== 'saida').reduce((t, r) => t + (Number(r.atraso_valor) || 0), 0);
    set('kpi-cart-atraso', brl.format(atr), atr > 0 ? 't-bad' : 't-ok');
    tb.innerHTML = '';
    if (!rows.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.style.textAlign = 'left'; td.textContent = erro ? 'Sem dados da carteira.' : 'Nenhum cliente na lista Carteira de Clientes (CS).'; tr.appendChild(td); tb.appendChild(tr); return; }
    rows.forEach(r => {
      const tr = document.createElement('tr'), c = [0, 1, 2, 3, 4].map(() => document.createElement('td'));
      if (r.url) { const a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.cliente; c[0].appendChild(a); } else c[0].textContent = r.cliente;
      const f = document.createElement('div'); f.className = 'hh-note'; f.style.margin = '2px 0 0'; f.textContent = r.fase + (r.growth_os ? ' · Growth OS' : ''); c[0].appendChild(f);
      const [txt, cls] = r.cor === 'saida' ? [r.fase, ''] : (COR[r.cor] || [r.cor, '']); const p = document.createElement('span'); p.className = 'hh-pill' + (cls ? ' ' + cls : ''); p.textContent = txt; c[1].appendChild(p);
      const ul = document.createElement('ul'); ul.className = 'hh-list'; ul.style.margin = '0';
      (r.motivos ? r.motivos.split(' | ') : ['nenhum sinal de risco']).forEach(m => { const li = document.createElement('li'); li.textContent = m; ul.appendChild(li); });
      if (r.nota) { const li = document.createElement('li'); li.className = 'hh-note'; li.textContent = 'Nota: ' + r.nota; ul.appendChild(li); }
      c[2].appendChild(ul);
      c[3].textContent = dm(r.proximo_contato);
      c[4].textContent = r.termometro == null ? '—' : r.termometro + '/5';
      c.forEach(td => { td.style.textAlign = 'left'; td.style.whiteSpace = 'normal'; td.style.verticalAlign = 'top'; tr.appendChild(td); });
      tb.appendChild(tr);
    });
  }
  dash.onData(draw);
  if (location.hash === '#carteira') { const b = document.querySelector('.hh-seg button[data-tab="carteira"]'); if (b) b.click(); }
})();
