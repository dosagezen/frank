import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Estado do menu mobile
  const [isOpen, setIsOpen] = useState(false);
  
  // Estado do colapso (desktop) - auto-colapsar em telas < 1440px
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      return saved === 'true';
    }
    // Se não há preferência salva, colapsar em telas < 1440px
    return window.innerWidth < 1440;
  });

  // Salvar estado no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Ajustar sidebar ao redimensionar a janela (opcional, com debounce)
  useEffect(() => {
    let timeoutId: number;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        // Só ajusta automaticamente se o usuário não tiver preferência manual salva
        const hasManualPreference = localStorage.getItem('sidebar-collapsed') !== null;
        if (!hasManualPreference) {
          setIsCollapsed(window.innerWidth < 1440);
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar deve ser usado dentro de um SidebarProvider');
  }
  return context;
}