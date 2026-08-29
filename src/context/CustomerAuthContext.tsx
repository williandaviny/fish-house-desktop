import React, { createContext, useContext, useState, useEffect } from 'react';

interface CustomerAuthContextType {
  customerPhone: string | null;
  login: (phone: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);

  // Carregar do localStorage ao iniciar e verificar login automático na URL
  useEffect(() => {
    const savedPhone = localStorage.getItem('fishhouse_customer_phone');
    if (savedPhone) {
      setCustomerPhone(savedPhone);
    }

    // Login automático via link (parâmetro ?phone na URL)
    const params = new URLSearchParams(window.location.search);
    const urlPhone = params.get('phone');
    if (urlPhone) {
      const cleanPhone = urlPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) { // Telefone com DDD pelo menos
        setCustomerPhone(cleanPhone);
        localStorage.setItem('fishhouse_customer_phone', cleanPhone);
        
        // Limpar o parâmetro 'phone' da URL sem recarregar a página
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const login = (phone: string) => {
    // Normalizar o número (remover caracteres não numéricos)
    const cleanPhone = phone.replace(/\D/g, '');
    setCustomerPhone(cleanPhone);
    localStorage.setItem('fishhouse_customer_phone', cleanPhone);
  };

  const logout = () => {
    setCustomerPhone(null);
    localStorage.removeItem('fishhouse_customer_phone');
  };

  return (
    <CustomerAuthContext.Provider value={{
      customerPhone,
      login,
      logout,
      isAuthenticated: !!customerPhone
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
