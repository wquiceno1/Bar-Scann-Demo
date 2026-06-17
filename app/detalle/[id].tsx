import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getTransaccion } from '../../db/transacciones';
import type { Transaccion, TransaccionItem } from '../../db/types';
import { formatCOP } from '../../db/util';

export default function DetalleScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<Transaccion | null>(null);
  const [items, setItems] = useState<TransaccionItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      getTransaccion(db, id).then((res) => {
        if (res) {
          setTx(res.tx);
          setItems(res.items);
        }
      });
    }, [db, id])
  );

  if (!tx) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Operación no encontrada.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.tipo}>{tx.tipo.toUpperCase()}</Text>
      <Text style={styles.meta}>{tx.fecha_hora.replace('T', ' ')}</Text>
      {tx.cliente_proveedor ? (
        <Text style={styles.meta}>{tx.cliente_proveedor}</Text>
      ) : null}
      {tx.motivo ? <Text style={styles.meta}>Motivo: {tx.motivo}</Text> : null}

      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.nombre}>{item.nombre_snapshot}</Text>
            <Text style={styles.cant}>×{item.cantidad}</Text>
            <Text style={styles.sub}>{formatCOP(item.subtotal)}</Text>
          </View>
        )}
      />

      {tx.tipo !== 'ajuste' && (
        <Text style={styles.total}>Total: {formatCOP(tx.total)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  tipo: { fontSize: 22, fontWeight: '800', color: '#111827' },
  meta: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  nombre: { flex: 1, fontSize: 15, color: '#111827' },
  cant: { fontSize: 14, color: '#6b7280' },
  sub: { fontSize: 15, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  total: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
    marginTop: 12,
  },
});
