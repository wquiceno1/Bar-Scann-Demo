import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme/tokens';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Sin sombra ni padding interno; útil para filas de lista. */
  flat?: boolean;
};

export default function Card({ children, style, flat = false }: Props) {
  return (
    <View style={[styles.card, flat ? styles.flat : shadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  flat: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
