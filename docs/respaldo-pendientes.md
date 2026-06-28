# Respaldo en Firebase — pendientes

Estado del respaldo (espejo de una vía a Firestore + recuperación ante pérdida
de hardware). Lo **ya funcionando y probado** está en los commits `4361fda` y
`106bd06`. Acá quedan mapeadas las tareas por atacar.

Módulos relevantes: `lib/firebase.ts`, `lib/auth.ts`, `lib/backup.ts`,
`lib/red.ts`, `components/SyncManager.tsx`, `components/RecuperarGate.tsx`,
`app/(tabs)/ajustes.tsx`.

---

## Pruebas pendientes

### 1. Ingreso con huella
- [ ] Tras iniciar sesión con email/clave, aceptar "Activar ingreso con huella"
      y verificar que guarda credenciales (`expo-secure-store`).
- [ ] Cerrar sesión y comprobar que aparece **"Entrar con huella"** y que entra
      bien.
- [ ] En la pantalla de recuperación (`RecuperarGate`), tras recuperar, ofrece
      activar huella (solo si el equipo tiene huella registrada).

**Recordatorio de diseño:** la huella es atajo **local** en Android, NO método
de recuperación. En un teléfono nuevo el primer ingreso es siempre email/clave.

### 2. Respaldo manual e indicadores (Ajustes → Respaldo)
- [ ] Botón **"Respaldar ahora"** sube pendientes y muestra el toast correcto.
- [ ] "Cambios pendientes" vuelve a 0 y "Último respaldo" se actualiza.
- [ ] Estado se refresca al entrar/salir de la pantalla de Ajustes.

---

## Mejoras / arreglos

### 3. Respaldar cambios de solo configuración (margen general)
**Problema:** la tabla `configuracion` no tiene columna `synced`, así que
cambiar solo el margen general (sin otra actividad de productos/ventas) NO
dispara respaldo por sí solo. Se sube recién junto al próximo cambio de
producto/venta (que sí marca `synced=0`).

**Opciones:**
- Marcar una "bandera de cambios de config" (p. ej. una clave
  `config_dirty` en `configuracion`) que `contarPendientes` tenga en cuenta.
- O subir `configuracion` completa también en un disparo por debounce cuando
  cambie esa tabla, sin depender de `synced`.

Impacto bajo (el margen es re-ingresable y rara vez cambia aislado), pero queda
anotado para cerrar el espejo al 100%.

---

## Notas para más adelante (no urgentes)

- **EAS build:** las credenciales `EXPO_PUBLIC_FIREBASE_*` viven en `.env`
  (ignorado por git). Para un build con EAS hay que cargarlas como EAS Secrets
  o en `eas.json`; no se suben con el repo. Ver `.env.example`.
- **Borrados no se espejan:** el modelo es de una vía e incremental. Los
  productos usan borrado lógico (`activo=0`), que sí se sincroniza. No hay
  borrado físico de transacciones en la app, así que no aplica hoy; si algún
  día se permite borrar, habría que decidir cómo reflejarlo en Firestore.
- **Posible candado de app con huella:** hoy la huella sirve para re-login.
  Si se quiere un bloqueo de la app al abrir (estilo banca), sería una función
  aparte (gate biométrico por arranque), evaluada en su momento.
