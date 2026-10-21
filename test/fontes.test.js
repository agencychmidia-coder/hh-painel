// Testes da leitura das fontes: nova tentativa, última leitura boa e falha isolada.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buscar, lerPlanilha } from '../lib/fontes.js';
import { montar } from '../api/dados.js';

const resp = (status, corpo, tipo = 'application/json') => ({ ok: status < 400, status, headers: { get: () => tipo }, text: async () => corpo });

test('buscar tenta de novo em 5xx e devolve a segunda resposta', async () => {
  let n = 0;
  mock.method(globalThis, 'fetch', async () => (++n === 1 ? resp(503, 'x') : resp(200, '{"a":1}')));
  const r = await buscar('https://x', { pausa: 1 });
  assert.equal(r.status, 200); assert.equal(n, 2);
  mock.restoreAll();
});

test('planilha: página HTML de "não encontrado" passageira é repetida', async () => {
  let n = 0;
  mock.method(globalThis, 'fetch', async () => (++n === 1 ? resp(404, '<html>Página não encontrada</html>', 'text/html') : resp(200, JSON.stringify({ lancamentos: { cols: [], rows: [] } }))));
  const r = await lerPlanilha('https://script.google.com/macros/s/x/exec?t=abcdefghij');
  assert.equal(r.ok, true); assert.equal(n, 2);
  mock.restoreAll();
});

test('planilha: URL sem token nem tenta buscar', async () => {
  const r = await lerPlanilha('https://script.google.com/macros/s/x/exec');
  assert.equal(r.ok, false); assert.equal(r.erro, 'url_sem_token');
});

const FONTE = {
  lancamentos: { cols: ['id', 'data', 'competencia', 'codigo', 'status', 'cliente', 'valor', 'descricao'], rows: [[1, '2026-10-01', '2026-10', '01.01', 'Realizado', 'Dr. X', 100, 'a']] },
  clientes: { cols: ['nome', 'status'], rows: [] }, parametros: [{ parametro: 'caixa_inicial', valor: 0 }], gerado_em: '2026-10-21T10:00:00'
};
const base = { hoje: '2026-10-21', agora: Date.parse('2026-10-21T13:00:00Z') };
const vazioClickup = { ok: true, dados: { clientes: [], abertas: [], reunioes: [] } };

test('tudo no ar: fontes ao vivo e tudo marcado para guardar', () => {
  const s = montar({ ...base, plan: { ok: true, dados: FONTE }, pipe: { ok: true, dados: [] }, cart: vazioClickup, gos: { ok: true, dados: [] } });
  assert.deepEqual(s.fontes.rows.map(r => r[1]), ['ao_vivo', 'ao_vivo', 'ao_vivo']);
  assert.equal(s.fonte_financeiro, 'ao_vivo');
  assert.ok(s._guardar.financeiro && s._guardar.pipeline && s._guardar.carteira_clickup && s._guardar.growthos);
});

test('planilha fora com última leitura: painel segue com a leitura antiga e o resto ao vivo', () => {
  const ult = { financeiro: { dados: { ...FONTE, lancamentos: { cols: ['id'], rows: [] }, parametros: [] }, lido_em: '2026-10-21T12:00:00Z' } };
  const s = montar({ ...base, ult, plan: { ok: false, erro: 'implantacao_nao_encontrada', detalhe: 'HTTP 404' }, pipe: { ok: true, dados: [] }, cart: vazioClickup, gos: { ok: true, dados: [] } });
  assert.equal(s.erro, undefined);
  assert.equal(s.fonte_financeiro, 'ultima_leitura');
  assert.equal(s.fontes.rows[0][1], 'ultima_leitura');
  assert.equal(s.fontes.rows[1][1], 'ao_vivo');
  assert.equal(s._guardar.financeiro, null, 'não regrava a leitura antiga');
});

test('planilha fora sem nenhuma leitura guardada: erro para o painel usar a foto', () => {
  const s = montar({ ...base, plan: { ok: false, erro: 'falha_ao_buscar_planilha' }, pipe: { ok: true, dados: [] }, cart: vazioClickup, gos: { ok: false, erro: 'x' } });
  assert.equal(s.erro, 'falha_ao_buscar_planilha');
});

test('ClickUp fora: pipeline vem da última leitura e o painel avisa', () => {
  const ult = { pipeline: { dados: { pipeline: { cols: ['etapa'], rows: [['6 - Ganho']] }, alertas: null }, lido_em: '2026-10-21T12:00:00Z' } };
  const s = montar({ ...base, ult, plan: { ok: true, dados: FONTE }, pipe: { ok: false, erro: 'ClickUp HTTP 401' }, cart: { ok: false, erro: 'ClickUp HTTP 401' }, gos: { ok: true, dados: [] } });
  assert.equal(s.pipeline.rows.length, 1);
  assert.equal(s.fontes.rows[1][1], 'ultima_leitura');
  assert.match(s.parametros.find(p => p.parametro === 'pipeline_erro').valor, /mostrando a leitura de 21\/10 09:00/);
});
