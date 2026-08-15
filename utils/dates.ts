export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSameDate(a: Date, b: Date) {
  return toISODate(a) === toISODate(b);
}

export function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

export function formatDateLabel(date: Date, prefix = 'Séance') {
  if (isSameDate(date, new Date())) return `${prefix} d'aujourd'hui`;
  if (isSameDate(date, getYesterday())) return `${prefix} d'hier`;
  return `${prefix} du ${date.toLocaleDateString('fr-FR')}`;
}

export function formatISODateLabel(dateStr: string, prefix = 'Séance') {
  return formatDateLabel(new Date(dateStr + 'T00:00:00'), prefix);
}
