
// Períodos relativos ao mês atual: nada de meses fixos.
dash.calc('contexto', {
  title: 'Períodos do painel', description: 'Mês atual, meses desde o início do controle, os dois últimos meses fechados, os três meses da projeção e o mês da meta.',
  inputs: ['parametros', 'lancamentos'],
  fn: (parametros, lancamentos) => {
    const p = k => { const x = parametros.find(q => q.parametro === k); return x ? x.valor : null; };
    const add = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const atual = p('mes_atual') || String(p('data_base') || '').slice(0, 7);
    const real = lancamentos.filter(r => r.status === 'Realizado');
    const inicio = p('inicio_controle') || real.reduce((m, r) => (!m || r.mes_caixa < m ? r.mes_caixa : m), '');
    const meses = []; for (let m = inicio; m && m <= atual; m = add(m, 1)) meses.push(m);
    const fechados = meses.filter(m => m < atual);
    const ultConc = p('ultima_conciliacao') || real.reduce((m, r) => (r.data > m ? r.data : m), '');
    return [{ atual, inicio, meses: meses.slice(-6), ult2: fechados.slice(-2), proj: [atual, add(atual, 1), add(atual, 2)], meta: add(atual, 1),
      data_base: p('data_base') || '', ultima_conciliacao: ultConc, fonte: p('fonte') || 'foto', gerado_em: p('gerado_em') || '', motivo_foto: p('motivo_foto') || '' }];
  }
});

dash.calc('caixa_atual', {
  title: 'Caixa hoje', description: 'Caixa inicial mais entradas realizadas menos saídas realizadas.',
  inputs: ['lancamentos','parametros'],
  fn: (lancamentos, parametros) => {
    const ini = Number(parametros.find(p => p.parametro === 'caixa_inicial').valor);
    let e = 0, s = 0;
    lancamentos.filter(r => r.status === 'Realizado').forEach(r => { if (r.natureza === 'Entrada') e += Number(r.valor); else s += Number(r.valor); });
    return [{ saldo: Math.round((ini + e - s) * 100) / 100, entradas: Math.round(e * 100) / 100, saidas: Math.round(s * 100) / 100 }];
  }
});

dash.calc('saldo_diario', {
  title: 'Saldo diário', description: 'Saldo acumulado no fim de cada dia com movimento realizado.',
  inputs: ['lancamentos','parametros','contexto'],
  fn: (lancamentos, parametros, contexto) => {
    let s = Number(parametros.find(p => p.parametro === 'caixa_inicial').valor);
    const dia = {};
    lancamentos.filter(r => r.status === 'Realizado').forEach(r => { dia[r.data] = (dia[r.data] || 0) + (r.natureza === 'Entrada' ? 1 : -1) * Number(r.valor); });
    const out = [{ data: contexto[0].inicio + '-01', saldo: s }];
    Object.keys(dia).sort().forEach(d => { s += dia[d]; out.push({ data: d, saldo: Math.round(s * 100) / 100 }); });
    return out;
  }
});

dash.calc('dre_competencia', {
  title: 'DRE por competência', description: 'Grupos operacionais por mês de competência: realizados mais o valor em aberto dos vencidos.',
  inputs: ['lancamentos','contexto'],
  fn: (lancamentos, contexto) => {
    const ops = ['Receita','Impostos','Custos de serviço','Pessoal','Marketing e vendas','Administrativo','Financeiro'];
    return contexto[0].meses.map(m => {
      const s = {}; ops.forEach(g => s[g] = 0);
      lancamentos.filter(r => r.competencia === m && ops.includes(r.grupo) && (r.status === 'Realizado' || r.situacao === 'Vencido'))
        .forEach(r => s[r.grupo] += Number(r.status === 'Realizado' ? r.valor : r.valor_em_aberto));
      const r2 = x => Math.round(x * 100) / 100;
      const custos = s['Impostos'] + s['Custos de serviço'] + s['Marketing e vendas'] + s['Administrativo'] + s['Financeiro'];
      const res = s['Receita'] - s['Pessoal'] - custos;
      return { competencia: m, receita: r2(s['Receita']), pessoal: r2(s['Pessoal']), servico: r2(s['Custos de serviço']), admin: r2(s['Administrativo']),
        impostos_fin: r2(s['Impostos'] + s['Financeiro'] + s['Marketing e vendas']), custos_adm: r2(custos), resultado: r2(res),
        margem: s['Receita'] ? Math.round(res / s['Receita'] * 1000) / 1000 : null };
    });
  }
});

dash.calc('resumo_comp', {
  title: 'Resultado dos dois últimos meses fechados', description: 'Soma dos dois últimos meses fechados por competência; margem = resultado ÷ receita.',
  inputs: ['dre_competencia','contexto'],
  fn: (dre_competencia, contexto) => {
    const m = dre_competencia.filter(r => contexto[0].ult2.includes(r.competencia));
    const rec = m.reduce((a, r) => a + r.receita, 0), res = m.reduce((a, r) => a + r.resultado, 0);
    return [{ receita: Math.round(rec * 100) / 100, resultado: Math.round(res * 100) / 100, margem: rec ? Math.round(res / rec * 1000) / 1000 : null }];
  }
});

dash.calc('ponte', {
  title: 'Ponte do resultado', description: 'Receita dos dois últimos meses fechados menos cada grupo de custo, até o resultado.',
  inputs: ['dre_competencia','contexto'],
  fn: (dre_competencia, contexto) => {
    const m = dre_competencia.filter(r => contexto[0].ult2.includes(r.competencia));
    const t = k => Math.round(m.reduce((a, r) => a + r[k], 0) * 100) / 100;
    return [
      { etapa: 'Receita', valor: t('receita'), tipo: 'total' },
      { etapa: 'Pessoal', valor: -t('pessoal'), tipo: 'passo' },
      { etapa: 'Administrativo', valor: -t('admin'), tipo: 'passo' },
      { etapa: 'Custos de serviço', valor: -t('servico'), tipo: 'passo' },
      { etapa: 'Impostos e tarifas', valor: -t('impostos_fin'), tipo: 'passo' },
      { etapa: 'Resultado', valor: t('resultado'), tipo: 'total' }
    ];
  }
});

dash.calc('custos_grupo', {
  title: 'Custos por grupo', description: 'Custos operacionais dos dois últimos meses fechados por grupo, por competência.',
  inputs: ['dre_competencia','contexto'],
  fn: (dre_competencia, contexto) => {
    const m = dre_competencia.filter(r => contexto[0].ult2.includes(r.competencia));
    const t = k => Math.round(m.reduce((a, r) => a + r[k], 0) * 100) / 100;
    return [{ grupo: 'Pessoal', valor: t('pessoal') }, { grupo: 'Administrativo', valor: t('admin') }, { grupo: 'Custos de serviço', valor: t('servico') }, { grupo: 'Impostos e tarifas', valor: t('impostos_fin') }];
  }
});

dash.calc('entradas_origem', {
  title: 'Entradas por origem', description: 'Receita de clientes e aportes de sócios por mês de caixa.',
  inputs: ['lancamentos','contexto'],
  fn: (lancamentos, contexto) => contexto[0].meses.map(m => {
    const re = lancamentos.filter(r => r.status === 'Realizado' && r.mes_caixa === m);
    const s = g => Math.round(re.filter(r => r.grupo === g).reduce((a, r) => a + Number(r.valor), 0) * 100) / 100;
    return { mes: m, receita: s('Receita'), aportes: s('Aporte de sócio') };
  })
});

dash.calc('socios', {
  title: 'Aportes e retiradas', description: 'Aportes (03.01.01) e retiradas de sócios (05.x) por mês de caixa.',
  inputs: ['lancamentos','contexto'],
  fn: (lancamentos, contexto) => contexto[0].meses.map(m => {
    const re = lancamentos.filter(r => r.status === 'Realizado' && r.mes_caixa === m);
    const ap = re.filter(r => r.grupo === 'Aporte de sócio').reduce((a, r) => a + Number(r.valor), 0);
    const rt = re.filter(r => r.grupo === 'Retirada de sócio').reduce((a, r) => a + Number(r.valor), 0);
    return { mes: m, aportes: Math.round(ap * 100) / 100, retiradas: Math.round(rt * 100) / 100, liquido: Math.round((rt - ap) * 100) / 100 };
  })
});

dash.calc('socios_total', {
  title: 'Retirada líquida total', description: 'Soma de retiradas menos aportes desde o início do controle.',
  inputs: ['socios'],
  fn: (socios) => [{ liquido: Math.round(socios.reduce((a, r) => a + r.liquido, 0) * 100) / 100 }]
});

dash.calc('vencidos', {
  title: 'Contas vencidas', description: 'Saídas previstas com valor em aberto de meses já encerrados, mais dívidas com sócios. Mensalidades de clientes atrasadas não entram aqui.',
  inputs: ['lancamentos'],
  fn: (lancamentos) => lancamentos.filter(r => r.natureza === 'Saída' && (r.situacao === 'Vencido' || r.situacao === 'Dívida com sócio'))
    .map(r => ({ id: r.id, descricao: r.descricao, competencia: r.competencia, valor: Number(r.valor_em_aberto) }))
});

dash.calc('vencido_total', {
  title: 'Total vencido', description: 'Soma das contas vencidas e das dívidas com sócios.',
  inputs: ['vencidos'],
  fn: (vencidos) => [{ total: Math.round(vencidos.reduce((a, r) => a + r.valor, 0) * 100) / 100 }]
});

dash.calc('projecao', {
  title: 'Projeção de caixa', description: 'Caixa hoje mais previstos em aberto do mês atual e dos dois seguintes; um cenário paga os vencidos no mês atual, o outro não.',
  inputs: ['lancamentos','caixa_atual','vencido_total','contexto'],
  fn: (lancamentos, caixa_atual, vencido_total, contexto) => {
    let a = caixa_atual[0].saldo, b = a;
    const out = [{ mes: 'Hoje', pagando_vencidos: a, sem_pagar_vencidos: b }];
    contexto[0].proj.forEach((m, i) => {
      const p = lancamentos.filter(r => r.status === 'Previsto' && r.situacao === 'A vencer' && r.competencia === m);
      const e = p.filter(r => r.natureza === 'Entrada').reduce((x, r) => x + Number(r.valor_em_aberto), 0);
      const s = p.filter(r => r.natureza === 'Saída').reduce((x, r) => x + Number(r.valor_em_aberto), 0);
      a += e - s - (i === 0 ? vencido_total[0].total : 0); b += e - s;
      out.push({ mes: m, pagando_vencidos: Math.round(a * 100) / 100, sem_pagar_vencidos: Math.round(b * 100) / 100 });
    });
    return out;
  }
});

dash.calc('meta_margem', {
  title: 'MRR e custo fixo', description: 'Receita e custos previstos para o próximo mês (mês cheio, sem atrasos).',
  inputs: ['lancamentos','contexto'],
  fn: (lancamentos, contexto) => {
    const nov = lancamentos.filter(r => r.status === 'Previsto' && r.competencia === contexto[0].meta);
    const mrr = nov.filter(r => r.grupo === 'Receita').reduce((a, r) => a + Number(r.valor), 0);
    const clientes = nov.filter(r => r.grupo === 'Receita' && Number(r.valor) > 0).length;
    const custo = nov.filter(r => r.natureza === 'Saída').reduce((a, r) => a + Number(r.valor), 0);
    return [{ mrr: mrr, custo_fixo: Math.round(custo * 100) / 100, clientes: clientes, ticket: clientes ? Math.round(mrr / clientes * 100) / 100 : null }];
  }
});

dash.calc('equilibrio', {
  title: 'Equilíbrio e concentração', description: 'Queima = custo fixo − MRR; equilíbrio = custo fixo ÷ ticket; concentração = maior MRR ÷ MRR total.',
  inputs: ['meta_margem','mrr_clientes'],
  fn: (meta_margem, mrr_clientes) => {
    const m = meta_margem[0], top = mrr_clientes[0] || { mrr: 0, cliente: '—' };
    return [{ queima: Math.round((m.custo_fixo - m.mrr) * 100) / 100, clientes: m.clientes, ticket: m.ticket,
      clientes_equilibrio: m.ticket ? Math.round(m.custo_fixo / m.ticket * 10) / 10 : null,
      concentracao: m.mrr ? Math.round(top.mrr / m.mrr * 1000) / 1000 : null, maior_cliente: top.cliente,
      em_saida: mrr_clientes.filter(r => r.status === 'saida').length }];
  }
});

dash.calc('meta_cenarios', {
  title: 'Receita para a meta', description: 'Necessária = custo fixo ÷ (1 − margem alvo); falta = necessária − MRR; clientes = falta ÷ ticket.',
  inputs: ['meta_margem'],
  fn: (meta_margem) => {
    const m = meta_margem[0];
    return [['Empatar (0%)', 0], ['Meta 40%', 0.4], ['Meta 50%', 0.5]].map(([c, t]) => {
      const need = m.custo_fixo / (1 - t), falta = Math.max(0, need - m.mrr);
      return { cenario: c, receita_necessaria: Math.round(need * 100) / 100, falta: Math.round(falta * 100) / 100, clientes: m.ticket ? Math.ceil(falta / m.ticket * 10) / 10 : null };
    });
  }
});

dash.calc('mrr_clientes', {
  title: 'MRR por cliente', description: 'Mensalidade prevista no próximo mês por cliente, com o status da aba Clientes (MRR).',
  inputs: ['lancamentos','contexto','clientes'],
  fn: (lancamentos, contexto, clientes) => {
    const n = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^dra?\.?\s+/, '').trim();
    const st = {}; clientes.forEach(c => { st[n(c.nome)] = c.status; });
    const tipo = s => /churn|inativ|encerrad|saiu|cancelad/i.test(s || '') ? 'saida' : (/risco/i.test(s || '') ? 'risco' : 'ativo');
    return lancamentos.filter(r => r.status === 'Previsto' && r.competencia === contexto[0].meta && r.grupo === 'Receita')
      .map(r => ({ cliente: r.cliente, mrr: Number(r.valor), status: Number(r.valor) === 0 ? 'saida' : tipo(st[n(r.cliente)]) })).sort((a, b) => b.mrr - a.mrr);
  }
});

dash.calc('funil', {
  title: 'Funil por etapa', description: 'Oportunidades e MRR por etapa no pipeline.',
  inputs: ['pipeline'],
  fn: (pipeline) => ['0 - Lead','1 - Contato inicial','2 - Diagnóstico agendado','3 - Diagnóstico realizado','4 - Proposta enviada','5 - Negociação','6 - Ganho','7 - Perdido'].map(e => {
    const r = pipeline.filter(p => p.etapa === e);
    return { etapa: e, oportunidades: r.length, mrr: r.reduce((a, p) => a + Number(p.mrr_fechado || p.mrr_proposto || 0), 0) };
  })
});

dash.calc('funil_resumo', {
  title: 'Resumo do funil', description: 'Abertas = etapas 1–5; conversão = ganhos ÷ (ganhos + perdidos), só com perdidos registrados.',
  inputs: ['pipeline'],
  fn: (pipeline) => {
    const g = pipeline.filter(p => p.etapa === '6 - Ganho'), l = pipeline.filter(p => p.etapa === '7 - Perdido');
    const ab = pipeline.filter(p => /^[1-5] /.test(p.etapa)).length;
    const ind = g.filter(p => /Indica|Networking/.test(p.origem_lead)).length;
    return [{ abertas: ab, ganhos: g.length, perdidos: l.length, conversao: l.length ? Math.round(g.length / (g.length + l.length) * 1000) / 1000 : null,
      share_indicacao: g.length ? Math.round(ind / g.length * 1000) / 1000 : null }];
  }
});

// Probabilidade de fechamento por etapa: PREMISSA (sem histórico de perdidos ainda). Recalibrar com ~20 oportunidades encerradas.
dash.calc('pipeline_valor', {
  title: 'Valor do pipeline', description: 'Em aberto = soma do MRR proposto das etapas 1 a 5. Projetado = MRR proposto × chance da etapa (0 a 5). Sem valor = abertas sem MRR proposto.',
  inputs: ['pipeline'],
  fn: (pipeline) => {
    const PROB = { 0: 0.05, 1: 0.10, 2: 0.20, 3: 0.35, 4: 0.50, 5: 0.70 };
    const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
    let aberto = 0, ponderado = 0, abertas = 0, semValor = 0;
    pipeline.forEach(p => {
      const e = parseInt(p.etapa, 10);
      if (!(e in PROB)) return;
      const v = num(p.mrr_proposto);
      abertas++; if (!v) semValor++;
      if (e >= 1) aberto += v;
      ponderado += v * PROB[e];
    });
    return [{ aberto: Math.round(aberto * 100) / 100, ponderado: Math.round(ponderado * 100) / 100, abertas, sem_valor: semValor }];
  }
});

dash.calc('origem', {
  title: 'Clientes por origem', description: 'Clientes ganhos agrupados por origem do lead.',
  inputs: ['pipeline'],
  fn: (pipeline) => {
    const g = {};
    pipeline.filter(p => p.etapa === '6 - Ganho').forEach(p => { g[p.origem_lead] = g[p.origem_lead] || { origem: p.origem_lead, clientes: 0, mrr: 0 }; g[p.origem_lead].clientes++; g[p.origem_lead].mrr += Number(p.mrr_fechado || 0); });
    return Object.values(g);
  }
});

dash.calc('variacao', {
  title: 'Variação entre os dois últimos meses fechados', description: 'Diferença de resultado (R$) e de margem (pontos percentuais) do último mês fechado contra o anterior.',
  inputs: ['dre_competencia','contexto'],
  fn: (dre_competencia, contexto) => {
    const [ma, ms] = contexto[0].ult2;
    const a = dre_competencia.find(r => r.competencia === ma), s = dre_competencia.find(r => r.competencia === ms);
    if (!a || !s) return [{ delta_resultado: null, delta_margem: null }];
    return [{ delta_resultado: Math.round((s.resultado - a.resultado) * 100) / 100, delta_margem: s.margem == null || a.margem == null ? null : Math.round((s.margem - a.margem) * 1000) / 1000 }];
  }
});
