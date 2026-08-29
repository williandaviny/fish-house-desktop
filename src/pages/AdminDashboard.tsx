import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle,
  Package,
  Globe,
  Store,
  AlertTriangle,
  RefreshCcw,
  Calculator,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

type DashboardData = {
  // Financeiro consolidado
  totalHoje: number;
  onlineHoje: number;
  balcaoHoje: number;
  aReceberPendente: number;

  // Operações
  pedidosOnlinePendentes: number;
  pedidosOnlinePagos: number;
  caixaAberto: boolean;
  saldoCaixaInicial: number;
  totalVendasCaixa: number;

  // Estoque crítico
  produtosCriticos: { name: string; stock: number }[];

  // Últimos pedidos online
  ultimosPedidos: {
    id: string;
    customer_name: string;
    final_amount: number;
    order_status: string;
    payment_status: string;
    created_at: string;
  }[];

  // Gráfico 7 dias
  chart7d: {
    label: string;
    online: number;
    balcao: number;
  }[];
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  confirmed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  preparing: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  ready: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  delivered: 'text-green-400 bg-green-500/10 border-green-500/20',
  canceled: 'text-red-400 bg-red-500/10 border-red-500/20',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
  canceled: 'Cancelado',
  paid: 'Pago',
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchAll();

    // Real-time subscriptions
    const ch1 = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caixas' }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(ch1); };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // ─── Parallel queries ───────────────────────────────────────────
      const [
        ordersRes,
        vendasHojeRes,
        caixaRes,
        produtosRes,
        contasReceberRes,
        ultimosPedidosRes,
        vendasSemanaRes,
      ] = await Promise.all([
        // All orders today
        supabase.from('orders').select('id, payment_status, final_amount, order_status, created_at').gte('created_at', todayStart),
        // Physical sales today
        supabase.from('vendas').select('valor_final, created_at').eq('status', 'concluida').gte('created_at', todayStart),
        // Open cash drawer
        supabase.from('caixas').select('id, saldo_inicial, status').eq('status', 'aberto').order('created_at', { ascending: false }).limit(1),
        // Critical stock
        supabase.from('products').select('name, stock').eq('is_available', true).lt('stock', 5).order('stock', { ascending: true }).limit(5),
        // Pending accounts receivable
        supabase.from('contas_receber').select('valor').eq('status', 'pendente'),
        // Last 6 online orders
        supabase.from('orders').select('id, customer_name, final_amount, order_status, payment_status, created_at').order('created_at', { ascending: false }).limit(6),
        // Physical sales last 7 days for chart
        supabase.from('vendas').select('valor_final, created_at').eq('status', 'concluida').gte('created_at', sevenDaysAgo),
      ]);

      // ─── Process today's online orders ──────────────────────────────
      const ordersHoje = ordersRes.data || [];
      const onlineHoje = ordersHoje
        .filter((o: any) => o.payment_status === 'paid')
        .reduce((s: number, o: any) => s + Number(o.final_amount), 0);
      const pedidosOnlinePendentes = ordersHoje.filter((o: any) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.order_status)).length;
      const pedidosOnlinePagos = ordersHoje.filter((o: any) => o.payment_status === 'paid').length;

      // ─── Physical sales today ────────────────────────────────────────
      const balcaoHoje = (vendasHojeRes.data || []).reduce((s: number, v: any) => s + Number(v.valor_final), 0);

      // ─── Cash drawer ─────────────────────────────────────────────────
      const caixaAberto = !!(caixaRes.data && caixaRes.data.length > 0);
      const saldoCaixaInicial = caixaAberto ? Number(caixaRes.data![0].saldo_inicial) : 0;

      // Total sales through current open cash drawer
      let totalVendasCaixa = 0;
      if (caixaAberto) {
        const { data: cxVendas } = await supabase
          .from('vendas')
          .select('valor_final')
          .eq('caixa_id', caixaRes.data![0].id)
          .eq('status', 'concluida');
        totalVendasCaixa = (cxVendas || []).reduce((s: number, v: any) => s + Number(v.valor_final), 0);
      }

      // ─── A Receber Pendente ───────────────────────────────────────────
      const aReceberPendente = (contasReceberRes.data || []).reduce((s: number, r: any) => s + Number(r.valor), 0);

      // ─── Chart: last 7 days comparison ───────────────────────────────
      const allOnlineOrders = await supabase
        .from('orders')
        .select('final_amount, payment_status, created_at')
        .gte('created_at', sevenDaysAgo)
        .eq('payment_status', 'paid');

      const chart7d = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dayStr = d.toDateString();
        const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '');

        const online = (allOnlineOrders.data || [])
          .filter((o: any) => new Date(o.created_at).toDateString() === dayStr)
          .reduce((s: number, o: any) => s + Number(o.final_amount), 0);

        const balcao = (vendasSemanaRes.data || [])
          .filter((v: any) => new Date(v.created_at).toDateString() === dayStr)
          .reduce((s: number, v: any) => s + Number(v.valor_final), 0);

        return { label, online, balcao };
      });

      setData({
        totalHoje: onlineHoje + balcaoHoje,
        onlineHoje,
        balcaoHoje,
        aReceberPendente,
        pedidosOnlinePendentes,
        pedidosOnlinePagos,
        caixaAberto,
        saldoCaixaInicial,
        totalVendasCaixa,
        produtosCriticos: produtosRes.data || [],
        ultimosPedidos: ultimosPedidosRes.data || [],
        chart7d,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-white/5 rounded-3xl" />
          <div className="h-72 bg-white/5 rounded-3xl" />
        </div>
      </div>
    );
  }

  const d = data!;
  const chartMax = Math.max(...d.chart7d.map(c => c.online + c.balcao), 100);
  const totalConsolidadoFormatted = `R$ ${d.totalHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Painel Geral 🐟</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Visão consolidada · Loja Física + Online ·{' '}
            <span className="text-gray-600">Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-all font-bold uppercase tracking-widest"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── Linha 1: KPIs ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total do dia */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="col-span-2 bg-gradient-to-br from-gold-500/10 to-gold-500/5 border border-gold-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold-500/5 rounded-full blur-3xl" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[10px] text-gold-500/70 font-black uppercase tracking-widest mb-1">Faturamento Total Hoje</p>
              <p className="text-4xl font-display font-black text-gold-400">{totalConsolidadoFormatted}</p>
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[10px] text-gray-400 font-bold">Online R$ {d.onlineHoje.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gold-400" />
                  <span className="text-[10px] text-gray-400 font-bold">Balcão R$ {d.balcaoHoje.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-gold-500/10 rounded-2xl">
              <DollarSign className="w-7 h-7 text-gold-500" />
            </div>
          </div>
        </motion.div>

        {/* A Receber Pendente */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">A Receber</span>
          </div>
          <p className="text-2xl font-black text-amber-400">R$ {d.aReceberPendente.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 mt-1 font-bold">Contas em aberto</p>
        </motion.div>

        {/* Pedidos online pendentes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Online</span>
          </div>
          <p className="text-2xl font-black text-white">{d.pedidosOnlinePendentes}</p>
          <p className="text-[10px] text-gray-500 mt-1 font-bold">Pedidos em andamento</p>
        </motion.div>
      </div>

      {/* ── Linha 2: Gráfico + Status Operacional ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gráfico Duplo */}
        <div className="lg:col-span-2 bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-gold-500 w-5 h-5" /> Faturamento — Últimos 7 dias
            </h3>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase">
              <span className="flex items-center gap-1.5 text-blue-400">
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Online
              </span>
              <span className="flex items-center gap-1.5 text-gold-400">
                <div className="w-2.5 h-2.5 rounded-sm bg-gold-400" /> Balcão
              </span>
            </div>
          </div>
          <div className="h-52 flex items-end gap-2 px-1">
            {d.chart7d.map((day, i) => {
              const onlinePct = (day.online / chartMax) * 100;
              const balcaoPct = (day.balcao / chartMax) * 100;
              const total = day.online + day.balcao;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-ink-950 border border-white/10 text-[10px] font-bold px-2 py-1.5 rounded-xl text-center whitespace-nowrap text-white z-10 pointer-events-none shadow-xl">
                    <div className="text-gold-400">R$ {total.toFixed(0)}</div>
                    <div className="text-blue-400">↑ R$ {day.online.toFixed(0)}</div>
                    <div className="text-gold-500">■ R$ {day.balcao.toFixed(0)}</div>
                  </div>
                  {/* Stacked bars */}
                  <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '180px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${onlinePct}%` }}
                      transition={{ delay: i * 0.07, duration: 0.8, ease: 'easeOut' }}
                      className="w-full bg-blue-400/70 rounded-t-lg min-h-[2px]"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${balcaoPct}%` }}
                      transition={{ delay: i * 0.07 + 0.1, duration: 0.8, ease: 'easeOut' }}
                      className="w-full bg-gold-400/80 min-h-[2px]"
                    />
                  </div>
                  <span className="text-[9px] text-gray-600 font-black uppercase">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Operacional */}
        <div className="space-y-4">

          {/* Caixa PDV */}
          <div className={`rounded-3xl p-5 border shadow-xl ${d.caixaAberto ? 'bg-green-500/5 border-green-500/20' : 'bg-ink-900 border-white/10'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-xl ${d.caixaAberto ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                <Calculator className={`w-5 h-5 ${d.caixaAberto ? 'text-green-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wide">Caixa PDV</p>
                <span className={`text-[9px] font-black uppercase ${d.caixaAberto ? 'text-green-400' : 'text-gray-600'}`}>
                  {d.caixaAberto ? '● Aberto' : '○ Fechado'}
                </span>
              </div>
            </div>
            {d.caixaAberto && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Fundo inicial:</span>
                  <span className="text-gray-300 font-bold">R$ {d.saldoCaixaInicial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Vendas no turno:</span>
                  <span className="text-green-400 font-bold">R$ {d.totalVendasCaixa.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pedidos Online */}
          <div className="bg-ink-900 border border-white/10 rounded-3xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-xs font-black text-white uppercase tracking-wide">Loja Online</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Pedidos pagos:</span>
                <span className="text-green-400 font-bold">{d.pedidosOnlinePagos}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Em andamento:</span>
                <span className="text-yellow-400 font-bold">{d.pedidosOnlinePendentes}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Faturado:</span>
                <span className="text-white font-bold">R$ {d.onlineHoje.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Estoque Crítico */}
          {d.produtosCriticos.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-500/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-xs font-black text-red-400 uppercase tracking-wide">Estoque Crítico</p>
              </div>
              <div className="space-y-1.5">
                {d.produtosCriticos.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className="text-gray-400 truncate pr-2">{p.name.trim()}</span>
                    <span className="text-red-400 font-black shrink-0">{p.stock} un</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Linha 3: Últimos Pedidos + Atalhos ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Últimos pedidos online */}
        <div className="lg:col-span-2 bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
              <ShoppingCart className="text-blue-400 w-5 h-5" /> Últimos Pedidos Online
            </h3>
            <button
              onClick={() => window.location.href = '/admin/pedidos'}
              className="text-[10px] text-gray-500 hover:text-gold-400 font-black uppercase tracking-widest transition-colors flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {d.ultimosPedidos.length === 0 ? (
              <p className="text-gray-600 italic text-sm text-center py-8">Nenhum pedido online ainda.</p>
            ) : (
              d.ultimosPedidos.map((order) => (
                <div key={order.id} className="flex items-center justify-between bg-white/3 hover:bg-white/5 border border-white/5 rounded-2xl px-4 py-3 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{order.customer_name}</p>
                      <p className="text-[10px] text-gray-600">
                        {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${STATUS_COLORS[order.order_status] || 'text-gray-500 bg-white/5 border-white/10'}`}>
                      {STATUS_LABELS[order.order_status] || order.order_status}
                    </span>
                    <span className="text-xs font-black text-white">R$ {Number(order.final_amount).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Atalhos rápidos */}
        <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl">
          <h3 className="text-base font-display font-bold text-white mb-5 flex items-center gap-2">
            ⚡ Atalhos Rápidos
          </h3>
          <div className="space-y-3">
            {[
              { label: 'PDV / Caixa', sub: 'Abrir o caixa de vendas', onClick: () => window.location.href = '/admin/pdv', icon: Calculator, color: 'gold' },
              { label: 'Gerenciar Pedidos', sub: 'Ver pedidos online', onClick: () => window.location.href = '/admin/pedidos', icon: ShoppingCart, color: 'blue' },
              { label: 'Estoque', sub: 'Ajustes e transferências', onClick: () => window.location.href = '/admin/estoque', icon: Package, color: 'purple' },
              { label: 'Financeiro', sub: 'Fluxo de caixa', onClick: () => window.location.href = '/admin/financeiro', icon: TrendingUp, color: 'green' },
              { label: 'Clientes', sub: 'Base de clientes', onClick: () => window.location.href = '/admin/clientes', icon: Users, color: 'pink' },
              { label: 'Canal Atacado B2B', sub: 'Copiar link de compartilhamento', onClick: () => {
                navigator.clipboard.writeText(`${window.location.origin}/atacado`);
                alert('Link do Canal de Atacado B2B copiado para a área de transferência!');
              }, icon: Globe, color: 'amber' },
              { label: 'Ver Vitrine', sub: 'Como o cliente vê', onClick: () => window.open('/', '_blank'), icon: Store, color: 'gray' },
            ].map((item, i) => {
              const colorMap: Record<string, string> = {
                gold: 'bg-gold-500/10 text-gold-500 group-hover:bg-gold-500 group-hover:text-ink-950',
                blue: 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white',
                purple: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white',
                green: 'bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-white',
                pink: 'bg-pink-500/10 text-pink-400 group-hover:bg-pink-500 group-hover:text-white',
                amber: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-ink-950',
                gray: 'bg-white/5 text-gray-400 group-hover:bg-white/20 group-hover:text-white',
              };
              return (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="w-full flex items-center justify-between p-3 bg-white/3 hover:bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-all ${colorMap[item.color]}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{item.label}</p>
                      <p className="text-[10px] text-gray-600">{item.sub}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-white transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
