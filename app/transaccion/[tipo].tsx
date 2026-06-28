import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario_snapshot,
    0
  );

  // Agrega/incrementa la línea de un producto (compartido por escaneo y buscador).
  const agregarProducto = useCallback(
    (prod: Producto) => {
      const precioUnit =
        tipo === 'venta'
          ? prod.precio
          : tipo === 'compra'
            ? (prod.costo ?? 0)
            : 0;

      setLineas((prev) => {
        const idx = prev.findIndex((l) => l.barcode === prod.barcode);
        if (idx >= 0) {
          const copia = [...prev];
          copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
          return copia;
        }
        return [
          ...prev,
          {
            barcode: prod.barcode,
            nombre: prod.nombre,
            cantidad: 1,
            costo_snapshot: prod.costo,
            precio_unitario_snapshot: precioUnit,
          },
        ];
      });
    },
    [tipo]
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
        .map((l) =>
          l.barcode === barcode ? { ...l, cantidad: l.cantidad + delta } : l
        )
        .filter((l) => l.cantidad !== 0)
    );
  };

  const finalizar = async () => {
    if (lineas.length === 0) {
      Alert.alert('Sin productos', 'Agrega al menos un producto.');
      return;
    }
    setGuardando(true);
    try {
      await finalizarTransaccion(db, {
        tipo,
        cliente_proveedor: contraparte.trim() || null,
        motivo: tipo === 'ajuste' ? contraparte.trim() || null : null,
        lineas,
      });
      toast(TITULOS[tipo] + ' guardada');
      router.back();
    } catch (e) {
      setGuardando(false);
      Alert.alert('Error', String(e));
    }
  };

  return (
    <View style={styles.container}>
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
        renderItem={({ item }) => (
          <View style={styles.linea}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineaNombre}>{item.nombre}</Text>
              <Text style={styles.lineaMeta}>
                {formatCOP(item.precio_unitario_snapshot)} c/u
              </Text>
            </View>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => cambiarCantidad(item.barcode, -1)}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.qty}>{item.cantidad}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => cambiarCantidad(item.barcode, 1)}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.subtotal}>
              {formatCOP(item.cantidad * item.precio_unitario_snapshot)}
            </Text>
          </View>
        )}
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
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  lineaNombre: { fontSize: font.md, fontWeight: '700', color: colors.text },
  lineaMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
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
