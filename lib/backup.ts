// Motor de respaldo: espejo de una vía local -> Firestore, con restauración
// solo cuando la base local está vacía (recuperación ante pérdida de hardware).
//
// El esquema SQLite ya está preparado: cada fila tiene `synced` (0 pendiente,
// 1 respaldada) e índices parciales sobre synced = 0. El push lee solo lo
// pendiente y lo marca como sincronizado; el restore reescribe lo local con
// synced = 1. La configuración (tabla sin `synced`) se respalda completa por
// ser pequeña.
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { Producto, Transaccion, TransaccionItem } from '../db/types';
import { getConfig, setConfig } from '../db/configuracion';
import { usuarioActual } from './auth';
import { db as firestore } from './firebase';

// writeBatch admite hasta 500 operaciones; dejamos margen.
const LIMITE_LOTE = 400;

const TABLAS_SYNC = ['productos', 'transacciones', 'transaccion_items'] as const;

export type EstadoRespaldo = {
  ultimoRespaldo: string | null;
  pendientes: number;
};

// expo-sqlite no admite transacciones concurrentes sobre la misma conexión.
// SyncManager y RecuperarGate pueden disparar respaldo/restauración a la vez
// (p. ej. al iniciar sesión), así que serializamos ambas en una sola cola.
let cola: Promise<unknown> = Promise.resolve();
function enSerie<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.then(
    () => undefined,
    () => undefined
  );
  return resultado;
}

export async function contarPendientes(db: SQLiteDatabase): Promise<number> {
  let total = 0;
  for (const t of TABLAS_SYNC) {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${t} WHERE synced = 0`
    );
    total += row?.n ?? 0;
  }
  return total;
}

export async function estadoRespaldo(
  db: SQLiteDatabase
): Promise<EstadoRespaldo> {
  return {
    ultimoRespaldo: await getConfig(db, 'last_backup_at'),
    pendientes: await contarPendientes(db),
  };
}

/** La base local no tiene datos de negocio (teléfono nuevo / reinstalación). */
export async function baseVacia(db: SQLiteDatabase): Promise<boolean> {
  const p = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM productos'
  );
  const t = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transacciones'
  );
  return (p?.n ?? 0) === 0 && (t?.n ?? 0) === 0;
}

async function marcarSincronizado(
  db: SQLiteDatabase,
  tabla: string,
  idCol: string,
  ids: string[]
): Promise<void> {
  const CHUNK = 400; // SQLite limita la cantidad de parámetros (~999)
  for (let i = 0; i < ids.length; i += CHUNK) {
    const grupo = ids.slice(i, i + CHUNK);
    const placeholders = grupo.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE ${tabla} SET synced = 1 WHERE ${idCol} IN (${placeholders})`,
      ...grupo
    );
  }
}

/**
 * Sube a Firestore todo lo pendiente y lo marca como sincronizado.
 * Devuelve la cantidad de filas respaldadas. Requiere sesión iniciada.
 */
export function respaldar(db: SQLiteDatabase): Promise<number> {
  return enSerie(() => respaldarImpl(db));
}

async function respaldarImpl(db: SQLiteDatabase): Promise<number> {
  if (!usuarioActual()) throw new Error('Sesión no iniciada');

  const productos = await db.getAllAsync<Producto>(
    'SELECT * FROM productos WHERE synced = 0'
  );
  const transacciones = await db.getAllAsync<Transaccion>(
    'SELECT * FROM transacciones WHERE synced = 0'
  );
  const items = await db.getAllAsync<TransaccionItem>(
    'SELECT * FROM transaccion_items WHERE synced = 0'
  );

  const ops: { col: string; id: string; data: DocumentData }[] = [
    ...productos.map((p) => ({ col: 'productos', id: p.barcode, data: p })),
    ...transacciones.map((t) => ({ col: 'transacciones', id: t.id, data: t })),
    ...items.map((i) => ({ col: 'transaccion_items', id: i.id, data: i })),
  ];

  for (let i = 0; i < ops.length; i += LIMITE_LOTE) {
    const lote = writeBatch(firestore);
    for (const op of ops.slice(i, i + LIMITE_LOTE)) {
      lote.set(doc(firestore, op.col, op.id), op.data);
    }
    await lote.commit();
  }

  // Configuración completa (pequeña): se respalda siempre.
  const config = await db.getAllAsync<{ clave: string; valor: string }>(
    'SELECT * FROM configuracion'
  );
  if (config.length) {
    const lote = writeBatch(firestore);
    for (const c of config) {
      lote.set(doc(firestore, 'configuracion', c.clave), c);
    }
    await lote.commit();
  }

  // Marcar como sincronizado solo lo que efectivamente subimos (por id),
  // para no perder cambios hechos durante la subida.
  await db.withTransactionAsync(async () => {
    await marcarSincronizado(
      db,
      'productos',
      'barcode',
      productos.map((p) => p.barcode)
    );
    await marcarSincronizado(
      db,
      'transacciones',
      'id',
      transacciones.map((t) => t.id)
    );
    await marcarSincronizado(
      db,
      'transaccion_items',
      'id',
      items.map((i) => i.id)
    );
  });

  await setConfig(db, 'last_backup_at', new Date().toISOString());
  return ops.length;
}

/**
 * Descarga el espejo de Firestore a la base local. Pensado para una base
 * vacía (teléfono nuevo). Reescribe filas con synced = 1. Devuelve el total
 * de filas restauradas. Requiere sesión iniciada.
 */
export function restaurar(db: SQLiteDatabase): Promise<number> {
  return enSerie(() => restaurarImpl(db));
}

async function restaurarImpl(db: SQLiteDatabase): Promise<number> {
  if (!usuarioActual()) throw new Error('Sesión no iniciada');

  const [productos, transacciones, items, config] = await Promise.all([
    getDocs(collection(firestore, 'productos')),
    getDocs(collection(firestore, 'transacciones')),
    getDocs(collection(firestore, 'transaccion_items')),
    getDocs(collection(firestore, 'configuracion')),
  ]);

  let total = 0;
  await db.withTransactionAsync(async () => {
    for (const d of productos.docs) {
      const p = d.data() as Producto;
      await db.runAsync(
        `INSERT OR REPLACE INTO productos
           (barcode, nombre, sin_codigo, categoria, modo_precio, costo,
            margen_pct, precio, stock_actual, activo, created_at, updated_at,
            synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        p.barcode,
        p.nombre,
        p.sin_codigo,
        p.categoria ?? null,
        p.modo_precio,
        p.costo ?? null,
        p.margen_pct ?? null,
        p.precio,
        p.stock_actual,
        p.activo,
        p.created_at,
        p.updated_at
      );
      total++;
    }

    for (const d of transacciones.docs) {
      const t = d.data() as Transaccion;
      await db.runAsync(
        `INSERT OR REPLACE INTO transacciones
           (id, tipo, fecha_hora, cliente_proveedor, motivo, total,
            created_at, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        t.id,
        t.tipo,
        t.fecha_hora,
        t.cliente_proveedor ?? null,
        t.motivo ?? null,
        t.total,
        t.created_at,
        t.updated_at
      );
      total++;
    }

    for (const d of items.docs) {
      const it = d.data() as TransaccionItem;
      await db.runAsync(
        `INSERT OR REPLACE INTO transaccion_items
           (id, transaccion_id, barcode, nombre_snapshot, cantidad,
            costo_snapshot, precio_unitario_snapshot, subtotal, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        it.id,
        it.transaccion_id,
        it.barcode,
        it.nombre_snapshot,
        it.cantidad,
        it.costo_snapshot ?? null,
        it.precio_unitario_snapshot,
        it.subtotal
      );
      total++;
    }

    for (const d of config.docs) {
      const c = d.data() as { clave: string; valor: string };
      await db.runAsync(
        'INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)',
        c.clave,
        c.valor
      );
    }
  });

  return total;
}
