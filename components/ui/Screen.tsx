import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing } from '../../theme/tokens';

type Props = {
  children: React.ReactNode;
  /** Aplica padding estándar al contenedor. */
  padded?: boolean;
  /**
   * Envuelve el contenido en un ScrollView. Úsalo en pantallas con formularios
   * que no tengan su propia lista, para que el contenido suba con el teclado.
   */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Contenedor de pantalla con el fondo de la app y manejo del teclado. */
export default function Screen({
  children,
  padded = false,
  scroll = false,
  style,
}: Props) {
  // behavior="padding" empuja el contenido midiendo el teclado por JS, sin
  // depender del resize nativo (que con edge-to-edge de SDK 54 no es fiable
  // en Android).
  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            padded && styles.padded,
            style,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.inner, padded && styles.padded, style]}>
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { padding: spacing.lg },
});
