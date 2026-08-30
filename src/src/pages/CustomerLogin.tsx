import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { motion } from 'motion/react';
import { Phone, ArrowRight, Fish } from 'lucide-react';

export default function CustomerLogin() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Se o usuário veio de uma página específica, redirecionamos de volta pra ela
  const from = (location.state as any)?.from?.pathname || '/meus-pedidos';

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      // Máscara básica (XX) XXXXX-XXXX
      if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      if (value.length > 9) value = `${value.slice(0, 10)}-${value.slice(10)}`;
      setPhone(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 14) return; // Mínimo (XX) XXXXX-XXXX

    setLoading(true);
    
    // Simulando um delay para parecer que está processando
    setTimeout(() => {
      login(phone);
      setLoading(false);
      navigate(from, { replace: true });
    }, 800);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-24 pb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-ink-800/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/10 text-gold-500 mb-4">
            <Fish className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white mb-2">Acompanhe seu Pedido</h1>
          <p className="text-gray-400 text-sm">
            Digite seu WhatsApp para ver o status dos seus pedidos na Fish House.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="phone" className="block text-xs font-semibold text-gold-500 uppercase tracking-wider mb-2 ml-1">
              Seu WhatsApp
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="w-5 h-5 text-gray-500" />
              </div>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                className="block w-full pl-12 pr-4 py-4 bg-ink-900 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-all text-lg font-medium"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || phone.length < 14}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-ink-900 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-gold-500/10"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Acessar Meus Pedidos
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-500">
          Ao acessar, você concorda em receber atualizações sobre seus pedidos via WhatsApp.
        </p>
      </motion.div>
    </div>
  );
}
