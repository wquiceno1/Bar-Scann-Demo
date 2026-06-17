import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listarTransacciones } from '../../db/transacciones';
import type { TipoTransaccion, Transaccion } from '../../db/types';
import { formatCOP } from '../../db/util';

const TIPOS: (TipoTransaccion | 'todos')[] = [
  'todos',
  'venta',
  'compra',
  'ajuste',
];
const ETIQUETA: Record<TipoTransaccion, string> = {
  venta: 'Venta',
  compra: 'Compra',
  ajuste: 'Ajuste',
};

export default function HistorialScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [filtro, setFiltro] = useState<TipoTransaccion | 'todos'>('todos');
  const [items, setItems] = useState<Transaccion[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarTransacciones(
        db,
        filtro === 'todos' ? {} : { tipo: filtro }
      ).then(setItems);
    }, [db, filtro])
  );

  return (
    <View style={styles.container}>
      <View style={styles.filtros}>
        {TIPOS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setFiltro(t)}
            style={[styles.chip, filtro === t && styles.chipOn]}
          >
            <Text style={[styles.chipText, filtro === t && styles.chipTextOn]}>
              {t === 'todos' ? 'Todos' : ETIQUETA[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={
          <Text style={styles.empty}>Sin operaciones registradas.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/detalle/${item.id}`)}
          >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  chipOn: { backgroundColor: '#2563eb' },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tipo: { fontSize: 15, fontWeight: '600', color: '#111827' },
  fecha: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  total: { fontSize: 15, fontWeight: '700', color: '#111827' },
});
