// Leitura das fontes externas, cada uma com tempo limite e nova tentativa.
// Nenhuma função aqui lança erro para o painel: cada uma devolve { ok, dados, erro }.
import { LISTA_PIPELINE } from './pipeline.js';
import { LISTA_CARTEIRA, LISTA_REUNIOES, EQUIPE_CLICKUP, ESPACO_HH } from './carteira.js';

const espera = ms => new Promise(r => setTimeout(r, ms));
const msg = e => String((e && e.message) || e).slice(0, 160);

// fetch com tempo limite; repete em erro de rede, 429 e 5xx (e no que `repetirSe` pedir).
export async function buscar(url, { tentativas = 2, tempo = 10000, pausa = 700, repetirSe, ...opcoes } = {}) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), tempo);
    try {
      const r = await fetch(url, { ...opcoes, signal: ctl.signal, cache: 'no-store' });
      const corpo = await r.text();
      clearTimeout(t);
      const resp = { status: r.status, ok: r.ok, corpo, tipo: r.headers.get('content-type') || '' };
      const repetir = r.status === 429 || r.status >= 500 || (repetirSe && repetirSe(resp));
      if (!repetir || i === tentativas - 1) return resp;
      ultimo = new Error('HTTP ' + r.status);
    } catch (e) {
      clearTimeout(t);
      ultimo = e && e.name === 'AbortError' ? new Error('sem resposta em ' + Math.round(tempo / 1000) + 's') : e;
      if (i === tentativas - 1) throw ultimo;
    }
    await espera(pausa * (i + 1));
  }
  throw ultimo;
}

// ---------- Planilha financeira (Apps Script "PainelHH") ----------
export function validarUrlPlanilha(url) {
  if (!url) return { erro: 'fonte_nao_configurada' };
  const limpa = url.trim().replace(/^['"]|['"]$/g, '');
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(limpa)) return { erro: 'url_invalida', detalhe: 'a URL não é de um App da Web do Apps Script' };
  if (!/[?&]t=[^&]{8,}/.test(limpa)) return { erro: 'url_sem_token', detalhe: 'falta ?t=TOKEN no fim da URL' };
  return { url: limpa };
}

const ehHtml = c => /<html|<!doctype/i.test(c);

export async function lerPlanilha(urlBruta) {
  const v = validarUrlPlanilha(urlBruta);
  if (v.erro) return { ok: false, erro: v.erro, detalhe: v.detalhe || '' };
  try {
    // O Google às vezes devolve uma página HTML de "não encontrado" por alguns segundos: tenta de novo antes de desistir.
    const r = await buscar(v.url, { redirect: 'follow', tempo: 15000, tentativas: 3, repetirSe: x => ehHtml(x.corpo) });
    let fonte;
    try { fonte = JSON.parse(r.corpo); } catch (e) {
      const html = ehHtml(r.corpo);
      if (html && /accounts\.google\.com|ServiceLogin|Fazer login|Sign in/i.test(r.corpo)) return { ok: false, erro: 'planilha_pede_login', detalhe: 'HTTP ' + r.status };
      if (html && /script function not found|Página não encontrada|not found/i.test(r.corpo)) return { ok: false, erro: 'implantacao_nao_encontrada', detalhe: 'HTTP ' + r.status };
      return { ok: false, erro: 'resposta_invalida_da_planilha', detalhe: 'HTTP ' + r.status + ' ' + r.tipo + ' ' + r.corpo.replace(/\s+/g, ' ').slice(0, 80) };
    }
    if (fonte.erro) return { ok: false, erro: fonte.erro, detalhe: fonte.detalhe || '' };
    return { ok: true, dados: fonte };
  } catch (e) {
    return { ok: false, erro: 'falha_ao_buscar_planilha', detalhe: msg(e) };
  }
}

// ---------- ClickUp ----------
export async function clickupPaginas(token, base, max = 20) {
  const out = [];
  for (let page = 0; page < max; page++) {
    const r = await buscar(base + (base.includes('?') ? '&' : '?') + 'page=' + page, { headers: { Authorization: token.trim() }, tempo: 10000 });
    if (!r.ok) throw new Error('ClickUp HTTP ' + r.status);
    const j = JSON.parse(r.corpo);
    out.push(...(j.tasks || []));
    if (j.last_page !== false || !(j.tasks || []).length) break;
  }
  return out;
}

export async function lerClickUpPipeline(token) {
  if (!token) return { ok: false, erro: 'CLICKUP_TOKEN não configurado' };
  try { return { ok: true, dados: await clickupPaginas(token, `https://api.clickup.com/api/v2/list/${LISTA_PIPELINE}/task?include_closed=true&subtasks=true`, 10) }; }
  catch (e) { return { ok: false, erro: msg(e) }; }
}

export async function lerClickUpCarteira(token) {
  if (!token) return { ok: false, erro: 'CLICKUP_TOKEN não configurado' };
  const desde = Date.now() - 180 * 86400000;
  try {
    const [clientes, abertas, reunioes] = await Promise.all([
      clickupPaginas(token, `https://api.clickup.com/api/v2/list/${LISTA_CARTEIRA}/task?subtasks=false`),
      clickupPaginas(token, `https://api.clickup.com/api/v2/team/${EQUIPE_CLICKUP}/task?space_ids[]=${ESPACO_HH}&subtasks=true`),
      clickupPaginas(token, `https://api.clickup.com/api/v2/list/${LISTA_REUNIOES}/task?include_closed=true&subtasks=true&date_updated_gt=${desde}`)
    ]);
    // Guarda só o que a carteira usa: menos dado trafegando e guardado.
    const enxuga = t => ({ id: t.id, name: t.name, url: t.url, due_date: t.due_date, date_closed: t.date_closed, status: t.status ? { status: t.status.status } : null,
      text_content: t.text_content, list: t.list ? { id: t.list.id } : null });
    return { ok: true, dados: { clientes: clientes.map(enxuga), abertas: abertas.map(enxuga), reunioes: reunioes.map(enxuga) } };
  } catch (e) { return { ok: false, erro: msg(e) }; }
}

// ---------- Growth OS (usuário painel_leitura) ----------
// Uma conexão por requisição. Toda operação tem prazo: o banco nunca pode segurar o painel.
// Depois da primeira falha (senha errada, rede, prazo), as demais operações nem tentam.
export function comPrazo(promessa, ms, rotulo) {
  let t;
  return Promise.race([promessa, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(rotulo + ': sem resposta em ' + Math.round(ms / 1000) + 's')), ms); })])
    .finally(() => clearTimeout(t));
}

export async function abrirGrowthOS(url) {
  if (!url) return null;
  const { default: postgres } = await import('postgres');
  const sql = postgres(url.trim(), { ssl: 'require', prepare: false, max: 1, idle_timeout: 5, connect_timeout: 6, max_lifetime: 30 });
  return { sql, erro: '' };
}

async function noBanco(banco, rotulo, fn, ms = 7000) {
  if (!banco) throw new Error('GROWTHOS_DB_URL não configurada');
  if (banco.erro) throw new Error(banco.erro);
  try { return await comPrazo(fn(banco.sql), ms, rotulo); }
  catch (e) { banco.erro = banco.erro || msg(e); throw e; }
}

export async function lerGrowthOS(banco, ms = 7000) {
  try {
    const linhas = await noBanco(banco, 'Growth OS', sql => sql`select * from painel.carteira()`, ms);
    return { ok: true, dados: linhas.map(r => ({ ...r, invest_28d: Number(r.invest_28d), invest_7d: Number(r.invest_7d) })) };
  } catch (e) { return { ok: false, erro: msg(e) }; }
}

export async function lerUltimas(banco, ms = 7000) {
  if (!banco) return {};
  try {
    const linhas = await noBanco(banco, 'última leitura', sql => sql`select fonte, dados, lido_em from painel.ultima_leitura`, ms);
    return Object.fromEntries(linhas.map(l => [l.fonte, { dados: l.dados, lido_em: new Date(l.lido_em).toISOString() }]));
  } catch (e) { console.error('[painel] ultima_leitura_falhou | ' + msg(e)); return {}; }
}

export async function guardarUltimas(banco, porFonte) {
  if (!banco || banco.erro) return;
  for (const [fonte, dados] of Object.entries(porFonte).filter(([, v]) => v != null)) {
    try {
      await noBanco(banco, 'guardar ' + fonte, sql => sql`insert into painel.ultima_leitura (fonte, dados, lido_em) values (${fonte}, ${sql.json(dados)}, now())
        on conflict (fonte) do update set dados = excluded.dados, lido_em = excluded.lido_em`, 5000);
    } catch (e) { console.error('[painel] guardar_' + fonte + '_falhou | ' + msg(e)); return; }
  }
}

export async function fecharGrowthOS(banco) {
  if (!banco) return;
  try { await comPrazo(banco.sql.end({ timeout: 1 }), 2000, 'fechar conexão'); } catch (e) { /* conexão some sozinha */ }
}
