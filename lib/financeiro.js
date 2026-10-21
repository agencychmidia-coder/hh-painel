// Planilha financeira: classificação do plano de contas e regras de baixa, vencido e churn.
import { objs, norm, r2 } from './util.js';
// Regras:
// 1. Baixa automática: um previsto de receita (com cliente) ou de pessoal (02.03.x) é abatido pelos realizados de
//    mesmo código, cliente e competência; o que sobra é o valor em aberto. Demais contas: trocar o status para Realizado.
// 2. Vencido: previsto com valor em aberto e competência anterior ao mês atual. Código 04.01.x é dívida com sócio.
// 3. Churn: cliente com status Churn/Inativo/Encerrado na aba Clientes (MRR) tem as mensalidades previstas zeradas.

export function grupo(c) {
  if (c.startsWith('01')) return 'Receita';
  if (c.startsWith('02.01')) return 'Impostos';
  if (c.startsWith('02.02')) return 'Custos de serviço';
  if (c.startsWith('02.03') || c.startsWith('02.04')) return 'Pessoal';
  if (c.startsWith('02.05')) return 'Marketing e vendas';
  if (c.startsWith('02.06')) return 'Administrativo';
  if (c.startsWith('02.07')) return 'Financeiro';
  if (c.startsWith('03.01')) return 'Aporte de sócio';
  if (c.startsWith('03')) return 'Entrada não operacional';
  if (c.startsWith('04')) return 'Saída não operacional';
  return 'Retirada de sócio';
}

export function transformar(fonte, hoje) {
  const mesAtual = hoje.slice(0, 7);
  const lanc = objs(fonte.lancamentos);
  const clientes = objs(fonte.clientes);
  const saiu = new Set(clientes.filter(c => /churn|inativ|encerrad|saiu|cancelad/i.test(c.status)).map(c => norm(c.nome)));

  const base = lanc.map(r => {
    const valor = Number(r.valor) || 0;
    const codigo = String(r.codigo);
    const g = grupo(codigo);
    const status = /realizado/i.test(r.status) ? 'Realizado' : 'Previsto';
    const churn = status === 'Previsto' && g === 'Receita' && saiu.has(norm(r.cliente));
    return {
      id: String(r.id), data: String(r.data), mes_caixa: String(r.data).slice(0, 7), competencia: r.competencia || String(r.data).slice(0, 7),
      codigo, grupo: g, natureza: /^0[13]/.test(codigo) ? 'Entrada' : 'Saída', status, situacao: '', cliente: r.cliente || '',
      valor: churn ? 0 : valor, valor_em_aberto: 0, descricao: r.descricao || '', churn
    };
  });

  // Regra 1 — baixa automática por código + cliente + competência, só onde o código identifica um único pagamento:
  // receita com cliente preenchido e pessoal (02.03.x, um código por pessoa). Contas que dividem código
  // (aluguel, condomínio e IPTU em 02.06.04, por exemplo) só saem do aberto trocando o status da linha prevista.
  const auto = r => (r.grupo === 'Receita' && norm(r.cliente) !== '') || r.codigo.startsWith('02.03');
  const pago = {};
  base.filter(r => r.status === 'Realizado' && auto(r)).forEach(r => { const k = `${r.codigo}|${norm(r.cliente)}|${r.competencia}`; pago[k] = (pago[k] || 0) + r.valor; });
  base.filter(r => r.status === 'Previsto').sort((a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id)).forEach(r => {
    const k = `${r.codigo}|${norm(r.cliente)}|${r.competencia}`;
    const abate = auto(r) ? Math.min(r.valor, pago[k] || 0) : 0;
    pago[k] = (pago[k] || 0) - abate;
    r.valor_em_aberto = r2(r.valor - abate);
  });

  // Regra 2 — situação
  base.forEach(r => {
    if (r.status === 'Realizado') r.situacao = 'Realizado';
    else if (r.valor_em_aberto <= 0) r.situacao = 'Baixado';
    else if (r.codigo.startsWith('04.01')) r.situacao = 'Dívida com sócio';
    else if (r.competencia < mesAtual) r.situacao = 'Vencido';
    else r.situacao = 'A vencer';
  });

  const realizados = base.filter(r => r.status === 'Realizado');
  const ultimaConc = realizados.reduce((m, r) => (r.data > m ? r.data : m), '');
  const inicio = realizados.reduce((m, r) => (!m || r.mes_caixa < m ? r.mes_caixa : m), '');
  const caixaIni = (fonte.parametros || []).find(p => p.parametro === 'caixa_inicial');

  const cols = ['id', 'data', 'mes_caixa', 'competencia', 'codigo', 'grupo', 'natureza', 'status', 'situacao', 'cliente', 'valor', 'valor_em_aberto', 'descricao'];
  return {
    gerado_em: fonte.gerado_em || null,
    lancamentos: { cols, rows: base.map(r => cols.map(c => r[c])) },
    pipeline: fonte.pipeline || { cols: [], rows: [] },
    clientes: fonte.clientes || { cols: ['nome', 'status'], rows: [] },
    parametros: [
      { parametro: 'caixa_inicial', valor: caixaIni ? Number(caixaIni.valor) : 0 },
      { parametro: 'data_base', valor: hoje },
      { parametro: 'mes_atual', valor: mesAtual },
      { parametro: 'inicio_controle', valor: inicio },
      { parametro: 'ultima_conciliacao', valor: ultimaConc },
      { parametro: 'fonte', valor: 'ao_vivo' }
    ]
  };
}
