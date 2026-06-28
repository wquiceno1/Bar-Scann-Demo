import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import type { ModoPrecio, Producto } from './types';
import { finalizarTransaccion } from './transacciones';
import { nowIso } from './util';

export async function getProducto(
  db: SQLiteDatabase,
  barcode: string
): Promise<Producto | null> {
  return (
    (await db.getFirstAsync<Producto>(
      'SELECT * FROM productos WHERE barcode = ?',
      barcode
    )) ?? null
  );
}

export async function listarProductos(
  db: SQLiteDatabase,
  busqueda?: string
): Promise<Producto[]> {
  if (busqueda && busqueda.trim().length > 0) {
    const q = `%${busqueda.trim()}%`;
    return db.getAllAsync<Producto>(
      `SELECT * FROM productos
         WHERE activo = 1 AND (nombre LIKE ? OR barcode LIKE ?)
         ORDER BY nombre`,
      q,
      q
    );
  }
  return db.getAllAsync<Producto>(
    'SELECT * FROM productos WHERE activo = 1 ORDER BY nombre'
  );
}

export type NuevoProducto = {
  barcode: string;
  nombre: string;
  sin_codigo?: boolean;
  categoria?: string | null;
  modo_precio: ModoPrecio;
  costo?: number | null;
  margen_pct?: number | null;
  precio: number;
  stock_inicial?: number;
};

export async function crearProducto(
  db: SQLiteDatabase,
  p: NuevoProducto
): Promise<void> {
  const ts = nowIso();
  // Se crea con stock 0; el stock inicial se registra como un movimiento
  // 'ajuste' (motivo 'inventario inicial') para que quede trazado y no
  // "aparezca de la nada".
  await db.runAsync(
    `INSERT INTO productos
       (barcode, nombre, sin_codigo, categoria, modo_precio, costo, margen_pct,
        precio, stock_actual, activo, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, 0)`,
    p.barcode,
    p.nombre,
    p.sin_codigo ? 1 : 0,
    p.categoria ?? null,
    p.modo_precio,
    p.costo ?? null,
    p.margen_pct ?? null,
    p.precio,
    ts,
    ts
  );

  if (p.stock_inicial && p.stock_inicial !== 0) {
    await finalizarTransaccion(db, {
      tipo: 'ajuste',
      motivo: 'inventario inicial',
      lineas: [
        {
          barcode: p.barcode,
          nombre: p.nombre,
          cantidad: p.stock_inicial,
          costo_snapshot: p.costo ?? null,
          precio_unitario_snapshot: 0,
        },
      ],
    });
  }
}

export type CamposEditables = Partial<
  Pick<
    Producto,
    | 'nombre'
    | 'categoria'
    | 'modo_precio'
    | 'costo'
    | 'margen_pct'
    | 'precio'
    | 'activo'
  >
>;

export async function actualizarProducto(
  db: SQLiteDatabase,
  barcode: string,
  campos: CamposEditables
): Promise<void> {
  const keys = Object.keys(campos);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const valores = keys.map(
    (k) => (campos as Record<string, SQLiteBindValue>)[k]
  );
  await db.runAsync(
    `UPDATE productos SET ${sets}, updated_at = ?, synced = 0 WHERE barcode = ?`,
    ...valores,
    nowIso(),
    barcode
  );
}
