import { chave, isoSP, numeroBR } from './util.js';

// ---------- Pipeline comercial no ClickUp (lista "Pipeline de Vendas") ----------
// Etapa = status da tarefa. Valores vêm de linhas fixas na descrição ("MRR proposto: 3500" etc.), porque o plano
// gratuito do ClickUp não deixa editar campos personalizados. O que não seguir o padrão vira alerta e fica fora das contas.
export const LISTA_PIPELINE = '901715108407';
const ETAPA = {
  'lead recebido': '0 - Lead', 'qualificacao': '1 - Contato inicial', 'repescagem': '1 - Contato inicial',
  'reuniao agendada': '2 - Diagnóstico agendado', 'diagnostico realizado': '3 - Diagnóstico realizado',
  'proposta enviada': '4 - Proposta enviada', 'negociacao': '5 - Negociação', 'ganho': '6 - Ganho', 'perdido': '7 - Perdido'
};
const ORIGENS = ['Indicação', 'Networking/Fellowship', 'Instagram Orgânico', 'Social Selling', 'Tráfego Pago', 'Collab DZ'];
// Oferta = uma ou mais partes somadas com "+", ex.: "Audiovisual + Tráfego + CRC". Sai sempre na ordem desta lista.
const PARTES_OFERTA = ['Assessoria', 'Audiovisual', 'Tráfego', 'Social Media', 'CRC'];
const APELIDO_OFERTA = { 'trafego pago': 'Tráfego', 'social': 'Social Media' };
const MOTIVOS = ['Preço', 'Concorrência', 'Sem Budget', 'Timing', 'Sem resposta', 'Outro'];
const daLista = (v, lista) => lista.find(o => chave(o) === chave(v)) || null;
export function oferta(v) {
  const partes = String(v || '').split('+').map(x => x.trim()).filter(Boolean);
  if (!partes.length) return null;
  const achadas = partes.map(x => daLista(APELIDO_OFERTA[chave(x)] || x, PARTES_OFERTA));
  if (achadas.includes(null)) return null;
  return PARTES_OFERTA.filter(o => achadas.includes(o)).join(' + ');
}

export function oportunidadeDaTarefa(t) {
  const nome = String(t.name || '').replace(/^\[(.*)\]\s*Oportunidade\s*$/i, '$1').trim() || t.name;
  const texto = String(t.text_content || t.description || '');
  const linha = k => { const m = texto.match(new RegExp('^[ \\t*_]*' + k + '[ \\t*_]*:[ \\t*_]*(.*)$', 'mi')); return m ? m[1].replace(/[*_]+$/, '').trim() : undefined; };
  const prob = [];
  const status = chave(t.status && t.status.status);
  const etapa = ETAPA[status];
  if (!etapa) prob.push('status "' + (t.status && t.status.status) + '" não é etapa do funil');

  const bruto = { proposto: linha('MRR proposto'), fechado: linha('MRR fechado'), origem: linha('Origem'), oferta: linha('Oferta'),
    cidade: linha('Cidade'), motivo: linha('Motivo de perda'), fechamento: linha('Data de fechamento') };
  if (bruto.proposto === undefined && bruto.origem === undefined) prob.push('descrição fora do formato padrão (sem as linhas do modelo)');

  const mrrP = numeroBR(bruto.proposto), mrrF = numeroBR(bruto.fechado);
  if (Number.isNaN(mrrP)) prob.push('MRR proposto não é número: "' + bruto.proposto + '"');
  if (Number.isNaN(mrrF)) prob.push('MRR fechado não é número: "' + bruto.fechado + '"');
  if (etapa === '6 - Ganho' && mrrF == null) prob.push('ganho sem MRR fechado');

  const origem = daLista(bruto.origem, ORIGENS);
  if (!bruto.origem) { if (bruto.origem !== undefined) prob.push('origem vazia'); }
  else if (!origem) prob.push('origem fora da lista: "' + bruto.origem + '"');
  const ofertaOk = oferta(bruto.oferta);
  if (bruto.oferta && !ofertaOk) prob.push('oferta fora da lista: "' + bruto.oferta + '"');
  if (etapa === '6 - Ganho' && !bruto.oferta) prob.push('ganho sem oferta');
  const motivo = daLista(bruto.motivo, MOTIVOS);
  if (bruto.motivo && !motivo) prob.push('motivo de perda fora da lista: "' + bruto.motivo + '"');
  if (etapa === '7 - Perdido' && !bruto.motivo) prob.push('perdido sem motivo');

  let fech = '';
  const f = String(bruto.fechamento || '').trim();
  if (/^hist[oó]rico$/i.test(f)) fech = '';
  else if (f) { const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) fech = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; else prob.push('data de fechamento fora do formato dd/mm/aaaa: "' + f + '"'); }
  else if (etapa === '6 - Ganho' || etapa === '7 - Perdido') prob.push('sem data de fechamento');

  const tags = (t.tags || []).map(x => chave(x.name));
  const respTxt = texto.match(/Respons[aá]vel\s*:\s*([A-Za-zÀ-ú]+)/i);
  const resp = tags.includes('lucas') ? 'Lucas'
    : (respTxt ? respTxt[1] : ((t.assignees || [])[0] ? String(t.assignees[0].username || '').split(' ')[0] : ''));

  return {
    linha: {
      id_oportunidade: String(t.id), data_entrada: isoSP(t.date_created), clinica_cirurgiao: nome, cidade: bruto.cidade || '',
      origem_lead: origem || '', oferta: ofertaOk || '', etapa: etapa || '', mrr_proposto: Number.isNaN(mrrP) ? null : mrrP,
      data_fechamento: fech, mrr_fechado: Number.isNaN(mrrF) ? null : mrrF, motivo_perda: motivo || '', responsavel: resp,
      data_proximo_passo: isoSP(t.due_date), status_clickup: (t.status && t.status.status) || '', url: t.url || ''
    },
    problemas: prob
  };
}

export function montarPipeline(tarefas) {
  const cols = ['id_oportunidade', 'data_entrada', 'clinica_cirurgiao', 'cidade', 'origem_lead', 'oferta', 'etapa', 'mrr_proposto', 'data_fechamento', 'mrr_fechado', 'motivo_perda', 'responsavel', 'data_proximo_passo', 'status_clickup', 'url'];
  const ok = [], alertas = [];
  tarefas.filter(t => !/^\[template\]/i.test(String(t.name || ''))).forEach(t => {
    const o = oportunidadeDaTarefa(t);
    // Fica fora das contas só o que impede o cálculo: etapa desconhecida ou valores que não são número.
    const bloqueia = !o.linha.etapa || o.problemas.some(p => /não é número|formato padrão/.test(p));
    if (!bloqueia) ok.push(cols.map(c => o.linha[c]));
    o.problemas.forEach(p => alertas.push([o.linha.clinica_cirurgiao, p + (bloqueia ? ' (fora das contas)' : ''), o.linha.url]));
  });
  alertas.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  return { pipeline: { cols, rows: ok }, alertas: { cols: ['oportunidade', 'problema', 'url'], rows: alertas } };
}
