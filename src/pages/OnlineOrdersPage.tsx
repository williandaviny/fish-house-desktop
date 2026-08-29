import React, { useState, useEffect } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { syncEngine } from '../services/database/supabaseSync';
import { useDatabase } from '../context/DatabaseContext';
import { PedidoOnline } from '../types/database';
import { ThermalPrinterService } from '../services/hardware/thermalPrinter';
import { 
  ShoppingBag, 
  Printer, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle, 
  RefreshCw, 
  Phone, 
  MapPin, 
  DollarSign 
} from 'lucide-react';

export const OnlineOrdersPage: React.FC = () => {
  const { config } = useDatabase();
  const [orders, setOrders] = useState<PedidoOnline[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    await syncEngine.checkNewOnlineOrders();
    const list = await sqliteService.getPedidosOnline(statusFilter);
    setOrders(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: PedidoOnline['status']) => {
    await sqliteService.atualizarStatusPedidoOnline(id, newStatus);
    fetchOrders();
  };

  const handlePrintComanda = (pedido: PedidoOnline) => {
    if (config) {
      ThermalPrinterService.printComandaOnline(pedido, config);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/30">
      {/* Barra de Filtros e Atualização */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['all', 'novo', 'em_preparo', 'saiu_entrega', 'entregue'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'all' ? 'Todos os Pedidos' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sincronizar Pedidos Web</span>
        </button>
      </div>

      {/* Grade de Pedidos */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
        {orders.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500">
            <ShoppingBag className="w-12 h-12 text-slate-700 mb-2" />
            <p className="font-semibold text-sm">Nenhum pedido online encontrado</p>
            <p className="text-xs text-slate-600">Novos pedidos feitos no site aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          orders.map(order => (
            <div
              key={order.id}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-md"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-black text-cyan-400 text-sm">{order.numero_pedido}</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    order.status === 'novo' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                    order.status === 'em_preparo' ? 'bg-blue-500/20 text-blue-400' :
                    order.status === 'saiu_entrega' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                  <p className="font-bold text-white text-sm">{order.cliente_nome}</p>
                  <p className="flex items-center gap-1 text-slate-400"><Phone className="w-3.5 h-3.5 text-cyan-400" /> {order.cliente_telefone}</p>
                  {order.cliente_endereco && (
                    <p className="flex items-center gap-1 text-slate-400"><MapPin className="w-3.5 h-3.5 text-cyan-400" /> {order.cliente_endereco}</p>
                  )}
                </div>

                {/* Itens */}
                <div className="mt-3 pt-2 border-t border-slate-900 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Itens Solicitados:</span>
                  {order.itens.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300">
                      <span><strong>{it.quantidade}x</strong> {it.produto_nome}</span>
                      <span className="font-mono text-slate-400">R$ {Number(it.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-base font-black text-emerald-400 font-mono">
                  R$ {Number(order.total).toFixed(2)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintComanda(order)}
                    title="Imprimir Comanda Térmica"
                    className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {order.status === 'novo' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'em_preparo')}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                    >
                      Aceitar
                    </button>
                  )}
                  {order.status === 'em_preparo' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'saiu_entrega')}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                    >
                      Despachar
                    </button>
                  )}
                  {order.status === 'saiu_entrega' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'entregue')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
