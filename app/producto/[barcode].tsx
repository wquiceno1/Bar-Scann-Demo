import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import ScannerView from '../../components/ScannerView';
import { Button, Card, Input, Screen } from '../../components/ui';
import {
  actualizarProducto,
  convertirASinCodigo,
  desactivarProducto,
  getProducto,
  reactivarProducto,
  reasignarCodigo,
} from '../../db/productos';
import type { Producto } from '../../db/types';
import { formatCOP } from '../../db/util';
import { toast } from '../../lib/feedback';
import { colors, font, radius, spacing } from '../../theme/tokens';

export default function ProductoScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const [prod, setProd] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [asignarVisible, setAsignarVisible] = useState(false);
  const [manual, setManual] = useState('');
  const [procesando, setProcesando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getProducto(db, barcode).then((p) => {
        setProd(p);
        if (p) {
          setNombre(p.nombre);
          setPrecio(String(p.precio));
        }
      });
    }, [db, barcode])
  );

  if (!prod) {
    return (
      <Screen padded>
        <Text style={styles.meta}>Producto no encontrado.</Text>
      </Screen>
    );
  }

  const activo = prod.activo === 1;

  const guardar = async () => {
    const precioNum = Number(precio);
    if (!nombre.trim() || !Number.isFinite(precioNum) || precioNum <= 0) {
      Alert.alert('Datos inválidos', 'Revisa el nombre y el precio.');
      return;
    }
    await actualizarProducto(db, prod.barcode, {
      nombre: nombre.trim(),
      precio: precioNum,
    });
    toast('Cambios guardados');
    router.back();
  };

  // Crea el producto con el código nuevo y retira el actual (estrategia B).
  const aplicarNuevoCodigo = async (codigo: string) => {
    const cod = codigo.trim();
    if (!cod) return;
    setProcesando(true);
    try {
      await reasignarCodigo(db, prod.barcode, cod, { sinCodigo: false });
      setAsignarVisible(false);
      setManual('');
      toast('Código reasignado');
      router.replace(`/producto/${cod}`);
    } catch (e) {
      setProcesando(false);
      Alert.alert('No se pudo reasignar', mensajeError(e));
    }
  };

  const convertir = () => {
    Alert.alert(
      'Convertir a sin código',
      'Se le asignará un código interno (INT-) y se buscará por nombre. El historial se conserva. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Convertir',
          onPress: async () => {
            setProcesando(true);
            try {
              const nuevo = await convertirASinCodigo(db, prod.barcode);
              toast('Convertido a sin código');
              router.replace(`/producto/${nuevo}`);
            } catch (e) {
              setProcesando(false);
              Alert.alert('Error', mensajeError(e));
            }
          },
        },
      ]
    );
  };

  const desactivar = () => {
    Alert.alert(
      'Desactivar producto',
      'Se ocultará del catálogo y de las búsquedas. El historial de ventas se conserva. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            await desactivarProducto(db, prod.barcode);
            toast('Producto desactivado');
            router.back();
          },
        },
      ]
    );
  };

  const reactivar = async () => {
    await reactivarProducto(db, prod.barcode);
    toast('Producto reactivado');
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {!activo && (
          <View style={styles.inactivoBanner}>
            <Ionicons name="archive-outline" size={18} color={colors.danger} />
            <Text style={styles.inactivoText}>
              Producto inactivo (oculto del catálogo).
            </Text>
          </View>
        )}

        <Card style={styles.stockCard}>
          <View style={styles.stockIcon}>
            <Ionicons name="cube" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stockLabel}>Stock actual</Text>
            <Text style={styles.stockValue}>{prod.stock_actual}</Text>
          </View>
        </Card>

        <Text style={styles.meta}>
          Código: {prod.barcode} · Costo:{' '}
          {prod.costo != null ? formatCOP(prod.costo) : '—'} · Modo:{' '}
          {prod.modo_precio}
        </Text>

        <Input label="Nombre" value={nombre} onChangeText={setNombre} />
        <Input
          label="Precio de venta (COP)"
          keyboardType="numeric"
          value={precio}
          onChangeText={setPrecio}
        />

        <Button label="Guardar cambios" icon="save" onPress={guardar} />

        {activo ? (
          <View style={styles.acciones}>
            <Text style={styles.accionesTitulo}>Código y estado</Text>
            <Button
              label="Asignar / cambiar código de barras"
              icon="barcode-outline"
              variant="secondary"
              onPress={() => setAsignarVisible(true)}
            />
            <Button
              label="Convertir a sin código (granel)"
              icon="pricetag-outline"
              variant="secondary"
              onPress={convertir}
            />
            <Button
              label="Desactivar producto"
              icon="archive-outline"
              variant="danger"
              onPress={desactivar}
            />
          </View>
        ) : (
          <View style={styles.acciones}>
            <Button
              label="Reactivar producto"
              icon="refresh"
              variant="venta"
              onPress={reactivar}
            />
          </View>
        )}
      </ScrollView>

      <Modal
        visible={asignarVisible}
        animationType="slide"
        onRequestClose={() => setAsignarVisible(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Asignar código</Text>
            <Pressable onPress={() => setAsignarVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.scanner}>
            <ScannerView onScan={aplicarNuevoCodigo} paused={procesando} />
            <View style={styles.scanHint}>
              <Ionicons name="scan-outline" size={16} color={colors.textInverse} />
              <Text style={styles.scanHintText}>
                Escanea el código correcto del producto
              </Text>
            </View>
          </View>
          <View style={styles.modalBody}>
            <Input
              label="O escribe el código a mano"
              value={manual}
              onChangeText={setManual}
              autoCapitalize="characters"
            />
            <Button
              label="Asignar este código"
              icon="checkmark-circle"
              loading={procesando}
              onPress={() => aplicarNuevoCodigo(manual)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  meta: { fontSize: font.sm, color: colors.textMuted },
  inactivoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.danger + '14',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inactivoText: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },
  stockCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stockIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockLabel: { fontSize: font.sm, color: colors.textMuted },
  stockValue: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  acciones: { gap: spacing.sm, marginTop: spacing.sm },
  accionesTitulo: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  modalTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  scanner: { height: 280, backgroundColor: '#000' },
  scanHint: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  scanHintText: { color: colors.textInverse, fontSize: font.xs },
  modalBody: { padding: spacing.lg, gap: spacing.md },
});
