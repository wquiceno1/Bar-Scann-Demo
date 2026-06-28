import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useFocusEffect } from 'expo-router';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Props = {
  /** Se llama una vez por lectura. El padre decide cuándo reanudar con `paused`. */
  onScan: (code: string) => void;
  /** Mientras true, se ignoran las lecturas (anti-metralleta). */
  paused?: boolean;
};

/**
 * Cámara a pantalla completa con lectura de EAN/UPC. Extraído de la demo:
 * mantiene la cámara viva e ignora lecturas mientras `paused` está activo,
 * y además aplica un debounce interno para no disparar dos veces el mismo gesto.
 */
export default function ScannerView({ onScan, paused = false }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cooldown, setCooldown] = useState(false);
  // La cámara se monta solo cuando la pantalla está enfocada. Al navegar a otra
  // pantalla y volver, esto fuerza un remount limpio: sin esto la CameraView
  // se queda en negro al regresar.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  if (!permission) {
    return <View style={styles.fill} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Necesitamos acceso a la cámara para escanear los códigos de barras de
          los productos.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Conceder permiso</Text>
        </Pressable>
      </View>
    );
  }

  const handle = ({ data }: BarcodeScanningResult) => {
    if (paused || cooldown) return;
    setCooldown(true);
    onScan(data);
    setTimeout(() => setCooldown(false), 800);
  };

  if (!focused) {
    return <View style={styles.fill} />;
  }

  const active = !paused && !cooldown;

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
      onBarcodeScanned={active ? handle : undefined}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#1f2937',
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
