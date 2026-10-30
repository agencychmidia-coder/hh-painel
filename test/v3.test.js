// Testes das telas Receita por cliente, A pagar, Custos e Time (app/v3-calc.js roda no navegador; aqui via vm).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; vm.runInNewContext(readFileSync(new URL('../app/v3-calc.js', import.meta.url), 'utf8'), ctx);
const V = ctx.V3calc;
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m); // objetos vêm de outro contexto (vm)
const HOJE = '2026-10-29';
let id = 0;
const l = (o) => ({ id: String(++id), natureza: /^0[13]/.test(o.codigo) ? 'Entrada' : 'Saída', valor_em_aberto: 0, cliente: '', descricao: o.descricao || 'x',
  mes_caixa: (o.data || '').slice(0, 7), ...o, valor: String(o.valor) });
const pago = (codigo, grupo, comp, valor, extra = {}) => l({ codigo, grupo, competencia: comp, data: comp + '-10', status: 'Realizado', situacao: 'Realizado', valor, ...extra });
const prev = (codigo, grupo, comp, valor, aberto, situacao, extra = {}) => l({ codigo, grupo, competencia: comp, data: comp + '-10', status: 'Previsto', situacao, valor, valor_em_aberto: aberto, ...extra });

const BASE = [
  pago('01.01.01', 'Receita', '2026-08', 3000, { cliente: 'Dr. A' }), pago('01.01.01', 'Receita', '2026-09', 3000, { cliente: 'Dr. A' }),
  prev('01.01.01', 'Receita', '2026-10', 3000, 3000, 'A vencer', { cliente: 'Dr. A', data: '2026-11-05' }),
  prev('01.01.01', 'Receita', '2026-11', 3000, 3000, 'A vencer', { cliente: 'Dr. A', data: '2026-12-05' }),
  pago('01.01.01', 'Receita', '2026-08', 1000, { cliente: 'Dr. B' }),
  prev('01.01.01', 'Receita', '2026-09', 1000, 1000, 'Vencido', { cliente: 'Dr. B' }),
  prev('01.01.01', 'Receita', '2026-10', 1000, 1000, 'A vencer', { cliente: 'Dr. B', data: '2026-11-05' }),
  pago('02.03.04', 'Pessoal', '2026-08', 1200), pago('02.03.04', 'Pessoal', '2026-09', 1200),
  prev('02.03.04', 'Pessoal', '2026-10', 1200, 1200, 'A vencer', { data: '2026-11-10' }),
  prev('02.03.03', 'Pessoal', '2026-09', 2000, 2000, 'Vencido'),
  prev('02.03.03', 'Pessoal', '2026-10', 2000, 2000, 'A vencer', { data: '2026-10-30' }),
  pago('02.06.04', 'Administrativo', '2026-08', 1000), pago('02.06.04', 'Administrativo', '2026-09', 1500),
  prev('02.06.04', 'Administrativo', '2026-11', 1400, 1400, 'A vencer', { data: '2026-11-10' }),
  prev('04.01.99', 'Saída não operacional', '2026-08', 500, 500, 'Dívida com sócio'),
  prev('05.01.02', 'Retirada de sócio', '2026-10', 900, 900, 'A vencer', { data: '2026-11-02' })
];

test('A pagar: separa vencido, semana e 30 dias; retirada e dívida com sócio fora da conta', () => {
  const p = V.pagar(BASE, HOJE);
  assert.equal(p.vencido.total, 2000);
  assert.equal(p.divida_socio.total, 500);
  assert.equal(p.semana.total, 2000, 'só o designer vence em 30/10, na semana de 26/10 a 01/11');
  assert.equal(p.total30, 2000 + 1200 + 1400);
  assert.equal(p.receber30, 1000 + 3000);
  assert.equal(p.dias.length, 35);
  assert.equal(p.dias[0].data, '2026-10-26');
  same(p.semanas.map(s => s.total), [2000, 0, 2600, 0, 0]);
  assert.equal(p.proximas[0].estado, 'vencida');
});

test('Custos: média dos meses fechados, conta que subiu e custo fixo do próximo mês', () => {
  const k = V.custos(BASE, HOJE);
  same(k.meses.map(m => m.mes), ['2026-08', '2026-09']);
  assert.equal(k.meses[1].total, 1200 + 2000 + 1500, 'setembro: pago + vencido');
  const alug = k.tabela.find(t => t.codigo === '02.06.04');
  assert.equal(alug.estado, 'subiu'); assert.equal(alug.media, 1000); assert.equal(alug.ultimo, 1500);
  assert.equal(k.tabela.find(t => t.codigo === '02.03.03').estado, 'novo');
  assert.equal(k.fixo_proximo.total, 1400);
  assert.equal(k.fixo_proximo.mrr, 3000);
});

test('Time: custo do mês, % da receita, atraso por função', () => {
  const t = V.time(BASE, HOJE);
  assert.equal(t.custo_mes, 3200);
  assert.equal(t.mrr, 4000);
  assert.equal(t.pct_receita, 0.8);
  assert.equal(t.atraso.total, 2000);
  const des = t.funcoes.find(f => f.codigo === '02.03.03');
  assert.equal(des.funcao, 'Designer'); assert.equal(des.estado, 'atraso');
  assert.equal(t.serie[t.serie.length - 1].planejado, true);
  assert.equal(t.serie[0].receita, 4000, 'agosto: 3000 + 1000 recebidos');
});

test('Receita por cliente: mapa, atraso, concentração e quem ligar', () => {
  const r = V.receitaClientes(BASE, [{ cliente: 'DR. A', cor: 'vermelho', fase: 'Ongoing' }], [], HOJE);
  same(r.meses.map(m => m.mes), ['2026-08', '2026-09', '2026-10', '2026-11']);
  const b = r.clientes.find(c => c.cliente === 'Dr. B');
  same(b.celulas.map(c => c.estado), ['pago', 'vencido', 'a_vencer', 'vazio']);
  assert.equal(b.atraso, 1000); assert.equal(b.acao, 'cobrar');
  assert.equal(b.pct_3m, 0.5);
  assert.equal(r.maior.cliente, 'Dr. A'); assert.equal(r.maior.pct, 0.75);
  assert.equal(r.risco.mes, 3000, 'Dr. A está em vermelho na Carteira');
  same(r.ligar.map(c => c.cliente), ['Dr. B', 'Dr. A'], 'quem deve vem primeiro');
});

test('Receita por cliente: mensalidade zerada pelo churn aparece como saída e não conta no MRR', () => {
  const L = BASE.concat([pago('01.01.01', 'Receita', '2026-08', 2000, { cliente: 'Dra. C' }), prev('01.01.01', 'Receita', '2026-10', 0, 0, 'Baixado', { cliente: 'Dra. C' })]);
  const r = V.receitaClientes(L, [], [{ nome: 'Dra. C', status: 'Churn' }], HOJE);
  const c = r.clientes.find(x => x.cliente === 'Dra. C');
  assert.equal(c.celulas[2].estado, 'saiu');
  assert.equal(r.mrr, 4000);
});
