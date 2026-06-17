import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listarProductos } from '../../db/productos';
import type { Producto } from '../../db/types';
import { formatCOP } from '../../db/util';

export default function CatalogoScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);

  const cargar = useCallback(
    (q: string) => {
      listarProductos(db, q).then(setProductos);
    },
    [db]
  );

  useFocusEffect(
    useCallback(() => {
      cargar(busqueda);
    }, [cargar, busqueda])
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar por nombre o código…"
        value={busqueda}
        onChangeText={(t) => {
          setBusqueda(t);
          cargar(t);
        }}
      />

      <FlatList
        data={productos}
        keyExtractor={(p) => p.barcode}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay productos en el catálogo.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/producto/${item.barcode}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.meta}>
                {item.barcode} · Stock: {item.stock_actual}
              </Text>
            </View>
            <Text style={styles.precio}>{formatCOP(item.precio)}</Text>
          </Pressable>
        )}
      />

      <Link href="/producto/nuevo" asChild>
        <Pressable style={styles.fab}>
          <Text style={styles.fabText}>+ Agregar</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 15,
  },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  nombre: { fontSize: 16, color: '#111827', fontWeight: '600' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  precio: { fontSize: 15, fontWeight: '700', color: '#111827' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
