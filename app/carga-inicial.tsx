import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import ScannerView from '../components/ScannerView';
import { getProducto } from '../db/productos';
import { colors, font, radius, spacing } from '../theme/tokens';

/**
 * Modo de puesta en marcha: escaneo continuo. Cada código desconocido salta al
 * alta con el barcode precargado; los ya existentes muestran su estado para
 * corregir el conteo desde el catálogo.
 */
export default function CargaInicialScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [paused, setPaused] = useState(false);

  const onScan = useCallback(
    async (code: string) => {
      setPaused(true);
      const prod = await getProducto(db, code);
      if (prod) {
        Alert.alert(
          'Ya existe',
          `${prod.nombre}\nStock actual: ${prod.stock_actual}`,
          [
            { text: 'Seguir escaneando', onPress: () => setPaused(false) },
            {
              text: 'Editar',
              onPress: () => {
                setPaused(false);
                router.push(`/producto/${prod.barcode}`);
              },
            },
          ]
        );
      } else {
        router.push(`/producto/nuevo?barcode=${code}`);
        setPaused(false);
      }
    },
    [db, router]
  );

  return (
    <View style={styles.container}>
      <ScannerView onScan={onScan} paused={paused} />
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => router.push('/producto/nuevo?granel=1')}
          style={({ pressed }) => [styles.granelBtn, pressed && styles.pressed]}
        >
          <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
          <Text style={styles.granelBtnText}>
            Agregar producto sin código (granel)
          </Text>
        </Pressable>
        <View style={styles.hint}>
          <Ionicons name="scan-outline" size={20} color={colors.textInverse} />
          <Text style={styles.hintText}>
            O escanea cada producto para darlo de alta con su conteo inicial.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  pressed: { opacity: 0.85 },
  bottomBar: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
  },
  granelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  granelBtnText: { color: colors.primary, fontSize: font.md, fontWeight: '700' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.overlay,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  hintText: {
    color: colors.textInverse,
    textAlign: 'center',
    fontSize: font.sm,
    flex: 1,
  },
});
