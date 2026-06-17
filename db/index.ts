import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'inventario.db';
const TARGET_VERSION = 1;

/**
 * Migraciones con el patrón PRAGMA user_version. Se ejecuta desde el `onInit`
 * de <SQLiteProvider>. Las migraciones futuras deben ser ADITIVAS (nuevas
 * tablas/columnas, nunca renombrar/borrar) para no romper el espejo de respaldo.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let userVersion = row?.user_version ?? 0;

  if (userVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(DDL_V1);
      await db.runAsync(
        `INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
           ('margen_general_pct', '30'),
           ('moneda', 'COP'),
           ('correlativo_interno', '0')`
      );
    });
    await db.execAsync(`PRAGMA user_version = 1`);
    userVersion = 1;
  }

  // if (userVersion < 2) { ... }  // futuras migraciones aditivas

  if (userVersion !== TARGET_VERSION) {
    console.warn(
      `[db] user_version=${userVersion} difiere de TARGET_VERSION=${TARGET_VERSION}`
    );
  }
}

const DDL_V1 = `
CREATE TABLE IF NOT EXISTS productos (
  barcode        TEXT PRIMARY KEY,
  nombre         TEXT    NOT NULL,
  sin_codigo     INTEGER NOT NULL DEFAULT 0,
  categoria      TEXT,
  modo_precio    TEXT    NOT NULL DEFAULT 'margen'
                   CHECK (modo_precio IN ('margen','fijo')),
  costo          INTEGER,
  margen_pct     REAL,
  precio         INTEGER NOT NULL,
  stock_actual   INTEGER NOT NULL DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  synced         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transacciones (
  id                TEXT PRIMARY KEY,
  tipo              TEXT NOT NULL CHECK (tipo IN ('compra','venta','ajuste')),
  fecha_hora        TEXT NOT NULL,
  cliente_proveedor TEXT,
  motivo            TEXT,
  total             INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  synced            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transaccion_items (
  id                       TEXT PRIMARY KEY,
  transaccion_id           TEXT NOT NULL
                             REFERENCES transacciones(id) ON DELETE CASCADE,
  barcode                  TEXT NOT NULL,
  nombre_snapshot          TEXT NOT NULL,
  cantidad                 INTEGER NOT NULL,
  costo_snapshot           INTEGER,
  precio_unitario_snapshot INTEGER NOT NULL,
  subtotal                 INTEGER NOT NULL,
  synced                   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_fecha       ON transacciones(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_tx_tipo_fecha  ON transacciones(tipo, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_items_tx       ON transaccion_items(transaccion_id);
CREATE INDEX IF NOT EXISTS idx_items_barcode  ON transaccion_items(barcode);
CREATE INDEX IF NOT EXISTS idx_prod_nombre    ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_prod_activo    ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_prod_unsynced  ON productos(synced)         WHERE synced = 0;
CREATE INDEX IF NOT EXISTS idx_tx_unsynced    ON transacciones(synced)     WHERE synced = 0;
CREATE INDEX IF NOT EXISTS idx_items_unsynced ON transaccion_items(synced) WHERE synced = 0;
`;
