import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { EmptyState, Input } from './ui';
import { listarProductos } from '../db/productos';
import type { Producto } from '../db/types';
import { formatCOP } from '../db/util';
import { colors, font, radius, spacing } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (producto: Producto) => void;
};

/** Modal de búsqueda por nombre/código para agregar productos sin escanear (granel). */
export default function BuscadorProducto({ visible, onClose, onSelect }: Props) {
  const db = useSQLiteContext();
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);

  const cargar = useCallback(
    (q: string) => {
      listarProductos(db, q).then(setProductos);
    },
    [db]
  );

  useEffect(() => {
    if (visible) {
      setBusqueda('');
      cargar('');
    }
  }, [visible, cargar]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Agregar sin escanear</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        <Input
          placeholder="Buscar por nombre o código…"
          value={busqueda}
          autoFocus
          onChangeText={(t) => {
            setBusqueda(t);
            cargar(t);
          }}
          style={styles.search}
        />

        <FlatList
          data={productos}
          keyExtractor={(p) => p.barcode}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Sin resultados"
              subtitle="Prueba con otro nombre o crea el producto desde el catálogo."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.meta}>
                  Stock: {item.stock_actual} · {item.barcode}
                </Text>
              </View>
              <Text style={styles.precio}>{formatCOP(item.precio)}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  search: { marginBottom: spacing.md },
  pressed: { opacity: 0.85 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  nombre: { fontSize: font.md, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  precio: { fontSize: font.md, fontWeight: '800', color: colors.text },
});
