import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { EmptyState, Screen } from '../../components/ui';
import { listarTransacciones } from '../../db/transacciones';
import type { TipoTransaccion, Transaccion } from '../../db/types';
import { formatCOP } from '../../db/util';
import { colors, font, radius, shadow, spacing } from '../../theme/tokens';

const TIPOS: (TipoTransaccion | 'todos')[] = ['todos', 'venta', 'compra', 'ajuste'];
const ETIQUETA: Record<TipoTransaccion, string> = {
  venta: 'Venta',
  compra: 'Compra',
  ajuste: 'Ajuste',
};
const ICONO: Record<TipoTransaccion, keyof typeof Ionicons.glyphMap> = {
  venta: 'cart',
  compra: 'cube',
  ajuste: 'construct',
};
const COLOR: Record<TipoTransaccion, string> = {
  venta: colors.venta,
  compra: colors.compra,
  ajuste: colors.ajuste,
};

export default function HistorialScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [filtro, setFiltro] = useState<TipoTransaccion | 'todos'>('todos');
  const [items, setItems] = useState<Transaccion[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarTransacciones(db, filtro === 'todos' ? {} : { tipo: filtro }).then(
        setItems
      );
    }, [db, filtro])
  );

  return (
    <Screen padded>
      <View style={styles.filtros}>
        {TIPOS.map((t) => {
          const on = filtro === t;
          return (
            <Pressable
              key={t}
              onPress={() => setFiltro(t)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t === 'todos' ? 'Todos' : ETIQUETA[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ gap: spacing.sm }}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Sin operaciones"
            subtitle="Las ventas, compras y ajustes que registres aparecerán aquí."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/detalle/${item.id}`)}
          >
            <View style={[styles.badge, { backgroundColor: COLOR[item.tipo] }]}>
              <Ionicons
                name={ICONO[item.tipo]}
                size={18}
                color={colors.textInverse}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipo}>
                {ETIQUETA[item.tipo]}
                {item.cliente_proveedor ? ` · ${item.cliente_proveedor}` : ''}
              </Text>
              <Text style={styles.fecha}>{item.fecha_hora.replace('T', ' ')}</Text>
            </View>
            {item.tipo !== 'ajuste' && (
              <Text style={styles.total}>{formatCOP(item.total)}</Text>
            )}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filtros: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: font.sm },
  chipTextOn: { color: colors.textInverse },
  pressed: { opacity: 0.85 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipo: { fontSize: font.md, fontWeight: '700', color: colors.text },
  fecha: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  total: { fontSize: font.md, fontWeight: '800', color: colors.text },
});
