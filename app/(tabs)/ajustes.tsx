import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getMargenGeneral, setConfig } from '../../db/configuracion';

export default function AjustesScreen() {
  const db = useSQLiteContext();
  const [margen, setMargen] = useState('');

  useFocusEffect(
    useCallback(() => {
      getMargenGeneral(db).then((m) => setMargen(String(m)));
    }, [db])
  );

  const guardar = async () => {
    const n = Number(margen);
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Margen inválido', 'Ingresa un porcentaje válido.');
      return;
    }
    await setConfig(db, 'margen_general_pct', String(n));
    Alert.alert('Guardado', `Margen general: ${n}%`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Margen general (%)</Text>
      <Text style={styles.help}>
        Se usa para sugerir precios en modo “calcular con margen”, salvo que el
        producto tenga su propio margen.
      </Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={margen}
        onChangeText={setMargen}
      />
      <Pressable style={styles.btn} onPress={guardar}>
        <Text style={styles.btnText}>Guardar</Text>
      </Pressable>

      <View style={styles.respaldo}>
        <Text style={styles.label}>Respaldo</Text>
        <Text style={styles.help}>
          Estado de sincronización con Firestore. (Pendiente: integrar el espejo
          de respaldo — JS SDK, sincroniza con la app abierta y con red.)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontSize: 16, fontWeight: '700', color: '#111827' },
  help: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  respaldo: {
    marginTop: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
  },
});
