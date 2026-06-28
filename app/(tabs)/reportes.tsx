import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LineChart } from 'react-native-chart-kit';
import { Card, Screen } from '../../components/ui';
import {
  serieDiaria,
  totalPorTipo,
  utilidadPeriodo,
  valorInventario,
  type SerieDia,
} from '../../db/reportes';
import { formatCOP } from '../../db/util';
import { colors, font, radius, spacing } from '../../theme/tokens';

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
  serie: SerieDia[];
};

type IconName = keyof typeof Ionicons.glyphMap;

const chartWidth = Dimensions.get('window').width - spacing.lg * 2;

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
        serieDiaria(db, 'venta', desde, hasta),
      ]).then(([inv, ventas, compras, util, serie]) =>
        setD({
          alCosto: inv.alCosto,
          alPrecio: inv.alPrecio,
          ventas,
          compras,
          utilidad: util.utilidad,
          serie,
        })
      );
    }, [db])
  );

  const serie = d?.serie ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Ventas por día (este mes)</Text>
        <Card style={styles.chartCard}>
          {serie.length > 0 ? (
            <LineChart
              data={{
                labels: serie.map((s) => s.dia.slice(8, 10)),
                datasets: [{ data: serie.map((s) => s.total) }],
              }}
              width={chartWidth - spacing.lg * 2}
              height={200}
              yAxisLabel="$"
              formatYLabel={(v) => abreviar(Number(v))}
              chartConfig={CHART_CONFIG}
              bezier
              style={{ borderRadius: radius.md }}
            />
          ) : (
            <View style={styles.chartEmpty}>
              <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
              <Text style={styles.chartEmptyText}>
                Aún no hay ventas este mes.
              </Text>
            </View>
          )}
        </Card>

        <Text style={styles.section}>Inventario actual</Text>
        <Kpi icon="cube" label="Valor al costo (inversión)" value={d?.alCosto} />
        <Kpi
          icon="pricetag"
          label="Valor al precio de venta"
          value={d?.alPrecio}
        />

        <Text style={styles.section}>Este mes</Text>
        <Kpi icon="cart" label="Ventas" value={d?.ventas} color={colors.venta} />
        <Kpi
          icon="download"
          label="Compras"
          value={d?.compras}
          color={colors.compra}
        />
        <Kpi
          icon="trending-up"
          label="Utilidad (ventas − costo vendido)"
          value={d?.utilidad}
          color={colors.venta}
          big
        />
      </ScrollView>
    </Screen>
  );
}

/** Abrevia montos grandes para los ejes (12500 → '12k'). */
function abreviar(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000) return Math.round(v / 1_000) + 'k';
  return String(Math.round(v));
}

const CHART_CONFIG = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (o = 1) => `rgba(37, 99, 235, ${o})`, // primary
  labelColor: () => colors.textMuted,
  propsForDots: { r: '3', strokeWidth: '1', stroke: colors.primary },
};

function Kpi({
  icon,
  label,
  value,
  color = colors.text,
  big = false,
}: {
  icon: IconName;
  label: string;
  value?: number;
  color?: string;
  big?: boolean;
}) {
  return (
    <Card style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '1a' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={[styles.kpiValue, big && styles.kpiValueBig, { color }]}>
          {value == null ? '—' : formatCOP(value)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  section: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  chartCard: { alignItems: 'center', paddingHorizontal: spacing.sm },
  chartEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  chartEmptyText: { color: colors.textMuted, fontSize: font.sm },
  kpi: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: font.sm, color: colors.textMuted },
  kpiValue: { fontSize: font.xl, fontWeight: '800', marginTop: 2 },
  kpiValueBig: { fontSize: font.xxl },
});
