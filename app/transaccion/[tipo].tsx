import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import BuscadorProducto from '../../components/BuscadorProducto';
import ScannerView from '../../components/ScannerView';
import { Button, Input } from '../../components/ui';
import { getProducto } from '../../db/productos';
import { finalizarTransaccion } from '../../db/transacciones';
import type { LineaBorrador, Producto, TipoTransaccion } from '../../db/types';
import { formatCOP } from '../../db/util';
import { toast } from '../../lib/feedback';
import { colors, font, radius, shadow, spacing } from '../../theme/tokens';

const TITULOS: Record<TipoTransaccion, string> = {
  venta: 'Nueva venta',
  compra: 'Nueva compra',
  ajuste: 'Ajuste de inventario',
};
const ACCENTO: Record<TipoTransaccion, string> = {
  venta: colors.venta,
  compra: colors.compra,
  ajuste: colors.ajuste,
};

function esTipo(v: string): v is TipoTransaccion {
  return v === 'venta' || v === 'compra' || v === 'ajuste';
}

export default function TransaccionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ tipo: string }>();
  const tipo: TipoTransaccion = esTipo(params.tipo) ? params.tipo : 'venta';

  const [lineas, setLineas] = useState<LineaBorrador[]>([]);
  const [contraparte, setContraparte] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [buscadorVisible, setBuscadorVisible] = useState(false);
  // Texto crudo del input de cantidad en 'ajuste' mientras se escribe (permite
  // estados intermedios como "-" sin perderlos). Override efímero del número.
  const [cantTexto, setCantTexto] = useState<Record<string, string>>({});

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario_snapshot,
    0
  );

  // Agrega/incrementa la línea de un producto (compartido por escaneo y buscador).
  const agregarProducto = useCallback(
    (prod: Producto) => {
      // En compra se precarga el costo guardado; si el producto aún no tiene
      // costo (caso típico en carga inicial con precio fijo), se parte del
      // precio de venta como referencia editable para no dejar el campo vacío.
      const costoCompra = prod.costo ?? prod.precio;
      const precioUnit =
        tipo === 'venta'
          ? prod.precio
          : tipo === 'compra'
            ? costoCompra
            : 0;
      const costoSnap = tipo === 'compra' ? costoCompra : prod.costo;

      // En venta no se puede agregar más unidades de las que hay en stock.
      if (tipo === 'venta') {
        const enLinea =
          lineas.find((l) => l.barcode === prod.barcode)?.cantidad ?? 0;
        if (enLinea + 1 > prod.stock_actual) {
          toast(
            prod.stock_actual <= 0
              ? 'Sin stock disponible'
              : `Stock máximo: ${prod.stock_actual}`
          );
          return;
        }
      }

      // El número manda: al escanear se descarta el override de texto.
      setCantTexto((t) => {
        const copia = { ...t };
        delete copia[prod.barcode];
        return copia;
      });

      setLineas((prev) => {
        const idx = prev.findIndex((l) => l.barcode === prod.barcode);
        if (idx >= 0) {
          // Defensa: en venta no exceder el stock disponible.
          if (
            tipo === 'venta' &&
            prev[idx].cantidad + 1 > (prev[idx].stock_actual ?? 0)
          ) {
            return prev;
          }
          const copia = [...prev];
          copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
          return copia;
        }
        // El producto recién agregado va arriba para no tener que hacer scroll.
        return [
          {
            barcode: prod.barcode,
            nombre: prod.nombre,
            // En ajuste se arranca en 0 (delta a escribir); en venta/compra en 1.
            cantidad: tipo === 'ajuste' ? 0 : 1,
            costo_snapshot: costoSnap,
            precio_unitario_snapshot: precioUnit,
            stock_actual: prod.stock_actual,
            precio_venta: prod.precio,
          },
          ...prev,
        ];
      });
    },
    [tipo, lineas]
  );

  const agregarPorCodigo = useCallback(
    async (code: string) => {
      const prod = await getProducto(db, code);
      if (!prod) {
        Alert.alert(
          'Producto no encontrado',
          `El código ${code} no está en el catálogo.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Crear producto',
              onPress: () => router.push(`/producto/nuevo?barcode=${code}`),
            },
          ]
        );
        return;
      }
      agregarProducto(prod);
    },
    [db, router, agregarProducto]
  );

  const cambiarCantidad = (barcode: string, delta: number) => {
    setLineas((prev) =>
      prev
        .map((l) => {
          if (l.barcode !== barcode) return l;
          let cantidad = l.cantidad + delta;
          // En venta, la cantidad no puede superar el stock disponible.
          if (tipo === 'venta' && cantidad > (l.stock_actual ?? 0)) {
            cantidad = l.stock_actual ?? 0;
          }
          return { ...l, cantidad };
        })
        .filter((l) => l.cantidad !== 0)
    );
  };

  const limpiarTexto = (barcode: string) =>
    setCantTexto((t) => {
      const copia = { ...t };
      delete copia[barcode];
      return copia;
    });

  // Ajuste: −/+ no eliminan la línea al llegar a 0 (0 es un delta válido en
  // construcción; la línea se quita solo con la papelera o al finalizar).
  const cambiarCantidadAjuste = (barcode: string, delta: number) => {
    limpiarTexto(barcode);
    setLineas((prev) =>
      prev.map((l) =>
        l.barcode === barcode ? { ...l, cantidad: l.cantidad + delta } : l
      )
    );
  };

  // Ajuste: edición directa del delta, admitiendo un signo negativo inicial.
  const cambiarCantidadTexto = (barcode: string, texto: string) => {
    let limpio = texto.replace(/[^\d-]/g, '');
    const negativo = limpio.startsWith('-');
    limpio = limpio.replace(/-/g, '');
    if (negativo) limpio = '-' + limpio;
    setCantTexto((t) => ({ ...t, [barcode]: limpio }));
    const n = limpio === '' || limpio === '-' ? 0 : parseInt(limpio, 10) || 0;
    setLineas((prev) =>
      prev.map((l) => (l.barcode === barcode ? { ...l, cantidad: n } : l))
    );
  };

  // Ajuste: invierte el signo (vía garantizada para negativos en Android).
  const invertirSigno = (barcode: string) => {
    limpiarTexto(barcode);
    setLineas((prev) =>
      prev.map((l) =>
        l.barcode === barcode ? { ...l, cantidad: -l.cantidad } : l
      )
    );
  };

  const quitarLinea = (barcode: string) => {
    limpiarTexto(barcode);
    setLineas((prev) => prev.filter((l) => l.barcode !== barcode));
  };

  // En compras: editar el costo unitario que cobró el proveedor.
  const cambiarCosto = (barcode: string, texto: string) => {
    const n = Number(texto.replace(/[^\d]/g, '')) || 0;
    setLineas((prev) =>
      prev.map((l) =>
        l.barcode === barcode
          ? { ...l, precio_unitario_snapshot: n, costo_snapshot: n }
          : l
      )
    );
  };

  const finalizar = async () => {
    // En ajuste se ignoran las líneas con delta 0 (sin cambio de stock).
    const lineasValidas =
      tipo === 'ajuste' ? lineas.filter((l) => l.cantidad !== 0) : lineas;
    if (lineasValidas.length === 0) {
      Alert.alert(
        'Sin cambios',
        tipo === 'ajuste'
          ? 'No hay ajustes que guardar.'
          : 'Agrega al menos un producto.'
      );
      return;
    }
    setGuardando(true);
    try {
      await finalizarTransaccion(db, {
        tipo,
        cliente_proveedor: contraparte.trim() || null,
        motivo: tipo === 'ajuste' ? contraparte.trim() || null : null,
        lineas: lineasValidas,
      });
      toast(TITULOS[tipo] + ' guardada');
      router.back();
    } catch (e) {
      setGuardando(false);
      Alert.alert('Error', String(e));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <Stack.Screen options={{ title: TITULOS[tipo] }} />

      <View style={styles.scanner}>
        <ScannerView
          onScan={agregarPorCodigo}
          paused={guardando || buscadorVisible}
        />
        <View style={styles.scanHint}>
          <Ionicons name="scan-outline" size={16} color={colors.textInverse} />
          <Text style={styles.scanHintText}>Apunta al código de barras</Text>
        </View>
      </View>

      <Pressable
        onPress={() => setBuscadorVisible(true)}
        style={({ pressed }) => [styles.sinEscanear, pressed && styles.pressed]}
      >
        <Ionicons name="search" size={18} color={colors.primary} />
        <Text style={styles.sinEscanearText}>
          Agregar sin escanear (granel / por nombre)
        </Text>
      </Pressable>

      <BuscadorProducto
        visible={buscadorVisible}
        onClose={() => setBuscadorVisible(false)}
        onSelect={agregarProducto}
      />

      <FlatList
        style={styles.lista}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        data={lineas}
        keyExtractor={(l) => l.barcode}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="barcode-outline"
              size={40}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>
              Escanea un producto para agregarlo.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (tipo === 'ajuste') {
            const stockActual = item.stock_actual ?? 0;
            const resultante = stockActual + item.cantidad;
            const display =
              cantTexto[item.barcode] !== undefined
                ? cantTexto[item.barcode]
                : String(item.cantidad);
            return (
              <View style={styles.linea}>
                <View style={styles.lineaHeader}>
                  <Text style={[styles.lineaNombre, styles.flex1]}>
                    {item.nombre}
                  </Text>
                  <Pressable onPress={() => quitarLinea(item.barcode)} hitSlop={8}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
                <Text style={styles.stockActual}>
                  Stock actual: <Text style={styles.stockActualNum}>{stockActual}</Text>
                </Text>
                <View style={styles.ajusteControls}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => cambiarCantidadAjuste(item.barcode, -1)}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </Pressable>
                  <TextInput
                    style={styles.ajusteInput}
                    keyboardType="numeric"
                    selectTextOnFocus
                    value={display}
                    onChangeText={(t) => cambiarCantidadTexto(item.barcode, t)}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => cambiarCantidadAjuste(item.barcode, 1)}
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </Pressable>
                  <Pressable
                    style={styles.signBtn}
                    onPress={() => invertirSigno(item.barcode)}
                  >
                    <Text style={styles.signBtnText}>±</Text>
                  </Pressable>
                </View>
                <Text
                  style={[
                    styles.resultante,
                    resultante < 0 && styles.resultanteWarn,
                  ]}
                >
                  Stock resultante:{' '}
                  <Text
                    style={[
                      styles.resultanteNum,
                      resultante < 0 && styles.resultanteWarn,
                    ]}
                  >
                    {resultante}
                  </Text>
                </Text>
              </View>
            );
          }
          const topeVenta =
            tipo === 'venta' && item.cantidad >= (item.stock_actual ?? 0);
          return (
          <View style={styles.linea}>
            <Text style={styles.lineaNombre}>{item.nombre}</Text>
            {tipo === 'venta' && (
              <Text
                style={[styles.stockHint, topeVenta && styles.stockHintWarn]}
              >
                Stock disponible: {item.stock_actual ?? 0}
              </Text>
            )}
            <View style={styles.lineaMain}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>
                  {tipo === 'compra' ? 'Costo c/u' : 'Precio c/u'}
                </Text>
                {tipo === 'compra' ? (
                  <>
                    <TextInput
                      style={styles.costoInput}
                      keyboardType="numeric"
                      selectTextOnFocus
                      value={
                        item.precio_unitario_snapshot
                          ? String(item.precio_unitario_snapshot)
                          : ''
                      }
                      onChangeText={(texto) => cambiarCosto(item.barcode, texto)}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.refVenta}>
                      Venta: {formatCOP(item.precio_venta ?? 0)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.colValue}>
                    {formatCOP(item.precio_unitario_snapshot)}
                  </Text>
                )}
              </View>

              <View style={styles.col}>
                <Text style={styles.colLabel}>Cantidad</Text>
                <View style={styles.qtyControls}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => cambiarCantidad(item.barcode, -1)}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.qty}>{item.cantidad}</Text>
                  <Pressable
                    style={[styles.qtyBtn, topeVenta && styles.qtyBtnOff]}
                    disabled={topeVenta}
                    onPress={() => cambiarCantidad(item.barcode, 1)}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={topeVenta ? colors.textMuted : colors.text}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.col, styles.colRight]}>
                <Text style={styles.colLabel}>Total</Text>
                <Text style={styles.subtotal}>
                  {formatCOP(item.cantidad * item.precio_unitario_snapshot)}
                </Text>
              </View>
            </View>
          </View>
          );
        }}
      />

      <View style={styles.footer}>
        <Input
          placeholder={
            tipo === 'venta'
              ? 'Cliente (opcional)'
              : tipo === 'compra'
                ? 'Proveedor (opcional)'
                : 'Motivo del ajuste (opcional)'
          }
          value={contraparte}
          onChangeText={setContraparte}
        />
        {tipo !== 'ajuste' && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={[styles.totalValue, { color: ACCENTO[tipo] }]}>
              {formatCOP(total)}
            </Text>
          </View>
        )}
        <Button
          label="Finalizar"
          icon="checkmark-circle"
          variant={tipo}
          size="lg"
          loading={guardando}
          onPress={finalizar}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.85 },
  scanner: { height: 220, backgroundColor: '#000' },
  sinEscanear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sinEscanearText: { color: colors.primary, fontSize: font.md, fontWeight: '700' },
  scanHint: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  scanHintText: { color: colors.textInverse, fontSize: font.xs },
  lista: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: font.md },
  linea: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  lineaNombre: { fontSize: font.md, fontWeight: '700', color: colors.text },
  stockHint: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  stockHintWarn: { color: colors.danger, fontWeight: '700' },
  qtyBtnOff: { opacity: 0.4 },
  flex1: { flex: 1 },
  lineaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stockActual: { fontSize: font.sm, color: colors.textMuted },
  stockActualNum: { color: colors.text, fontWeight: '700' },
  ajusteControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ajusteInput: {
    flex: 1,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  signBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signBtnText: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  resultante: { fontSize: font.sm, color: colors.textMuted },
  resultanteNum: { color: colors.text, fontWeight: '800' },
  resultanteWarn: { color: colors.danger },
  lineaMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  col: { gap: spacing.xs },
  colRight: { alignItems: 'flex-end' },
  colLabel: { fontSize: font.xs, color: colors.textMuted, fontWeight: '600' },
  colValue: { fontSize: font.md, fontWeight: '700', color: colors.text },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  costoInput: {
    width: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: font.md,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  refVenta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: 28, textAlign: 'center', fontSize: font.lg, fontWeight: '700' },
  subtotal: {
    minWidth: 84,
    textAlign: 'right',
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: font.md, color: colors.textMuted, fontWeight: '600' },
  totalValue: { fontSize: font.xxl, fontWeight: '800' },
});
