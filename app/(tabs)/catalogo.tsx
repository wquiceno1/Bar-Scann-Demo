import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { EmptyState, Input, Screen } from '../../components/ui';
import {
  listarProductos,
  UMBRAL_STOCK_BAJO,
  type DireccionOrden,
  type OrdenProducto,
} from '../../db/productos';
import type { Producto } from '../../db/types';
import { formatCOP } from '../../db/util';
import { colors, font, radius, shadow, spacing } from '../../theme/tokens';

export default function CatalogoScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenProducto>('nombre');
  const [dir, setDir] = useState<DireccionOrden>('asc');
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);

  const cargar = useCallback(
    (q: string, opts: { orden: OrdenProducto; dir: DireccionOrden; soloStockBajo: boolean }) => {
      listarProductos(db, q, opts).then(setProductos);
    },
    [db]
  );

  useFocusEffect(
    useCallback(() => {
      cargar(busqueda, { orden, dir, soloStockBajo });
    }, [cargar, busqueda, orden, dir, soloStockBajo])
  );

  // Chip de orden: 1er toque → mayor→menor (desc), 2º → menor→mayor (asc),
  // 3º → vuelve al orden por nombre (default).
  const tocarChip = (criterio: 'stock' | 'precio') => {
    let nuevoOrden: OrdenProducto;
    let nuevaDir: DireccionOrden;
    if (orden !== criterio) {
      nuevoOrden = criterio;
      nuevaDir = 'desc';
    } else if (dir === 'desc') {
      nuevoOrden = criterio;
      nuevaDir = 'asc';
    } else {
      nuevoOrden = 'nombre';
      nuevaDir = 'asc';
    }
    setOrden(nuevoOrden);
    setDir(nuevaDir);
    cargar(busqueda, { orden: nuevoOrden, dir: nuevaDir, soloStockBajo });
  };

  const toggleStockBajo = () => {
    const next = !soloStockBajo;
    setSoloStockBajo(next);
    cargar(busqueda, { orden, dir, soloStockBajo: next });
  };

  return (
    <Screen padded>
      <Input
        placeholder="Buscar por nombre o código…"
        value={busqueda}
        onChangeText={(t) => {
          setBusqueda(t);
          cargar(t, { orden, dir, soloStockBajo });
        }}
        style={styles.search}
      />

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Ordenar</Text>
        <SortChip
          label="Stock"
          activo={orden === 'stock'}
          dir={dir}
          onPress={() => tocarChip('stock')}
        />
        <SortChip
          label="Precio"
          activo={orden === 'precio'}
          dir={dir}
          onPress={() => tocarChip('precio')}
        />
        <Pressable
          onPress={toggleStockBajo}
          style={[styles.chip, soloStockBajo && styles.chipWarnOn]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={14}
            color={soloStockBajo ? colors.textInverse : colors.ajuste}
          />
          <Text
            style={[styles.chipText, soloStockBajo && styles.chipTextOn]}
          >
            Stock bajo
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={productos}
        keyExtractor={(p) => p.barcode}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 96 }}
        ListEmptyComponent={
          <EmptyState
            icon="pricetags-outline"
            title={soloStockBajo ? 'Sin productos con stock bajo' : 'Catálogo vacío'}
            subtitle={
              soloStockBajo
                ? 'Ningún producto está por debajo del umbral.'
                : 'Agrega productos con el botón + o usa la carga inicial escaneando.'
            }
          />
        }
        renderItem={({ item }) => {
          const agotado = item.stock_actual <= 0;
          const bajo = item.stock_actual <= UMBRAL_STOCK_BAJO;
          const stockColor = agotado
            ? colors.danger
            : bajo
              ? colors.ajuste
              : colors.textMuted;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push(`/producto/${item.barcode}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="cube-outline" size={13} color={stockColor} />
                  <Text style={[styles.meta, { color: stockColor, fontWeight: bajo ? '700' : '400' }]}>
                    Stock: {item.stock_actual}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.meta}>{item.barcode}</Text>
                </View>
              </View>
              <Text style={styles.precio}>{formatCOP(item.precio)}</Text>
            </Pressable>
          );
        }}
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

function SortChip({
  label,
  activo,
  dir,
  onPress,
}: {
  label: string;
  activo: boolean;
  dir: DireccionOrden;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, activo && styles.chipOn]}>
      <Text style={[styles.chipText, activo && styles.chipTextOn]}>{label}</Text>
      {activo && (
        <Ionicons
          name={dir === 'desc' ? 'arrow-down' : 'arrow-up'}
          size={14}
          color={colors.textInverse}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: spacing.sm },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sortLabel: { fontSize: font.xs, color: colors.textMuted, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipWarnOn: { backgroundColor: colors.ajuste, borderColor: colors.ajuste },
  chipText: { fontSize: font.sm, color: colors.text, fontWeight: '700' },
  chipTextOn: { color: colors.textInverse },
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
