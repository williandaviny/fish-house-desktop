import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Eye, 
  CheckCircle, 
  Clock, 
  Truck, 
  TrendingUp, 
  ShoppingBag, 
  CreditCard,
  RefreshCcw,
  ExternalLink,
  MessageCircle,
  Store,
  QrCode,
  Trash2,
  Edit2,
  XCircle,
  Printer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { motion, AnimatePresence } from 'motion/react';

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_whatsapp: string;
  delivery_type: 'delivery' | 'pickup';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  total_amount: number;
  final_amount: number;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  scheduled: boolean;
  is_b2b?: boolean;
  restaurant_cnpj?: string;
  restaurant_name?: string;
};

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Order>>({});
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;
  const { settings } = useSettings();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchOrders();

    const ordersSubscription = supabase
      .channel('orders_realtime_module')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // Refresh current page on any change
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, [currentPage, debouncedSearch]);

  const fetchOrders = async () => {
    setLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('orders')
      .select('id, created_at, customer_name, customer_whatsapp, delivery_type, payment_method, payment_status, order_status, total_amount, final_amount, address_street, address_number, address_neighborhood, address_city, scheduled, is_b2b, restaurant_cnpj, restaurant_name', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (debouncedSearch.trim()) {
      query = query.or(`customer_name.ilike.%${debouncedSearch.trim()}%,customer_whatsapp.ilike.%${debouncedSearch.trim()}%`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (!error) {
      setOrders(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (!error) setOrderItems(data || []);
  };

  const updateOrderStatus = async (orderId: string, status: any) => {
    const { error } = await supabase.from('orders').update({ order_status: status }).eq('id', orderId);
    if (!error) {
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, order_status: status } : null);
      }

      // Trigger WhatsApp notifications
      try {
        const order = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
        if (order) {
          const updatedOrder = { ...order, order_status: status };
          
          import('../utils/whatsapp').then(async ({ notifyClientStatusChange, notifyStoreGroup }) => {
            // Notify Client
            await notifyClientStatusChange(updatedOrder);

            // Notify Store Group (select correct event type)
            const eventType = status === 'delivered' ? 'delivered' : (status === 'canceled' ? 'canceled' : 'status_changed');
            
            // If the items aren't loaded in state, we can fetch them or pass the existing orderItems if selectedOrder is active
            const itemsToUse = selectedOrder?.id === orderId ? orderItems : [];
            await notifyStoreGroup(updatedOrder, itemsToUse, eventType);
          }).catch(err => console.error('WhatsApp notification error:', err));
        }
      } catch (err) {
        console.error('Error triggering status change notifications:', err);
      }
    }
  };

  const updatePaymentStatus = async (orderId: string, status: any) => {
    const updates: any = { payment_status: status };
    if (status === 'paid') {
      updates.order_status = 'confirmed';
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (!error) {
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
      }

      // Trigger WhatsApp notification for payment status change
      if (status === 'paid') {
        try {
          const order = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
          if (order) {
            const updatedOrder = { ...order, ...updates };
            import('../utils/whatsapp').then(async ({ notifyClientStatusChange }) => {
              await notifyClientStatusChange(updatedOrder);
            }).catch(err => console.error('WhatsApp payment notification error:', err));
          }
        } catch (err) {
          console.error('Error triggering payment notifications:', err);
        }
      }
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setDeletingOrderId(orderId);
  };

  const confirmDelete = async () => {
    if (!deletingOrderId) return;
    
    try {
      // 1. Delete items first to avoid foreign key issues
      const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', deletingOrderId);
      if (itemsError) throw itemsError;

      // 2. Delete the order
      const { error: orderError } = await supabase.from('orders').delete().eq('id', deletingOrderId);
      if (orderError) throw orderError;
      
      // 3. Update local state
      setOrders(prev => prev.filter(o => o.id !== deletingOrderId));
      setDeletingOrderId(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(`⚠️ Erro ao excluir: ${err.message || 'Verifique se você tem permissão de administrador.'}`);
    }
  };

  const handlePrint = async (order: Order) => {
    // 1. Fetch items if we don't have them
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    if (!items) return;

    // 2. Setup print data
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = items.map(i => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 14px;">
        <span>${i.quantity}x ${i.product_name}</span>
        <span>R$ ${Number(i.total_price).toFixed(2)}</span>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Comanda - Fish House #${order.id.slice(0,8)}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              padding: 20px; 
              width: 80mm; 
              margin: 0 auto;
              color: black;
            }
            .header { text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px; }
            .title { font-size: 20px; font-weight: bold; margin: 5px 0; }
            .info { font-size: 12px; margin-bottom: 5px; }
            .items { border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px; }
            .total { font-size: 18px; font-weight: bold; text-align: right; }
            .footer { text-align: center; font-size: 10px; margin-top: 20px; border-top: 1px dashed black; padding-top: 10px; }
            .address { font-size: 13px; font-weight: bold; margin: 10px 0; background: #eee; padding: 5px; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <div class="title">${settings?.label_config.header || 'FISH HOUSE'}</div>
            <div style="font-size: 10px; margin-top: 5px;">Pedido #${order.id.slice(0,8).toUpperCase()}</div>
            <div style="font-size: 10px;">${new Date(order.created_at).toLocaleString()}</div>
          </div>

          <div class="info">
            <strong>CLIENTE:</strong> ${order.customer_name}<br>
            <strong>WHATSAPP:</strong> ${order.customer_whatsapp}<br>
            <strong>ENTREGA:</strong> ${order.delivery_type === 'pickup' ? 'RETIRADA NA LOJA' : 'DELIVERY'}
          </div>

          ${order.delivery_type === 'delivery' ? `
          <div class="address">
            ENDEREÇO: ${order.address_street}, ${order.address_number}<br>
            BAIRRO: ${order.address_neighborhood} - ${order.address_city}
          </div>
          ` : ''}

          <div class="items">
            <div style="font-size: 10px; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid black;">Produtos</div>
            ${itemsHtml}
          </div>

          <div class="total">
            TOTAL: R$ ${Number(order.final_amount).toFixed(2).replace('.', ',')}
          </div>

          <div class="info" style="margin-top: 10px;">
            <strong>FORMA PGTO:</strong> ${order.payment_method.toUpperCase()}<br>
            <strong>STATUS:</strong> ${order.payment_status.toUpperCase()}
          </div>

          <div class="footer">
            ${settings?.label_config.footer || 'Obrigado pela preferência!'}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleUpdateOrderDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const { error } = await supabase
      .from('orders')
      .update({
        customer_name: editFormData.customer_name,
        customer_whatsapp: editFormData.customer_whatsapp,
        address_street: editFormData.address_street,
        address_number: editFormData.address_number,
        address_neighborhood: editFormData.address_neighborhood,
      })
      .eq('id', selectedOrder.id);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...editFormData } : o));
      setIsEditing(false);
      setViewingDetails(false);
    }
  };

  const filteredOrders = orders; // filtering now done server-side via debouncedSearch

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'confirmed': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'paid': 
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'shipped': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'canceled': 
      case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const translatePaymentStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': '⏳ Pendente',
      'paid': '✅ Pago',
      'failed': '❌ Falhou',
      'refunded': '🔄 Reembolsado',
      'canceled': '🚫 Cancelado'
    };
    return map[status] || status;
  };

  const translateOrderStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': '🛒 Recebido',
      'confirmed': '👨‍🍳 Preparar',
      'processing': '🔪 Em Preparo',
      'shipped': '🚚 Enviado',
      'delivered': '🏁 Entregue',
      'canceled': '❌ Cancelado'
    };
    return map[status] || status;
  };

  const formatWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleaned}`;
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Pesquisar pedidos..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-ink-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold-500"
          />
        </div>
        <button onClick={fetchOrders} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
          <RefreshCcw className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Pedido</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Cliente</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Pagamento</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={6} className="px-6 py-10 animate-pulse bg-white/5" /></tr>)
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => { setSelectedOrder(order); fetchOrderItems(order.id); setViewingDetails(true); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gold-500 font-bold uppercase text-sm">#{order.id.slice(0, 8)}</span>
                        {order.is_b2b && (
                          <span className="bg-gold-500 text-ink-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            ATACADO
                          </span>
                        )}
                        {order.scheduled && (
                          <span className="bg-amber-500 text-ink-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" /> AGENDADO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-sm">{order.customer_name}</div>
                      <div className="text-xs text-gray-400 italic">{order.customer_phone || order.customer_whatsapp}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase">
                          {order.payment_method === 'pix' ? (
                            <><QrCode className="w-3.5 h-3.5 text-gold-500" /> Pix</>
                          ) : order.payment_method === 'whatsapp_b2b' ? (
                            <><MessageCircle className="w-3.5 h-3.5 text-amber-500" /> Atacado</>
                          ) : (
                            <><CreditCard className="w-3.5 h-3.5 text-blue-400" /> Cartão</>
                          )}
                        </div>
                        <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getStatusColor(order.payment_status)}`}>
                          {translatePaymentStatus(order.payment_status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(order.order_status)}`}>
                        {translateOrderStatus(order.order_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">R$ {Number(order.final_amount).toFixed(2).replace('.', ',')}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handlePrint(order);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                          title="Imprimir Comanda"
                        >
                          <Printer className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedOrder(order); 
                            fetchOrderItems(order.id); 
                            setViewingDetails(true); 
                          }}
                          className="p-2 text-gray-400 hover:text-gold-500 hover:bg-gold-500/10 rounded-lg transition-all"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteOrder(order.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Excluir Definitivamente"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-white/5">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              onClick={() => { setSelectedOrder(order); fetchOrderItems(order.id); setViewingDetails(true); }}
              className="p-4 space-y-4 active:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gold-500 font-bold uppercase text-xs">#{order.id.slice(0, 8)}</span>
                  {order.is_b2b && (
                    <span className="bg-gold-500 text-ink-950 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center leading-none">
                      ATACADO
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 font-bold">
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white text-sm">{order.customer_name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">{order.delivery_type === 'pickup' ? 'Retirada na Loja' : 'Delivery'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white">R$ {Number(order.final_amount).toFixed(2).replace('.', ',')}</p>
                  <p className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${getStatusColor(order.payment_status)}`}>
                    {translatePaymentStatus(order.payment_status)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${getStatusColor(order.order_status)}`}>
                  {translateOrderStatus(order.order_status)}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePrint(order); }}
                    className="p-2.5 bg-white/5 text-blue-500 rounded-xl border border-white/5"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); fetchOrderItems(order.id); setViewingDetails(true); }}
                    className="p-2.5 bg-white/5 text-gold-500 rounded-xl border border-white/5"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500 text-sm">Nenhum pedido encontrado.</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {viewingDetails && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setViewingDetails(false)} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative w-full max-w-2xl bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
                    #{selectedOrder.id.slice(0, 8).toUpperCase()} - {selectedOrder.customer_name}
                  </h2>
                  {selectedOrder.scheduled && (
                    <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5" /> Pedido Agendado para o Próximo Dia Útil
                    </span>
                  )}
                </div>
                <button onClick={() => setViewingDetails(false)} className="text-gray-400 hover:text-white transition-colors">Fechar</button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Pagamento</p>
                    <div className="flex items-center gap-2">
                      {selectedOrder.payment_method === 'pix' ? (
                        <div className="flex items-center gap-1.5 bg-gold-500/10 text-gold-500 px-3 py-1.5 rounded-lg border border-gold-500/20 font-bold text-xs uppercase">
                          <QrCode className="w-4 h-4" /> Pix
                        </div>
                      ) : selectedOrder.payment_method === 'whatsapp_b2b' ? (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-lg border border-amber-500/20 font-bold text-xs uppercase">
                          <MessageCircle className="w-4 h-4" /> Atacado / WhatsApp
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 font-bold text-xs uppercase">
                          <CreditCard className="w-4 h-4" /> Cartão de Crédito
                        </div>
                      )}
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(selectedOrder.payment_status)}`}>
                        {translatePaymentStatus(selectedOrder.payment_status)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Entrega {selectedOrder.delivery_type === 'pickup' && '(Retirada)'}</p>
                    {selectedOrder.delivery_type === 'delivery' ? (
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <p className="text-sm">{selectedOrder.address_street}, {selectedOrder.address_number}</p>
                        <p className="text-xs text-gray-500 mt-1">{selectedOrder.address_neighborhood}, {selectedOrder.address_city}</p>
                      </div>
                    ) : (
                      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                        <p className="text-sm font-bold text-purple-500 uppercase">Cliente vai retirar na loja</p>
                      </div>
                    )}
                  </div>
                  
                  {selectedOrder.is_b2b && (
                    <div className="md:col-span-2 bg-gold-500/5 border border-gold-500/10 p-4 rounded-xl space-y-2">
                      <p className="text-[10px] text-gold-500 uppercase font-black tracking-widest">Informações de Atacado (B2B)</p>
                      <div className="grid grid-cols-2 gap-4 text-xs font-bold text-white uppercase tracking-wider">
                        <div>
                          <span className="text-[9px] text-gray-500 block normal-case font-bold">Empresa / Razão Social:</span>
                          <span className="text-white font-black">{selectedOrder.restaurant_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 block normal-case font-bold">CNPJ:</span>
                          <span className="font-mono text-white font-black">{selectedOrder.restaurant_cnpj || '—'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-2">Alterar Status</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Pedido</label>
                     <select 
                      value={selectedOrder.order_status} 
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)} 
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold-500 outline-none appearance-none cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="pending">🛒 Recebido</option>
                      <option value="confirmed">👨‍🍳 Preparar</option>
                      <option value="processing">🔪 Em Preparo</option>
                      <option value="shipped">🚚 Enviado</option>
                      <option value="delivered">🏁 Entregue</option>
                      <option value="canceled">❌ Cancelado</option>
                    </select>
                    </div>
                    <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Pagamento</label>
                     <select 
                      value={selectedOrder.payment_status} 
                      onChange={(e) => updatePaymentStatus(selectedOrder.id, e.target.value)} 
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold-500 outline-none appearance-none cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="pending">⏳ Pendente</option>
                      <option value="paid">✅ Pago</option>
                      <option value="failed">❌ Falhou</option>
                      <option value="canceled">🚫 Cancelado</option>
                    </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-500 uppercase font-bold">Itens do Pedido</p>
                  {orderItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-sm">{item.quantity}x {item.product_name}</span>
                      <span className="font-bold text-white text-sm">R$ {Number(item.total_price).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-6 mt-4 border-t border-white/10">
                  <span className="text-gray-500 font-bold uppercase text-xs tracking-widest">Total Final</span>
                  <span className="text-3xl font-bold text-gold-500">R$ {Number(selectedOrder.final_amount).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => {
                    setEditFormData({
                      customer_name: selectedOrder.customer_name,
                      customer_whatsapp: selectedOrder.customer_whatsapp,
                      address_street: selectedOrder.address_street,
                      address_number: selectedOrder.address_number,
                      address_neighborhood: selectedOrder.address_neighborhood,
                    });
                    setIsEditing(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold transition-all border border-white/10"
                >
                  <Edit2 className="w-4 h-4 text-gold-500" /> Editar Dados
                </button>
                <a 
                  href={formatWhatsApp(selectedOrder.customer_whatsapp)} 
                  target="_blank"
                  className="flex-[2] flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-green-900/20"
                >
                  <MessageCircle className="w-5 h-5" /> Abrir WhatsApp
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditing(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">Editar Pedido</h3>
              <form onSubmit={handleUpdateOrderDetails} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Cliente</label>
                  <input 
                    type="text" 
                    value={editFormData.customer_name || ''}
                    onChange={e => setEditFormData({...editFormData, customer_name: e.target.value})}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">WhatsApp</label>
                  <input 
                    type="text" 
                    value={editFormData.customer_whatsapp || ''}
                    onChange={e => setEditFormData({...editFormData, customer_whatsapp: e.target.value})}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold-500 transition-all outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Rua</label>
                    <input 
                      type="text" 
                      value={editFormData.address_street || ''}
                      onChange={e => setEditFormData({...editFormData, address_street: e.target.value})}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold-500 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Número</label>
                    <input 
                      type="text" 
                      value={editFormData.address_number || ''}
                      onChange={e => setEditFormData({...editFormData, address_number: e.target.value})}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-gold-500 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-white/5 text-gray-400 py-4 rounded-xl font-bold hover:text-white transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 bg-gold-500 text-ink-950 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-gold-600 transition-all">Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingOrderId && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingOrderId(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-ink-900 border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl p-8 text-center text-white">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Excluir Pedido?</h3>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">Tem certeza que deseja apagar permanentemente este pedido e todos os seus itens? <br/><br/> <span className="text-red-400 font-bold">Esta ação não pode ser desfeita.</span></p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeletingOrderId(null)}
                  className="flex-1 bg-white/5 text-gray-400 py-4 rounded-xl font-bold hover:text-white hover:bg-white/10 transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-900/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t border-white/10">
          <span className="text-sm text-gray-400">
            Página {currentPage} de {totalPages} ({totalCount} pedidos)
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
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 hover:bg-white/10 transition-all"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
