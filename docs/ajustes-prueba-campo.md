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

---

## Iteración 4 — Búsqueda insensible a acentos (2026-06-30)

**Contexto:** los productos registrados con tilde (p. ej. "Plátano", "Limón") no
aparecían en ningún buscador. La causa: `LIKE` de SQLite es **sensible a
acentos**, y además podía fallar por diferencias de normalización Unicode
(NFC vs NFD) entre lo almacenado y lo tecleado.

### Qué se implementó
Fix **puro en la capa de consultas**, robusto a NFC/NFD y en ambos sentidos
(buscar "platano" encuentra "Plátano", y viceversa):
- **[db/util.ts](../db/util.ts)** — dos helpers:
  - `normalizarBusqueda(s)`: descompone (NFD), quita marcas combinantes
    (U+0300–U+036F) y pasa a minúsculas. Normaliza el **término tecleado**.
  - `sqlNormalizar(columna)`: arma una expresión SQL equivalente
    (`replace(char(...))` para marcas combinantes + `replace` de precompuestos
    español + `lower`). Normaliza la **columna** en la comparación. `columna` es
    un identificador del código (no entrada del usuario), seguro de interpolar.
- **[db/productos.ts](../db/productos.ts)** — `listarProductos` compara el
  nombre con `sqlNormalizar('nombre') LIKE ?` y término normalizado. El código de
  barras sigue con comparación directa (no tiene acentos). Cubre el buscador del
  **catálogo** y el de **ventas/compras** (`BuscadorProducto`).
- **[db/transacciones.ts](../db/transacciones.ts)** — el filtro `contraparte`
  del historial usa la misma normalización sobre `cliente_proveedor`.

### Decisiones
- **Sin migración ni columna nueva.** Se evaluó una columna `nombre_norm`
  indexable, pero la solución por expresión SQL no toca el esquema ni el
  respaldo ([lib/backup.ts](../lib/backup.ts) usa listas de columnas explícitas)
  y funciona sobre los datos existentes tal cual están. Para un catálogo de una
  sola tienda el escaneo completo es irrelevante en rendimiento.
- Se cubrió el set español (á é í ó ú ü ñ + mayúsculas) y, vía marcas
  combinantes, cualquier acento en forma NFD.

### Modelo de datos
- **Sin migración.** Solo cambia el SQL de las consultas de búsqueda.

### Verificación
- Prueba unitaria del normalizador + equivalente SQL en JS: "Café/café/CAFÉ",
  "Plátano", "Niño", "Jalapeño", "Limón" → todos normalizan igual en NFC y NFD;
  match correcto en ambos sentidos. `tsc --noEmit` limpio.

### Pruebas (manuales, en dispositivo)
- [ ] Buscar "platano" (sin tilde) encuentra "Plátano".
- [ ] Buscar "Plátano" (con tilde) encuentra "Plátano".
- [ ] Igual en el buscador de venta/compra (Agregar sin escanear).
- [ ] Filtro de contraparte en historial encuentra nombres con tilde.

---

## Iteración 5 — Orden inverso en la sesión de transacción (2026-06-30)

**Contexto:** al agregar productos a una venta/compra, cada nuevo iba al final
de la lista, obligando a hacer scroll para ver lo recién agregado.

### Qué se implementó
- **[app/transaccion/[tipo].tsx](../app/transaccion/[tipo].tsx)** — en
  `agregarProducto`, los productos **nuevos se insertan arriba** (`[nuevo, ...prev]`),
  así lo último ingresado queda visible sin scroll y lo anterior baja. Re-escanear
  un producto ya presente **incrementa su cantidad en su lugar** (no salta de
  posición). Aplica a venta, compra y ajuste (la función es compartida).

### Modelo de datos
- **Sin migración.** Solo cambia el orden de inserción en el estado de UI.

### Pruebas (manuales, en dispositivo)
- [ ] Agregar varios productos: el último queda arriba.
- [ ] Re-escanear uno existente sube su cantidad sin cambiar de posición.
- [ ] Total y edición de costo/cantidad siguen correctos.

---

## Iteración 6 — Precarga del costo en compra (2026-06-30)

**Contexto:** al escanear un producto en una compra, el input de costo salía
vacío. Causa: en la carga inicial los productos se crean con **precio de venta
fijo y sin costo** (`costo = null`), así que no había nada que precargar.

### Qué se implementó
- **[app/transaccion/[tipo].tsx](../app/transaccion/[tipo].tsx)** — en compra,
  el input de costo precarga `prod.costo` si existe; si es `null`, parte del
  **precio de venta** como referencia editable (`costoCompra = prod.costo ?? prod.precio`).
  Tanto `precio_unitario_snapshot` como `costo_snapshot` de la línea toman ese
  valor, para que al finalizar el costo quede registrado en el producto.
  Se agregó `selectTextOnFocus` al input (el valor precargado se reemplaza al
  escribir) y una referencia "Venta: $X" debajo del input.
- **[db/types.ts](../db/types.ts)** — `LineaBorrador.precio_venta?` (solo UI,
  referencia del precio de venta vigente en compra).

### Por qué optimiza la carga inicial
La compra es el momento natural para capturar el costo real del proveedor. Como
`finalizarTransaccion` ya escribe el costo al producto en compra (sin tocar el
precio fijo, [db/transacciones.ts](../db/transacciones.ts)), a medida que se
compran productos el catálogo va ganando los costos que hoy faltan → habilita
reportes de utilidad/margen sin trabajo extra.

### Modelo de datos
- **Sin migración.** Solo cambia el valor precargado en la UI; el guardado del
  costo en compra ya existía.

### Pruebas (manuales, en dispositivo)
- [ ] Compra de un producto con costo → precarga el costo.
- [ ] Compra de un producto sin costo (fijo) → precarga el precio de venta y
      muestra "Venta: $X".
- [ ] Editar el costo y finalizar guarda el costo en el producto sin cambiar su
      precio de venta.
- [ ] La venta sigue mostrando el precio de venta (no editable) como antes.

---

## Iteración 7 — Reportes: ventas del día con filtro de fecha (2026-06-30)

**Contexto:** los reportes solo trabajaban a nivel de mes. Se necesita ver el
resumen de ventas de un día puntual (por defecto hoy) y poder elegir la fecha.

### Qué se implementó
- **[db/reportes.ts](../db/reportes.ts)** — `resumenVentasDia(db, dia)` devuelve
  `{ total, numVentas, unidades, utilidad }` para un `'YYYY-MM-DD'` (reutiliza la
  lógica de rango por día). Ignora compras/ajustes.
- **[app/(tabs)/reportes.tsx](../app/(tabs)/reportes.tsx)** — nueva sección
  **"Ventas del día"** arriba del reporte mensual:
  - Selector de fecha con **flechas ◀ ▶** (día anterior/siguiente, ▶ deshabilitada
    en hoy), **"Volver a hoy"**, y al tocar la fecha se abre un **calendario
    nativo** (`@react-native-community/datetimepicker`, `maximumDate = hoy`).
  - KPIs del día: total vendido, N° de ventas, unidades vendidas y utilidad.
  - El resumen recarga al cambiar la fecha y al volver a la pantalla.
  - `Kpi` ahora soporta `conteo` (muestra números sin formato COP).

### Dependencia / build
- **Se agregó el módulo nativo `@react-native-community/datetimepicker@8.4.4`**
  (vía `npx expo install`; el config plugin quedó en `app.json`). Por ser nativo,
  **el calendario solo aparece tras generar un APK nuevo**. Las flechas y "Volver
  a hoy" funcionan sin él, pero el componente requiere el rebuild.

### Modelo de datos
- **Sin migración.** Solo nuevas consultas de lectura.

### Pruebas (manuales, en dispositivo)
- [ ] Al abrir Reportes, "Ventas del día" muestra el resumen de hoy.
- [ ] Flechas ◀ ▶ cambian el día y recargan el resumen; ▶ se bloquea en hoy.
- [ ] Tocar la fecha abre el calendario y no deja elegir fechas futuras.
- [ ] "Volver a hoy" reaparece al salir de hoy y regresa correctamente.
- [ ] Total, N° de ventas, unidades y utilidad cuadran con las ventas del día.

---

## Iteración 8 — Historial por día (2026-06-30)

**Contexto:** el historial cargaba **todo el histórico**, y con muchas operaciones
la lista crece demasiado y deja de ser práctica. Se quiere una vista reducida a
las operaciones del **día seleccionado**, conservando los filtros por tipo.

### Qué se implementó
- **[lib/fecha.ts](../lib/fecha.ts)** (nuevo) — helpers de fecha compartidos
  (`hoyStr`, `dateADiaStr`, `diaADate`, `sumarDias`, `fechaLarga`, `rangoDia`).
  Reportes y Historial usan el **mismo selector de día** (DRY).
- **[app/(tabs)/reportes.tsx](../app/(tabs)/reportes.tsx)** — refactor para
  consumir esos helpers (se quitaron las copias locales de la iteración 7).
- **[app/(tabs)/historial.tsx](../app/(tabs)/historial.tsx)** — selector de día
  (flechas ◀ ▶, "Volver a hoy", calendario nativo, default hoy) arriba de los
  chips de tipo. La carga ahora pasa `rangoDia(dia)` como `desde/hasta` a
  `listarTransacciones`, así solo trae las operaciones de ese día. Los chips de
  tipo (Todos/Venta/Compra/Ajuste) se conservan y se combinan con el día. Cada
  fila muestra solo la **hora** (el día ya está fijado por el selector).

### Dependencia / build
- Reusa `@react-native-community/datetimepicker` (ya agregado en la iteración 7).
  El calendario solo aparece en un **APK nuevo**; flechas y "Volver a hoy"
  funcionan sin él.

### Modelo de datos
- **Sin migración.** `listarTransacciones` ya soportaba `desde/hasta`.

### Pruebas (manuales, en dispositivo)
- [ ] Al abrir Historial, muestra solo las operaciones de hoy.
- [ ] Flechas ◀ ▶ cambian el día; ▶ se bloquea en hoy.
- [ ] Calendario permite saltar a cualquier día pasado (no futuros).
- [ ] Los chips de tipo filtran dentro del día seleccionado.
- [ ] "Volver a hoy" funciona; cada fila muestra la hora correcta.

---

## Iteración 9 — Reasignar código, convertir a sin código y desactivar (2026-06-30)

**Contexto:** algunos productos quedaron con códigos de barras erróneos o que no
leen, y no había forma de corregirlos ni de retirar un producto del catálogo.
Borrar es delicado porque las ventas referencian el producto.

### Diseño (estrategia B, sin borrado físico)
`barcode` es la **PRIMARY KEY**, así que "reasignar código" = cambiar la PK. Como
el respaldo a Firestore usa el barcode como id de documento y es de una vía, un
rename en sitio dejaría un **fantasma**. Por eso se usa **"retirar + crear"**:
crear un producto nuevo con el código nuevo (copiando datos y stock), migrar las
referencias laxas de `transaccion_items`, y **desactivar** el viejo (`activo=0`,
stock 0). Historial y reportes quedan intactos (snapshots); el respaldo queda
coherente (el viejo se sincroniza como inactivo). Funciona en ambos sentidos
(código real ↔ INT-).

### Qué se implementó
- **[db/productos.ts](../db/productos.ts)** — `desactivarProducto`,
  `reactivarProducto`, `reasignarCodigo(viejo, nuevo, { sinCodigo })` (atómica,
  con validación de colisión: si el código nuevo ya existe avisa, y si es de un
  inactivo sugiere reactivarlo), y `convertirASinCodigo` (genera un `INT-`).
  `listarProductos` admite `soloInactivos` para listar los desactivados.
- **[app/producto/[barcode].tsx](../app/producto/[barcode].tsx)** — sección de
  acciones: **Asignar / cambiar código** (modal con escáner + entrada manual),
  **Convertir a sin código**, **Desactivar** (con confirmación). Si el producto
  está inactivo, muestra un banner y un botón **Reactivar**. Tras reasignar/
  convertir, navega a la ficha del código nuevo.
- **[app/(tabs)/catalogo.tsx](../app/(tabs)/catalogo.tsx)** — chip **"Inactivos"**
  para ver y entrar a los productos desactivados (y reactivarlos).

### Modelo de datos
- **Sin migración.** Solo usa columnas existentes (`activo`, PK `barcode`,
  referencia laxa `transaccion_items.barcode`). No agrega dependencias nativas,
  así que también corre en Expo Go.

### Pruebas (manuales, en dispositivo)
- [ ] Reasignar el código de un producto a uno escaneado nuevo: el viejo queda
      inactivo, el nuevo conserva stock e historial.
- [ ] Convertir a sin código genera un INT- y mantiene las ventas.
- [ ] INT- → código real (asignar) funciona igual (flujo inverso).
- [ ] Colisión con un código existente avisa; si es inactivo sugiere reactivar.
- [ ] Desactivar oculta del catálogo/búsqueda; "Inactivos" lo muestra; reactivar
      lo devuelve.
- [ ] El historial y los reportes de las ventas viejas siguen correctos.

---

## Iteración 10 — Tope de stock en ventas (2026-06-30)

**Contexto:** en una venta se podían agregar más unidades de las que había en
stock (p. ej. 5 con solo 3 disponibles). No había ningún control.

### Qué se implementó (solo en `venta`)
- **[app/transaccion/[tipo].tsx](../app/transaccion/[tipo].tsx)**:
  - El botón **+ se desactiva** cuando la cantidad de la línea llega al
    `stock_actual`.
  - Cada línea de venta muestra **"Stock disponible: N"** (en rojo al llegar al
    tope).
  - Al **escanear / agregar** un producto que ya está en su tope (o sin stock),
    avisa con un toast (`Stock máximo: N` / `Sin stock disponible`) y no lo
    agrega.
  - `cambiarCantidad` topa la cantidad al stock en venta (defensa adicional).
- Compra y ajuste **no** tienen tope (en compra sumas stock; en ajuste el delta
  puede ser cualquiera).

### Notas
- El `stock_actual` se captura al agregar el producto (ya venía en la línea desde
  la iteración 1/6) y no se decrementa dentro del carrito; el tope es
  `cantidad ≤ stock_actual`. El stock real se descuenta al finalizar.
- **Sin migración** ni dependencias nuevas.

### Pruebas (manuales, en dispositivo)
- [ ] Producto con 3 en stock: en venta no deja pasar de 3 (botón + apagado).
- [ ] Re-escanear el 4º avisa "Stock máximo: 3" y no lo suma.
- [ ] Producto sin stock: avisa "Sin stock disponible" y no lo agrega.
- [ ] Compra y ajuste siguen sin límite.
