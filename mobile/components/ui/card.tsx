import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";


type RNViewProps = React.ComponentProps<typeof View>;
type RNTextProps = React.ComponentProps<typeof Text>;

type WithStyle<T> = T & { style?: StyleProp<any>; className?: string };

export function Card({ style, className, ...props }: WithStyle<RNViewProps>) {
  return (
    <View
      style={[styles.card, style as ViewStyle]}
      {...props}
    />
  );
}

export function CardHeader({ style, className, ...props }: WithStyle<RNViewProps>) {
  return (
    <View
      style={[styles.header, style as ViewStyle]}
      {...props}
    />
  );
}

export function CardTitle({ style, className, ...props }: WithStyle<RNTextProps>) {
  return (
    <Text
      style={[styles.title, style as TextStyle]}
      {...props}
    />
  );
}

export function CardDescription({ style, className, ...props }: WithStyle<RNTextProps>) {
  return (
    <Text
      style={[styles.description, style as TextStyle]}
      {...props}
    />
  );
}

export function CardAction({ style, className, ...props }: WithStyle<RNViewProps>) {
  return (
    <View
      style={[styles.action, style as ViewStyle]}
      {...props}
    />
  );
}

export function CardContent({ style, className, ...props }: WithStyle<RNViewProps>) {
  return (
    <View
      style={[styles.content, style as ViewStyle]}
      {...props}
    />
  );
}

export function CardFooter({ style, className, ...props }: WithStyle<RNViewProps>) {
  return (
    <View
      style={[styles.footer, style as ViewStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    overflow: "hidden",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,

    elevation: 3,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  description: {
    fontSize: 14,
    color: "#6b7280",
  },
  action: {
    alignSelf: "flex-end",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
