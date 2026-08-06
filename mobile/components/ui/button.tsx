import * as React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";

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
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const label = title ?? children;
  const bgOverride = color ? { backgroundColor: color } : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
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

const styles = StyleSheet.create({
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

const variantStyles: Record<
  Variant,
  { container: ViewStyle; text: TextStyle; spinnerColor: string }
> = {
  default: {
    container: { backgroundColor: "#111827" },
    text: { color: "#ffffff" },
    spinnerColor: "#ffffff",
  },
  secondary: {
    container: { backgroundColor: "#f3f4f6" },
    text: { color: "#111827" },
    spinnerColor: "#111827",
  },
  outline: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: "#d1d5db",
    },
    text: { color: "#111827" },
    spinnerColor: "#111827",
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: "#111827" },
    spinnerColor: "#111827",
  },
};

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
