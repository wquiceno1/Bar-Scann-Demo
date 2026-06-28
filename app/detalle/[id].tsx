import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card, Screen } from '../../components/ui';
import { getTransaccion } from '../../db/transacciones';
import type { Transaccion, TransaccionItem } from '../../db/types';
import { formatCOP } from '../../db/util';
import { colors, font, spacing } from '../../theme/tokens';

const ETIQUETA: Record<Transaccion['tipo'], string> = {
  venta: 'Venta',
  compra: 'Compra',
  ajuste: 'Ajuste',
};

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
      <Screen padded>
        <Text style={styles.meta}>Operación no encontrada.</Text>
      </Screen>
    );
  }

  return (
    <Screen padded>
      <Text style={styles.tipo}>{ETIQUETA[tx.tipo]}</Text>
      <Text style={styles.meta}>{tx.fecha_hora.replace('T', ' ')}</Text>
      {tx.cliente_proveedor ? (
        <Text style={styles.meta}>{tx.cliente_proveedor}</Text>
      ) : null}
      {tx.motivo ? <Text style={styles.meta}>Motivo: {tx.motivo}</Text> : null}

      <Card flat style={styles.list}>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.nombre}>{item.nombre_snapshot}</Text>
              <Text style={styles.cant}>×{item.cantidad}</Text>
              <Text style={styles.sub}>{formatCOP(item.subtotal)}</Text>
            </View>
          )}
        />
      </Card>

      {tx.tipo !== 'ajuste' && (
        <Text style={styles.total}>Total: {formatCOP(tx.total)}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tipo: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  list: { marginTop: spacing.lg, padding: spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  nombre: { flex: 1, fontSize: font.md, color: colors.text },
  cant: { fontSize: font.sm, color: colors.textMuted },
  sub: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
    minWidth: 80,
    textAlign: 'right',
  },
  total: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.lg,
  },
});
