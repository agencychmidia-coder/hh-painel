/* Aba Carteira: números do topo e fonte dos dados. A lista de clientes com detalhe fica em v2.js.
   Os sinais e as regras ficam em /api/dados (montarCarteira). */
(function () {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const par = n => { const d = dash.data('parametros'); const p = d.status === 'ok' ? d.data.find(x => x.parametro === n) : null; return p ? String(p.valor || '') : ''; };
  const set = (id, txt, cls) => { const el = document.getElementById(id); if (!el) return; el.classList.remove('dash-skeleton', 't-bad', 't-warn', 't-ok'); if (cls) el.classList.add(cls); el.textContent = txt; };
  function draw() {
    const nota = document.getElementById('carteira-fonte');
    if (!nota || dash.data('parametros').status !== 'ok') return;
    const d = dash.data('carteira'), rows = d.status === 'ok' ? d.data : [];
    const erro = par('fonte') === 'foto' ? 'o painel não conseguiu ler os dados ao vivo e está mostrando a foto antiga' : par('carteira_erro'), gerro = par('growthos_erro');
    nota.textContent = erro ? 'Carteira indisponível: ' + erro + '.'
      : 'Fontes: ClickUp (lista Carteira de Clientes, tarefas e reuniões), planilha financeira' + (gerro ? ' — Growth OS fora (' + gerro + ').' : ' e Growth OS.');
    const n = c => rows.filter(r => r.cor === c).length;
    set('kpi-cart-verm', String(n('vermelho')), n('vermelho') ? 't-bad' : 't-ok');
    set('kpi-cart-amar', String(n('amarelo')), n('amarelo') ? 't-warn' : '');
    set('kpi-cart-verde', String(n('verde')));
    const atr = rows.filter(r => r.cor !== 'saida').reduce((t, r) => t + (Number(r.atraso_valor) || 0), 0);
    set('kpi-cart-atraso', brl.format(atr), atr > 0 ? 't-bad' : 't-ok');
  }
  dash.onData(draw);
  if (location.hash === '#carteira') { const b = document.querySelector('.hh-seg button[data-tab="carteira"]'); if (b) b.click(); }
})();
