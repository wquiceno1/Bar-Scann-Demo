import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

type Props = {
  children: React.ReactNode;
  /** Aplica padding estándar al contenedor. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Contenedor de pantalla con el fondo de la app. */
export default function Screen({ children, padded = false, style }: Props) {
  return (
    <View style={[styles.screen, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
});
