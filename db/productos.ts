import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import type { ModoPrecio, Producto } from './types';
import { nextCodigoInterno } from './configuracion';
import { finalizarTransaccion } from './transacciones';
import { normalizarBusqueda, nowIso, sqlNormalizar } from './util';

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

export type OrdenProducto = 'nombre' | 'stock' | 'precio';
export type DireccionOrden = 'asc' | 'desc';

/** Umbral (unidades) a partir del cual un producto se considera "stock bajo". */
export const UMBRAL_STOCK_BAJO = 5;

export type OpcionesListado = {
  orden?: OrdenProducto;
  dir?: DireccionOrden;
  soloStockBajo?: boolean;
  soloInactivos?: boolean; // muestra solo los desactivados (activo = 0)
};

export async function listarProductos(
  db: SQLiteDatabase,
  busqueda?: string,
  opciones: OpcionesListado = {}
): Promise<Producto[]> {
  const {
    orden = 'nombre',
    dir = 'asc',
    soloStockBajo = false,
    soloInactivos = false,
  } = opciones;

  // activo es 0/1 derivado de un booleano del código (no de entrada de usuario).
  const where: string[] = [`activo = ${soloInactivos ? 0 : 1}`];
  const params: SQLiteBindValue[] = [];

  if (busqueda && busqueda.trim().length > 0) {
    const term = busqueda.trim();
    // Nombre: cada palabra debe aparecer, en cualquier orden (insensible a
    // acentos). Código de barras: comparación directa contra la frase completa.
    const tokens = normalizarBusqueda(term).split(/\s+/).filter(Boolean);
    const nombreConds = tokens
      .map(() => `${sqlNormalizar('nombre')} LIKE ?`)
      .join(' AND ');
    where.push(`((${nombreConds}) OR barcode LIKE ?)`);
    for (const t of tokens) params.push(`%${t}%`);
    params.push(`%${term}%`);
  }
  if (soloStockBajo) {
    where.push('stock_actual <= ?');
    params.push(UMBRAL_STOCK_BAJO);
  }

  // Dirección y columna salen de listas blancas (nunca de texto del usuario).
  const dirSql = dir === 'desc' ? 'DESC' : 'ASC';
  const orderBy =
    orden === 'stock'
      ? `stock_actual ${dirSql}, nombre COLLATE NOCASE ASC`
      : orden === 'precio'
        ? `precio ${dirSql}, nombre COLLATE NOCASE ASC`
        : `nombre COLLATE NOCASE ${dirSql}`;

  return db.getAllAsync<Producto>(
    `SELECT * FROM productos WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`,
    ...params
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

/** Borrado lógico: oculta el producto del catálogo sin tocar el historial. */
export function desactivarProducto(
  db: SQLiteDatabase,
  barcode: string
): Promise<void> {
  return actualizarProducto(db, barcode, { activo: 0 });
}

/** Reactiva un producto previamente desactivado. */
export function reactivarProducto(
  db: SQLiteDatabase,
  barcode: string
): Promise<void> {
  return actualizarProducto(db, barcode, { activo: 1 });
}

/**
 * Reasigna el código (PK) de un producto usando la estrategia "retirar + crear":
 * crea un producto nuevo con el código `nuevo` copiando datos y stock, migra las
 * referencias laxas de los ítems históricos, y desactiva el viejo (su stock pasa
 * al nuevo). Mantiene el historial y los reportes intactos (snapshots) y deja el
 * respaldo coherente (el viejo se sincroniza como inactivo, sin fantasmas).
 *
 * Sirve en ambos sentidos: código real → INT- (sin código) y viceversa.
 */
export async function reasignarCodigo(
  db: SQLiteDatabase,
  viejo: string,
  nuevo: string,
  opciones: { sinCodigo: boolean }
): Promise<void> {
  const nuevoCod = nuevo.trim();
  if (!nuevoCod) throw new Error('El código nuevo no puede estar vacío.');
  if (nuevoCod === viejo) throw new Error('El código nuevo es igual al actual.');

  const prod = await getProducto(db, viejo);
  if (!prod) throw new Error('Producto no encontrado.');

  const existente = await db.getFirstAsync<{ activo: number }>(
    'SELECT activo FROM productos WHERE barcode = ?',
    nuevoCod
  );
  if (existente) {
    throw new Error(
      existente.activo === 1
        ? 'Ya existe un producto activo con ese código.'
        : 'Ya existe un producto inactivo con ese código; reactívalo en su lugar.'
    );
  }

  const ts = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO productos
         (barcode, nombre, sin_codigo, categoria, modo_precio, costo, margen_pct,
          precio, stock_actual, activo, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)`,
      nuevoCod,
      prod.nombre,
      opciones.sinCodigo ? 1 : 0,
      prod.categoria ?? null,
      prod.modo_precio,
      prod.costo ?? null,
      prod.margen_pct ?? null,
      prod.precio,
      prod.stock_actual,
      prod.created_at,
      ts
    );
    await db.runAsync(
      'UPDATE transaccion_items SET barcode = ?, synced = 0 WHERE barcode = ?',
      nuevoCod,
      viejo
    );
    await db.runAsync(
      `UPDATE productos
         SET activo = 0, stock_actual = 0, updated_at = ?, synced = 0
       WHERE barcode = ?`,
      ts,
      viejo
    );
  });
}

/** Convierte un producto a "sin código": le asigna un INT- autogenerado. */
export async function convertirASinCodigo(
  db: SQLiteDatabase,
  barcode: string
): Promise<string> {
  const nuevo = await nextCodigoInterno(db);
  await reasignarCodigo(db, barcode, nuevo, { sinCodigo: true });
  return nuevo;
}
