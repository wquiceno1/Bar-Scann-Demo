import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import ScannerView from '../components/ScannerView';
import { getProducto } from '../db/productos';

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
      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Escanea cada producto de la tienda para darlo de alta con su conteo
          inicial.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  hint: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 14,
  },
  hintText: { color: '#fff', textAlign: 'center', fontSize: 14 },
});
