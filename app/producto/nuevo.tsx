import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getMargenGeneral,
  nextCodigoInterno,
} from '../../db/configuracion';
import { crearProducto, getProducto } from '../../db/productos';
import type { ModoPrecio } from '../../db/types';
import { precioConMargen } from '../../db/util';

export default function NuevoProductoScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string }>();

  const [barcode] = useState(params.barcode ?? '');
  const [sinCodigo, setSinCodigo] = useState(!params.barcode);
  const [nombre, setNombre] = useState('');
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>('margen');
  const [costo, setCosto] = useState('');
  const [margen, setMargen] = useState('');
  const [precio, setPrecio] = useState('');
  const [stockInicial, setStockInicial] = useState('0');

  const precioSugerido = (() => {
    if (modoPrecio !== 'margen') return null;
    const c = Number(costo);
    const m = Number(margen);
    if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(m)) return null;
    return precioConMargen(c, m);
  })();

  const guardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.');
      return;
    }

    let codigoFinal = barcode.trim();
    if (sinCodigo || !codigoFinal) {
      codigoFinal = await nextCodigoInterno(db);
    } else if (await getProducto(db, codigoFinal)) {
      Alert.alert('Código repetido', 'Ya existe un producto con ese código.');
      return;
    }

    const costoNum = costo ? Number(costo) : null;
    let precioFinal: number;
    if (modoPrecio === 'margen') {
      const m = margen ? Number(margen) : await getMargenGeneral(db);
      if (costoNum == null || !Number.isFinite(costoNum)) {
        Alert.alert('Falta el costo', 'En modo margen el costo es obligatorio.');
        return;
      }
      precioFinal = precioConMargen(costoNum, m);
    } else {
      precioFinal = Number(precio);
      if (!Number.isFinite(precioFinal) || precioFinal <= 0) {
        Alert.alert('Precio inválido', 'Ingresa un precio de venta válido.');
        return;
      }
    }

    await crearProducto(db, {
      barcode: codigoFinal,
      nombre: nombre.trim(),
      sin_codigo: sinCodigo,
      modo_precio: modoPrecio,
      costo: costoNum,
      margen_pct: margen ? Number(margen) : null,
      precio: precioFinal,
      // TODO: registrar el stock inicial como transacción 'ajuste'
      // (motivo: 'inventario inicial') para trazabilidad, según el diseño.
      stock_inicial: Number(stockInicial) || 0,
    });
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 12 }}>
      <Field label="Código de barras">
        <Text style={styles.codigo}>
          {barcode || (sinCodigo ? '(se generará INT-… )' : '—')}
        </Text>
      </Field>

      <Toggle
        label="Producto a granel / sin código"
        value={sinCodigo}
        onChange={setSinCodigo}
      />

      <Field label="Nombre">
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />
      </Field>

      <Field label="Modo de precio">
        <View style={styles.row}>
          <Seg
            on={modoPrecio === 'margen'}
            label="Calcular con margen"
            onPress={() => setModoPrecio('margen')}
          />
          <Seg
            on={modoPrecio === 'fijo'}
            label="Precio fijo"
            onPress={() => setModoPrecio('fijo')}
          />
        </View>
      </Field>

      <Field label="Costo (COP)">
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={costo}
          onChangeText={setCosto}
        />
      </Field>

      {modoPrecio === 'margen' ? (
        <>
          <Field label="Margen % (vacío = general)">
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={margen}
              onChangeText={setMargen}
            />
          </Field>
          {precioSugerido != null && (
            <Text style={styles.sugerido}>
              Precio sugerido: ${precioSugerido.toLocaleString('es-CO')}
            </Text>
          )}
        </>
      ) : (
        <Field label="Precio de venta (COP)">
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={precio}
            onChangeText={setPrecio}
          />
        </Field>
      )}

      <Field label="Stock inicial">
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={stockInicial}
          onChangeText={setStockInicial}
        />
      </Field>

      <Pressable style={styles.btn} onPress={guardar}>
        <Text style={styles.btnText}>Guardar producto</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggle} onPress={() => onChange(!value)}>
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function Seg({
  on,
  label,
  onPress,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.seg, on && styles.segOn]} onPress={onPress}>
      <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 4 },
  codigo: { fontSize: 16, color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  segOn: { backgroundColor: '#2563eb' },
  segText: { color: '#374151', fontWeight: '600' },
  segTextOn: { color: '#fff' },
  sugerido: { fontSize: 15, color: '#16a34a', fontWeight: '700' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  check: { color: '#fff', fontWeight: '700' },
  toggleLabel: { fontSize: 15, color: '#111827' },
  btn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
