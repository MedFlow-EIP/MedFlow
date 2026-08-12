import * as React from "react";
import { useMemo } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  className?: string;
  color?: string;
};

export function Button({
  title,
  children,
  onPress,
  variant = "default",
  size = "md",
  disabled = false,
  loading = false,
  style,
  textStyle,
  color,
}: ButtonProps) {
  const { colors } = useTheme();
  const variantStyles = useMemo(() => makeVariantStyles(colors), [colors]);
  const styles = useMemo(() => makeBaseStyles(), []);

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const label = title ?? children;
  const bgOverride = color ? { backgroundColor: color } : null;
  const accessibleLabel = typeof label === "string" ? label : title;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        s.container,
        v.container,
        bgOverride,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style as any,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.spinnerColor} />
      ) : (
        <Text style={[styles.textBase, s.text, v.text, textStyle as any]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function makeBaseStyles() {
  return StyleSheet.create({
    base: {
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      minHeight: 44,
      paddingHorizontal: 16,
    },
    textBase: {
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
  });
}

function makeVariantStyles(
  colors: ThemeColors
): Record<Variant, { container: ViewStyle; text: TextStyle; spinnerColor: string }> {
  return {
    default: {
      container: { backgroundColor: colors.textPrimary },
      text: { color: colors.background },
      spinnerColor: colors.background,
    },
    secondary: {
      container: { backgroundColor: colors.surfaceAlt },
      text: { color: colors.textPrimary },
      spinnerColor: colors.textPrimary,
    },
    outline: {
      container: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.border,
      },
      text: { color: colors.textPrimary },
      spinnerColor: colors.textPrimary,
    },
    ghost: {
      container: { backgroundColor: "transparent" },
      text: { color: colors.textPrimary },
      spinnerColor: colors.textPrimary,
    },
  };
}

const sizeStyles: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { minHeight: 36, paddingHorizontal: 12 },
    text: { fontSize: 14 },
  },
  md: {
    container: { minHeight: 44, paddingHorizontal: 16 },
    text: { fontSize: 16 },
  },
  lg: {
    container: { minHeight: 52, paddingHorizontal: 18 },
    text: { fontSize: 18 },
  },
};