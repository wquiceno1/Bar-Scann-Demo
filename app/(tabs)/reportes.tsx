import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Card, Screen } from '../../components/ui';
import { getSalarioPct } from '../../db/configuracion';
import {
  deducciones,
  inventarioInicial,
  productosVendidos,
  resumenVentasDia,
  salidasColegio,
  totalPorTipo,
  valorInventario,
  type FilaDeduccion,
  type ResumenDia,
} from '../../db/reportes';
import { labelSubcat } from '../../db/salidas';
import { totalTransporte } from '../../db/transportes';
import { formatCOP } from '../../db/util';
import {
  compartirReportePdf,
  reporteInventarioInicial,
  reporteVentas,
  type ReportePdf,
} from '../../lib/reportePdf';
import {
  dateADiaStr,
  diaADate,
  fechaLarga,
  hoyStr,
  rangoDia,
  sumarDias,
} from '../../lib/fecha';
import { colors, font, spacing } from '../../theme/tokens';

/** Rango del mes en `offset` meses respecto al actual (0 = mes actual). */
function rangoMes(offset: number): { desde: string; hasta: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { desde: `${y}-${m}-01T00:00:00`, hasta: `${y}-${m}-31T23:59:59` };
}

/** Etiqueta legible del mes en `offset` meses respecto al actual: "Julio 2026". */
function labelMes(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const texto = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

type DatosMes = {
  ventas: number;
  compras: number;
  transporte: number;
  colegio: number;
  deducciones: number;
  deduccionesFilas: FilaDeduccion[];
};

/** Desglose de deducciones por subcategoría, para la nota del KPI. */
function desgloseDeducciones(filas?: FilaDeduccion[]): string | undefined {
  if (!filas || filas.length === 0) return undefined;
  return filas
    .map((f) => `${labelSubcat(f.subcategoria)}: ${formatCOP(f.total)}`)
    .join(' · ');
}

type Inventario = { alCosto: number; alPrecio: number };

type IconName = keyof typeof Ionicons.glyphMap;

export default function ReportesScreen() {
  const db = useSQLiteContext();
  const [d, setD] = useState<DatosMes | null>(null);
  const [inv, setInv] = useState<Inventario | null>(null);
  const [dia, setDia] = useState(hoyStr());
  const [resumen, setResumen] = useState<ResumenDia | null>(null);
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [mesOffset, setMesOffset] = useState(0);
  const [salarioPct, setSalarioPct] = useState(7);
  const [salarioAbierto, setSalarioAbierto] = useState(false);
  const [pdfCargando, setPdfCargando] = useState<
    null | 'inv' | 'histo' | 'dia' | 'mes'
  >(null);

  const esHoy = dia === hoyStr();
  const esMesActual = mesOffset === 0;

  // Base del salario del mes = ventas + compras + transporte + colegio +
  // deducciones. El salario es un % configurable (7% por defecto) de esa base.
  const salarioBase = d
    ? d.ventas + d.compras + d.transporte + d.colegio + d.deducciones
    : 0;
  const salario = Math.round((salarioBase * salarioPct) / 100);

  // Genera un PDF y abre el diálogo nativo de compartir/imprimir. `construir`
  // devuelve null cuando el reporte no tiene filas.
  const generarPdf = async (
    clave: NonNullable<typeof pdfCargando>,
    construir: () => Promise<ReportePdf | null>
  ) => {
    setPdfCargando(clave);
    try {
      const reporte = await construir();
      if (!reporte) {
        Alert.alert('Sin datos', 'No hay información para este reporte todavía.');
        return;
      }
      await compartirReportePdf(reporte);
    } catch (e) {
      Alert.alert(
        'No se pudo generar el PDF',
        (e as Error)?.message ?? 'Error desconocido.'
      );
    } finally {
      setPdfCargando(null);
    }
  };

  const pdfInventario = () =>
    generarPdf('inv', async () => {
      const { filas, total } = await inventarioInicial(db);
      return filas.length ? reporteInventarioInicial(filas, total) : null;
    });

  const pdfVentasHistorico = () =>
    generarPdf('histo', async () => {
      const { filas, total } = await productosVendidos(db);
      return filas.length ? reporteVentas(filas, total) : null;
    });

  const pdfVentasDia = () =>
    generarPdf('dia', async () => {
      const { filas, total } = await productosVendidos(db, rangoDia(dia));
      const etiqueta = esHoy ? 'Hoy' : fechaLarga(dia);
      return filas.length ? reporteVentas(filas, total, etiqueta) : null;
    });

  const pdfVentasMes = () =>
    generarPdf('mes', async () => {
      const { filas, total } = await productosVendidos(db, rangoMes(mesOffset));
      return filas.length ? reporteVentas(filas, total, labelMes(mesOffset)) : null;
    });

  // Resumen del día seleccionado: recarga al cambiar la fecha y al volver a la
  // pantalla (p. ej. tras registrar una venta).
  useFocusEffect(
    useCallback(() => {
      resumenVentasDia(db, dia).then(setResumen);
    }, [db, dia])
  );

  // Valor de inventario: es una foto del stock actual, no depende del mes
  // seleccionado — se recarga solo al volver a la pantalla.
  useFocusEffect(
    useCallback(() => {
      valorInventario(db).then(setInv);
    }, [db])
  );

  // Porcentaje del salario (configurable en Ajustes): se recarga al volver.
  useFocusEffect(
    useCallback(() => {
      getSalarioPct(db).then(setSalarioPct);
    }, [db])
  );

  useFocusEffect(
    useCallback(() => {
      const { desde, hasta } = rangoMes(mesOffset);
      Promise.all([
        totalPorTipo(db, 'venta', desde, hasta),
        totalPorTipo(db, 'compra', desde, hasta),
        totalTransporte(db, { desde, hasta }),
        salidasColegio(db, { desde, hasta }),
        deducciones(db, { desde, hasta }),
      ]).then(([ventas, compras, transporte, colegio, ded]) =>
        setD({
          ventas,
          compras,
          transporte,
          colegio: colegio.total,
          deducciones: ded.total,
          deduccionesFilas: ded.filas,
        })
      );
    }, [db, mesOffset])
  );

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

        <Text style={styles.section}>Inventario actual</Text>
        <Kpi
          icon="pricetag"
          label="Valor del inventario"
          value={inv?.alPrecio}
        />

        <Text style={styles.section}>Ventas por mes</Text>
        <Card style={styles.diaCard}>
          <View style={styles.diaNav}>
            <Pressable
              onPress={() => setMesOffset((x) => x - 1)}
              hitSlop={8}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.diaFecha}>{labelMes(mesOffset)}</Text>
            <Pressable
              onPress={() => setMesOffset((x) => x + 1)}
              disabled={esMesActual}
              hitSlop={8}
              style={[styles.navBtn, esMesActual && styles.navBtnOff]}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          {!esMesActual && (
            <Pressable onPress={() => setMesOffset(0)} style={styles.hoyBtn}>
              <Ionicons name="today-outline" size={14} color={colors.primary} />
              <Text style={styles.hoyBtnText}>Volver a este mes</Text>
            </Pressable>
          )}
        </Card>

        <Kpi icon="cart" label="Ventas" value={d?.ventas} color={colors.venta} />
        <Kpi
          icon="download"
          label="Compras"
          value={d?.compras}
          color={colors.compra}
        />
        <Kpi
          icon="bus"
          label="Transporte"
          value={d?.transporte}
          color={colors.transporte}
        />
        <Kpi
          icon="school"
          label="Entregado al colegio"
          value={d?.colegio}
          color={colors.salida}
        />
        <Kpi
          icon="exit"
          label="Deducciones"
          value={d?.deducciones}
          color={colors.salida}
          caption={desgloseDeducciones(d?.deduccionesFilas)}
        />

        <Card style={styles.salarioCard}>
          <Pressable
            style={styles.salarioHead}
            onPress={() => setSalarioAbierto((v) => !v)}
          >
            <View
              style={[
                styles.kpiIcon,
                { backgroundColor: colors.primary + '1a' },
              ]}
            >
              <Ionicons name="wallet" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kpiLabel}>Mi salario del mes ({salarioPct}%)</Text>
              <Text
                style={[
                  styles.kpiValue,
                  styles.kpiValueBig,
                  { color: colors.primary },
                ]}
              >
                {d == null ? '—' : formatCOP(salario)}
              </Text>
            </View>
            <Ionicons
              name={salarioAbierto ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
          {salarioAbierto && (
            <View style={styles.salarioBody}>
              <FilaSalario label="Ventas" value={d?.ventas} />
              <FilaSalario label="Compras" value={d?.compras} />
              <FilaSalario label="Transporte" value={d?.transporte} />
              <FilaSalario label="Entregado al colegio" value={d?.colegio} />
              <FilaSalario label="Deducciones" value={d?.deducciones} />
              <View style={styles.salarioDivider} />
              <FilaSalario label="Base (suma)" value={salarioBase} bold />
              <FilaSalario
                label={`Salario (${salarioPct}%)`}
                value={salario}
                bold
                color={colors.primary}
              />
            </View>
          )}
        </Card>

        <Text style={styles.section}>Reportes imprimibles</Text>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.pdfHelp}>
            Genera un PDF para imprimir o compartir por WhatsApp, correo o Drive.
          </Text>
          <Button
            label="Inventario inicial (PDF)"
            icon="cube-outline"
            variant="secondary"
            loading={pdfCargando === 'inv'}
            onPress={pdfInventario}
          />
          <Button
            label="Ventas — histórico completo (PDF)"
            icon="cart-outline"
            variant="secondary"
            loading={pdfCargando === 'histo'}
            onPress={pdfVentasHistorico}
          />
          <Button
            label={`Ventas del día (${esHoy ? 'Hoy' : fechaLarga(dia)})`}
            icon="calendar-outline"
            variant="secondary"
            loading={pdfCargando === 'dia'}
            onPress={pdfVentasDia}
          />
          <Button
            label={`Ventas del mes (${labelMes(mesOffset)})`}
            icon="calendar-number-outline"
            variant="secondary"
            loading={pdfCargando === 'mes'}
            onPress={pdfVentasMes}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Kpi({
  icon,
  label,
  value,
  color = colors.text,
  big = false,
  caption,
}: {
  icon: IconName;
  label: string;
  value?: number;
  color?: string;
  big?: boolean;
  caption?: string;
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
        {caption && <Text style={styles.kpiCaption}>{caption}</Text>}
      </View>
    </Card>
  );
}

/** Fila del desglose del salario: etiqueta a la izquierda, valor a la derecha. */
function FilaSalario({
  label,
  value,
  bold = false,
  color = colors.text,
}: {
  label: string;
  value?: number;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.filaSalario}>
      <Text style={[styles.filaLabel, bold && styles.filaBold]}>{label}</Text>
      <Text style={[styles.filaValue, bold && styles.filaBold, { color }]}>
        {value == null ? '—' : formatCOP(value)}
      </Text>
    </View>
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
  kpi: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfHelp: { fontSize: font.sm, color: colors.textMuted },
  kpiLabel: { fontSize: font.sm, color: colors.textMuted },
  kpiCaption: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  kpiValue: { fontSize: font.xl, fontWeight: '800', marginTop: 2 },
  kpiValueBig: { fontSize: font.xxl },
  salarioCard: { gap: spacing.sm },
  salarioHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  salarioBody: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  salarioDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  filaSalario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filaLabel: { fontSize: font.md, color: colors.textMuted },
  filaValue: { fontSize: font.md, color: colors.text, fontWeight: '600' },
  filaBold: { fontWeight: '800', color: colors.text },
});
