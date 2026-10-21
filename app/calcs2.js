// Cálculos adicionados em 15/10/2026: conversão por origem, mensalidades em atraso, MRR mês a mês e maiores despesas.
dash.calc('origem', {
  title: 'Oportunidades e conversão por origem', description: 'Por origem do lead: oportunidades, ganhos, perdidos, conversão = ganhos ÷ (ganhos + perdidos) e MRR ganho.',
  inputs: ['pipeline'],
  fn: (pipeline) => {
    const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
    const g = {};
    pipeline.forEach(p => {
      const o = String(p.origem_lead || '').trim() || 'Sem origem';
      const x = g[o] = g[o] || { origem: o, oportunidades: 0, ganhos: 0, perdidos: 0, mrr: 0 };
      x.oportunidades++;
      if (p.etapa === '6 - Ganho') { x.ganhos++; x.mrr += num(p.mrr_fechado) || num(p.mrr_proposto); }
      if (p.etapa === '7 - Perdido') x.perdidos++;
    });
    return Object.values(g).map(x => ({ ...x, conversao: x.perdidos ? Math.round(x.ganhos / (x.ganhos + x.perdidos) * 1000) / 1000 : null }))
      .sort((a, b) => b.oportunidades - a.oportunidades);
  }
});

dash.calc('recebiveis_atrasados', {
  title: 'Mensalidades em atraso', description: 'Receitas previstas com valor em aberto e vencimento anterior a hoje. Dias = hoje − vencimento.',
  inputs: ['lancamentos', 'contexto'],
  fn: (lancamentos, contexto) => {
    const hoje = contexto[0].data_base || new Date().toISOString().slice(0, 10);
    const dias = d => Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 86400000);
    return lancamentos.filter(r => r.status === 'Previsto' && r.grupo === 'Receita' && Number(r.valor_em_aberto) > 0 && /^\d{4}-\d{2}-\d{2}/.test(r.data) && r.data < hoje)
      .map(r => ({ id: r.id, cliente: r.cliente || r.descricao, descricao: r.descricao, vencimento: r.data, dias: dias(r.data), valor: Number(r.valor_em_aberto) }))
      .sort((a, b) => b.dias - a.dias);
  }
});

dash.calc('recebiveis_faixas', {
  title: 'Atraso por faixa', description: 'Mensalidades em atraso somadas por faixa de dias.',
  inputs: ['recebiveis_atrasados'],
  fn: (rows) => [['1 a 30 dias', 1, 30], ['31 a 60 dias', 31, 60], ['Mais de 60 dias', 61, 1e9]].map(([faixa, a, b]) => {
    const r = rows.filter(x => x.dias >= a && x.dias <= b);
    return { faixa, qtd: r.length, valor: Math.round(r.reduce((t, x) => t + x.valor, 0) * 100) / 100 };
  })
});

dash.calc('mrr_mensal', {
  title: 'MRR mês a mês', description: 'Por competência: por cliente, o maior entre o previsto e o recebido; somado no mês. Entraram/saíram comparam a lista de clientes com o mês anterior. Churn = saíram ÷ clientes do mês anterior.',
  inputs: ['lancamentos', 'contexto'],
  fn: (lancamentos, contexto) => {
    const c = contexto[0];
    const add = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const meses = []; for (let m = c.inicio; m && m <= c.meta; m = add(m, 1)) meses.push(m);
    const n = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^dra?\.?\s+/, '').trim();
    const acc = {};
    lancamentos.filter(r => r.grupo === 'Receita' && meses.includes(r.competencia)).forEach(r => {
      const k = r.competencia + '|' + n(r.cliente || r.descricao);
      const x = acc[k] = acc[k] || { prev: 0, real: 0 };
      if (r.status === 'Realizado') x.real += Number(r.valor); else x.prev += Number(r.valor);
    });
    let anterior = null;
    return meses.map(m => {
      const cli = {};
      Object.keys(acc).filter(k => k.startsWith(m + '|')).forEach(k => { const v = Math.max(acc[k].prev, acc[k].real); if (v > 0) cli[k.slice(8)] = v; });
      const nomes = Object.keys(cli), mrr = nomes.reduce((t, k) => t + cli[k], 0);
      let novos = null, saidas = null, churn = null;
      if (anterior) {
        novos = nomes.filter(k => !(k in anterior)).length;
        saidas = Object.keys(anterior).filter(k => !(k in cli)).length;
        churn = Object.keys(anterior).length ? Math.round(saidas / Object.keys(anterior).length * 1000) / 1000 : null;
      }
      anterior = cli;
      return { mes: m, mrr: Math.round(mrr * 100) / 100, clientes: nomes.length, novos, saidas, churn, previsto: m >= c.atual };
    });
  }
});

dash.calc('maiores_despesas', {
  title: 'Maiores despesas', description: 'Último mês fechado por competência: saídas operacionais pagas ou vencidas, somadas por descrição. % = participação no custo operacional do mês.',
  inputs: ['lancamentos', 'contexto'],
  fn: (lancamentos, contexto) => {
    const m = contexto[0].ult2[contexto[0].ult2.length - 1];
    const ops = ['Impostos', 'Custos de serviço', 'Pessoal', 'Marketing e vendas', 'Administrativo', 'Financeiro'];
    const g = {};
    lancamentos.filter(r => r.competencia === m && ops.includes(r.grupo) && (r.status === 'Realizado' || r.situacao === 'Vencido')).forEach(r => {
      const k = (r.descricao || r.codigo) + '|' + r.grupo;
      const x = g[k] = g[k] || { descricao: r.descricao || r.codigo, grupo: r.grupo, valor: 0 };
      x.valor += Number(r.status === 'Realizado' ? r.valor : r.valor_em_aberto);
    });
    const rows = Object.values(g), total = rows.reduce((t, x) => t + x.valor, 0);
    return rows.sort((a, b) => b.valor - a.valor).slice(0, 10).map(x => ({ ...x, valor: Math.round(x.valor * 100) / 100, pct: total ? Math.round(x.valor / total * 1000) / 1000 : null }));
  }
});
