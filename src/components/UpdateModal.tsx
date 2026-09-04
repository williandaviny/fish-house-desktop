import React, { useEffect, useState } from 'react';
import { Sparkles, Download, X, CheckCircle, RefreshCw, Zap } from 'lucide-react';
import { UpdaterService, UpdateInfo, APP_VERSION } from '../services/updater/updater';
import { isDesktop } from '../utils/isDesktop';

export const UpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [progresso, setProgresso] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
    // Nunca checa ou baixa executavel Windows quando estiver no navegador / nuvem
    if (!isDesktop) return;

    // Checa se ha atualizacao 3 segundos apos abrir o sistema
    const timer = setTimeout(async () => {
      try {
        const info = await UpdaterService.checkForUpdates();
        if (info.hasUpdate) {
          setUpdateInfo(info);
          setModalOpen(true);
        }
      } catch (err) {
        console.log('Verificacao de update:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleAtualizarSilencioso = async () => {
    const targetUrl = updateInfo?.downloadUrl || 'https://github.com/williandaviny/fish-house-desktop/releases';

    try {
      setAtualizando(true);
      setStatusMsg('Conectando e iniciando download...');
      setProgresso(2);

      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Escuta o evento de progresso vindo do Rust
      const unlisten = await listen<number>('update-progress', (event) => {
        const pct = event.payload;
        setProgresso(pct);
        if (pct < 100) {
          setStatusMsg(`Baixando atualização: ${pct}% concluído...`);
        } else {
          setStatusMsg('Download finalizado! Instalando e reiniciando...');
        }
      });

      // Dispara o download nativo em segundo plano
      await invoke('download_and_install_update', { url: targetUrl });
      unlisten();
    } catch (err: any) {
      console.error('Erro na atualizacao nativa, abrindo navegador como fallback:', err);
      setStatusMsg('Redirecionando para download...');
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_url', { url: targetUrl });
      } catch {
        window.open(targetUrl, '_blank');
      }
      setAtualizando(false);
    }
  };

  if (!isDesktop || !modalOpen || !updateInfo) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-ink-900 rounded-[2.5rem] p-6 space-y-4 border border-gold-500/40 shadow-2xl animate-in fade-in zoom-in duration-200 text-left">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nova Atualização Disponível!</h3>
              <p className="text-xs text-gray-400">
                Versão <strong className="text-gold-400 font-mono">v{updateInfo.latestVersion}</strong> (Sua versão: v{APP_VERSION})
              </p>
            </div>
          </div>
          {!atualizando && (
            <button
              onClick={() => setModalOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Detalhes da Atualizacao */}
        <div className="space-y-2 text-xs">
          <p className="text-gray-300 font-semibold">O que há de novo nesta versão:</p>
          <div className="p-3.5 rounded-2xl bg-ink-950 border border-white/5 text-gray-400 whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed">
            {updateInfo.body}
          </div>
        </div>

        {/* Barra de Progresso de Download / Instalacao */}
        {atualizando ? (
          <div className="space-y-2.5 py-2">
            <div className="flex justify-between text-xs text-gray-300">
              <span className="flex items-center space-x-2">
                <RefreshCw size={13} className="animate-spin text-gold-400" />
                <span className="font-medium text-gold-300">{statusMsg}</span>
              </span>
              <span className="font-mono font-bold text-gold-400">{progresso}%</span>
            </div>
            <div className="w-full bg-ink-950 rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
              <div
                style={{ width: `${progresso}%` }}
                className="bg-gradient-to-r from-gold-400 to-gold-600 h-full rounded-full transition-all duration-200 shadow-lg shadow-gold-500/30"
              />
            </div>
            <p className="text-[11px] text-gray-400 text-center flex items-center justify-center space-x-1.5 pt-1">
              <Zap size={12} className="text-gold-400" />
              <span>O sistema reiniciará sozinho em poucos segundos. Não feche a janela.</span>
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-gold-500/10 border border-gold-500/20 text-[11px] text-gold-300 flex items-center space-x-2">
            <CheckCircle size={14} className="text-gold-400 shrink-0" />
            <span>Atualização 100% segura: suas vendas, estoque e configurações locais permanecem intactos!</span>
          </div>
        )}

        {!atualizando && (
          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-ink-950 hover:bg-white/5 text-gray-300 font-semibold text-xs transition border border-white/10"
            >
              Lembrar Depois
            </button>

            <button
              type="button"
              onClick={handleAtualizarSilencioso}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 hover:brightness-110 text-ink-950 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-gold-500/20 cursor-pointer"
            >
              <Download size={14} />
              <span>Atualizar Agora (Automático)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
