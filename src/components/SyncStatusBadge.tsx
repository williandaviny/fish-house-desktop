import React, { useState, useEffect } from 'react';
import { syncEngine } from '../services/local/syncEngine';
import { LocalSyncStatus } from '../services/local/localDb';
import { RefreshCw, CheckCircle2, CloudUpload, HardDrive, AlertTriangle } from 'lucide-react';
import { isDesktop } from '../utils/isDesktop';

export default function SyncStatusBadge() {
  const [status, setStatus] = useState<LocalSyncStatus>({
    last_synced_at: null,
    is_syncing: false,
    pending_count: 0,
    error: null
  });

  useEffect(() => {
    if (!isDesktop) return;

    // Inicia background sync a cada 2 horas apenas no app desktop
    syncEngine.startBackgroundSync(7200000);
    const unsubscribe = syncEngine.subscribe(setStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  if (!isDesktop) return null;

  const handleManualSync = async () => {
    if (status.is_syncing) return;
    await syncEngine.syncAll();
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Nunca';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recente';
    }
  };

  return (
    <button
      onClick={handleManualSync}
      disabled={status.is_syncing}
      title={
        status.error 
          ? `Erro de sincronização: ${status.error}. Clique para tentar novamente.` 
          : `Banco Local Ativo (0ms). Última sinc: ${formatLastSync(status.last_synced_at)}. Clique para sincronizar agora.`
      }
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
        status.error
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          : status.pending_count > 0
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 animate-pulse'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
      }`}
    >
      <HardDrive className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">
        {status.is_syncing 
          ? 'Sincronizando...' 
          : status.pending_count > 0 
          ? `${status.pending_count} na fila` 
          : 'Local (0ms)'}
      </span>
      
      {status.is_syncing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold-500" />
      ) : status.pending_count > 0 ? (
        <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      )}
    </button>
  );
}
