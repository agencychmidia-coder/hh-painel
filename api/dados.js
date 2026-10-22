// /api/dados — monta os dados do painel a partir de três fontes independentes:
//   planilha financeira (Apps Script "PainelHH"), ClickUp (pipeline e carteira) e Growth OS (usuário painel_leitura).
// Cada fonte é lida em paralelo, com tempo limite e nova tentativa. Se uma cair, entra a última leitura boa dela
// (tabela painel.ultima_leitura) e o painel avisa qual fonte está atrasada. Só sem nenhum dado financeiro a resposta é erro.
// Protegido pelo middleware de senha do site.
// Variáveis: PAINEL_FONTE_URL (obrigatória), CLICKUP_TOKEN e GROWTHOS_DB_URL (opcionais).
import { hojeSP, objs } from '../lib/util.js';
import { transformar } from '../lib/financeiro.js';
import { montarPipeline } from '../lib/pipeline.js';
import { montarCarteira } from '../lib/carteira.js';
import { lerPlanilha, lerClickUpPipeline, lerClickUpCarteira, abrirGrowthOS, lerGrowthOS, lerUltimas, guardarUltimas, fecharGrowthOS, comPrazo } from '../lib/fontes.js';

const CAB = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const quando = iso => {
  if (!iso) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};
const erroDe = r => (r.erro || '') + (r.detalhe ? ' | ' + r.detalhe : '');

// Estado de uma fonte para o topo do painel: ao vivo, última leitura boa ou fora.
export function estado(fonte, r, ultima, agoraIso) {
  if (r.ok) return { fonte, estado: 'ao_vivo', lido_em: agoraIso, erro: '' };
  if (ultima) return { fonte, estado: 'ultima_leitura', lido_em: ultima.lido_em, erro: erroDe(r) };
  return { fonte, estado: 'fora', lido_em: '', erro: erroDe(r) };
}

// Junta as fontes já lidas. Separado do GET para poder ser testado sem rede.
export function montar({ plan, pipe, cart, gos, ult = {}, hoje, agora }) {
  const agoraIso = new Date(agora).toISOString();
  const fin = plan.ok ? transformar(plan.dados, hoje) : (ult.financeiro ? ult.financeiro.dados : null);
  if (!fin) return { erro: plan.erro || 'falha_ao_buscar_planilha', detalhe: plan.detalhe || '' };

  // Pipeline: ClickUp ao vivo > última leitura do ClickUp > pipeline da planilha.
  let pipeline = fin.pipeline || { cols: [], rows: [] }, alertas = null, pfonte = 'planilha';
  if (pipe.ok) { const m = montarPipeline(pipe.dados); pipeline = m.pipeline; alertas = m.alertas; pfonte = 'clickup'; }
  else if (ult.pipeline) { pipeline = ult.pipeline.dados.pipeline; alertas = ult.pipeline.dados.alertas; pfonte = 'clickup'; }

  // Carteira: dados do ClickUp (ao vivo ou última leitura) + Growth OS (idem) + mensalidades da planilha.
  const cartDados = cart.ok ? cart.dados : (ult.carteira_clickup ? ult.carteira_clickup.dados : null);
  const gosDados = gos.ok ? gos.dados : (ult.growthos ? ult.growthos.dados : null);
  const carteira = cartDados ? montarCarteira({ ...cartDados, lancamentos: objs(fin.lancamentos), gos: gosDados, hoje, agora }) : null;

  const ePlan = estado('Planilha financeira', plan, ult.financeiro, agoraIso);
  const eClick = (pipe.ok && cart.ok) ? estado('ClickUp', { ok: true }, null, agoraIso)
    : estado('ClickUp', pipe.ok ? cart : pipe, ult.pipeline || ult.carteira_clickup, agoraIso);
  const eGos = estado('Growth OS', gos, ult.growthos, agoraIso);
  const fontes = [ePlan, eClick, eGos];

  const atraso = e => (e.estado === 'ultima_leitura' ? 'fora do ar; mostrando a leitura de ' + quando(e.lido_em) : e.estado === 'fora' ? e.erro : '');
  const saida = {
    ...fin,
    pipeline, pipeline_alertas: alertas, carteira,
    fontes: { cols: ['fonte', 'estado', 'lido_em', 'erro'], rows: fontes.map(f => [f.fonte, f.estado, f.lido_em, f.erro]) },
    fonte_financeiro: plan.ok ? 'ao_vivo' : 'ultima_leitura',
    motivo_financeiro: plan.ok ? '' : (plan.erro || '') + '|' + (plan.detalhe || '')
  };
  saida.parametros = (fin.parametros || []).filter(p => !/^(pipeline_|carteira_|growthos_)/.test(p.parametro)).concat([
    { parametro: 'pipeline_fonte', valor: pfonte },
    { parametro: 'pipeline_erro', valor: pipe.ok ? '' : (ult.pipeline ? atraso(eClick) : (pipe.erro || '')) },
    { parametro: 'carteira_erro', valor: carteira ? '' : (cart.erro || 'sem dados') },
    { parametro: 'growthos_erro', valor: gos.ok ? '' : (ult.growthos ? atraso(eGos) : (gos.erro || '')) }
  ]);
  // O que vale guardar como última leitura boa (só o que veio ao vivo agora).
  saida._guardar = {
    financeiro: plan.ok ? fin : null,
    pipeline: pipe.ok ? { pipeline, alertas } : null,
    carteira_clickup: cart.ok ? cart.dados : null,
    growthos: gos.ok ? gos.dados : null
  };
  return saida;
}

export async function GET() {
  const hoje = hojeSP(), agora = Date.now();
  let banco = null;
  try { banco = await abrirGrowthOS(process.env.GROWTHOS_DB_URL); } catch (e) { console.error('[painel] growthos_conexao | ' + String(e && e.message || e).slice(0, 120)); }
  try {
    const token = process.env.CLICKUP_TOKEN;
    // Prazo total por fonte: nenhuma delas pode estourar o limite da função (60s) e derrubar as outras.
    const prazo = (p, ms, nome) => comPrazo(p, ms, nome).catch(e => ({ ok: false, erro: e.message }));
    const [plan, pipe, cart, gos, ult] = await Promise.all([
      prazo(lerPlanilha(process.env.PAINEL_FONTE_URL), 40000, 'planilha'), prazo(lerClickUpPipeline(token), 25000, 'ClickUp'),
      prazo(lerClickUpCarteira(token), 25000, 'ClickUp'), lerGrowthOS(banco), lerUltimas(banco)
    ]);
    const saida = montar({ plan, pipe, cart, gos, ult, hoje, agora });
    if (saida.erro) {
      console.error('[painel] ' + saida.erro + (saida.detalhe ? ' | ' + saida.detalhe : ''));
      return new Response(JSON.stringify({ erro: saida.erro, detalhe: saida.detalhe }), { status: saida.erro === 'fonte_nao_configurada' ? 503 : 502, headers: CAB });
    }
    const guardar = saida._guardar; delete saida._guardar;
    await guardarUltimas(banco, guardar);
    const resumo = saida.fontes.rows.map(r => r[0] + ': ' + r[1] + (r[3] ? ' (' + r[3] + ')' : '')).join(' · ');
    (saida.fontes.rows.some(r => r[1] !== 'ao_vivo') ? console.error : console.log)('[painel] fontes | ' + resumo);
    return new Response(JSON.stringify(saida), { status: 200, headers: CAB });
  } catch (e) {
    console.error('[painel] falha_inesperada | ' + String(e && e.stack || e).slice(0, 300));
    return new Response(JSON.stringify({ erro: 'falha_inesperada', detalhe: String(e && e.message || e).slice(0, 120) }), { status: 500, headers: CAB });
  } finally {
    await fecharGrowthOS(banco);
  }
}
