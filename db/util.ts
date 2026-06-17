// Utilidades compartidas de la capa de datos.

/** Fecha-hora local en ISO 8601 sin zona: 'YYYY-MM-DDTHH:mm:ss'. */
export function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** UUID v4 (suficiente para un solo dispositivo; no usa cripto fuerte). */
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Precio sugerido en COP (entero) a partir de costo y margen %. */
export function precioConMargen(costo: number, margenPct: number): number {
  return Math.round(costo * (1 + margenPct / 100));
}

/** Formato de dinero COP para mostrar (ej. 12500 -> '$12.500'). */
export function formatCOP(valor: number): string {
  return '$' + Math.round(valor).toLocaleString('es-CO');
}
