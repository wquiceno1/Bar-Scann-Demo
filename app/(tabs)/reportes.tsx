import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LineChart } from 'react-native-chart-kit';
import { Card, Screen } from '../../components/ui';
import {
  resumenVentasDia,
  serieDiaria,
  totalPorTipo,
  utilidadPeriodo,
  valorInventario,
  type ResumenDia,
  type SerieDia,
} from '../../db/reportes';
import { formatCOP } from '../../db/util';
import {
  dateADiaStr,
  diaADate,
  fechaLarga,
  hoyStr,
  sumarDias,
} from '../../lib/fecha';
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
  const [dia, setDia] = useState(hoyStr());
  const [resumen, setResumen] = useState<ResumenDia | null>(null);
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const esHoy = dia === hoyStr();

  // Resumen del día seleccionado: recarga al cambiar la fecha y al volver a la
  // pantalla (p. ej. tras registrar una venta).
  useFocusEffect(
    useCallback(() => {
      resumenVentasDia(db, dia).then(setResumen);
    }, [db, dia])
  );

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
        <Text style={styles.section}>Ventas del día</Text>
        <Card style={styles.diaCard}>
          <View style={styles.diaNav}>
            <Pressable
              onPress={() => setDia((x) => sumarDias(x, -1))}
              hitSlop={8}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setMostrarPicker(true)}
              style={styles.diaFechaBtn}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.diaFecha}>
                {esHoy ? 'Hoy' : fechaLarga(dia)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDia((x) => sumarDias(x, 1))}
              disabled={esHoy}
              hitSlop={8}
              style={[styles.navBtn, esHoy && styles.navBtnOff]}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          {!esHoy && (
            <Pressable onPress={() => setDia(hoyStr())} style={styles.hoyBtn}>
              <Ionicons name="today-outline" size={14} color={colors.primary} />
              <Text style={styles.hoyBtnText}>Volver a hoy</Text>
            </Pressable>
          )}
        </Card>

        <Kpi
          icon="cash"
          label="Total vendido"
          value={resumen?.total}
          color={colors.venta}
          big
        />
        <Kpi
          icon="receipt-outline"
          label="N° de ventas"
          value={resumen?.numVentas}
          conteo
        />
        <Kpi
          icon="cube-outline"
          label="Unidades vendidas"
          value={resumen?.unidades}
          conteo
        />
        <Kpi
          icon="trending-up"
          label="Utilidad del día"
          value={resumen?.utilidad}
          color={colors.venta}
        />

        {mostrarPicker && (
          <DateTimePicker
            value={diaADate(dia)}
            mode="date"
            maximumDate={new Date()}
            onChange={(event, selected) => {
              setMostrarPicker(false);
              if (event.type === 'set' && selected) {
                setDia(dateADiaStr(selected));
              }
            }}
          />
        )}

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
  conteo = false,
}: {
  icon: IconName;
  label: string;
  value?: number;
  color?: string;
  big?: boolean;
  conteo?: boolean;
}) {
  return (
    <Card style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '1a' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={[styles.kpiValue, big && styles.kpiValueBig, { color }]}>
          {value == null ? '—' : conteo ? String(value) : formatCOP(value)}
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
  diaCard: { gap: spacing.sm },
  diaNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.35 },
  diaFechaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  diaFecha: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'capitalize',
  },
  hoyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  hoyBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '700' },
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
