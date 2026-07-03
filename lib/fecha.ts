// Helpers de fecha para los selectores por día (reportes, historial).
// Trabajan con cadenas 'YYYY-MM-DD' en hora local, coherentes con `fecha_hora`
// (ISO local) de la base.

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' usando la fecha local. */
export function dateADiaStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date a medianoche local. */
export function diaADate(dia: string): Date {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Día de hoy como 'YYYY-MM-DD' local. */
export function hoyStr(): string {
  return dateADiaStr(new Date());
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD'. */
export function sumarDias(dia: string, delta: number): string {
  const d = diaADate(dia);
  d.setDate(d.getDate() + delta);
  return dateADiaStr(d);
}

/** Etiqueta legible: "lunes, 29 de junio". */
export function fechaLarga(dia: string): string {
  return diaADate(dia).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Límites ISO [desde, hasta] que cubren todo el día indicado. */
export function rangoDia(dia: string): { desde: string; hasta: string } {
  return { desde: `${dia}T00:00:00`, hasta: `${dia}T23:59:59` };
}

// --- Mes: cadenas 'YYYY-MM' en hora local. ---

/** Mes actual como 'YYYY-MM' local. */
export function hoyMesStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Suma (o resta) meses a un mes 'YYYY-MM'. */
export function sumarMeses(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Etiqueta legible: "julio 2026". */
export function mesLargo(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });
}

/** Límites ISO [desde, hasta] que cubren todo el mes indicado ('YYYY-MM'). */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(y, m, 0).getDate(); // día 0 del mes siguiente
  return {
    desde: `${mes}-01T00:00:00`,
    hasta: `${mes}-${pad2(ultimoDia)}T23:59:59`,
  };
}
