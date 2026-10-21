// Proteção por senha (HTTP Basic) de todo o site, fechada por padrão.
// Senha na variável de ambiente PAINEL_SENHA (Vercel > Settings > Environment Variables).
// Usuário opcional em PAINEL_USUARIO (padrão: "hh"). Sem PAINEL_SENHA definida, ninguém entra.
export const config = { runtime: 'nodejs' };

function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default function middleware(request) {
  const senha = process.env.PAINEL_SENHA;
  const usuario = process.env.PAINEL_USUARIO || 'hh';
  const base = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Type': 'text/plain; charset=utf-8' };
  if (!senha) return new Response('Painel HH bloqueado: a senha de acesso ainda não foi configurada.', { status: 503, headers: base });
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Basic ')) {
    let dec = '';
    try { dec = Buffer.from(auth.slice(6), 'base64').toString('utf8'); } catch (e) {}
    const i = dec.indexOf(':');
    if (i > -1 && iguais(dec.slice(0, i), usuario) && iguais(dec.slice(i + 1), senha)) return; // segue para o painel
  }
  return new Response('Acesso restrito ao Painel HH.', { status: 401, headers: { ...base, 'WWW-Authenticate': 'Basic realm="Painel HH", charset="UTF-8"' } });
}
