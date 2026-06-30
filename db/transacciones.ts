import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import type {
  LineaBorrador,
  ModoPrecio,
  TipoTransaccion,
  Transaccion,
  TransaccionItem,
} from './types';
import { getMargenGeneral } from './configuracion';
import {
  newId,
  normalizarBusqueda,
  nowIso,
  precioConMargen,
  sqlNormalizar,
} from './util';

export type NuevaTransaccion = {
  tipo: TipoTransaccion;
  cliente_proveedor?: string | null;
  motivo?: string | null;
  lineas: LineaBorrador[];
};

/** Delta de stock que aplica una línea según el tipo de transacción. */
function deltaStock(tipo: TipoTransaccion, cantidad: number): number {
  if (tipo === 'venta') return -cantidad;
  return cantidad; // compra (+) y ajuste (± según cantidad)
}

/**
 * Persiste una transacción con sus ítems y aplica el stock, todo de forma
 * atómica. Guarda snapshot de costo/precio por línea. Devuelve el id.
 */
export async function finalizarTransaccion(
  db: SQLiteDatabase,
  t: NuevaTransaccion
): Promise<string> {
  const id = newId();
  const ts = nowIso();
  const esAjuste = t.tipo === 'ajuste';
  const total = esAjuste
    ? 0
    : t.lineas.reduce(
        (acc, l) => acc + l.cantidad * l.precio_unitario_snapshot,
        0
      );

  const margenGeneral = t.tipo === 'compra' ? await getMargenGeneral(db) : 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transacciones
         (id, tipo, fecha_hora, cliente_proveedor, motivo, total,
          created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      id,
      t.tipo,
      ts,
      t.cliente_proveedor ?? null,
      t.motivo ?? null,
      total,
      ts,
      ts
    );

    for (const l of t.lineas) {
      await db.runAsync(
        `INSERT INTO transaccion_items
           (id, transaccion_id, barcode, nombre_snapshot, cantidad,
            costo_snapshot, precio_unitario_snapshot, subtotal, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        newId(),
        id,
        l.barcode,
        l.nombre,
        l.cantidad,
        l.costo_snapshot ?? null,
        l.precio_unitario_snapshot,
        l.cantidad * l.precio_unitario_snapshot
      );

      await db.runAsync(
        `UPDATE productos
           SET stock_actual = stock_actual + ?, updated_at = ?, synced = 0
         WHERE barcode = ?`,
        deltaStock(t.tipo, l.cantidad),
        ts,
        l.barcode
      );

      // En compras, el costo de la línea pasa a ser el costo del producto; si
      // su precio se calcula con margen, se recalcula también el precio de venta.
      if (t.tipo === 'compra' && l.costo_snapshot != null) {
        const prod = await db.getFirstAsync<{
          modo_precio: ModoPrecio;
          margen_pct: number | null;
        }>(
          'SELECT modo_precio, margen_pct FROM productos WHERE barcode = ?',
          l.barcode
        );
        if (prod?.modo_precio === 'margen') {
          await db.runAsync(
            `UPDATE productos
               SET costo = ?, precio = ?, updated_at = ?, synced = 0
             WHERE barcode = ?`,
            l.costo_snapshot,
            precioConMargen(l.costo_snapshot, prod.margen_pct ?? margenGeneral),
            ts,
            l.barcode
          );
        } else {
          await db.runAsync(
            `UPDATE productos
               SET costo = ?, updated_at = ?, synced = 0
             WHERE barcode = ?`,
            l.costo_snapshot,
            ts,
            l.barcode
          );
        }
      }
    }
  });

  return id;
}

export type FiltroHistorial = {
  tipo?: TipoTransaccion;
  desde?: string; // ISO
  hasta?: string; // ISO
  contraparte?: string;
};

export async function listarTransacciones(
  db: SQLiteDatabase,
  filtro: FiltroHistorial = {}
): Promise<Transaccion[]> {
  const where: string[] = [];
  const params: SQLiteBindValue[] = [];
  if (filtro.tipo) {
    where.push('tipo = ?');
    params.push(filtro.tipo);
  }
  if (filtro.desde) {
    where.push('fecha_hora >= ?');
    params.push(filtro.desde);
  }
  if (filtro.hasta) {
    where.push('fecha_hora <= ?');
    params.push(filtro.hasta);
  }
  if (filtro.contraparte) {
    where.push(`${sqlNormalizar('cliente_proveedor')} LIKE ?`);
    params.push(`%${normalizarBusqueda(filtro.contraparte)}%`);
  }
  const sql =
    'SELECT * FROM transacciones' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY fecha_hora DESC';
  return db.getAllAsync<Transaccion>(sql, ...params);
}

export async function getTransaccion(
  db: SQLiteDatabase,
  id: string
): Promise<{ tx: Transaccion; items: TransaccionItem[] } | null> {
  const tx = await db.getFirstAsync<Transaccion>(
    'SELECT * FROM transacciones WHERE id = ?',
    id
  );
  if (!tx) return null;
  const items = await db.getAllAsync<TransaccionItem>(
    'SELECT * FROM transaccion_items WHERE transaccion_id = ?',
    id
  );
  return { tx, items };
}
