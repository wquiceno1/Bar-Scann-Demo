# Ajustes derivados de la prueba de campo

Mejoras concretas que salieron de usar el **APK v1** en la tienda. Cada bloque
queda consignado con qué se cambia y cómo, para no perder el contexto entre
sesiones.

> Recordatorio (AGENTS.md): antes de escribir código de UI Expo, verificar el
> comportamiento exacto en los docs versionados de **SDK 54**
> (https://docs.expo.dev/versions/v54.0.0/), en particular `TextInput`
> (`keyboardType` y entrada de signo negativo en Android).

---

## Iteración 1 — Módulo "Ajuste de inventario" (2026-06-29)

**Contexto del problema (prueba de campo del 2026-06-28):**
- Para subir 25 unidades hay que tocar `+` veinticinco veces. Inviable.
- No se ve el stock que el producto ya tiene, así que se ajusta "a ciegas".
- Se cometió un error de carga: en un producto que tenía 6 se escribió 6000.
  Hoy no hay forma cómoda de **restar** para corregir (habría que tocar `−`
  miles de veces).

### Objetivo
En la sesión de `ajuste` (y **solo** ahí), cada línea debe:
1. Mostrar el **stock actual** del producto.
2. Permitir escribir la **cantidad a ajustar** en un input editable (delta).
3. Aceptar **valores negativos** en ese input (para corregir errores como el de
   6000 → 6, escribiendo `-5994`).
4. Mostrar en vivo el **stock resultante** (`stock_actual + delta`), que es lo
   que de verdad evita repetir el error de los 6000.

> Nota de modelo: en `ajuste`, la `cantidad` de la línea **ya es el delta** que
> se suma al stock (`deltaStock` en [db/transacciones.ts](../db/transacciones.ts)
> y `cantidad: number` admite ±). **No se toca la base de datos ni el esquema.**

### Diseño de la línea de ajuste (UI)
```
┌─────────────────────────────────────────────┐
│ Nombre del producto                      🗑   │
│ Stock actual: 6000                            │
│ Ajuste:   [ − ]  [  -5994  ]  [ + ]           │
│ Stock resultante: 6                           │
└─────────────────────────────────────────────┘
```
- `[ − ]` / `[ + ]`: se conservan para el ajuste fino de ±1 (gesto rápido).
- Input central editable: el usuario escribe el delta directo (ej. `25`, `-5994`).
- `🗑` (papelera): quita la línea explícitamente. En `ajuste` la línea **no** se
  auto-elimina al llegar a 0 (a diferencia de venta/compra), porque 0 es un
  estado intermedio válido mientras se escribe.
- "Stock resultante" se recalcula en vivo; si queda negativo se resalta en color
  de advertencia (no se bloquea: un ajuste puede dejar 0, y avisar es mejor que
  impedir).

### Entrada de números negativos en Android
La app es 99% Android y el `keyboardType="numeric"` no garantiza la tecla `−` en
todos los teclados. Para que escribir negativos sea confiable:
- Permitir `-` al inicio del texto al parsear el input.
- Agregar un botón **`±`** que invierte el signo del valor actual, como vía
  garantizada independientemente del teclado.
- Confirmar en los docs de SDK 54 si conviene `keyboardType="numbers-and-punctuation"`
  (iOS) vs `numeric` (Android) antes de fijar el valor.

### Manejo del input mientras se escribe
Para que escribir `-5994` no "salte" ni borre la línea:
- Mantener el **texto crudo** del input en estado local del componente
  (`Record<barcode, string>`), como override mientras el usuario teclea,
  separado del número del borrador.
- Estados intermedios `""`, `"-"` se interpretan como delta `0` en el modelo,
  pero el texto mostrado se preserva tal cual lo tecleó el usuario.
- Al usar `−`/`+`/`±` o re-escanear, el override se descarta y el input vuelve a
  reflejar el número.

### Limpiar el default al hacer focus (no borrarlo a mano)
El default visible (`0`) debe **seleccionarse solo al enfocar** el input, de modo
que la primera tecla lo reemplace, sin tener que borrarlo manualmente. Se logra
con `selectTextOnFocus` en el `TextInput`. El valor `0` sigue visible como default
(si no se toca, el ajuste/stock queda en 0), pero deja de estorbar al escribir.

> **Mismo arreglo en la carga de productos.** El campo **"Stock inicial"** de
> [app/producto/nuevo.tsx](../app/producto/nuevo.tsx) hoy carga un `0` literal que
> hay que borrar a mano (`useState('0')`, línea ~33). Se le agrega
> `selectTextOnFocus` para que el `0` se reemplace al escribir. Al guardar ya se
> normaliza con `Number(stockInicial) || 0`, así que no cambia la lógica.

### Cambios por archivo
- **[db/types.ts](../db/types.ts)** — agregar campo opcional `stock_actual?: number`
  a `LineaBorrador` (solo para mostrar el stock al armar el ajuste; no afecta a
  venta/compra ni a la persistencia).
- **[app/transaccion/[tipo].tsx](../app/transaccion/[tipo].tsx)**:
  - Al `agregarProducto`, capturar `stock_actual` del producto en la línea.
  - Para `ajuste`: default de `cantidad` (delta) = `0` (input vacío con
    placeholder `0`), en vez de `1`.
  - Nuevo handler `cambiarCantidadTexto(barcode, texto)` que parsea con signo y
    actualiza el texto crudo + el número; **no** filtra líneas en 0.
  - Nuevo handler de `±` (invertir signo) y de `🗑` (quitar línea).
  - Render condicional `tipo === 'ajuste'`: mostrar "Stock actual", input
    editable + `−`/`+`/`±`, y "Stock resultante".
  - En `finalizar` (solo `ajuste`): filtrar líneas con delta `0` antes de
    persistir; si no queda ninguna, `Alert` "No hay ajustes que guardar".
  - `selectTextOnFocus` en el input de cantidad del ajuste.
  - `venta`/`compra` quedan **sin cambios** (siguen con `−`/`+` y auto-eliminar
    en 0).
- **[app/producto/nuevo.tsx](../app/producto/nuevo.tsx)** — `selectTextOnFocus`
  en el `Input` de "Stock inicial" (el `0` se reemplaza al escribir).

### Modelo de datos
- **Sin migración.** `transaccion_items.cantidad` ya admite negativos y
  `finalizarTransaccion` ya aplica el delta correcto en `ajuste`.
- El nuevo `stock_actual` en `LineaBorrador` es solo de UI (no se persiste).

### Casos borde a cubrir
- Delta `0` → línea ignorada al finalizar.
- Texto intermedio (`""`, `"-"`) → no rompe el render ni elimina la línea.
- Re-escanear el mismo producto en `ajuste` → sigue sumando `+1` al delta (no
  duplica la línea), coherente con el resto de la app.
- Stock resultante negativo → se muestra con advertencia, no se bloquea.

### Pruebas (manuales, en dispositivo)
- [ ] Ajuste con `+25` escrito a mano sube el stock en 25 y muestra el
      resultante correcto.
- [ ] Corrección del caso real: producto en 6000, escribir `-5994`, resultante 6,
      finalizar y verificar stock = 6.
- [ ] Botón `±` invierte el signo correctamente en Android.
- [ ] `−`/`+` siguen funcionando para el ajuste fino.
- [ ] `🗑` quita la línea; finalizar sin líneas válidas avisa.
- [ ] Venta y compra siguen comportándose igual que antes.
- [ ] El ajuste finalizado aparece bien en historial/detalle y respeta que los
      reportes de dinero ignoran `ajuste`.

### Fuera de alcance (anotado para después)
- Llevar el input editable de cantidad también a **compra** (mismo dolor de
  "tocar + muchas veces" al comprar por mayor). Es directo de extender luego.
- Modo "fijar stock a un valor exacto" (que calcule el delta solo). Por ahora se
  trabaja con delta explícito.

---

## Iteración 2 — Orden y filtros en el catálogo (2026-06-29)

**Contexto:** el catálogo solo se podía ver en orden alfabético. Se necesita
ordenar por **stock** y por **precio de venta**, en ambos sentidos, y detectar
de un vistazo qué productos hay que recomprar.

### Qué se implementó
- **Chips de orden** bajo el buscador: `Stock` y `Precio`. Cada chip cicla en
  tres toques: 1º **mayor→menor** (↓), 2º **menor→mayor** (↑), 3º **se apaga** y
  vuelve al orden por nombre A–Z (default). Solo un criterio activo a la vez; el
  chip activo muestra la flecha de dirección.
- **Filtro "Stock bajo"** (toggle): muestra solo productos con
  `stock_actual <= UMBRAL_STOCK_BAJO` (= 5, incluye agotados). Útil para decidir
  recompras.
- **Indicador visual de stock** en cada fila: el texto "Stock: N" y su ícono se
  pintan en **rojo** si está agotado (≤ 0) y en **ámbar** si está bajo (≤ 5);
  gris si está normal.

### Cambios por archivo
- **[db/productos.ts](../db/productos.ts)** — `listarProductos` ahora recibe un
  3er parámetro opcional `{ orden, dir, soloStockBajo }`. El `ORDER BY` y la
  dirección salen de **listas blancas** (nunca de texto del usuario). Se exporta
  `UMBRAL_STOCK_BAJO` y los tipos `OrdenProducto`/`DireccionOrden`. La firma
  vieja `(db, busqueda)` sigue válida → `BuscadorProducto.tsx` no se toca.
- **[app/(tabs)/catalogo.tsx](../app/(tabs)/catalogo.tsx)** — estado de
  `orden`/`dir`/`soloStockBajo`, barra de chips (`SortChip` + toggle), recarga
  vía `useFocusEffect` con esos deps, y el coloreado de stock por fila.

### Modelo de datos
- **Sin migración.** Solo `ORDER BY` / `WHERE` sobre columnas existentes.

### Decisiones
- Sin chip de "Nombre": el orden alfabético es el default y se recupera con el
  3er toque del chip activo.
- Umbral de stock bajo fijo en **5** por ahora; queda anotado hacerlo
  configurable en Ajustes más adelante.

### Pruebas (manuales, en dispositivo)
- [ ] Ordenar por Stock ↓ / ↑ reordena bien; 3er toque vuelve a A–Z.
- [ ] Ordenar por Precio ↓ / ↑ reordena bien.
- [ ] Cambiar de Stock a Precio limpia el orden anterior (un solo criterio).
- [ ] "Stock bajo" filtra a ≤ 5 e incluye agotados; al apagar vuelve a todos.
- [ ] El orden/filtro se mantiene al volver de editar un producto.
- [ ] Filas agotadas en rojo y bajas en ámbar; el buscador sigue funcionando.

### Fuera de alcance (anotado para después)
- Umbral de stock bajo configurable en Ajustes.
- Recordar el orden/filtro elegido entre sesiones (persistir en `configuracion`).

---

## Iteración 3 — Producto sin código desde carga inicial (2026-06-29)

**Contexto:** en la carga inicial solo se podía escanear. El check "sin código /
granel" vivía en el formulario de alta, al que solo se llegaba **después** de
escanear → quedaba "detrás de la barrera del escaneo". No había forma de dar de
alta un producto a granel sin escanear algo primero.

### Qué se implementó
- **[app/carga-inicial.tsx](../app/carga-inicial.tsx)** — barra inferior con un
  botón **"Agregar producto sin código (granel)"** sobre la cámara. Navega a
  `/producto/nuevo?granel=1`. El texto de ayuda se ajustó ("O escanea cada
  producto…"). No se toca el estado `paused`: al volver del alta, `ScannerView`
  se remonta solo al recuperar foco.
- **[app/producto/nuevo.tsx](../app/producto/nuevo.tsx)** — lee el nuevo param
  `granel`; `sinCodigo` se inicializa con `params.granel === '1' || !params.barcode`.
  La lógica de guardado (genera `INT-…` cuando es sin código) **no cambia**.

### Decisiones
- Se eligió el **param explícito `?granel=1`** (en vez de depender del default
  implícito `!params.barcode`) para que la intención sea clara y robusta ante
  cambios futuros.
- El toggle "sin código" queda **editable** en el form (el usuario puede
  cambiar de idea).

### Modelo de datos
- **Sin migración.** Solo navegación + inicialización de estado de UI.

### Pruebas (manuales, en dispositivo)
- [ ] El botón abre el alta con "sin código" ya marcado.
- [ ] Guardar genera un código `INT-…` y vuelve a la cámara.
- [ ] La cámara sigue escaneando normal al regresar (no queda en negro ni en
      pausa).
- [ ] El flujo de escaneo normal (código nuevo → alta con barcode; existente →
      alerta) sigue intacto.
