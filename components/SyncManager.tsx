import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { onCambioSesion, usuarioActual } from '../lib/auth';
import { baseVacia, necesitaRespaldo, respaldar, restaurar } from '../lib/backup';
import { hayRed } from '../lib/red';

/**
 * Orquesta el respaldo en segundo plano. Sin UI. Cuando hay sesión y red:
 * restaura si la base local está vacía (teléfono nuevo), o respalda si toca
 * (cambios pendientes y pasó más de un día). Se dispara al montar, al volver
 * la app a primer plano y al cambiar la sesión.
 */
export default function SyncManager() {
  const db = useSQLiteContext();
  const corriendo = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (corriendo.current) return;
      if (!usuarioActual()) return;
      corriendo.current = true;
      try {
        if (!(await hayRed())) return;
        if (await baseVacia(db)) {
          await restaurar(db);
        } else if (await necesitaRespaldo(db)) {
          await respaldar(db);
        }
      } catch (e) {
        console.warn('[respaldo] sincronización falló', e);
      } finally {
        corriendo.current = false;
      }
    };

    tick();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') tick();
    });
    const desuscribir = onCambioSesion(() => tick());

    return () => {
      sub.remove();
      desuscribir();
    };
  }, [db]);

  return null;
}
