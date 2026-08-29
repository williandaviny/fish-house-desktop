import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  Scale, 
  DollarSign, 
  ShoppingBag, 
  BarChart3, 
  CloudSync, 
  Settings,
  Fish
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onlineOrdersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onlineOrdersCount = 0 }) => {
  const navItems = [
    { id: 'pdv', label: 'PDV (Caixa)', icon: ShoppingCart, highlight: true },
    { id: 'orders', label: 'Pedidos Web', icon: ShoppingBag, badge: onlineOrdersCount },
    { id: 'products', label: 'Produtos', icon: Package },
    { id: 'taras', label: 'Taras Balança', icon: Scale },
    { id: 'cashier', label: 'Turno & Caixa', icon: DollarSign },
    { id: 'dashboard', label: 'Relatórios', icon: BarChart3 },
    { id: 'sync', label: 'Nuvem & Backup', icon: CloudSync },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Logo */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black">
            <Fish className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Fish House
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">DESKTOP</span>
            </h1>
            <p className="text-xs text-slate-400">Peixaria Premium</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-900/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            SQLite Offline-First
          </span>
          <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
            v1.0.0
          </span>
        </div>
      </div>
    </aside>
  );
};
