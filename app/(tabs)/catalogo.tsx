import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { EmptyState, Input, Screen } from '../../components/ui';
import { listarProductos } from '../../db/productos';
import type { Producto } from '../../db/types';
import { formatCOP } from '../../db/util';
import { colors, font, radius, shadow, spacing } from '../../theme/tokens';

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
    <Screen padded>
      <Input
        placeholder="Buscar por nombre o código…"
        value={busqueda}
        onChangeText={(t) => {
          setBusqueda(t);
          cargar(t);
        }}
        style={styles.search}
      />

      <FlatList
        data={productos}
        keyExtractor={(p) => p.barcode}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 96 }}
        ListEmptyComponent={
          <EmptyState
            icon="pricetags-outline"
            title="Catálogo vacío"
            subtitle="Agrega productos con el botón + o usa la carga inicial escaneando."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/producto/${item.barcode}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <View style={styles.metaRow}>
                <Ionicons
                  name="cube-outline"
                  size={13}
                  color={colors.textMuted}
                />
                <Text style={styles.meta}>Stock: {item.stock_actual}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.meta}>{item.barcode}</Text>
              </View>
            </View>
            <Text style={styles.precio}>{formatCOP(item.precio)}</Text>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push('/producto/nuevo')}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={22} color={colors.textInverse} />
        <Text style={styles.fabText}>Agregar</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: spacing.md },
  pressed: { opacity: 0.85 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  nombre: { fontSize: font.md, color: colors.text, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 3,
  },
  meta: { fontSize: font.xs, color: colors.textMuted },
  dot: { color: colors.textMuted },
  precio: { fontSize: font.md, fontWeight: '800', color: colors.text },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    ...shadow,
  },
  fabText: { color: colors.textInverse, fontSize: font.md, fontWeight: '700' },
});
