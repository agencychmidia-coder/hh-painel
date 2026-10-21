/* Funil vindo do ClickUp: mostra de onde veio o pipeline e as oportunidades com descrição fora do padrão. */
(function () {
  const par = n => { const d = dash.data('parametros'); const p = d.status === 'ok' ? d.data.find(x => x.parametro === n) : null; return p ? String(p.valor || '') : ''; };
  const linha = (tb, txt) => { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 2; td.style.textAlign = 'left'; td.textContent = txt; tr.appendChild(td); tb.appendChild(tr); };
  function draw() {
    const nota = document.getElementById('funil-fonte'), tb = document.querySelector('#tb-alertas tbody'), pl = document.getElementById('pill-alertas');
    if (!nota || !tb || dash.data('parametros').status !== 'ok') return;
    const fonte = par('pipeline_fonte'), erro = par('pipeline_erro');
    nota.textContent = fonte === 'clickup'
      ? 'Fonte: ClickUp › HH - Comercial › Pipeline de Vendas. Etapa = status da tarefa; repescagem conta como contato inicial.'
      : 'Fonte: planilha “HH — Pipeline Comercial”' + (erro ? ' — o ClickUp não respondeu (' + erro + ').' : '.');
    const a = dash.data('pipeline_alertas'), rows = a.status === 'ok' ? a.data : [];
    tb.innerHTML = '';
    pl.classList.remove('dash-skeleton', 'up', 'down', 'warn');
    if (fonte !== 'clickup') { linha(tb, 'Aparece quando o pipeline vier do ClickUp.'); pl.textContent = 'ClickUp fora'; pl.classList.add('warn'); return; }
    if (!rows.length) { linha(tb, 'Nenhuma oportunidade fora do padrão.'); pl.textContent = 'Tudo no padrão'; pl.classList.add('up'); return; }
    const fora = rows.filter(r => /fora das contas/.test(r.problema)).length;
    pl.textContent = rows.length + (rows.length === 1 ? ' problema' : ' problemas') + (fora ? ' · ' + fora + ' fora das contas' : '');
    pl.classList.add(fora ? 'down' : 'warn');
    rows.forEach(r => {
      const tr = document.createElement('tr'), t1 = document.createElement('td'), t2 = document.createElement('td');
      if (r.url) { const l = document.createElement('a'); l.href = r.url; l.target = '_blank'; l.rel = 'noopener'; l.textContent = r.oportunidade; t1.appendChild(l); } else t1.textContent = r.oportunidade;
      t2.textContent = r.problema; t2.className = /fora das contas/.test(r.problema) ? 't-bad' : 't-warn';
      [t1, t2].forEach(c => { c.style.textAlign = 'left'; c.style.whiteSpace = 'normal'; });
      tr.appendChild(t1); tr.appendChild(t2); tb.appendChild(tr);
    });
  }
  dash.onData(draw);
})();
