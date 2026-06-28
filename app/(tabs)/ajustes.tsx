import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Card, Input, Screen } from '../../components/ui';
import { getMargenGeneral, setConfig } from '../../db/configuracion';
import { toast } from '../../lib/feedback';
import { colors, font, spacing } from '../../theme/tokens';

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
    toast(`Margen general guardado: ${n}%`);
  };

  return (
    <Screen padded>
      <Card style={{ gap: spacing.md }}>
        <Input
          label="Margen general (%)"
          hint="Se usa para sugerir precios en modo “calcular con margen”, salvo que el producto tenga su propio margen."
          keyboardType="numeric"
          value={margen}
          onChangeText={setMargen}
        />
        <Button label="Guardar" icon="save" onPress={guardar} />
      </Card>

      <Card style={[styles.respaldo, { gap: spacing.sm }]}>
        <View style={styles.respaldoHead}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
          <Text style={styles.respaldoTitle}>Respaldo</Text>
        </View>
        <Text style={styles.help}>
          Estado de sincronización con Firestore. Pendiente: integrar el espejo
          de respaldo (sincroniza con la app abierta y con red).
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: font.sm, color: colors.textMuted },
  respaldo: { marginTop: spacing.lg },
  respaldoHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  respaldoTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
});
