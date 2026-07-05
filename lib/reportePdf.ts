// Armado y compartir de reportes imprimibles (PDF) desde HTML/CSS.
// Genera con expo-print y lo abre en el diálogo nativo de compartir/imprimir.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FilaInventarioInicial, FilaVenta } from '../db/reportes';
import { formatCOP } from '../db/util';

const TIENDA = 'Tienda Comunal de la Vereda Santa Barbara';

type Alinear = 'left' | 'right';

type Columna = { titulo: string; alinear?: Alinear };

export type ReportePdf = {
  titulo: string;
  /** Solo en ventas por período (ej. "Hoy" o "Julio 2026"). */
  periodo?: string;
  columnas: Columna[];
  /** Cada fila ya viene con sus celdas formateadas como texto. */
  filas: string[][];
  /** Valor del gran total, ya formateado (va en la última columna). */
  totalValor: string;
};

/** Fecha-hora de generación legible: "DD/MM/YYYY HH:MM". */
function ahoraLegible(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

/** Escapa texto para insertarlo con seguridad en el HTML del reporte. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function construirHtml(r: ReportePdf): string {
  const align = (c: Columna) => (c.alinear === 'right' ? 'right' : 'left');

  const thead = r.columnas
    .map((c) => `<th style="text-align:${align(c)}">${esc(c.titulo)}</th>`)
    .join('');

  const tbody = r.filas
    .map(
      (fila) =>
        '<tr>' +
        fila
          .map(
            (celda, i) =>
              `<td style="text-align:${align(r.columnas[i])}">${esc(celda)}</td>`
          )
          .join('') +
        '</tr>'
    )
    .join('');

  // Fila de total: "TOTAL" ocupa todas las columnas menos la última, y el valor
  // va en la última (que siempre es la columna de dinero).
  const totalRow =
    '<tr class="total">' +
    `<td colspan="${r.columnas.length - 1}" style="text-align:right">TOTAL</td>` +
    `<td style="text-align:right">${esc(r.totalValor)}</td>` +
    '</tr>';

  const periodoLinea = r.periodo
    ? `<p class="meta">Período: ${esc(r.periodo)}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
         color: #1a1a1a; padding: 24px; font-size: 12px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: #444; }
  .meta { margin: 0; color: #666; font-size: 11px; }
  header { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e2e2e2; }
  th { text-transform: uppercase; font-size: 10px; letter-spacing: .3px;
       color: #555; border-bottom: 1px solid #999; }
  tr:nth-child(even) td { background: #f7f7f7; }
  tr.total td { font-weight: 700; font-size: 13px; border-top: 2px solid #333;
                border-bottom: none; background: #fff; padding-top: 10px; }
</style>
</head>
<body>
  <header>
    <h1>${esc(TIENDA)}</h1>
    <h2>Reporte: ${esc(r.titulo)}</h2>
    <p class="meta">Generado: ${ahoraLegible()}</p>
    ${periodoLinea}
    <p class="meta">${r.filas.length} producto${r.filas.length === 1 ? '' : 's'}</p>
  </header>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}${totalRow}</tbody>
  </table>
</body>
</html>`;
}

/** Construye el reporte de inventario inicial listo para imprimir. */
export function reporteInventarioInicial(
  filas: FilaInventarioInicial[],
  total: number
): ReportePdf {
  return {
    titulo: 'Inventario inicial',
    columnas: [
      { titulo: 'Código' },
      { titulo: 'Nombre' },
      { titulo: 'Cant. inicial', alinear: 'right' },
      { titulo: 'Precio unit.', alinear: 'right' },
      { titulo: 'Valor total', alinear: 'right' },
    ],
    filas: filas.map((f) => [
      f.barcode,
      f.nombre,
      String(f.stock_inicial),
      formatCOP(f.precio),
      formatCOP(f.valor_total),
    ]),
    totalValor: formatCOP(total),
  };
}

/** Construye el reporte de ventas realizadas listo para imprimir. */
export function reporteVentas(
  filas: FilaVenta[],
  total: number,
  periodo?: string
): ReportePdf {
  return {
    titulo: 'Ventas realizadas',
    periodo,
    columnas: [
      { titulo: 'Código' },
      { titulo: 'Nombre' },
      { titulo: 'Unidades', alinear: 'right' },
      { titulo: 'Precio prom.', alinear: 'right' },
      { titulo: 'Total', alinear: 'right' },
    ],
    filas: filas.map((f) => [
      f.barcode,
      f.nombre,
      String(f.unidades),
      formatCOP(f.precio_prom),
      formatCOP(f.total),
    ]),
    totalValor: formatCOP(total),
  };
}

/**
 * Genera el PDF y abre el diálogo nativo para imprimir/compartir (WhatsApp,
 * correo, Drive…). Si compartir no está disponible, cae a la impresión directa.
 */
export async function compartirReportePdf(reporte: ReportePdf): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: construirHtml(reporte) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: reporte.titulo,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
}
