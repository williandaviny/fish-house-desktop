import React, { useState, useEffect } from 'react';
import { syncEngine } from '../services/local/syncEngine';
import { localDb } from '../services/local/localDb';
import { motion, AnimatePresence } from 'motion/react';
import { Fish, Database, CheckCircle2, RefreshCw } from 'lucide-react';

export default function InitialSyncModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'initial' | 'syncing' | 'completed'>('initial');
  const [syncedCount, setSyncedCount] = useState(0);

  useEffect(() => {
    // Checa se o banco local esta vazio na primeira inicializacao
    const prods = localDb.getProducts();
    if (!prods || prods.length === 0) {
      setIsOpen(true);
      handleStartInitialSync();
    }
  }, []);

  const handleStartInitialSync = async () => {
    setLoading(true);
    setStep('syncing');

    try {
      const res = await syncEngine.downloadInitialCatalog(true);
      if (res.success) {
        setSyncedCount(res.count);
        setStep('completed');
        setTimeout(() => {
          setIsOpen(false);
        }, 2500);
      } else {
        setStep('initial');
      }
    } catch (err) {
      console.error('Erro na sincronizacao inicial:', err);
      setStep('initial');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-ink-900 border border-gold-500/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-center"
      >
        {/* Glow decor */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-gold-500/20 blur-[80px] rounded-full pointer-events-none" />

        <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(207,161,74,0.3)] animate-pulse">
          <Fish className="w-9 h-9 text-ink-950" />
        </div>

        <h3 className="text-2xl font-display font-bold text-white mb-2">
          {step === 'completed' ? 'Sincronização Concluída!' : 'Configurando Banco Local'}
        </h3>

        <p className="text-gray-400 text-xs font-medium mb-6 leading-relaxed">
          {step === 'completed'
            ? `Tudo pronto! ${syncedCount} produtos e dados foram salvos no seu computador. O sistema agora opera com 0ms e autonomia offline.`
            : 'Baixando catálogo completo de peixes, preços, taras de balança Toledo e fotos da nuvem para o armazenamento local...'}
        </p>

        {step === 'syncing' && (
          <div className="space-y-4">
            <div className="w-full bg-ink-950 rounded-full h-3 p-0.5 border border-white/10 overflow-hidden">
              <div className="bg-gradient-to-r from-gold-400 to-gold-600 h-full rounded-full animate-pulse w-3/4" />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-gold-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Alimentando banco de dados local...</span>
            </div>
          </div>
        )}

        {step === 'completed' && (
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span>Banco Local Pronto (0ms de latência)</span>
          </div>
        )}

        {step === 'initial' && (
          <button
            onClick={handleStartInitialSync}
            disabled={loading}
            className="w-full bg-gold-500 hover:bg-gold-600 text-ink-950 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Database className="w-4 h-4" /> Iniciar Download do Catálogo
          </button>
        )}
      </motion.div>
    </div>
  );
}
