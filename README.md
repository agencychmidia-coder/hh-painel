# Painel HH

Painel de gestão interno da Holistic Health em **painel.holistichealth.com.br** (Vercel, projeto `hh-painel`). Acesso protegido por senha (`middleware.js`).

## Como funciona
- `index.html` + `app/*.js`: a página (sem build). `app/calcs*.js` calcula, `app/render.js` desenha.
- `api/dados.js`: lê as três fontes em paralelo e devolve um JSON só.
  - **Planilha financeira**: Apps Script "PainelHH" (`PAINEL_FONTE_URL`).
  - **ClickUp**: pipeline (lista Pipeline de Vendas) e carteira (lista Carteira de Clientes (CS)) (`CLICKUP_TOKEN`).
  - **Growth OS**: função `painel.carteira()`, só agregados, usuário `painel_leitura` (`GROWTHOS_DB_URL`, Transaction pooler, porta 6543).
- Se uma fonte cai, entra a última leitura boa dela (tabela `painel.ultima_leitura` no Growth OS) e o topo do painel mostra qual fonte está atrasada. Só sem nenhum dado financeiro o painel usa a foto em `data/`.
- Regras em `lib/`: `financeiro.js`, `pipeline.js`, `carteira.js`; leitura das fontes em `lib/fontes.js`.

## Mudar e publicar
1. Mudar o código e rodar `npm test`.
2. `git push` na `main` publica em produção pela Vercel. Os testes rodam no GitHub a cada push.
3. Para desfazer: Vercel → Deployments → versão anterior → Promote to Production (ou `git revert`).

Nunca colocar senhas ou tokens no código: tudo fica nas variáveis de ambiente da Vercel.
