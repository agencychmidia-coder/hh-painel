// Utilidades compartilhadas pelo /api/dados.
export const FUSO = 'America/Sao_Paulo';
export const objs = t => (t && t.cols ? t.rows.map(r => Object.fromEntries(t.cols.map((c, i) => [c, r[i]]))) : []);
export const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^dra?\.?\s+/, '').trim();
export const chave = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const r2 = x => Math.round(x * 100) / 100;

export function hojeSP(agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(agora).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const isoSP = ms => (ms ? hojeSP(new Date(Number(ms))) : '');
export const diasEntre = (a, b) => Math.floor((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
export const dmy = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');

export function numeroBR(v) {
  let s = String(v == null ? '' : v).replace(/r\$/i, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}
