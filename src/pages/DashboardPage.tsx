import React, { useState, useEffect } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { DashboardMetrics, Venda } from '../types/database';
import { BarChart3, TrendingUp, DollarSign, Package, AlertTriangle, ShoppingCart } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await sqliteService.getDashboardMetrics();
      setMetrics(data);
    };
    load();
  }, []);

  if (!metrics) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-900/30 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-extrabold text-white">Relatórios & Visão Geral</h3>
        <p className="text-xs text-slate-400">Resumo de desempenho de vendas locais e produtos da Fish House.</p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Faturamento Hoje</span>
          <span className="text-2xl font-black text-emerald-400 font-mono block">
            R$ {metrics.faturamentoHoje.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">{metrics.totalVendasHoje} vendas realizadas</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ticket Médio Hoje</span>
          <span className="text-2xl font-black text-cyan-400 font-mono block">
            R$ {metrics.ticketMedioHoje.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">Média por cliente</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Faturamento do Mês</span>
          <span className="text-2xl font-black text-blue-400 font-mono block">
            R$ {metrics.faturamentoMes.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">Total acumulado</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total de Produtos</span>
          <span className="text-2xl font-black text-purple-400 font-mono block">
            {metrics.quantidadeProdutos}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">Cadastrados no SQLite</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vendas Recentes */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-cyan-400" />
            <span>Últimas Vendas Realizadas</span>
          </h4>

          {metrics.vendasRecentes.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Nenhuma venda realizada ainda.</p>
          ) : (
            <div className="divide-y divide-slate-900">
              {metrics.vendasRecentes.map(v => (
                <div key={v.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white font-mono">#{v.numero_venda}</span>
                    <span className="text-slate-400 ml-2">{v.forma_pagamento}</span>
                  </div>
                  <span className="font-mono font-black text-emerald-400">R$ {Number(v.valor_final).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas de Estoque Baixo */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Produtos com Estoque Baixo (&le; 5)</span>
          </h4>

          {metrics.produtosEstoqueBaixo.length === 0 ? (
            <p className="text-xs text-emerald-400 py-6 text-center">Todos os estoques estão normais!</p>
          ) : (
            <div className="divide-y divide-slate-900">
              {metrics.produtosEstoqueBaixo.map(p => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="font-mono font-black text-amber-400">{Number(p.stock).toFixed(2)} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
