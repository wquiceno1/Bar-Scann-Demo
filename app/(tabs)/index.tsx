import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function OperarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>¿Qué quieres registrar?</Text>

      <Link href="/transaccion/venta" asChild>
        <Pressable style={[styles.btn, styles.venta]}>
          <Text style={styles.btnText}>Nueva venta</Text>
        </Pressable>
      </Link>

      <Link href="/transaccion/compra" asChild>
        <Pressable style={[styles.btn, styles.compra]}>
          <Text style={styles.btnText}>Nueva compra</Text>
        </Pressable>
      </Link>

      <Link href="/transaccion/ajuste" asChild>
        <Pressable style={[styles.btn, styles.ajuste]}>
          <Text style={styles.btnText}>Ajuste de inventario</Text>
        </Pressable>
      </Link>

      <Link href="/carga-inicial" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Carga inicial del catálogo</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, justifyContent: 'center' },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  btn: { paddingVertical: 28, borderRadius: 16, alignItems: 'center' },
  venta: { backgroundColor: '#16a34a' },
  compra: { backgroundColor: '#2563eb' },
  ajuste: { backgroundColor: '#d97706' },
  btnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  secondary: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  secondaryText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
});
