import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import ScannerView from '../../components/ScannerView';
import { getProducto } from '../../db/productos';
import { finalizarTransaccion } from '../../db/transacciones';
import type { LineaBorrador, TipoTransaccion } from '../../db/types';
import { formatCOP } from '../../db/util';

const TITULOS: Record<TipoTransaccion, string> = {
  venta: 'Nueva venta',
  compra: 'Nueva compra',
  ajuste: 'Ajuste de inventario',
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

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario_snapshot,
    0
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
    [db, router, tipo]
  );

  const cambiarCantidad = (barcode: string, delta: number) => {
    setLineas((prev) =>
      prev
        .map((l) =>
          l.barcode === barcode ? { ...l, cantidad: l.cantidad + delta } : l
        )
        // en ajuste la cantidad puede ser negativa; solo se elimina si llega a 0
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
        <ScannerView onScan={agregarPorCodigo} paused={guardando} />
      </View>

      <FlatList
        style={styles.lista}
        data={lineas}
        keyExtractor={(l) => l.barcode}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Escanea un producto para agregarlo.
          </Text>
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
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{item.cantidad}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => cambiarCantidad(item.barcode, 1)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
            <Text style={styles.subtotal}>
              {formatCOP(item.cantidad * item.precio_unitario_snapshot)}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TextInput
          style={styles.input}
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
          <Text style={styles.total}>Total: {formatCOP(total)}</Text>
        )}
        <Pressable
          style={[styles.finalizar, guardando && styles.finalizarOff]}
          onPress={finalizar}
          disabled={guardando}
        >
          <Text style={styles.finalizarText}>
            {guardando ? 'Guardando…' : 'Finalizar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scanner: { height: 220, backgroundColor: '#000' },
  lista: { flex: 1, paddingHorizontal: 12 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 24 },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  lineaNombre: { fontSize: 15, fontWeight: '600', color: '#111827' },
  lineaMeta: { fontSize: 12, color: '#6b7280' },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 20, fontWeight: '700', color: '#374151' },
  qty: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  subtotal: {
    minWidth: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  total: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'right' },
  finalizar: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finalizarOff: { backgroundColor: '#9ca3af' },
  finalizarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
