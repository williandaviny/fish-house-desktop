import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  MessageCircle, 
  ShoppingBag, 
  TrendingUp, 
  Calendar,
  ExternalLink,
  ChevronRight,
  Filter,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  MapPin,
  Clock,
  ChevronDown,
  Eye,
  Package,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_city?: string;
  notes?: string;
  created_at: string;
};

type CustomerStats = {
  totalOrders: number;
  totalSpent: number;
  lastOrder?: string;
};

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerStats, setCustomerStats] = useState<Record<string, CustomerStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'totalSpent' | 'totalOrders' | 'lastOrder'>('totalSpent');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    whatsapp: '',
    address_street: '',
    address_number: '',
    address_neighborhood: '',
    address_city: 'Bombinhas',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // 1. Fetch Customers — select only needed columns
    const { data: customersData } = await supabase
      .from('customers')
      .select('id, name, whatsapp, email, address_street, address_number, address_neighborhood, address_city, notes, created_at')
      .order('name');
    
    // 2. Fetch Orders for Stats — only last 90 days, minimal columns
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: ordersData } = await supabase
      .from('orders')
      .select('customer_whatsapp, final_amount, created_at')
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false });

    if (customersData && ordersData) {
      const statsMap: Record<string, CustomerStats> = {};
      ordersData.forEach(o => {
        const wa = o.customer_whatsapp;
        if (!statsMap[wa]) {
          statsMap[wa] = { totalOrders: 0, totalSpent: 0, lastOrder: o.created_at };
        }
        statsMap[wa].totalOrders += 1;
        statsMap[wa].totalSpent += Number(o.final_amount);
      });
      setCustomerStats(statsMap);
      setCustomers(customersData);
    }
    setLoading(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.whatsapp) return;

    const payload = { ...formData };
    
    if (editingCustomer) {
      await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
    } else {
      await supabase.from('customers').insert([payload]);
    }

    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    await supabase.from('customers').delete().eq('id', deletingCustomer.id);
    setDeletingCustomer(null);
    fetchData();
  };

  const fetchHistory = async (whatsapp: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, final_amount, order_status, payment_status, payment_method')
      .eq('customer_whatsapp', whatsapp)
      .order('created_at', { ascending: false })
      .limit(30);
    setOrderHistory(data || []);
  };

  const fetchOrderItems = async (orderId: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from('order_items')
      .select('id, order_id, product_name, quantity, unit_price, subtotal')
      .eq('order_id', orderId);
    setOrderItems(data || []);
    setLoadingItems(false);
  };

  const filteredCustomers = customers
    .filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.whatsapp.includes(searchTerm)
    )
    .sort((a, b) => {
      const sA = customerStats[a.whatsapp] || { totalSpent: 0, totalOrders: 0, lastOrder: '' };
      const sB = customerStats[b.whatsapp] || { totalSpent: 0, totalOrders: 0, lastOrder: '' };
      
      if (sortBy === 'lastOrder') {
        return new Date(sB.lastOrder || 0).getTime() - new Date(sA.lastOrder || 0).getTime();
      }
      return (sB[sortBy] as number) - (sA[sortBy] as number);
    });

  const totalCustomerPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleaned}`;
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-ink-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <Users className="text-gold-500 w-8 h-8" /> Gestão de Clientes
          </h2>
          <p className="text-gray-500 text-sm mt-1">Gerencie a base de fidelidade e histórico de compras.</p>
        </div>
        <button 
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', whatsapp: '', address_street: '', address_number: '', address_neighborhood: '', address_city: 'Bombinhas', notes: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-ink-950 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-gold-500/10 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Novo Cliente
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-ink-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md md:sticky md:top-24 z-20 shadow-xl">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Pesquisar cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold-500 transition-all font-medium"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest hidden md:block">Ordenar por:</span>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 md:w-48 bg-ink-950 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-gold-500 appearance-none cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value="totalSpent">💰 Maior Faturamento</option>
            <option value="totalOrders">📦 Frequência (Pedidos)</option>
            <option value="lastOrder">📅 Mais Recente</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse" />)
          ) : (
            paginatedCustomers.map((customer) => {
              const stats = customerStats[customer.whatsapp] || { totalSpent: 0, totalOrders: 0 };
              return (
                <motion.div
                  key={customer.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-ink-900 border border-white/5 rounded-3xl overflow-hidden hover:border-gold-500/20 transition-all group relative"
                >
                  <div className="p-6 md:p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-gold-500/20 to-transparent rounded-2xl border border-gold-500/10 flex items-center justify-center text-gold-500 font-display font-bold text-2xl group-hover:scale-110 transition-transform">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white uppercase tracking-tight">{customer.name}</h3>
                          <p className="text-sm text-gray-500 font-mono tracking-tighter flex items-center gap-1.5 mt-0.5">
                            <MessageCircle className="w-3.5 h-3.5 text-green-500" /> {customer.whatsapp}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setEditingCustomer(customer); setFormData(customer); setIsModalOpen(true); }}
                          className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeletingCustomer(customer)}
                          className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-8">
                      <div className="bg-ink-950 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-[9px] text-gray-500 font-black uppercase mb-1 flex items-center justify-center gap-1">
                          <ShoppingBag className="w-2.5 h-2.5" /> Pedidos
                        </p>
                        <p className="text-xl font-bold text-white">{stats.totalOrders}</p>
                      </div>
                      <div className="bg-ink-950 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-[9px] text-gray-500 font-black uppercase mb-1 flex items-center justify-center gap-1">
                          <DollarSign className="w-2.5 h-2.5" /> Gasto
                        </p>
                        <p className="text-xl font-bold text-gold-500">R$ {stats.totalSpent.toFixed(0)}</p>
                      </div>
                      <div className="bg-ink-950 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-[9px] text-gray-500 font-black uppercase mb-1 flex items-center justify-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Ticket
                        </p>
                        <p className="text-xl font-bold text-white">R$ {(stats.totalSpent / (stats.totalOrders || 1)).toFixed(0)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={() => { setViewingHistory(customer); fetchHistory(customer.whatsapp); }}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase py-4 rounded-xl border border-white/10 transition-all"
                      >
                        <Clock className="w-4 h-4 text-gold-500" /> Ver Histórico
                      </button>
                      <a 
                        href={formatWhatsApp(customer.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase py-4 rounded-xl transition-all shadow-lg shadow-green-900/10"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                    </div>
                  </div>

                  {stats.totalSpent > 1000 && (
                    <div className="bg-gradient-to-r from-gold-500/20 to-gold-600/20 text-gold-500 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-center border-t border-gold-500/10">
                      ✨ Cliente VIP Fish House ✨
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalCustomerPages > 1 && (
        <div className="flex items-center justify-between py-4 border-t border-white/10">
          <span className="text-sm text-gray-400">
            Página {currentPage} de {totalCustomerPages} ({filteredCustomers.length} clientes)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalCustomerPages, p + 1))}
              disabled={currentPage === totalCustomerPages}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 hover:bg-white/10 transition-all"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h2 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
                  {editingCustomer ? 'Editar Cliente' : 'Cadastrar Cliente'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <form id="customerForm" onSubmit={handleSaveCustomer} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Nome Completo *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-white focus:border-gold-500 outline-none transition-all"
                      placeholder="Ex: João da Silva"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">WhatsApp *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.whatsapp || ''}
                      onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-white focus:border-gold-500 outline-none transition-all"
                      placeholder="Ex: 47999999999"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Rua</label>
                      <input 
                        type="text" 
                        value={formData.address_street || ''}
                        onChange={e => setFormData({...formData, address_street: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-white focus:border-gold-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Nº</label>
                      <input 
                        type="text" 
                        value={formData.address_number || ''}
                        onChange={e => setFormData({...formData, address_number: e.target.value})}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-white focus:border-gold-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Notas / Observações</label>
                    <textarea 
                      rows={3}
                      value={formData.notes || ''}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-4 text-white focus:border-gold-500 outline-none transition-all resize-none"
                      placeholder="Obs sobre entrega, preferências, etc..."
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase tracking-widest hover:text-white transition-all">Cancelar</button>
                <button 
                  type="submit" 
                  form="customerForm"
                  className="flex-3 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-ink-950 py-4 rounded-xl font-black uppercase tracking-widest transition-all px-12"
                >
                  <Save className="w-5 h-5" /> Salvar Cliente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {viewingHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setViewingHistory(null); setSelectedOrder(null); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-4">
                  {selectedOrder && (
                    <button 
                      onClick={() => setSelectedOrder(null)} 
                      className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                      {selectedOrder ? `Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}` : 'Histórico de Pedidos'}
                    </h2>
                    <p className="text-xs text-gold-500 font-bold uppercase mt-1">{viewingHistory.name}</p>
                  </div>
                </div>
                <button onClick={() => { setViewingHistory(null); setSelectedOrder(null); }} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {!selectedOrder ? (
                    <motion.div 
                      key="history-list"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-4"
                    >
                      {orderHistory.length === 0 ? (
                        <p className="text-center text-gray-500 py-10 italic">Nenhum pedido registrado para este cliente.</p>
                      ) : (
                        orderHistory.map(order => (
                          <div 
                            key={order.id} 
                            onClick={() => { setSelectedOrder(order); fetchOrderItems(order.id); }}
                            className="bg-ink-950 p-4 rounded-2xl border border-white/5 flex items-center justify-between hover:border-gold-500/30 transition-all cursor-pointer group"
                          >
                            <div>
                              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
                                #{order.id.slice(0, 8).toUpperCase()} - {new Date(order.created_at).toLocaleDateString()}
                              </p>
                              <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${order.payment_status === 'paid' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                                  {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                                </span>
                                <span className="text-xs font-bold text-white uppercase tracking-tighter">
                                  {order.order_status === 'delivered' ? '✅ Entregue' : '🛒 Em andamento'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-lg font-bold text-gold-500">R$ {Number(order.final_amount).toFixed(2).replace('.', ',')}</p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">{order.payment_method}</p>
                              </div>
                              <Eye className="w-5 h-5 text-gray-600 group-hover:text-gold-500 transition-colors" />
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="order-details"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Resumo</p>
                          <p className="text-sm font-bold text-white uppercase tracking-tight">{selectedOrder.delivery_type === 'delivery' ? '🚗 Entrega' : '🏪 Retirada'}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Pagamento</p>
                          <p className="text-sm font-bold text-white uppercase tracking-tight">{selectedOrder.payment_method.toUpperCase()}</p>
                          <p className="text-xs text-gold-500 font-bold mt-1 uppercase">{selectedOrder.payment_status === 'paid' ? 'Transação Aprovada' : 'Aguardando Pagamento'}</p>
                        </div>
                      </div>

                      {selectedOrder.delivery_type === 'delivery' && (
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Endereço de Entrega</p>
                          <p className="text-sm text-white">{selectedOrder.address_street}, {selectedOrder.address_number}</p>
                          <p className="text-xs text-gray-500 uppercase mt-1 font-bold">{selectedOrder.address_neighborhood} - {selectedOrder.address_city}</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Itens do Pedido</p>
                        {loadingItems ? (
                          <div className="space-y-2">
                             {[1,2].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}
                          </div>
                        ) : orderItems.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">Nenhum item encontrado.</p>
                        ) : (
                          orderItems.map(item => (
                            <div key={item.id} className="bg-ink-950 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gold-500/50" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white uppercase tracking-tight">{item.quantity}x {item.product_name}</p>
                                  <p className="text-[10px] text-gray-500 font-bold tracking-widest">UNIT: R$ {Number(item.unit_price).toFixed(2).replace('.', ',')}</p>
                                </div>
                              </div>
                              <p className="font-bold text-white">R$ {Number(item.total_price).toFixed(2).replace('.', ',')}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Valor Total</p>
                          <p className="text-3xl font-bold text-gold-500 tracking-tighter">R$ {Number(selectedOrder.final_amount).toFixed(2).replace('.', ',')}</p>
                        </div>
                        <button 
                          onClick={() => {
                            const itemsList = orderItems.map(item => `${item.quantity}x ${item.product_name}`).join(', ');
                            const message = `Olá ${viewingHistory.name}! 👋\n\nVi que você já pediu *${itemsList}* anteriormente e pensamos se você não gostaria de repetir esse pedido hoje? 🐟✨\n\nPodemos preparar para você?`;
                            window.open(`https://wa.me/55${viewingHistory.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                          className="bg-gold-500 hover:bg-gold-600 text-ink-950 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-gold-500/20"
                        >
                          Sugerir Repetir
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deletingCustomer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingCustomer(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-ink-900 border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl p-8 text-center text-white">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Excluir Cliente?</h3>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">Tem certeza que deseja apagar permanentemente o cliente <span className="text-white font-bold">{deletingCustomer.name}</span>? <br/><br/> <span className="text-red-400 font-bold">Isso não apagará os pedidos existentes, apenas o registro do cliente.</span></p>
              
              <div className="flex gap-4">
                <button onClick={() => setDeletingCustomer(null)} className="flex-1 bg-white/5 text-gray-400 py-4 rounded-xl font-bold hover:text-white transition-all">Cancelar</button>
                <button onClick={handleDelete} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-900/20">Remover</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
