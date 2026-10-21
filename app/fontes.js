/* Estado de cada fonte no topo do painel: ao vivo, última leitura boa (atrasada) ou fora do ar. */
(function () {
  const quando = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''); };
  function draw() {
    const box = document.getElementById('chips-fontes');
    if (!box) return;
    const d = dash.data('fontes');
    box.innerHTML = '';
    if (d.status !== 'ok' || !d.data.length) return;
    d.data.forEach(f => {
      const c = document.createElement('span');
      c.className = 'hh-chip' + (f.estado === 'ao_vivo' ? '' : ' danger');
      c.textContent = f.fonte + (f.estado === 'ao_vivo' ? ' ✓' : f.estado === 'ultima_leitura' ? ' · leitura de ' + quando(f.lido_em) : ' · fora do ar');
      if (f.erro) c.title = f.erro;
      box.appendChild(c);
    });
  }
  dash.onData(draw);
})();
