import React, { ReactNode, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Fish, 
  Settings, 
  Menu, 
  X, 
  LogOut, 
  User, 
  Bell,
  ChevronRight,
  Users,
  Trash2,
  Check,
  Zap,
  Info,
  CheckCircle,
  AlertTriangle,
  Database,
  Calculator,
  Warehouse,
  TrendingUp,
  FileSpreadsheet,
  Globe
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

import SyncStatusBadge from './SyncStatusBadge';
import InitialSyncModal from './InitialSyncModal';
import { UpdateModal } from './UpdateModal';
import { isDesktop } from '../utils/isDesktop';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  link: string;
  created_at: string;
}

interface AdminLayoutProps {
  children?: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('Administrador');
  const location = useLocation();
  const navigate = useNavigate();

  const [newOrderPopup, setNewOrderPopup] = useState<any | null>(null);

  const playOrderChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playNote(783.99, now, 0.25);       // G5
      playNote(1046.50, now + 0.2, 0.5);  // C6
    } catch (e) {
      console.error('Audio chime error:', e);
    }
  };

  const sendNativeDesktopNotification = (order: any) => {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          const customerName = order.customer_name || 'Cliente';
          const totalVal = Number(order.final_amount || order.total_amount || 0).toFixed(2).replace('.', ',');
          
          const notif = new Notification('🚨 NOVO PEDIDO RECEBIDO! - Fish House', {
            body: `Cliente: ${customerName} • R$ ${totalVal}\nClique para ver o pedido na tela.`,
            icon: '/logo.png',
            requireInteraction: true // Mantém a notificação fixa na tela do Windows até o usuário clicar
          });

          notif.onclick = () => {
            try { window.focus(); } catch (_) {}
            navigate('/admin/pedidos');
          };
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    } catch (err) {
      console.error('Desktop notification error:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUser();

    // Solicita permissão para notificações nativas da área de trabalho do Windows/Mac
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    // Listen for new orders in Realtime (both orders and pedidos tables)
    const handleNewIncomingOrder = (order: any) => {
      console.log('🚨 NEW ORDER REALTIME EVENT:', order);
      playOrderChime();
      setNewOrderPopup(order);
      sendNativeDesktopNotification(order);
    };

    const ordersChannel = supabase
      .channel('admin_global_orders_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        handleNewIncomingOrder(payload.new);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, (payload) => {
        // Se for pedido web/delivery
        if (payload.new.origem === 'web' || payload.new.tipo === 'delivery' || payload.new.tipo_pedido === 'delivery') {
          handleNewIncomingOrder(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || '');
      const name = user.user_metadata?.full_name || 
                   user.user_metadata?.name || 
                   user.email?.split('@')[0] || 
                   'Administrador';
      
      // Formatting the name if it's from email
      const formattedName = name.split('.')[0].charAt(0).toUpperCase() + name.split('.')[0].slice(1);
      setUserName(formattedName);
    }
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id);
  };

  const clearAllNotifications = async () => {
    await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setIsNotifOpen(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { name: 'PDV', icon: Calculator, path: '/admin/pdv' },
    { name: 'Estoque', icon: Warehouse, path: '/admin/estoque' },
    { name: 'Compras', icon: FileSpreadsheet, path: '/admin/compras' },
    { name: 'Financeiro', icon: TrendingUp, path: '/admin/financeiro' },
    { name: 'Pedidos', icon: ShoppingBag, path: '/admin/pedidos' },
    { name: 'Produtos', icon: Fish, path: '/admin/produtos' },
    { name: 'Clientes', icon: Users, path: '/admin/clientes' },
    { name: 'Configurações', icon: Settings, path: '/admin/config' },
    { name: 'Limpeza de Dados', icon: Database, path: '/admin/cleanup' },
  ];



  return (
    <div className="min-h-screen bg-ink-950 text-white flex overflow-hidden" style={{ position: 'relative' }}>
      {/* Modais exclusivos da versão Desktop instalável */}
      {isDesktop && <InitialSyncModal />}
      {isDesktop && <UpdateModal />}

      {/* Sidebar Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Sidebar — uses a fixed drawer on mobile, shrinks on desktop */}
      <aside
        style={{
          width: isSidebarOpen ? '256px' : '0px',
          minWidth: isSidebarOpen ? '256px' : '0px',
          overflow: 'hidden',
          transition: 'width 300ms ease, min-width 300ms ease',
          pointerEvents: isSidebarOpen ? 'auto' : 'none',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-ink-900, #0f1117)',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 70,
        }}
      >
        {/* Sidebar inner — fixed 256px width so content never overflows */}
        <div style={{ width: '256px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(207,161,74,0.3)]">
                <Fish className="text-ink-950 w-6 h-6" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight whitespace-nowrap">Fish Admin</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-500 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={() => {
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={({ isActive }) => `w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group text-left cursor-pointer ${
                    isActive
                    ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/10 font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-ink-950' : 'group-hover:text-gold-500'}`} />
                      <span className="font-medium whitespace-nowrap flex-1">{item.name}</span>
                      {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all text-left"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="font-medium text-sm">Encerrar Sessão</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 bg-ink-900/50 backdrop-blur-md border-b border-white/5 px-4 md:px-8 flex items-center justify-between sticky top-0 z-[50] shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              {isSidebarOpen && window.innerWidth >= 768 ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="hidden md:block text-sm font-bold text-white uppercase tracking-[0.2em] opacity-50">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
            </h2>
            <h2 className="md:hidden text-xs font-black text-gold-500 uppercase tracking-widest">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Fish Admin'}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Local-First Sync Engine Status Badge */}
            <SyncStatusBadge />

            {/* Share B2B Link */}
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/atacado`);
                alert('Link do Canal de Atacado B2B copiado para a área de transferência!');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gold-500/10 text-gold-500 border border-gold-500/20 rounded-xl text-xs font-bold transition-all hover:bg-gold-500 hover:text-ink-950 cursor-pointer"
              title="Copiar Link do Canal de Atacado B2B"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Compartilhar Atacado</span>
            </button>

            {/* Bell/Notifications */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2 rounded-lg transition-all ${isNotifOpen ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-600 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-ink-900 text-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      onClick={() => setIsNotifOpen(false)}
                      className="fixed inset-0 z-40 bg-black/20" 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-80 md:w-96 bg-ink-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-50 origin-top-right backdrop-blur-xl"
                    >
                      <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gold-500">Notificações</h3>
                        <button 
                          onClick={clearAllNotifications}
                          className="text-[10px] font-black uppercase text-gray-500 hover:text-red-500 transition-all flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" /> Limpar tudo
                        </button>
                      </div>

                      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-12 text-center text-gray-500 italic text-sm">
                            <Info className="w-8 h-8 mx-auto mb-3 opacity-20" />
                            Nenhuma notificação por aqui.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id} 
                              onClick={() => { markAsRead(n.id); setIsNotifOpen(false); navigate(n.link); }}
                              className={`p-4 border-b border-white/5 transition-all cursor-pointer flex gap-4 ${n.is_read ? 'opacity-50' : 'bg-white/5 hover:bg-white/10'}`}
                            >
                              <div className={`p-2 rounded-xl shrink-0 h-fit ${
                                n.type === 'success' ? 'bg-green-500/10 text-green-500' : 
                                n.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                                'bg-blue-500/10 text-blue-500'
                              }`}>
                                {n.type === 'success' ? <CheckCircle className="w-4 h-4" /> : 
                                 n.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                  <p className="text-xs font-black uppercase tracking-tight text-white leading-tight">{n.title}</p>
                                  <button 
                                    onClick={(e) => deleteNotification(n.id, e)}
                                    className="p-1 text-gray-700 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                <p className="text-[9px] text-gray-600 font-bold uppercase">{new Date(n.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-white/10 mx-1 md:mx-2" />
            <div className="flex items-center gap-3 pl-1">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white leading-none">{userName}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{userEmail || 'Administrador'}</p>
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-full border border-white/10 flex items-center justify-center group-hover:border-gold-500/50 transition-all overflow-hidden shrink-0">
                <User className="text-gray-400 w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence>
            {newOrderPopup && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="sticky top-4 z-50 max-w-2xl mx-auto px-4"
              >
                <div className="bg-gold-500 text-ink-950 p-4 rounded-2xl shadow-2xl border border-white/20 flex items-center justify-between gap-4 animate-bounce">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-ink-950/10 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-6 h-6 text-ink-950" />
                    </div>
                    <div>
                      <p className="font-black text-xs uppercase tracking-widest text-ink-950">🚨 NOVO PEDIDO RECEBIDO DA LOJA!</p>
                      <p className="text-xs font-bold opacity-90">
                        {newOrderPopup.customer_name || 'Cliente'} • Total: R$ {Number(newOrderPopup.final_amount || newOrderPopup.total_amount || 0).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setNewOrderPopup(null);
                        navigate('/admin/pedidos');
                      }}
                      className="bg-ink-950 text-gold-500 hover:bg-ink-900 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Ver Pedidos
                    </button>
                    <button
                      onClick={() => setNewOrderPopup(null)}
                      className="p-2 hover:bg-ink-950/10 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4 text-ink-950" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
