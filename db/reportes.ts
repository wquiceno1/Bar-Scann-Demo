import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

/** Valor del inventario: al costo (inversión) y al precio de venta (potencial). */
export async function valorInventario(
  db: SQLiteDatabase
): Promise<{ alCosto: number; alPrecio: number }> {
  const row = await db.getFirstAsync<{ alCosto: number; alPrecio: number }>(
    `SELECT
       COALESCE(SUM(stock_actual * COALESCE(costo, 0)), 0) AS alCosto,
       COALESCE(SUM(stock_actual * precio), 0)             AS alPrecio
     FROM productos WHERE activo = 1`
  );
  return row ?? { alCosto: 0, alPrecio: 0 };
}

/** Total de ventas o compras en un rango [desde, hasta] (ISO). Ignora ajustes. */
export async function totalPorTipo(
  db: SQLiteDatabase,
  tipo: 'venta' | 'compra',
  desde: string,
  hasta: string
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total
       FROM transacciones
      WHERE tipo = ? AND fecha_hora >= ? AND fecha_hora <= ?`,
    tipo,
    desde,
    hasta
  );
  return row?.total ?? 0;
}

export type ResumenDia = {
  total: number; // COP vendidos en el día
  utilidad: number; // ventas − costo de lo vendido en el día
};

/** Resumen de ventas de un día concreto ('YYYY-MM-DD'). Ignora compras/ajustes. */
export async function resumenVentasDia(
  db: SQLiteDatabase,
  dia: string
): Promise<ResumenDia> {
  const desde = `${dia}T00:00:00`;
  const hasta = `${dia}T23:59:59`;

  const cab = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total
       FROM transacciones
      WHERE tipo = 'venta' AND fecha_hora >= ? AND fecha_hora <= ?`,
    desde,
    hasta
  );

  const det = await db.getFirstAsync<{ ingresos: number; costo: number }>(
    `SELECT
       COALESCE(SUM(i.subtotal), 0)                                AS ingresos,
       COALESCE(SUM(i.cantidad * COALESCE(i.costo_snapshot, 0)), 0) AS costo
     FROM transaccion_items i
     JOIN transacciones t ON t.id = i.transaccion_id
     WHERE t.tipo = 'venta' AND t.fecha_hora >= ? AND t.fecha_hora <= ?`,
    desde,
    hasta
  );

  const ingresos = det?.ingresos ?? 0;
  const costo = det?.costo ?? 0;
  return {
    total: cab?.total ?? 0,
    utilidad: ingresos - costo,
  };
}

/**
 * Utilidad del período (ventas − costo de lo vendido), posible gracias al
 * snapshot de costo+precio en cada ítem de venta.
 */
export async function utilidadPeriodo(
  db: SQLiteDatabase,
  desde: string,
  hasta: string
): Promise<{ ingresos: number; costo: number; utilidad: number }> {
  const row = await db.getFirstAsync<{ ingresos: number; costo: number }>(
    `SELECT
       COALESCE(SUM(i.subtotal), 0)                          AS ingresos,
       COALESCE(SUM(i.cantidad * COALESCE(i.costo_snapshot, 0)), 0) AS costo
     FROM transaccion_items i
     JOIN transacciones t ON t.id = i.transaccion_id
     WHERE t.tipo = 'venta' AND t.fecha_hora >= ? AND t.fecha_hora <= ?`,
    desde,
    hasta
  );
  const ingresos = row?.ingresos ?? 0;
  const costo = row?.costo ?? 0;
  return { ingresos, costo, utilidad: ingresos - costo };
}

export type FilaInventarioInicial = {
  barcode: string;
  nombre: string;
  stock_inicial: number;
  precio: number;
  valor_total: number;
};

/**
 * Inventario con el que arrancó la tienda, valorizado a precio de venta.
 *
 * Solo productos activos con stock inicial > 0. El stock inicial se reconstruye
 * como `stock_actual − compras + ventas` (Opción B): ignora TODOS los ajustes,
 * incluidas las correcciones posteriores, porque `crearProducto` registra el
 * stock de arranque como un `ajuste` ('inventario inicial') y no como columna.
 * El valor por fila y el gran total se calculan en JS (`stock_inicial * precio`).
 */
export async function inventarioInicial(
  db: SQLiteDatabase
): Promise<{ filas: FilaInventarioInicial[]; total: number }> {
  const rows = await db.getAllAsync<{
    barcode: string;
    nombre: string;
    precio: number;
    stock_inicial: number;
  }>(
    `SELECT
       p.barcode,
       p.nombre,
       p.precio,
       p.stock_actual - COALESCE(mov.compras, 0) + COALESCE(mov.ventas, 0)
         AS stock_inicial
     FROM productos p
     LEFT JOIN (
       SELECT i.barcode,
              SUM(CASE WHEN t.tipo = 'compra' THEN i.cantidad ELSE 0 END) AS compras,
              SUM(CASE WHEN t.tipo = 'venta'  THEN i.cantidad ELSE 0 END) AS ventas
       FROM transaccion_items i
       JOIN transacciones t ON t.id = i.transaccion_id
       GROUP BY i.barcode
     ) mov ON mov.barcode = p.barcode
     WHERE p.activo = 1
       AND (p.stock_actual - COALESCE(mov.compras, 0) + COALESCE(mov.ventas, 0)) > 0
     ORDER BY p.nombre COLLATE NOCASE`
  );

  let total = 0;
  const filas = rows.map((r) => {
    const valor_total = r.stock_inicial * r.precio;
    total += valor_total;
    return {
      barcode: r.barcode,
      nombre: r.nombre,
      stock_inicial: r.stock_inicial,
      precio: r.precio,
      valor_total,
    };
  });
  return { filas, total };
}

export type FilaVenta = {
  barcode: string;
  nombre: string;
  unidades: number;
  precio_prom: number;
  total: number;
};

/**
 * Productos vendidos, agrupados por código y ordenados por unidades (desc).
 * Sin `rango` es el histórico completo; con `rango` se limita al período
 * [desde, hasta] (ISO). El total sale siempre de la suma real de subtotales;
 * `precio_prom = round(total / unidades)`. El nombre usa el catálogo actual y,
 * si el producto ya no existe, cae al `nombre_snapshot` de la venta.
 */
export async function productosVendidos(
  db: SQLiteDatabase,
  rango?: { desde: string; hasta: string }
): Promise<{ filas: FilaVenta[]; total: number }> {
  const params: SQLiteBindValue[] = [];
  let filtro = '';
  if (rango) {
    filtro = ' AND t.fecha_hora >= ? AND t.fecha_hora <= ?';
    params.push(rango.desde, rango.hasta);
  }

  const rows = await db.getAllAsync<{
    barcode: string;
    nombre: string;
    unidades: number;
    total: number;
  }>(
    `SELECT
       i.barcode,
       COALESCE(p.nombre, i.nombre_snapshot) AS nombre,
       SUM(i.cantidad) AS unidades,
       SUM(i.subtotal) AS total
     FROM transaccion_items i
     JOIN transacciones t ON t.id = i.transaccion_id
     LEFT JOIN productos p ON p.barcode = i.barcode
     WHERE t.tipo = 'venta'${filtro}
     GROUP BY i.barcode
     ORDER BY unidades DESC`,
    ...params
  );

  let total = 0;
  const filas = rows.map((r) => {
    total += r.total;
    return {
      barcode: r.barcode,
      nombre: r.nombre,
      unidades: r.unidades,
      precio_prom: r.unidades > 0 ? Math.round(r.total / r.unidades) : 0,
      total: r.total,
    };
  });
  return { filas, total };
}
