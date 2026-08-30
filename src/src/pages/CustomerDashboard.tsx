import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle, 
  ChevronRight, 
  ShoppingBag,
  MessageCircle,
  LogOut,
  MapPin,
  Calendar,
  Heart,
  Search,
  ChevronLeft
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getOptimizedImageUrl } from '../utils/image';

type Order = {
  id: string;
  created_at: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  total_amount: number;
  final_amount: number;
  delivery_type: 'delivery' | 'pickup';
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  scheduled: boolean;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  is_available: boolean;
  unit: string;
};

export default function CustomerDashboard() {
  const { customerPhone, logout, isAuthenticated } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'favorites'>('orders');
  const navigate = useNavigate();
  const { addToCart } = useCart();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/verificar');
      return;
    }
    fetchData();

    // Inscrição em tempo real para atualizações de status
    const ordersSubscription = supabase
      .channel('customer_orders_realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `customer_whatsapp=eq.${customerPhone}` 
      }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, [customerPhone, isAuthenticated, navigate]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Orders
    const ordersRes = await supabase
      .from('orders')
      .select('id, created_at, order_status, payment_status, final_amount, delivery_type, payment_method, address_neighborhood, address_city, items')
      .eq('customer_whatsapp', customerPhone)
      .order('created_at', { ascending: false });

    if (!ordersRes.error) {
      setOrders(ordersRes.data || []);
    }

    // Fetch Favorites
    const favoritesRes = await supabase
      .from('customer_favorites')
      .select('product_id')
      .eq('customer_whatsapp', customerPhone);
    
    if (!favoritesRes.error && favoritesRes.data.length > 0) {
      const productIds = favoritesRes.data.map(f => f.product_id);
      const productsRes = await supabase
        .from('products')
        .select('id, name, price, image_url, unit, is_available, is_deleted')
        .in('id', productIds);
      
      if (!productsRes.error && productsRes.data) {
        const activeFavorites = productsRes.data.filter((p: any) => p.is_deleted !== true);
        setFavoriteProducts(activeFavorites);
      }
    }

    setLoading(false);
  };

  const removeFavorite = async (productId: string) => {
    const { error } = await supabase
      .from('customer_favorites')
      .delete()
      .eq('customer_whatsapp', customerPhone)
      .eq('product_id', productId);
    
    if (!error) {
      setFavoriteProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'Recebido', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', progress: 20 };
      case 'confirmed': return { label: 'A Preparar', icon: Clock, color: 'text-cyan-500', bg: 'bg-cyan-500/10', progress: 40 };
      case 'processing': return { label: 'Em Preparo', icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-500/10', progress: 60 };
      case 'shipped': return { label: 'Em Rota', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500/10', progress: 80 };
      case 'delivered': return { label: 'Entregue', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', progress: 100 };
      case 'canceled': return { label: 'Cancelado', icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', progress: 0 };
      default: return { label: 'Pendente', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-500/10', progress: 0 };
    }
  };

  const activeOrders = orders.filter(o => o.order_status !== 'delivered' && o.order_status !== 'canceled');
  const pastOrders = orders.filter(o => o.order_status === 'delivered' || o.order_status === 'canceled');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-32 px-4 max-w-4xl mx-auto">
      {/* Header do Painel */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold font-display text-white italic">Olá! 🐟</h1>
          <p className="text-gray-400 text-sm mt-1">Bem-vindo à sua área de pedidos.</p>
        </div>
        <button 
          onClick={logout}
          className="p-3 bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-2xl transition-all border border-white/5"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-4 rounded-2xl font-bold transition-all border ${
            activeTab === 'orders' 
              ? 'bg-gold-500 text-ink-950 border-gold-500 shadow-lg shadow-gold-500/20' 
              : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
          }`}
        >
          Meus Pedidos
        </button>
        <button 
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-4 rounded-2xl font-bold transition-all border ${
            activeTab === 'favorites' 
              ? 'bg-gold-500 text-ink-950 border-gold-500 shadow-lg shadow-gold-500/20' 
              : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
          }`}
        >
          Favoritos
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'orders' ? (
          <motion.div
            key="orders-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Seção de Pedidos Ativos */}
            <div className="mb-12">
              <h2 className="text-xl font-bold font-display text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                <Truck className="w-5 h-5 text-gold-500" />
                Acompanhando agora
              </h2>

              {activeOrders.length === 0 ? (
                <div className="bg-ink-800/30 border border-white/5 rounded-3xl p-10 text-center">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">Nenhum pedido em andamento no momento.</p>
                  <Link to="/catalogo" className="mt-4 inline-block text-gold-500 font-bold hover:underline">
                    Explorar Catálogo
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeOrders.map((order) => {
                    const status = getStatusInfo(order.order_status);
                    const StatusIcon = status.icon;
                    
                    return (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-ink-800/50 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <span className="text-[10px] font-black text-gold-500 uppercase tracking-[0.2em] mb-1 block">Pedido #{order.id.slice(0, 8).toUpperCase()}</span>
                              <div className="flex items-center gap-2">
                                <StatusIcon className={`w-5 h-5 ${status.color}`} />
                                <span className={`text-lg font-bold ${status.color}`}>{status.label}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-gray-400 block font-medium">Total</span>
                              <span className="text-xl font-bold text-white">R$ {Number(order.final_amount).toFixed(2).replace('.', ',')}</span>
                            </div>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="relative h-2 bg-white/5 rounded-full mb-8 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${status.progress}%` }}
                              className={`absolute h-full ${status.color.replace('text', 'bg')} shadow-[0_0_10px_currentColor]`}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                              <MapPin className="w-5 h-5 text-gray-500" />
                              <span className="text-sm text-gray-300">
                                {order.delivery_type === 'pickup' ? 'Retirada na Loja' : `${order.address_street}, ${order.address_number}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                              <Calendar className="w-5 h-5 text-gray-500" />
                              <span className="text-sm text-gray-300">
                                {new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/5 p-4 flex justify-center">
                          <a 
                            href={`https://wa.me/554730114981?text=Olá! Gostaria de informações sobre meu pedido #${order.id.slice(0, 8).toUpperCase()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-gold-500 text-sm font-bold hover:scale-105 transition-transform"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Falar com atendente sobre este pedido
                          </a>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Histórico Recente */}
            {pastOrders.length > 0 && (
              <div>
                <h2 className="text-xl font-bold font-display text-white mb-6 uppercase tracking-wider flex items-center gap-2 opacity-60">
                  <CheckCircle className="w-5 h-5" />
                  Vendas passadas
                </h2>
                <div className="space-y-4">
                  {pastOrders.slice(0, 5).map((order) => {
                    const status = getStatusInfo(order.order_status);
                    return (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-5 bg-ink-800/20 border border-white/5 rounded-2xl"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${status.bg}`}>
                            <Package className={`w-5 h-5 ${status.color}`} />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">Pedido #{order.id.slice(0, 5).toUpperCase()}</p>
                            <p className="text-[10px] text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div className="hidden sm:block">
                            <p className="text-white font-bold text-sm">R$ {Number(order.final_amount).toFixed(2).replace('.', ',')}</p>
                            <p className={`text-[10px] font-bold uppercase ${status.color}`}>{status.label}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-700" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="favorites-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-bold font-display text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
              <Heart className="w-5 h-5 text-red-500 fill-current" />
              Seus Favoritos
            </h2>

            {favoriteProducts.length === 0 ? (
              <div className="bg-ink-800/30 border border-white/5 rounded-3xl p-10 text-center">
                <Heart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">Você ainda não salvou nenhum produto.</p>
                <Link to="/catalogo" className="mt-4 inline-block text-gold-500 font-bold hover:underline">
                  Ver Catálogo
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favoriteProducts.map((p) => (
                  <motion.div 
                    key={p.id}
                    layout
                    className="bg-white/5 border border-white/10 rounded-3xl p-4 flex gap-4 items-center group"
                  >
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
                      <img src={getOptimizedImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold truncate text-sm">{p.name}</h4>
                      <p className="text-gold-500 font-bold text-sm mt-1">R$ {Number(p.price).toFixed(2).replace('.', ',')}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button 
                          onClick={() => addToCart({ ...p, quantity: p.unit === 'kg' ? 0.5 : 1, image: p.image_url })}
                          className="bg-white text-ink-950 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gold-500 transition-colors"
                        >
                          Adicionar
                        </button>
                        <button 
                          onClick={() => removeFavorite(p.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors p-1"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
