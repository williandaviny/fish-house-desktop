import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Plus, ShoppingBag, MessageCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { getOptimizedImageUrl } from '../utils/image';

export default function Cart() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    payment: 'pix'
  });

  const handleCheckout = (e: FormEvent) => {
    e.preventDefault();
    
    let message = `*Novo Pedido - Fish House*\n\n`;
    message += `*Cliente:* ${formData.name}\n`;
    message += `*Endereço:* ${formData.address}\n`;
    message += `*Pagamento:* ${formData.payment.toUpperCase()}\n\n`;
    message += `*Itens do Pedido:*\n`;
    
    items.forEach(item => {
      const unitLabel = item.unit || 'un';
      const qtyLabel = item.quantity.toString().replace('.', ',');
      message += `${qtyLabel}${unitLabel} ${item.name} - R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}\n`;
    });
    
    message += `\n*Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*`;

    const url = `https://wa.me/554730114981?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    clearCart();
    setIsCartOpen(false);
    setIsCheckingOut(false);
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-ink-900 border-l border-white/10 z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-gold-500" />
                Seu Carrinho
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                  <ShoppingBag className="w-16 h-16 opacity-20" />
                  <p className="text-lg">Seu carrinho está vazio</p>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="text-gold-500 hover:text-gold-400 font-medium"
                  >
                    Continuar comprando
                  </button>
                </div>
              ) : isCheckingOut ? (
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nome Completo</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-ink-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500 transition-colors"
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Endereço de Entrega</label>
                    <textarea 
                      required
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-ink-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500 transition-colors resize-none h-24"
                      placeholder="Rua, Número, Bairro, Complemento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Forma de Pagamento</label>
                    <select 
                      value={formData.payment}
                      onChange={e => setFormData({...formData, payment: e.target.value})}
                      className="w-full bg-ink-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500 transition-colors appearance-none"
                    >
                      <option value="pix">
                        PIX {settings?.pix_discount_enabled ? `(${settings.pix_discount_percent}% de desconto)` : ''}
                      </option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="dinheiro">Dinheiro</option>
                    </select>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => {
                    const step = item.unit === 'kg' ? 0.1 : 1;
                    return (
                      <div key={item.id} className="flex gap-4 bg-ink-800/50 p-3 rounded-2xl border border-white/5">
                        <img 
                          src={getOptimizedImageUrl(item.image)} 
                          alt={item.name} 
                          className="w-20 h-20 object-cover rounded-xl"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-white font-medium text-sm leading-tight mb-1">{item.name}</h3>
                            <div className="flex justify-between items-baseline">
                              <p className="text-gold-500 font-bold text-sm">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                              <p className="text-[10px] text-gray-500 uppercase font-bold">por {item.unit || 'un'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 bg-ink-900 rounded-lg px-2 py-1 border border-white/10">
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity - step)}
                                className="text-gray-400 hover:text-white p-1"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-white font-bold text-xs min-w-[30px] text-center">
                                {item.quantity.toString().replace('.', ',')}
                                <span className="text-[9px] text-gray-500 ml-0.5">{item.unit || 'un'}</span>
                              </span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + step)}
                                className="text-gray-400 hover:text-white p-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-400 hover:text-red-300 text-[11px] font-bold uppercase tracking-wider"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-white/10 bg-ink-900">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-400">Total do Pedido</span>
                  <span className="text-2xl font-bold text-white font-display">
                    R$ {cartTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {isCheckingOut ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsCheckingOut(false)}
                      className="flex-1 py-4 rounded-xl font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      form="checkout-form"
                      type="submit"
                      className="flex-[2] flex items-center justify-center gap-2 bg-gradient-to-r from-gold-400 to-gold-600 text-ink-900 py-4 rounded-xl font-bold hover:from-gold-300 hover:to-gold-500 transition-all shadow-[0_0_20px_rgba(207,161,74,0.3)]"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Enviar Pedido
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      if (location.pathname.startsWith('/atacado')) {
                        navigate('/atacado/checkout');
                      } else {
                        navigate('/checkout');
                      }
                    }}
                    className="w-full py-4 rounded-xl font-bold text-ink-900 bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-300 hover:to-gold-500 transition-all shadow-[0_0_20px_rgba(207,161,74,0.3)]"
                  >
                    Finalizar Compra
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
