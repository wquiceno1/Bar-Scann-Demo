import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Card, Input, Screen } from '../../components/ui';
import { actualizarProducto, getProducto } from '../../db/productos';
import type { Producto } from '../../db/types';
import { formatCOP } from '../../db/util';
import { toast } from '../../lib/feedback';
import { colors, font, spacing } from '../../theme/tokens';

export default function ProductoScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const [prod, setProd] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
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

        <Button
          label="Guardar cambios"
          icon="save"
          onPress={guardar}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  meta: { fontSize: font.sm, color: colors.textMuted },
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
});
