import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Input, Screen } from '../../components/ui';
import { getMargenGeneral, nextCodigoInterno } from '../../db/configuracion';
import { crearProducto, getProducto } from '../../db/productos';
import type { ModoPrecio } from '../../db/types';
import { precioConMargen } from '../../db/util';
import { toast } from '../../lib/feedback';
import { colors, font, radius, spacing } from '../../theme/tokens';

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
  const [margenGeneral, setMargenGeneral] = useState<number | null>(null);

  useEffect(() => {
    getMargenGeneral(db).then(setMargenGeneral);
  }, [db]);

  const margenEfectivo = margen.trim() !== '' ? Number(margen) : margenGeneral;

  const precioSugerido = (() => {
    if (modoPrecio !== 'margen') return null;
    const c = Number(costo);
    if (!Number.isFinite(c) || c <= 0) return null;
    if (margenEfectivo == null || !Number.isFinite(margenEfectivo)) return null;
    return precioConMargen(c, margenEfectivo);
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
      // crearProducto registra esto como un 'ajuste' (motivo 'inventario
      // inicial') para que el stock de arranque quede trazado.
      stock_inicial: Number(stockInicial) || 0,
    });
    toast(`Producto guardado: ${nombre.trim()}`);
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.codigoBox}>
          <Ionicons name="barcode-outline" size={20} color={colors.textMuted} />
          <Text style={styles.codigo}>
            {barcode || (sinCodigo ? 'Se generará un código INT-…' : '—')}
          </Text>
        </View>

        <Toggle
          label="Producto a granel / sin código"
          value={sinCodigo}
          onChange={setSinCodigo}
        />

        <Input label="Nombre" value={nombre} onChangeText={setNombre} />

        <View>
          <Text style={styles.label}>Modo de precio</Text>
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
        </View>

        <Input
          label="Costo (COP)"
          keyboardType="numeric"
          value={costo}
          onChangeText={setCosto}
        />

        {modoPrecio === 'margen' ? (
          <>
            <Input
              label="Margen del producto %"
              hint={
                margenGeneral != null
                  ? `Opcional. Si lo dejas vacío usa el margen general (${margenGeneral}%).`
                  : 'Opcional.'
              }
              keyboardType="numeric"
              placeholder={
                margenGeneral != null ? `${margenGeneral} (general)` : ''
              }
              value={margen}
              onChangeText={setMargen}
            />
            {precioSugerido != null && (
              <View style={styles.sugeridoBox}>
                <Ionicons name="pricetag" size={16} color={colors.venta} />
                <Text style={styles.sugerido}>
                  Precio sugerido: ${precioSugerido.toLocaleString('es-CO')}
                  {margen.trim() === '' ? '  · margen general' : ''}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Input
            label="Precio de venta (COP)"
            keyboardType="numeric"
            value={precio}
            onChangeText={setPrecio}
          />
        )}

        <Input
          label="Stock inicial"
          keyboardType="numeric"
          value={stockInicial}
          onChangeText={setStockInicial}
        />

        <Button
          label="Guardar producto"
          icon="save"
          variant="venta"
          size="lg"
          onPress={guardar}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </Screen>
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
        {value && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
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
  content: { padding: spacing.lg, gap: spacing.lg },
  codigoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  codigo: { fontSize: font.md, color: colors.text },
  label: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  seg: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { color: colors.textMuted, fontWeight: '700' },
  segTextOn: { color: colors.textInverse },
  sugeridoBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sugerido: { fontSize: font.md, color: colors.venta, fontWeight: '700' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { fontSize: font.md, color: colors.text, flex: 1 },
});
