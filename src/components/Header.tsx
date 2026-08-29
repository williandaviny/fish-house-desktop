import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Cloud, Wifi, Clock, User, ShieldCheck } from 'lucide-react';

export const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const { activeCaixa } = useDatabase();
  const [time, setTime] = useState(new Date().toLocaleTimeString('pt-BR'));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Status Caixa */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
          <div className={`w-2 h-2 rounded-full ${activeCaixa ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
          <span className="text-slate-300 font-medium">
            {activeCaixa ? `Caixa Aberto (${activeCaixa.operador_nome})` : 'Caixa Fechado'}
          </span>
        </div>

        {/* Relógio */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{time}</span>
        </div>

        {/* Indicador Nuvem */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
          <Cloud className="w-3.5 h-3.5" />
          <span className="font-semibold">Nuvem Pronta</span>
        </div>
      </div>
    </header>
  );
};
