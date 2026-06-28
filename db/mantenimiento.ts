import type { SQLiteDatabase } from 'expo-sqlite';
import { setConfig } from './configuracion';

/**
 * Vacía los datos de negocio (productos, transacciones e ítems) para dejar
 * el teléfono listo para una prueba de campo. No toca la configuración
 * (margen, moneda) ni el respaldo en la nube: si hay sesión activa y red,
 * SyncManager puede volver a restaurar estos datos desde Firestore.
 */
export async function vaciarDatosLocales(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM transaccion_items');
    await db.execAsync('DELETE FROM transacciones');
    await db.execAsync('DELETE FROM productos');
    await setConfig(db, 'correlativo_interno', '0');
  });
}
