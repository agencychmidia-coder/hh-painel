/* Painel HH v3 — cálculos das telas Receita por cliente, A pagar, Custos e Time.
   Funções puras: recebem as linhas de lançamentos (já transformadas pelo /api/dados) e devolvem números prontos.
   Roda no navegador (window.V3calc) e nos testes (node, via vm). */
(function (raiz) {
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const num = v => Number(v) || 0;
  const r2 = v => Math.round(v * 100) / 100;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^dra?\.?\s+/, '').replace(/\s+/g, ' ').trim();
  const somaDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const diaSemana = iso => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = segunda
  const segunda = iso => somaDias(iso, -diaSemana(iso));
  const somaMes = (ym, n) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const rotMes = ym => MES[Number(ym.slice(5, 7)) - 1];
  const OPERACIONAL = ['Impostos', 'Custos de serviço', 'Pessoal', 'Marketing e vendas', 'Administrativo', 'Financeiro'];
  const ehPessoal = c => /^02\.0[34]/.test(c);

  // Nome de cada conta do plano de contas da HH. Conta nova sem nome aparece com o grupo e o código.
  const CONTA = {
    '02.01.01': 'Impostos (DAS)', '02.02.01': 'Prestadores pontuais', '02.02.02': 'Alimentação em captação', '02.02.03': 'Combustível e pedágio',
    '02.02.04': 'Transporte por aplicativo', '02.02.05': 'Aluguel de carro', '02.02.06': 'Estúdio', '02.02.07': 'Domínio e hospedagem',
    '02.03.03': 'Designer', '02.03.04': 'Filmmaker', '02.03.06': 'Gestor de tráfego', '02.03.11': 'CRC e atendimento',
    '02.06.04': 'Aluguel, condomínio e IPTU', '02.06.05': 'Energia e água', '02.06.06': 'Internet e telefone', '02.06.07': 'Software e ferramentas',
    '02.06.08': 'Material de consumo', '02.06.10': 'Limpeza', '02.07.02': 'Tarifas e taxas'
  };
  const nomeConta = (codigo, grupo) => CONTA[codigo] || (grupo + ' · ' + codigo);

  const linhas = L => L.map(r => ({ ...r, valor: num(r.valor), aberto: num(r.valor_em_aberto) }));
  // Custo de uma competência já fechada: o que foi pago + o que venceu e não foi pago.
  const custoFechado = r => (r.status === 'Realizado' ? r.valor : r.situacao === 'Vencido' ? r.aberto : 0);
  // Meses fechados com controle: competências já encerradas a partir do primeiro mês de caixa da planilha
  // (pagamento atrasado de um mês anterior ao controle não vira um mês quase vazio no gráfico).
  const mesesFechados = (L, mesAtual, n) => {
    const real = L.filter(r => r.status === 'Realizado'), inicio = real.map(r => r.mes_caixa).filter(Boolean).sort()[0] || '';
    return [...new Set(real.map(r => r.competencia))].filter(m => m && m < mesAtual && m >= inicio).sort().slice(-n);
  };
  // Receita de um mês: fechado = recebido + vencido não pago; mês atual ou futuro = mensalidades previstas.
  const receitaMes = (T, m, mesAtual) => r2(T.filter(r => r.grupo === 'Receita' && r.competencia === m)
    .reduce((t, r) => t + (m < mesAtual ? custoFechado(r) : r.status === 'Previsto' ? r.valor : 0), 0));

  /* ---------- A pagar: o que vence nos próximos 30 dias ---------- */
  function pagar(Lb, hoje) {
    const L = linhas(Lb), lim = somaDias(hoje, 29);
    const abertas = L.filter(r => r.status === 'Previsto' && r.natureza === 'Saída' && r.aberto > 0 && r.grupo !== 'Retirada de sócio');
    const divida = abertas.filter(r => r.situacao === 'Dívida com sócio');
    const contas = abertas.filter(r => r.situacao !== 'Dívida com sócio');
    const vencidas = contas.filter(r => r.data < hoje).sort((a, b) => a.data.localeCompare(b.data));
    const prox = contas.filter(r => r.data >= hoje && r.data <= lim).sort((a, b) => a.data.localeCompare(b.data) || b.aberto - a.aberto);
    const seg = segunda(hoje), dom = somaDias(seg, 6);
    const semana = prox.filter(r => r.data <= dom);
    const soma = a => r2(a.reduce((t, r) => t + r.aberto, 0));
    const dias = Array.from({ length: 35 }, (_, i) => {
      const d = somaDias(seg, i), its = prox.filter(r => r.data === d);
      return { data: d, total: soma(its), n: its.length, passado: d < hoje, hoje: d === hoje, fora: d > lim };
    });
    const semanas = Array.from({ length: 5 }, (_, i) => {
      const a = somaDias(seg, i * 7), b = somaDias(a, 6);
      return { inicio: a, fim: b, total: soma(prox.filter(r => r.data >= a && r.data <= b)) };
    });
    const cat = {};
    prox.forEach(r => { cat[r.grupo] = (cat[r.grupo] || 0) + r.aberto; });
    const receber = L.filter(r => r.status === 'Previsto' && r.natureza === 'Entrada' && r.aberto > 0 && r.data >= hoje && r.data <= lim);
    return {
      total30: soma(prox), n30: prox.length, ate: lim,
      semana: { total: soma(semana), n: semana.length, inicio: seg, fim: dom },
      vencido: { total: soma(vencidas), n: vencidas.length, itens: vencidas },
      divida_socio: { total: soma(divida), n: divida.length },
      receber30: soma(receber),
      proximas: vencidas.concat(prox).slice(0, 12).map(r => ({ id: r.id, descricao: r.descricao, grupo: r.grupo, data: r.data, valor: r.aberto,
        estado: r.data < hoje ? 'vencida' : r.data <= dom ? 'semana' : 'agendada' })),
      dias, semanas,
      categorias: Object.entries(cat).map(([grupo, total]) => ({ grupo, total: r2(total) })).sort((a, b) => b.total - a.total)
    };
  }

  /* ---------- Custos: para onde vai o dinheiro e o que subiu ---------- */
  function custos(Lb, hoje) {
    const L = linhas(Lb).filter(r => OPERACIONAL.includes(r.grupo));
    const mesAtual = hoje.slice(0, 7), meses = mesesFechados(linhas(Lb), mesAtual, 6);
    const porMes = meses.map(m => ({ mes: m, rotulo: rotMes(m), total: r2(L.filter(r => r.competencia === m).reduce((t, r) => t + custoFechado(r), 0)) }));
    const ult = meses[meses.length - 1], ant = meses.slice(0, -1);
    const contas = {};
    L.forEach(r => {
      if (!meses.includes(r.competencia)) return;
      const v = custoFechado(r); if (!v) return;
      const k = r.codigo, c = contas[k] || (contas[k] = { codigo: k, conta: nomeConta(k, r.grupo), grupo: r.grupo, meses: {} });
      c.meses[r.competencia] = (c.meses[r.competencia] || 0) + v;
    });
    const tabela = Object.values(contas).map(c => {
      const ultimo = r2(c.meses[ult] || 0);
      const vals = ant.map(m => c.meses[m] || 0), comValor = vals.filter(v => v > 0);
      const media = comValor.length ? r2(comValor.reduce((a, b) => a + b, 0) / comValor.length) : 0;
      const variacao = media > 0 ? (ultimo - media) / media : null;
      const estado = !media && ultimo ? 'novo' : !ultimo ? 'sem_lancamento' : variacao > 0.1 ? 'subiu' : variacao < -0.1 ? 'caiu' : 'estavel';
      return { codigo: c.codigo, conta: c.conta, grupo: c.grupo, media, ultimo, variacao, estado, total: r2(Object.values(c.meses).reduce((a, b) => a + b, 0)) };
    }).sort((a, b) => b.ultimo - a.ultimo || b.total - a.total);
    const grupos = {};
    tabela.forEach(t => { grupos[t.grupo] = (grupos[t.grupo] || 0) + t.total; });
    const tot = Object.values(grupos).reduce((a, b) => a + b, 0) || 1;
    // Custo fixo do próximo mês: o que já está previsto na planilha (recorrente) para a competência seguinte.
    const prox = somaMes(mesAtual, 1);
    const fixo = r2(L.filter(r => r.status === 'Previsto' && r.competencia === prox).reduce((t, r) => t + r.valor, 0));
    const receitaPrev = linhas(Lb).filter(r => r.status === 'Previsto' && r.grupo === 'Receita' && r.competencia === prox && r.valor > 0);
    const mrr = r2(receitaPrev.reduce((t, r) => t + r.valor, 0)), clientes = new Set(receitaPrev.map(r => norm(r.cliente))).size;
    const ticket = clientes ? mrr / clientes : 0;
    const recebido = ult ? linhas(Lb).filter(r => r.status === 'Realizado' && r.grupo === 'Receita' && r.competencia === ult).reduce((t, r) => t + r.valor, 0) : 0;
    const ultimos = porMes.slice(-3), media3 = ultimos.length ? r2(ultimos.reduce((t, m) => t + m.total, 0) / ultimos.length) : 0;
    return {
      meses: porMes, ultimo_mes: ult || null, media_mensal: media3,
      pct_receita_ultimo: recebido ? (porMes.length ? porMes[porMes.length - 1].total / recebido : null) : null,
      tabela, subiram: tabela.filter(t => t.estado === 'subiu'),
      grupos: Object.entries(grupos).map(([grupo, total]) => ({ grupo, total: r2(total), pct: total / tot })).sort((a, b) => b.total - a.total),
      fixo_proximo: { competencia: prox, total: fixo, mrr, clientes, ticket: r2(ticket), clientes_para_cobrir: ticket ? Math.ceil((fixo / ticket) * 10) / 10 : null }
    };
  }

  /* ---------- Time: quanto o time custa, função por função ---------- */
  function time(Lb, hoje) {
    const T = linhas(Lb), mesAtual = hoje.slice(0, 7);
    const P = T.filter(r => ehPessoal(r.codigo));
    const mrrDe = m => receitaMes(T, m, mesAtual);
    const planejado = m => r2(P.filter(r => r.status === 'Previsto' && r.competencia === m).reduce((t, r) => t + r.valor, 0));
    const fechados = mesesFechados(T, mesAtual, 5);
    const serie = fechados.map(m => ({ mes: m, rotulo: rotMes(m), time: r2(P.filter(r => r.competencia === m).reduce((t, r) => t + custoFechado(r), 0)), receita: mrrDe(m) }))
      .concat([{ mes: mesAtual, rotulo: rotMes(mesAtual), time: planejado(mesAtual), receita: mrrDe(mesAtual), planejado: true }]);
    const mrr = mrrDe(mesAtual), custo = planejado(mesAtual);
    const atraso = P.filter(r => r.status === 'Previsto' && r.situacao === 'Vencido' && r.aberto > 0);
    const ult3 = fechados.slice(-3);
    const funcoes = [...new Set(P.map(r => r.codigo))].map(c => {
      const R = P.filter(r => r.codigo === c);
      const mes = r2(R.filter(r => r.status === 'Previsto' && r.competencia === mesAtual).reduce((t, r) => t + r.valor, 0));
      const pago3 = r2(R.filter(r => ult3.includes(r.competencia) && r.status === 'Realizado').reduce((t, r) => t + r.valor, 0));
      const at = R.filter(r => r.status === 'Previsto' && r.situacao === 'Vencido' && r.aberto > 0);
      const valorAtraso = r2(at.reduce((t, r) => t + r.aberto, 0));
      return { codigo: c, funcao: nomeConta(c, 'Pessoal'), custo_mes: mes, pago_3m: pago3, pct_receita: mrr ? mes / mrr : null,
        atraso: valorAtraso, meses_atraso: new Set(at.map(r => r.competencia)).size, estado: valorAtraso > 0 ? 'atraso' : mes > 0 ? 'ok' : 'inativo' };
    }).filter(f => f.custo_mes > 0 || f.atraso > 0 || f.pago_3m > 0).sort((a, b) => b.custo_mes - a.custo_mes || b.pago_3m - a.pago_3m);
    // De cada R$ 100 de receita do mês: recorrentes pelo previsto do mês, variáveis pela média dos meses fechados.
    const mediaFechada = g => ult3.length ? T.filter(r => r.grupo === g && ult3.includes(r.competencia)).reduce((t, r) => t + custoFechado(r), 0) / ult3.length : 0;
    const prevMes = g => T.filter(r => r.grupo === g && r.status === 'Previsto' && r.competencia === mesAtual).reduce((t, r) => t + r.valor, 0);
    const partes = [
      ['Time', custo], ['Estrutura (aluguel, contas, ferramentas)', Math.max(prevMes('Administrativo'), mediaFechada('Administrativo'))],
      ['Custos de produção', mediaFechada('Custos de serviço')], ['Impostos e taxas', mediaFechada('Impostos') + mediaFechada('Financeiro')],
      ['Marketing e vendas', mediaFechada('Marketing e vendas')]
    ].filter(p => p[1] > 0).map(([parte, v]) => ({ parte, valor: r2(v), de100: mrr ? r2((v / mrr) * 100) : null }));
    const gasto = partes.reduce((t, p) => t + p.valor, 0);
    return {
      mes: mesAtual, custo_mes: custo, mrr, pct_receita: mrr ? custo / mrr : null, pessoas: funcoes.filter(f => f.custo_mes > 0).length,
      atraso: { total: r2(atraso.reduce((t, r) => t + r.aberto, 0)), n: atraso.length },
      serie, funcoes, de100: partes, sobra: { valor: r2(mrr - gasto), de100: mrr ? r2(((mrr - gasto) / mrr) * 100) : null }
    };
  }

  /* ---------- Receita por cliente: quem pagou, quem atrasou e quanto pesa ---------- */
  function receitaClientes(Lb, carteira, clientes, hoje) {
    const T = linhas(Lb).filter(r => r.grupo === 'Receita' && norm(r.cliente));
    const mesAtual = hoje.slice(0, 7);
    const status = {}; (clientes || []).forEach(c => { status[norm(c.nome)] = c.status || ''; });
    const cart = carteira || [];
    const daCarteira = n => cart.find(c => { const k = norm(c.cliente); if (k === n) return true; const a = n.split(' '), b = k.split(' ');
      return a.length > 1 && b.length > 1 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]; });
    const nomes = {}; T.forEach(r => { const k = norm(r.cliente); if (!nomes[k]) nomes[k] = r.cliente; });
    const primeiro = mesesFechados(linhas(Lb), mesAtual, 12)[0] || mesAtual;
    const meses = []; for (let m = primeiro; m <= somaMes(mesAtual, 1) && meses.length < 12; m = somaMes(m, 1)) meses.push(m);
    const fechados3 = mesesFechados(linhas(Lb), mesAtual, 3);
    const lista = Object.keys(nomes).map(k => {
      const R = T.filter(r => norm(r.cliente) === k);
      const celulas = meses.map(m => {
        const M = R.filter(r => r.competencia === m), prev = M.filter(r => r.status === 'Previsto');
        const previsto = r2(prev.reduce((t, r) => t + r.valor, 0)), pago = r2(M.filter(r => r.status === 'Realizado').reduce((t, r) => t + r.valor, 0));
        const aberto = r2(prev.reduce((t, r) => t + r.aberto, 0)), venc = prev.some(r => r.situacao === 'Vencido' && r.aberto > 0);
        const churn = prev.length > 0; // mensalidade zerada pela regra de churn
        let estado = 'vazio';
        if (previsto === 0 && pago === 0) estado = churn ? 'saiu' : 'vazio';
        else if (aberto <= 0 && (pago > 0 || previsto > 0)) estado = 'pago';
        else if (venc) estado = pago > 0 ? 'parcial' : 'vencido';
        else estado = 'a_vencer';
        return { mes: m, previsto, pago, aberto, estado };
      });
      // Pontualidade dos últimos 3 meses fechados: recebido ÷ (recebido + vencido que ficou em aberto).
      const pago3 = R.filter(r => r.status === 'Realizado' && fechados3.includes(r.competencia)).reduce((t, r) => t + r.valor, 0);
      const prev3 = pago3 + R.filter(r => r.status === 'Previsto' && r.situacao === 'Vencido' && fechados3.includes(r.competencia)).reduce((t, r) => t + r.aberto, 0);
      const mrrAtual = r2(R.filter(r => r.status === 'Previsto' && r.competencia === mesAtual).reduce((t, r) => t + r.valor, 0));
      const mrrProx = r2(R.filter(r => r.status === 'Previsto' && r.competencia === somaMes(mesAtual, 1)).reduce((t, r) => t + r.valor, 0));
      const pagos = R.filter(r => r.status === 'Realizado').sort((a, b) => b.data.localeCompare(a.data));
      const vencido = R.filter(r => r.status === 'Previsto' && r.situacao === 'Vencido' && r.aberto > 0);
      const c = daCarteira(k), st = status[k] || '';
      const saindo = /churn|inativ|encerrad|saiu|cancelad/i.test(st) || (c && c.cor === 'saida');
      const risco = !saindo && (/risco/i.test(st) || (c && c.cor === 'vermelho'));
      const atraso = r2(vencido.reduce((t, r) => t + r.aberto, 0));
      const diasAtraso = vencido.length ? Math.round((Date.parse(hoje) - Date.parse(vencido.map(r => r.data).sort()[0])) / 86400000) : 0;
      const mrr = mrrAtual || mrrProx;
      const acao = atraso > 0 ? 'cobrar' : saindo ? 'saindo' : risco ? 'risco' : null;
      return { cliente: nomes[k], chave: k, mrr, mrr_atual: mrrAtual, mrr_proximo: mrrProx, celulas, pct_3m: prev3 ? pago3 / prev3 : null,
        ultimo_pagamento: pagos.length ? pagos[0].data : null, atraso, dias_atraso: diasAtraso, saindo, risco, cor: c ? c.cor : null, fase: c ? c.fase : null, acao };
    }).filter(c => c.mrr > 0 || c.atraso > 0 || c.celulas.some(x => x.mes >= somaMes(mesAtual, -2) && x.estado !== 'vazio'))
      .sort((a, b) => b.mrr - a.mrr || b.atraso - a.atraso);
    const mrrTotal = r2(lista.filter(c => !c.saindo).reduce((t, c) => t + c.mrr, 0));
    const ativos = lista.filter(c => c.mrr > 0 && !c.saindo);
    const maior = [...ativos].sort((a, b) => b.mrr - a.mrr)[0] || null;
    const emRisco = lista.filter(c => (c.saindo || c.risco) && c.mrr > 0);
    const riscoMes = r2(emRisco.reduce((t, c) => t + c.mrr, 0)), mrrBruto = lista.reduce((t, c) => t + c.mrr, 0);
    return {
      meses: meses.map(m => ({ mes: m, rotulo: rotMes(m), atual: m === mesAtual, futuro: m > mesAtual })), clientes: lista,
      ativos: ativos.length, mrr: mrrTotal,
      concentracao: ativos.map(c => ({ cliente: c.cliente, mrr: c.mrr, pct: mrrTotal ? c.mrr / mrrTotal : 0 })).sort((a, b) => b.mrr - a.mrr),
      maior: maior ? { cliente: maior.cliente, mrr: maior.mrr, pct: mrrTotal ? maior.mrr / mrrTotal : 0 } : null,
      risco: { mes: riscoMes, ano: r2(riscoMes * 12), n: emRisco.length, pct: mrrBruto ? riscoMes / mrrBruto : 0 },
      atraso: { total: r2(lista.reduce((t, c) => t + c.atraso, 0)), n: lista.filter(c => c.atraso > 0).length },
      ligar: lista.filter(c => c.acao).sort((a, b) => (b.atraso > 0) - (a.atraso > 0) || b.mrr - a.mrr)
    };
  }

  const api = { pagar, custos, time, receitaClientes, nomeConta, segunda, somaDias, somaMes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.V3calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
