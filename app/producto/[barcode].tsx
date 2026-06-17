import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { actualizarProducto, getProducto } from '../../db/productos';
import type { Producto } from '../../db/types';
import { formatCOP } from '../../db/util';

export default function ProductoScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const [prod, setProd] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');

  useFocusEffect(
    useCallback(() => {
      getProducto(db, barcode).then((p) => {
        setProd(p);
        if (p) {
          setNombre(p.nombre);
          setPrecio(String(p.precio));
        }
      });
    }, [db, barcode])
  );

  if (!prod) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Producto no encontrado.</Text>
      </View>
    );
  }

  const guardar = async () => {
    const precioNum = Number(precio);
    if (!nombre.trim() || !Number.isFinite(precioNum) || precioNum <= 0) {
      Alert.alert('Datos inválidos', 'Revisa el nombre y el precio.');
      return;
    }
    await actualizarProducto(db, prod.barcode, {
      nombre: nombre.trim(),
      precio: precioNum,
    });
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 12 }}>
      <Text style={styles.meta}>Código: {prod.barcode}</Text>
      <Text style={styles.stock}>Stock actual: {prod.stock_actual}</Text>
      <Text style={styles.meta}>
        Costo: {prod.costo != null ? formatCOP(prod.costo) : '—'} · Modo:{' '}
        {prod.modo_precio}
      </Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

      <Text style={styles.label}>Precio de venta (COP)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={precio}
        onChangeText={setPrecio}
      />

      <Pressable style={styles.btn} onPress={guardar}>
        <Text style={styles.btnText}>Guardar cambios</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  meta: { fontSize: 14, color: '#6b7280' },
  stock: { fontSize: 18, fontWeight: '700', color: '#111827' },
  label: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
