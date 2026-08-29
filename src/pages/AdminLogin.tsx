import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Mail, Fish, AlertCircle, ShoppingBag } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      setLoading(false);
      return;
    }

    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-ink-900 border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(207,161,74,0.3)] animate-pulse">
              <Fish className="w-10 h-10 text-ink-950" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-widest">Acesso VIP</h1>
            <p className="text-gray-400 text-sm italic font-medium">Painel Administrativo Fish House</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-widest ml-1">E-mail Operacional</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold-500 transition-colors" />
                <input 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-gold-500/40 transition-all font-medium"
                  placeholder="seu@email.com.br"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-widest ml-1">Senha de Comando</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold-500 transition-colors" />
                <input 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-gold-500/40 transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-ink-950 py-4 rounded-2xl font-bold uppercase tracking-widest shadow-[0_10px_20px_rgba(207,161,74,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" />
              ) : (
                <>Entrar no Painel <ShoppingBag className="w-5 h-5" /></>
              )}
            </button>
          </form>

          <p className="mt-12 text-center text-[10px] text-gray-600 uppercase tracking-widest font-bold">
            Fish House &copy; 2026 • Peixaria Premium
          </p>
        </div>
      </motion.div>
    </div>
  );
}
