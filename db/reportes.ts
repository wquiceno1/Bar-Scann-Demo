import type { SQLiteDatabase } from 'expo-sqlite';

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
