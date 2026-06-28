import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { onCambioSesion, usuarioActual } from '../lib/auth';
import { baseVacia, contarPendientes, respaldar, restaurar } from '../lib/backup';
import { hayRed } from '../lib/red';

// Espera tras el último cambio antes de respaldar, para agrupar ráfagas
// (p. ej. las varias filas de una venta) en una sola subida.
const DEBOUNCE_MS = 3000;

/**
 * Orquesta el respaldo en segundo plano (sin UI). Cuando hay sesión y red:
 * restaura si la base local está vacía (teléfono nuevo), o sube los cambios
 * pendientes. Se dispara al montar, al volver la app a primer plano, al
 * cambiar la sesión y, con un pequeño retardo, ante cualquier cambio en la
 * base (crear/editar productos, registrar ventas, ajustes de stock, etc.).
 */
export default function SyncManager() {
  const db = useSQLiteContext();
  const corriendo = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sincronizar = async () => {
      if (corriendo.current) return;
      if (!usuarioActual()) return;
      corriendo.current = true;
      try {
        if (!(await hayRed())) return;
        if (await baseVacia(db)) {
          await restaurar(db);
        } else if ((await contarPendientes(db)) > 0) {
          await respaldar(db);
        }
      } catch (e) {
        console.warn('[respaldo] sincronización falló', e);
      } finally {
        corriendo.current = false;
      }
    };

    // Los cambios en la base se agrupan con debounce; los respaldos marcan
    // synced = 1 (otro cambio), pero al reintentar ya no hay pendientes y se
    // descarta, así que no hay bucle.
    const agendar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sincronizar, DEBOUNCE_MS);
    };

    sincronizar();
    const subApp = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizar();
    });
    const desuscribir = onCambioSesion(() => sincronizar());
    const subDb = addDatabaseChangeListener(agendar);

    return () => {
      if (timer) clearTimeout(timer);
      subApp.remove();
      desuscribir();
      subDb.remove();
    };
  }, [db]);

  return null;
}
