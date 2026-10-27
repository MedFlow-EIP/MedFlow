import { Alert } from 'react-native';

// Remplaçant de Alert.alert (même signature) : affiche un dialogue aux
// couleurs de l'app au lieu de la boîte native Android/iOS. Le dialogue est
// rendu par <AppDialogHost /> (monté une fois dans App.tsx) ; sans hôte
// monté (tests, écran de démarrage), on retombe sur l'alerte native.

export type AppAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AppAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

type Listener = (request: AppAlertRequest) => void;

let listener: Listener | null = null;
let nextId = 1;

/** Branché par AppDialogHost ; renvoie la fonction de débranchement. */
export function registerAppAlertHost(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]): void {
  if (!listener) {
    // Arguments transmis tels quels : même comportement que Alert.alert.
    if (buttons) Alert.alert(title, message, buttons);
    else Alert.alert(title, message);
    return;
  }
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  listener({ id: nextId++, title, message, buttons: list });
}
