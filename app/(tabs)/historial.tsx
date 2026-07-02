import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { EmptyState, Screen } from '../../components/ui';
import { listarTransacciones } from '../../db/transacciones';
import type { TipoTransaccion, Transaccion } from '../../db/types';
import { formatCOP } from '../../db/util';
import {
  dateADiaStr,
  diaADate,
  fechaLarga,
  hoyStr,
  rangoDia,
  sumarDias,
} from '../../lib/fecha';
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
  const [dia, setDia] = useState(hoyStr());
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [items, setItems] = useState<Transaccion[]>([]);

  const esHoy = dia === hoyStr();
  const totalDia =
    filtro === 'venta' || filtro === 'compra'
      ? items.reduce((acc, t) => acc + t.total, 0)
      : 0;

  // Solo las operaciones del día seleccionado (recarga al cambiar día/tipo y al
  // volver a la pantalla).
  useFocusEffect(
    useCallback(() => {
      const { desde, hasta } = rangoDia(dia);
      listarTransacciones(db, {
        desde,
        hasta,
        ...(filtro === 'todos' ? {} : { tipo: filtro }),
      }).then(setItems);
    }, [db, filtro, dia])
  );

  return (
    <Screen padded>
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
          <Text style={styles.diaFecha}>{esHoy ? 'Hoy' : fechaLarga(dia)}</Text>
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

      {(filtro === 'venta' || filtro === 'compra') && (
        <View
          style={[
            styles.totalBar,
            filtro === 'compra' && styles.totalBarCompra,
          ]}
        >
          <Text style={styles.totalBarLabel}>
            {filtro === 'venta' ? 'Total ventas del día' : 'Total compras del día'}
          </Text>
          <Text
            style={[
              styles.totalBarValue,
              filtro === 'compra' && styles.totalBarValueCompra,
            ]}
          >
            {formatCOP(totalDia)}
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ gap: spacing.sm }}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Sin operaciones este día"
            subtitle={
              esHoy
                ? 'Las ventas, compras y ajustes de hoy aparecerán aquí.'
                : 'No hay operaciones registradas en la fecha seleccionada.'
            }
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
              <Text style={styles.fecha}>{item.fecha_hora.slice(11, 16)}</Text>
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
  diaNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  hoyBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '700' },
  filtros: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.venta + '14',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  totalBarCompra: { backgroundColor: colors.compra + '14' },
  totalBarLabel: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  totalBarValue: { fontSize: font.lg, fontWeight: '800', color: colors.venta },
  totalBarValueCompra: { color: colors.compra },
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
