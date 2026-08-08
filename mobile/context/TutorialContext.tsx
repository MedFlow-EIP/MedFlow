import React, { createContext, useContext, useState } from 'react';

type TutorialContextValue = {
  visible: boolean;
  show: () => void;
  hide: () => void;
};

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const value: TutorialContextValue = {
    visible,
    show: () => setVisible(true),
    hide: () => setVisible(false),
  };

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial() doit être utilisé à l\'intérieur de <TutorialProvider>');
  }
  return ctx;
}