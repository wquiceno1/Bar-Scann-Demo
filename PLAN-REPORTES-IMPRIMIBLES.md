# Plan: Reportes imprimibles (Inventario inicial y Ventas)

Estado: **implementado** (2026-07-05). Documento de trabajo acordado con el dueño
(Tienda Comunal de la Vereda Santa Barbara).

Implementación:
- `db/reportes.ts` → `inventarioInicial()` y `productosVendidos(rango?)`.
- `lib/reportePdf.ts` → armado del HTML + `compartirReportePdf()` (expo-print +
  expo-sharing, con fallback a impresión directa).
- `app/(tabs)/reportes.tsx` → sección "Reportes imprimibles" con 4 botones:
  inventario inicial, ventas histórico, ventas del día y ventas del mes
  seleccionados (reutilizan los selectores de arriba).

Pendiente en runtime: probar en el celular tras "Restaurar desde la nube" (ver §7)
y contrastar con las cifras de referencia (§5).

## 1. Objetivo

Generar dos reportes imprimibles (PDF) desde la pantalla de Reportes, pensados
para armar un balance general del avance del negocio:

1. **Inventario inicial** — con qué productos y en qué cantidad arrancó la tienda,
   valorizados a precio de venta al público.
2. **Ventas realizadas** — qué productos se han vendido, en qué cantidad y por
   cuánto dinero.

Se mantienen como dos reportes separados a propósito (aunque técnicamente se
podrían unir), porque responden a dos preguntas distintas: *"¿qué tenía?"* vs
*"¿qué vendí?"*.

## 2. Formato de salida

- **PDF** vía `expo-print` (genera desde HTML/CSS) + `expo-sharing` (compartir /
  imprimir con el diálogo nativo).
- Ambos paquetes **ya están instalados** (`expo-print`, `expo-sharing`).
- Un solo botón permite tanto imprimir en impresora normal como enviar por
  WhatsApp / correo / guardar en Drive.

## 3. Decisiones acordadas

| Tema | Decisión |
|------|----------|
| Valor unitario en inventario | **Precio de venta al público** (`productos.precio`). No usamos costo porque la tienda se entregó con productos ya valorizados y sin dato de costo real. |
| Cálculo del stock inicial | **Opción B**: `stock_actual − compras + ventas` (ignora ajustes). Absorbe correctamente las correcciones de inventario ya hechas. |
| Inventario: productos inactivos | **Solo activos** (`activo = 1`). Se excluyen dados de baja, duplicados y errores. |
| Valor unitario en ventas | **Precio promedio** = `total / unidades` (por si hubo variación de precio en el tiempo). El total siempre sale de la suma real de subtotales. |
| Alcance del reporte de ventas | **Ambos**: un botón para histórico completo y otro para el período (día/mes) seleccionado en pantalla. |
| Alcance del inventario inicial | Punto fijo (arranque de la operación). No lleva selector de fecha. |

### Sobre la Opción B para el stock inicial

`crearProducto` (en [db/productos.ts](db/productos.ts)) **no** guarda el stock de
arranque directo: lo registra como un `ajuste` con `motivo = 'inventario inicial'`.
Por eso NO se puede contar "solo ajustes de inventario inicial" (quedaría inflado
por correcciones posteriores). En cambio, `stock_actual − compras + ventas`
reconstruye el punto de partida ignorando **todos** los ajustes, incluidas las
correcciones.

> Nota a futuro: cuando se agregue el módulo de **registro de pérdidas** (mermas,
> vencimientos), esos movimientos deberán ser de tipo `ajuste` para que esta
> fórmula los siga tratando como parte del stock inicial y no distorsionen el
> reporte. Confirmado con el dueño que ese es el comportamiento deseado.

## 4. Estructura de las tablas

### 4.1 Encabezado (ambos reportes)

```
Tienda Comunal de la Vereda Santa Barbara
Reporte: [Inventario inicial | Ventas realizadas]
Generado: DD/MM/YYYY HH:MM
[Ventas: sólo si aplica período → "Período: <día o mes>"]
```

### 4.2 Inventario inicial

| Código | Nombre | Cant. inicial | Precio unit. | Valor total |
|--------|--------|--------------:|-------------:|------------:|
| INT-000011 | Xtime canela | 1 | $200 | $200 |
| … | … | … | … | … |
| | | | **TOTAL** | **$ N** |

- Ordenado alfabéticamente por nombre.
- `Código` = barcode real o código interno `INT-XXXXXX`.
- Total = suma de `Valor total`.

### 4.3 Ventas realizadas

| Código | Nombre | Unidades | Precio prom. | Total |
|--------|--------|---------:|-------------:|------:|
| INT-000012 | Lokiño masticable | 36 | $100 | $3.600 |
| … | … | … | … | … |
| | | | **TOTAL** | **$ N** |

- Ordenado por unidades vendidas (descendente).
- Total = suma de `Total`.

## 5. Lógica de cálculo (SQL sobre SQLite local)

### 5.1 Inventario inicial (solo activos, stock inicial > 0)

```sql
SELECT
  p.barcode,
  p.nombre,
  p.precio,
  p.stock_actual - COALESCE(mov.compras, 0) + COALESCE(mov.ventas, 0) AS stock_inicial
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
ORDER BY p.nombre COLLATE NOCASE;
```

El `valor_total` por fila y el gran total se calculan en JS: `stock_inicial * precio`.

### 5.2 Ventas realizadas

```sql
SELECT
  i.barcode,
  COALESCE(p.nombre, i.nombre_snapshot) AS nombre,
  SUM(i.cantidad) AS unidades,
  SUM(i.subtotal) AS total
FROM transaccion_items i
JOIN transacciones t ON t.id = i.transaccion_id
LEFT JOIN productos p ON p.barcode = i.barcode
WHERE t.tipo = 'venta'
  -- Variante "período": AND t.fecha_hora >= ? AND t.fecha_hora <= ?
GROUP BY i.barcode
ORDER BY unidades DESC;
```

`precio_prom = round(total / unidades)` se calcula en JS.

> Nombre: se usa el actual del catálogo (`p.nombre`) y, si el producto ya no
> existe, cae al `nombre_snapshot` del momento de la venta.

### Cifras de referencia (validadas contra Firestore, ya con Maggi corregido)

- Inventario inicial: ~**558 productos**, total ≈ **$10.927.300**.
- Ventas: **184 productos**, total ≈ **$1.587.600** (tras la corrección de Maggi).

## 6. Implementación técnica

### 6.1 `db/reportes.ts` — dos funciones nuevas

```ts
export type FilaInventarioInicial = {
  barcode: string;
  nombre: string;
  stock_inicial: number;
  precio: number;
  valor_total: number;
};

export async function inventarioInicial(
  db: SQLiteDatabase
): Promise<{ filas: FilaInventarioInicial[]; total: number }>;

export type FilaVenta = {
  barcode: string;
  nombre: string;
  unidades: number;
  precio_prom: number;
  total: number;
};

// desde/hasta opcionales: si se omiten, es histórico completo.
export async function productosVendidos(
  db: SQLiteDatabase,
  rango?: { desde: string; hasta: string }
): Promise<{ filas: FilaVenta[]; total: number }>;
```

### 6.2 `lib/reportePdf.ts` (nuevo) — armado del PDF

- Función que recibe título, período opcional, columnas y filas, y arma el HTML
  con el encabezado de la tienda + tabla con estilos.
- Usa `formatCOP` de [db/util.ts](db/util.ts) para el dinero.
- `Print.printToFileAsync({ html })` → `Sharing.shareAsync(uri)`.
- Manejar el caso "sin compartir disponible" (`Sharing.isAvailableAsync()`).

### 6.3 `app/(tabs)/reportes.tsx` — nueva sección "Reportes imprimibles"

Al final de la pantalla, una `Card` con:
- Botón **"Inventario inicial (PDF)"**.
- Botón **"Ventas — histórico (PDF)"**.
- Botón **"Ventas — período seleccionado (PDF)"** (usa el día/mes ya elegido
  arriba).
- Cada botón con su estado de carga; feedback con `toast`.

## 7. Prerrequisito antes de usar los reportes en el celular

La corrección del error de tipeo (Cubos Caldo Maggi: 5 unidades a $5.000 →
$500) **ya se aplicó en Firestore**, pero el SQLite del teléfono todavía tiene el
valor viejo. Antes de generar reportes hay que:

1. Abrir **Ajustes → Respaldo → "Restaurar desde la nube"** (botón ya agregado).
2. Eso baja el dato corregido al teléfono (total de la transacción y subtotal del
   ítem).

Tras esto, el total de ventas queda en ~$1.587.600.

## 8. Trabajo relacionado ya hecho

- ✅ Instalados `expo-print` y `expo-sharing`.
- ✅ Corregido en Firestore el ítem de Maggi (`transaccion_items` +
  `transacciones.total`).
- ✅ Agregado botón "Restaurar desde la nube" en
  [app/(tabs)/ajustes.tsx](app/(tabs)/ajustes.tsx) (usa `restaurar()` de
  [lib/backup.ts](lib/backup.ts), que hace `INSERT OR REPLACE` sin vaciar la base).
