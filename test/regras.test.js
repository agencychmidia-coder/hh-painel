// Testes das regras do painel. Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroBR, hojeSP } from '../lib/util.js';
import { oferta, montarPipeline } from '../lib/pipeline.js';
import { montarCarteira } from '../lib/carteira.js';
import { transformar, grupo } from '../lib/financeiro.js';

test('numeroBR aceita os formatos usados no ClickUp e na planilha', () => {
  assert.equal(numeroBR('R$ 3.500,00'), 3500);
  assert.equal(numeroBR('3.500'), 3500);
  assert.equal(numeroBR('3500'), 3500);
  assert.equal(numeroBR('3500.5'), 3500.5);
  assert.equal(numeroBR(''), null);
  assert.ok(Number.isNaN(numeroBR('3,5 mil')));
});

test('oferta é soma de partes, em ordem fixa, com apelidos', () => {
  assert.equal(oferta('Audiovisual + Tráfego + CRC'), 'Audiovisual + Tráfego + CRC');
  assert.equal(oferta('CRC+Assessoria'), 'Assessoria + CRC');
  assert.equal(oferta('Tráfego Pago'), 'Tráfego');
  assert.equal(oferta('Cirurgia'), null);
  assert.equal(oferta(''), null);
});

const desc = (o) => ['MRR proposto: ' + (o.p ?? ''), 'MRR fechado: ' + (o.f ?? ''), 'Origem: ' + (o.o ?? ''), 'Oferta: ' + (o.of ?? ''),
  'Cidade:', 'Motivo de perda: ' + (o.m ?? ''), 'Data de fechamento: ' + (o.d ?? '')].join('\n');
const tarefa = (nome, status, o, extra = {}) => ({ id: nome, name: `[${nome}] Oportunidade`, status: { status }, text_content: desc(o), assignees: [{ username: 'Caio H' }], tags: [], url: 'u', ...extra });

test('pipeline: etapas, repescagem, template ignorado e alertas', () => {
  const m = montarPipeline([
    tarefa('A', 'reunião agendada', { p: 3000, o: 'Indicação' }),
    tarefa('B', 'repescagem', { p: 3750, o: 'Networking/Fellowship', of: 'Assessoria' }),
    tarefa('C', 'ganho', { p: 4000, f: 4000, o: 'Networking/Fellowship', d: '15/10/2026' }),
    tarefa('D', 'negociação', { p: '3,5 mil', o: 'Insta' }),
    { id: 't', name: '[TEMPLATE] [NOME] Oportunidade', status: { status: 'lead recebido' }, text_content: desc({}) }
  ]);
  const etapa = Object.fromEntries(m.pipeline.rows.map(r => [r[2], r[6]]));
  assert.equal(etapa.A, '2 - Diagnóstico agendado');
  assert.equal(etapa.B, '1 - Contato inicial');
  assert.equal(etapa.C, '6 - Ganho');
  assert.equal(etapa.D, undefined, 'MRR inválido fica fora das contas');
  assert.equal(m.pipeline.rows.length, 3, 'template não entra');
  const problemas = m.alertas.rows.map(r => r[0] + ': ' + r[1]);
  assert.ok(problemas.some(p => p.startsWith('C: ganho sem oferta')));
  assert.ok(problemas.some(p => p.startsWith('D: MRR proposto não é número')));
});

const cliente = (nome, status, ap, term = '', due) => ({ name: `[${nome}]`, status: { status }, text_content: `Termômetro: ${term}\nApelidos: ${ap}\nNota:`, due_date: due, url: 'u' });

test('carteira: fase pelo status, sinais e ordem', () => {
  const hoje = '2026-10-21', agora = Date.parse('2026-10-21T15:00:00Z');
  const r = montarCarteira({
    clientes: [
      cliente('DR. ALFA', 'Ongoing', 'Alfa', '4', String(Date.parse('2026-10-28'))),
      cliente('DR. BETA', 'Renewal', 'Beta', '2'),
      cliente('DRA. GAMA', 'Offboarding', 'Gama'),
      cliente('DZ MED', 'Onboarding', 'DZ Med')
    ],
    abertas: [{ name: '[HH] - Planejamento - DZ Med', due_date: String(Date.parse('2026-10-19')), list: { id: '901716266479' } }],
    reunioes: [{ name: '[DR. ALFA] - Alinhamento', date_closed: String(Date.parse('2026-10-14')) }],
    lancamentos: [{ status: 'Previsto', grupo: 'Receita', valor_em_aberto: 1800, data: '2026-09-10', cliente: 'Dr. Beta' }],
    gos: [{ cliente: 'Dr. Alfa', meta_ult_sync: '2026-10-21T09:00:00Z', dias_sem_veiculacao: 0, invest_28d: 600, crm_ult_atividade: '2026-10-20T12:00:00Z', semana_inicio: '2026-10-12', semaforo: 'verde', motivos: [], alertas_escalados: 0 }],
    hoje, agora
  });
  const por = Object.fromEntries(r.rows.map(x => [x[0], { fase: x[1], cor: x[3], motivos: x[4] }]));
  assert.equal(por['DR. ALFA'].cor, 'verde');
  assert.equal(por['DR. BETA'].cor, 'vermelho');
  assert.match(por['DR. BETA'].motivos, /termômetro 2 de 5/);
  assert.match(por['DR. BETA'].motivos, /mensalidade em atraso há 41 dia/);
  assert.equal(por['DRA. GAMA'].cor, 'saida');
  assert.equal(por['DZ MED'].fase, 'Onboarding');
  assert.match(por['DZ MED'].motivos, /1 tarefa vencida/);
  assert.doesNotMatch(por['DZ MED'].motivos, /reunião/, 'onboarding não cobra reunião');
  assert.equal(r.rows[0][0], 'DR. BETA', 'vermelho primeiro');
});

test('financeiro: grupo e baixa automática', () => {
  assert.equal(grupo('01.01'), 'Receita');
  assert.equal(grupo('02.03.01'), 'Pessoal');
  const t = transformar({
    lancamentos: { cols: ['id', 'data', 'competencia', 'codigo', 'status', 'cliente', 'valor', 'descricao'], rows: [
      [1, '2026-10-10', '2026-10', '01.01', 'Previsto', 'Dr. X', 2000, 'mensalidade'],
      [2, '2026-10-12', '2026-10', '01.01', 'Realizado', 'Dr. X', 1500, 'pix']
    ] },
    clientes: { cols: ['nome', 'status'], rows: [] }, parametros: [{ parametro: 'caixa_inicial', valor: 10 }]
  }, '2026-10-21');
  const prev = t.lancamentos.rows.find(r => r[0] === '1');
  assert.equal(prev[t.lancamentos.cols.indexOf('valor_em_aberto')], 500);
});

test('hojeSP usa o fuso de São Paulo', () => {
  assert.equal(hojeSP(new Date('2026-10-21T02:30:00Z')), '2026-10-20');
});
