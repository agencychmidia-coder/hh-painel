/* Adaptador: reproduz a API do painel do Claude (dash.calc / dash.data / dash.onData) no site independente.
   Fonte principal: /api/dados (planilha, ClickUp e Growth OS, cada um com última leitura boa). Se a API falhar, usa a foto em /data e avisa no topo. */
window.dash = (function () {
  const calcs = {}, raw = {}, cache = {}, subs = [];
  let state = 'loading', err = '';
  const api = {
    calc(id, c) { calcs[id] = c; },
    data(id) {
      if (state !== 'ok') return { status: state, data: [], message: err };
      try {
        if (!(id in cache)) cache[id] = id in raw ? raw[id] : calcs[id].fn(...calcs[id].inputs.map(i => api.data(i).data));
        return { status: 'ok', data: cache[id] };
      } catch (e) { console.error('calculo', id, e); return { status: 'error', data: [], message: String(e) }; }
    },
    onData(fn) { subs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} },
    refresh() {}, params() { return {}; }, setParams() {}, resetParams() {}
  };
  const run = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const rows = j => j && j.cols ? j.rows.map(r => Object.fromEntries(j.cols.map((c, i) => [c, r[i]]))) : (j || []);
  const getJSON = u => fetch(u, { cache: 'no-store', credentials: 'same-origin' }).then(r => r.json().then(j => { if (!r.ok || j.erro) throw new Error((j.erro || String(r.status)) + (j.detalhe ? '|' + j.detalhe : '')); return j; }));
  const usar = (d, fonte, motivo) => {
    raw.lancamentos = rows(d.lancamentos); raw.pipeline = rows(d.pipeline); raw.clientes = rows(d.clientes); raw.pipeline_alertas = rows(d.pipeline_alertas || []); raw.carteira = rows(d.carteira || []); raw.fontes = rows(d.fontes || []);
    raw.parametros = (d.parametros || []).filter(p => p.parametro !== 'fonte').concat([{ parametro: 'fonte', valor: fonte }, { parametro: 'gerado_em', valor: d.gerado_em || '' }, { parametro: 'motivo_foto', valor: motivo || '' }]);
    state = 'ok'; run();
  };
  getJSON('/api/dados')
    .then(d => usar(d, d.fonte_financeiro || 'ao_vivo', d.motivo_financeiro || ''))
    .catch(e1 => Promise.all(['lancamentos', 'pipeline', 'parametros'].map(n => getJSON('/data/' + n + '.json')))
      .then(([l, p, pa]) => usar({ lancamentos: l, pipeline: p, parametros: pa, clientes: { cols: ['nome', 'status'], rows: [] } }, 'foto', String(e1.message || e1)))
      .catch(e2 => { state = 'error'; err = String(e2); run(); }));
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 150); });
  return api;
})();
