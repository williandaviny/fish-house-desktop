import React, { useState } from 'react';
import { DatabaseProvider, useDatabase } from './context/DatabaseContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PDVPage } from './pages/PDVPage';
import { OnlineOrdersPage } from './pages/OnlineOrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { TarasPage } from './pages/TarasPage';
import { CashRegisterPage } from './pages/CashRegisterPage';
import { SyncSettingsPage } from './pages/SyncSettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isReady } = useDatabase();
  const [activeTab, setActiveTab] = useState('pdv');

  if (!isReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <h2 className="text-lg font-bold">Carregando Fish House Desktop...</h2>
        <p className="text-xs text-slate-500 mt-1">Inicializando banco de dados local SQLite</p>
      </div>
    );
  }

  const getTitle = () => {
    switch (activeTab) {
      case 'pdv': return { title: 'Frente de Caixa (PDV)', subtitle: 'Pressione F2 para buscar produtos, F10 para receber' };
      case 'orders': return { title: 'Pedidos Online & Delivery', subtitle: 'Pedidos sincronizados do site peixariafishhouse.com.br' };
      case 'products': return { title: 'Catálogo de Produtos', subtitle: 'Cadastro de peixes, frutos do mar, PLU e balança' };
      case 'taras': return { title: 'Taras de Balança (Toledo)', subtitle: 'Tabela oficial de taras para o MGV 7' };
      case 'cashier': return { title: 'Controle de Turno & Caixa', subtitle: 'Abertura, fechamento, sangrias e suprimentos' };
      case 'dashboard': return { title: 'Relatórios Gerenciais', subtitle: 'Métricas de faturamento e vendas' };
      case 'sync': return { title: 'Sincronização & Nuvem', subtitle: 'Integração Supabase e Backup Local' };
      default: return { title: 'Fish House Desktop', subtitle: '' };
    }
  };

  const headerInfo = getTitle();

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={headerInfo.title} subtitle={headerInfo.subtitle} />
        {activeTab === 'pdv' && <PDVPage />}
        {activeTab === 'orders' && <OnlineOrdersPage />}
        {activeTab === 'products' && <ProductsPage />}
        {activeTab === 'taras' && <TarasPage />}
        {activeTab === 'cashier' && <CashRegisterPage />}
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'sync' && <SyncSettingsPage />}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <DatabaseProvider>
      <MainLayout />
    </DatabaseProvider>
  );
}
