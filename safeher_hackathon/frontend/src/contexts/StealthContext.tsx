import React, { createContext, useContext, useState, useCallback } from "react";

interface StealthContextType {
  isStealthMode: boolean;
  toggleStealthMode: () => void;
  setStealthMode: (value: boolean) => void;
}

const StealthContext = createContext<StealthContextType | undefined>(undefined);

export function StealthProvider({ children }: { children: React.ReactNode }) {
  const [isStealthMode, setIsStealthMode] = useState(() => {
    return sessionStorage.getItem("stealth_mode") === "true";
  });

  const toggleStealthMode = useCallback(() => {
    setIsStealthMode((prev) => {
      const next = !prev;
      sessionStorage.setItem("stealth_mode", String(next));
      return next;
    });
  }, []);

  const setStealthMode = useCallback((value: boolean) => {
    setIsStealthMode(value);
    sessionStorage.setItem("stealth_mode", String(value));
  }, []);

  return (
    <StealthContext.Provider value={{ isStealthMode, toggleStealthMode, setStealthMode }}>
      {children}
    </StealthContext.Provider>
  );
}

export function useStealth() {
  const context = useContext(StealthContext);
  if (!context) {
    throw new Error("useStealth must be used within a StealthProvider");
  }
  return context;
}
