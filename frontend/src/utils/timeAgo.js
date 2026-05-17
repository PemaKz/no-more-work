/**
 * Formatea un timestamp (string ISO o Date) como "hace X" en español.
 * Devuelve null si el input es null/undefined.
 */
export default function timeAgo(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  const ms = Date.now() - date.getTime();
  if (Number.isNaN(ms)) return null;

  const sec = Math.floor(ms / 1000);
  if (sec < 30) return "hace unos segundos";
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return date.toLocaleDateString();
}
