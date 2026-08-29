import React, { createContext, useContext, useEffect, useState } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { syncEngine } from '../services/database/supabaseSync';
import { CaixaSessao, EmpresaConfig } from '../types/database';

interface DatabaseContextType {
  isReady: boolean;
  activeCaixa: CaixaSessao | null;
  config: EmpresaConfig | null;
  refreshCaixa: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  activeCaixa: null,
  config: null,
  refreshCaixa: async () => {},
  refreshConfig: async () => {}
});

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [activeCaixa, setActiveCaixa] = useState<CaixaSessao | null>(null);
  const [config, setConfig] = useState<EmpresaConfig | null>(null);

  const refreshCaixa = async () => {
    try {
      const caixa = await sqliteService.getCaixaAberto();
      setActiveCaixa(caixa);
    } catch (e) {
      console.error('Erro ao buscar caixa:', e);
    }
  };

  const refreshConfig = async () => {
    try {
      const cfg = await sqliteService.getConfig();
      setConfig(cfg);
    } catch (e) {
      console.error('Erro ao buscar config:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await sqliteService.init();
        await refreshConfig();
        await refreshCaixa();
        setIsReady(true);

        // Inicia sincronização em segundo plano
        syncEngine.startBackgroundSync();
      } catch (err) {
        console.error('Falha ao inicializar SQLite:', err);
      }
    };
    init();
  }, []);

  return (
    <DatabaseContext.Provider value={{ isReady, activeCaixa, config, refreshCaixa, refreshConfig }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => useContext(DatabaseContext);
