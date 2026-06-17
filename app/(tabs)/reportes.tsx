import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  totalPorTipo,
  utilidadPeriodo,
  valorInventario,
} from '../../db/reportes';
import { formatCOP } from '../../db/util';

// Rango del mes actual en ISO local.
function rangoMesActual(): { desde: string; hasta: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { desde: `${y}-${m}-01T00:00:00`, hasta: `${y}-${m}-31T23:59:59` };
}

type Datos = {
  alCosto: number;
  alPrecio: number;
  ventas: number;
  compras: number;
  utilidad: number;
};

export default function ReportesScreen() {
  const db = useSQLiteContext();
  const [d, setD] = useState<Datos | null>(null);

  useFocusEffect(
    useCallback(() => {
      const { desde, hasta } = rangoMesActual();
      Promise.all([
        valorInventario(db),
        totalPorTipo(db, 'venta', desde, hasta),
        totalPorTipo(db, 'compra', desde, hasta),
        utilidadPeriodo(db, desde, hasta),
      ]).then(([inv, ventas, compras, util]) =>
        setD({
          alCosto: inv.alCosto,
          alPrecio: inv.alPrecio,
          ventas,
          compras,
          utilidad: util.utilidad,
        })
      );
    }, [db])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 12 }}>
      <Text style={styles.section}>Inventario actual</Text>
      <Card label="Valor al costo (inversión)" value={d?.alCosto} />
      <Card label="Valor al precio de venta" value={d?.alPrecio} />

      <Text style={styles.section}>Este mes</Text>
      <Card label="Ventas" value={d?.ventas} />
      <Card label="Compras" value={d?.compras} />
      <Card label="Utilidad (ventas − costo vendido)" value={d?.utilidad} />

      {/* TODO: gráfico de serie diaria con react-native-chart-kit. */}
    </ScrollView>
  );
}

function Card({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>
        {value == null ? '—' : formatCOP(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardLabel: { fontSize: 14, color: '#6b7280' },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
});
