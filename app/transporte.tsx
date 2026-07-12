import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Card, Input, Screen } from '../components/ui';
import {
  crearTransporte,
  eliminarTransporte,
  listarTransportes,
  type Transporte,
} from '../db/transportes';
import { formatCOP } from '../db/util';
import { dateADiaStr, diaADate, fechaLarga, hoyStr } from '../lib/fecha';
import { toast } from '../lib/feedback';
import { colors, font, radius, spacing } from '../theme/tokens';

/** Hora local 'HH:mm:ss' para completar la fecha_hora del registro. */
function horaActual(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function TransporteScreen() {
  const db = useSQLiteContext();
  const [monto, setMonto] = useState('');
  const [transportador, setTransportador] = useState('');
  const [detalle, setDetalle] = useState('');
  const [fecha, setFecha] = useState(hoyStr());
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [lista, setLista] = useState<Transporte[]>([]);

  const recargar = useCallback(() => {
    listarTransportes(db).then(setLista);
  }, [db]);

  useFocusEffect(recargar);

  const guardar = async () => {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un valor mayor a 0.');
      return;
    }
    setGuardando(true);
    try {
      await crearTransporte(db, {
        monto: n,
        transportador,
        detalle,
        fecha_hora: `${fecha}T${horaActual()}`,
      });
      toast('Transporte registrado');
      setMonto('');
      setTransportador('');
      setDetalle('');
      setFecha(hoyStr());
      recargar();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = (t: Transporte) => {
    Alert.alert(
      'Borrar registro',
      `¿Eliminar el transporte de ${formatCOP(t.monto)}${
        t.transportador ? ` (${t.transportador})` : ''
      }?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await eliminarTransporte(db, t.id);
            recargar();
          },
        },
      ]
    );
  };

  return (
    <Screen padded scroll>
      <Stack.Screen options={{ title: 'Costo de transporte' }} />

      <Card style={styles.form}>
        <Input
          label="Monto pagado (COP)"
          keyboardType="numeric"
          value={monto}
          onChangeText={setMonto}
          placeholder="0"
        />
        <Input
          label="Transportador (opcional)"
          value={transportador}
          onChangeText={setTransportador}
          placeholder="Quién hizo el flete"
        />
        <Input
          label="Detalle (opcional)"
          value={detalle}
          onChangeText={setDetalle}
          placeholder="Ej. flete de mercadería del proveedor"
          multiline
        />
        <View style={styles.fechaWrap}>
          <Text style={styles.fechaLabel}>Fecha</Text>
          <Pressable
            style={styles.fechaBtn}
            onPress={() => setMostrarPicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.fechaTexto}>
              {fecha === hoyStr() ? 'Hoy' : fechaLarga(fecha)}
            </Text>
          </Pressable>
        </View>
        <Button
          label="Guardar"
          icon="save"
          variant="transporte"
          loading={guardando}
          onPress={guardar}
        />
      </Card>

      {mostrarPicker && (
        <DateTimePicker
          value={diaADate(fecha)}
          mode="date"
          maximumDate={new Date()}
          onChange={(event, selected) => {
            setMostrarPicker(false);
            if (event.type === 'set' && selected) {
              setFecha(dateADiaStr(selected));
            }
          }}
        />
      )}

      <Text style={styles.section}>Registros</Text>
      {lista.length === 0 ? (
        <Text style={styles.vacio}>
          Aún no hay costos de transporte registrados.
        </Text>
      ) : (
        <Card flat style={styles.lista}>
          {lista.map((t, i) => (
            <View key={t.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowMonto}>{formatCOP(t.monto)}</Text>
                <Text style={styles.rowMeta}>
                  {t.fecha_hora.slice(0, 10)}
                  {t.transportador ? ` · ${t.transportador}` : ''}
                </Text>
                {t.detalle ? (
                  <Text style={styles.rowDetalle}>{t.detalle}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => borrar(t)} hitSlop={8}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  fechaWrap: { gap: spacing.xs },
  fechaLabel: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  fechaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fechaTexto: {
    fontSize: font.md,
    color: colors.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  section: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  vacio: { fontSize: font.md, color: colors.textMuted },
  lista: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowMonto: { fontSize: font.md, fontWeight: '800', color: colors.text },
  rowMeta: { fontSize: font.sm, color: colors.textMuted },
  rowDetalle: { fontSize: font.sm, color: colors.text },
});
