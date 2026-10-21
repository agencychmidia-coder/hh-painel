import { chave, r2, isoSP, diasEntre, dmy } from './util.js';
import { LISTA_PIPELINE } from './pipeline.js';

// ---------- Carteira (aba Carteira): sinais de risco por cliente ----------
// Clientes = tarefas da lista "Carteira de Clientes (CS)" no ClickUp (termômetro, fase, apelidos, próximo contato).
// Sinais: mensalidade em atraso (planilha), tarefas vencidas e última reunião (ClickUp) e, para quem usa o Growth OS,
// semáforo, alertas e frescor de mídia/CRM lidos pela função painel.carteira() — só agregados, nunca dado de paciente.
export const LISTA_CARTEIRA = '1600240000000145';
export const LISTA_REUNIOES = '901717207027';
export const EQUIPE_CLICKUP = '90171366371';
export const ESPACO_HH = '90176342626';
const FASES_CS = { onboarding: 'Onboarding', implementation: 'Implementation', ongoing: 'Ongoing', renewal: 'Renewal', offboarding: 'Offboarding', churned: 'Churned' };
const REGRA = { atrasoVermelho: 30, reuniaoAmarelo: 21, reuniaoVermelho: 45, semVeiculacao: 3, semCrm: 3, syncMetaHoras: 36, semanaVelha: 16 };

const termo = s => chave(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^dra? /, '');
const casa = (texto, tokens) => { const t = ' ' + termo(texto) + ' '; return tokens.some(k => t.includes(' ' + k + ' ')); };

export function montarCarteira({ clientes, abertas, reunioes, lancamentos, gos, hoje, agora }) {
  const linhas = [];
  const ordem = { vermelho: 0, amarelo: 1, verde: 2, saida: 3 };
  clientes.forEach(t => {
    const texto = String(t.text_content || t.description || '');
    const linha = k => { const m = texto.match(new RegExp('^[ \\t*_]*' + k + '[ \\t*_]*:[ \\t*_]*(.*)$', 'mi')); return m ? m[1].replace(/[*_]+$/, '').trim() : ''; };
    const nome = String(t.name || '').replace(/^\[(.*)\]\s*$/, '$1').trim();
    const tokens = [nome, ...linha('Apelidos').split(',')].map(termo).filter(k => k.length >= 3);
    // Fase = status da tarefa (Onboarding · Implementation · Ongoing · Renewal · Offboarding · Churned); a linha "Fase:" fica só como reserva.
    const faseTxt = FASES_CS[chave(t.status && t.status.status)] || linha('Fase') || 'Ongoing';
    const fase = chave(faseTxt);
    const saindo = ['offboarding', 'churned', 'saida'].includes(fase);
    const termTxt = linha('Term[oô]metro');
    const term = /^[1-5]$/.test(termTxt) ? Number(termTxt) : null;
    const verm = [], amar = [];

    // Relacionamento (manual)
    if (term == null) amar.push('termômetro não preenchido');
    else if (term <= 2) verm.push('termômetro ' + term + ' de 5');
    else if (term === 3) amar.push('termômetro 3 de 5');
    const prox = isoSP(t.due_date);
    if (!prox) amar.push('sem próximo contato marcado');
    else if (prox < hoje) amar.push('próximo contato venceu em ' + dmy(prox));

    // Financeiro (planilha)
    const atr = lancamentos.filter(r => r.status === 'Previsto' && r.grupo === 'Receita' && r.valor_em_aberto > 0 && r.data < hoje && casa(r.cliente || r.descricao, tokens));
    const atrValor = r2(atr.reduce((a, r) => a + r.valor_em_aberto, 0));
    const atrDias = atr.reduce((m, r) => Math.max(m, diasEntre(r.data, hoje)), 0);
    if (atrValor > 0) (atrDias > REGRA.atrasoVermelho ? verm : amar).push('mensalidade em atraso há ' + atrDias + ' dia(s)');

    // Entrega e contato (ClickUp)
    const vencidas = abertas.filter(x => x.list && x.list.id !== LISTA_CARTEIRA && x.list.id !== LISTA_PIPELINE && x.due_date && Number(x.due_date) < agora && casa(x.name, tokens)).length;
    if (vencidas) amar.push(vencidas + (vencidas === 1 ? ' tarefa vencida' : ' tarefas vencidas'));
    const reun = reunioes.filter(x => casa(x.name, tokens));
    const feitas = reun.map(x => isoSP(x.date_closed)).filter(Boolean).sort();
    const ultReuniao = feitas[feitas.length - 1] || '';
    if (fase !== 'onboarding' && !saindo) {
      if (!ultReuniao) amar.push('nenhuma reunião concluída no ClickUp');
      else { const d = diasEntre(ultReuniao, hoje); if (d > REGRA.reuniaoVermelho) verm.push('última reunião há ' + d + ' dias'); else if (d > REGRA.reuniaoAmarelo) amar.push('última reunião há ' + d + ' dias'); }
    }

    // Growth OS (só quem usa)
    const g = (gos || []).find(o => casa(o.cliente, tokens));
    if (g) {
      if (g.invest_28d > 0 && g.dias_sem_veiculacao != null && g.dias_sem_veiculacao >= REGRA.semVeiculacao) verm.push('sem veiculação há ' + g.dias_sem_veiculacao + ' dias');
      if (g.meta_ult_sync && (agora - Date.parse(g.meta_ult_sync)) / 3600000 > REGRA.syncMetaHoras) amar.push('dados da Meta sem sincronizar há ' + Math.floor((agora - Date.parse(g.meta_ult_sync)) / 3600000) + 'h');
      const crm = g.crm_ult_atividade ? diasEntre(isoSP(Date.parse(g.crm_ult_atividade)), hoje) : null;
      if (crm == null || crm >= REGRA.semCrm) amar.push(crm == null ? 'CRM sem atividade registrada' : 'CRM sem atividade há ' + crm + ' dias');
      const sem = g.semana_inicio ? (g.semana_inicio instanceof Date ? g.semana_inicio.toISOString().slice(0, 10) : String(g.semana_inicio).slice(0, 10)) : '';
      if (sem && diasEntre(sem, hoje) <= REGRA.semanaVelha) {
        const mot = (g.motivos || []).join('; ');
        if (g.semaforo === 'vermelho') verm.push('Growth OS vermelho' + (mot ? ': ' + mot : ''));
        else if (g.semaforo === 'amarelo') amar.push('Growth OS amarelo' + (mot ? ': ' + mot : ''));
      } else amar.push(sem ? 'semáforo do Growth OS desatualizado (semana de ' + dmy(sem) + ')' : 'Growth OS sem semáforo semanal');
      if (g.alertas_escalados > 0) amar.push(g.alertas_escalados + ' alerta(s) de qualidade escalado(s)');
    }

    const cor = saindo ? 'saida' : (verm.length ? 'vermelho' : (amar.length ? 'amarelo' : 'verde'));
    linhas.push({
      cliente: nome, fase: faseTxt, termometro: term, cor, motivos: [...verm, ...amar].join(' | '),
      proximo_contato: prox, ult_reuniao: ultReuniao, atraso_valor: atrValor, atraso_dias: atrDias, tarefas_vencidas: vencidas,
      growth_os: g ? (g.semaforo || 'sem semáforo') : '', nota: linha('Nota'), url: t.url || ''
    });
  });
  linhas.sort((a, b) => ordem[a.cor] - ordem[b.cor] || a.cliente.localeCompare(b.cliente, 'pt-BR'));
  const cols = ['cliente', 'fase', 'termometro', 'cor', 'motivos', 'proximo_contato', 'ult_reuniao', 'atraso_valor', 'atraso_dias', 'tarefas_vencidas', 'growth_os', 'nota', 'url'];
  return { cols, rows: linhas.map(l => cols.map(c => l[c])) };
}
