export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8080";

if (!process.env.EXPO_PUBLIC_API_URL) {
  console.warn(
    "[api] EXPO_PUBLIC_API_URL n'est pas défini, repli sur http://10.0.2.2:8080 " +
    "(alias localhost pour l'émulateur Android standard). "
  );
}