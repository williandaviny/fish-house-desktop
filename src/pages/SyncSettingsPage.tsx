import React, { useState, useEffect } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { syncEngine } from '../services/database/supabaseSync';
import { useDatabase } from '../context/DatabaseContext';
import { UpdaterService, UpdateInfo, APP_VERSION } from '../services/updater/updater';
import { Cloud, Download, Upload, RefreshCw, Database, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

export const SyncSettingsPage: React.FC = () => {
  const { config, refreshConfig } = useDatabase();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    checkUpdates();
  }, []);

  const handlePullCatalog = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncEngine.pullFullCatalog();
    setSyncMsg(res.message);
    setSyncing(false);
  };

  const handlePushSales = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncEngine.pushPendingSales();
    setSyncMsg(res.message);
    setSyncing(false);
  };

  const handleExportBackup = async () => {
    const jsonStr = await sqliteService.exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish_house_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        await sqliteService.importDatabaseJSON(text);
        alert('Backup restaurado com sucesso no SQLite local!');
      } catch (err: any) {
        alert('Erro ao importar backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    const info = await UpdaterService.checkForUpdates();
    setUpdateInfo(info);
    setCheckingUpdate(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-900/30 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-extrabold text-white">Sincronização & Backup do Sistema</h3>
        <p className="text-xs text-slate-400">Controle a integração com a nuvem Supabase, sincronização de catálogo e atualizações automáticas.</p>
      </div>

      {syncMsg && (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{syncMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sincronização Supabase */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-md">
          <div className="flex items-center gap-3 text-cyan-400 font-extrabold text-sm">
            <Cloud className="w-5 h-5" />
            <span>Sincronização com o Supabase (Nuvem)</span>
          </div>

          <p className="text-xs text-slate-400">
            Baixe novos produtos cadastrados no site ou envie as vendas feitas no balcão diretamente para o banco central.
          </p>

          <div className="space-y-3 pt-2">
            <button
              disabled={syncing}
              onClick={handlePullCatalog}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 font-bold text-xs text-white flex items-center justify-center gap-2 transition-all"
            >
              <Download className={`w-4 h-4 text-cyan-400 ${syncing ? 'animate-bounce' : ''}`} />
              <span>Baixar Catálogo Mestre da Nuvem (Pull)</span>
            </button>

            <button
              disabled={syncing}
              onClick={handlePushSales}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-cyan-950"
            >
              <Upload className="w-4 h-4" />
              <span>Enviar Vendas Pendentes para a Nuvem (Push)</span>
            </button>
          </div>
        </div>

        {/* Backup Local */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-md">
          <div className="flex items-center gap-3 text-emerald-400 font-extrabold text-sm">
            <Database className="w-5 h-5" />
            <span>Backup e Restauração Local (SQLite)</span>
          </div>

          <p className="text-xs text-slate-400">
            Exporte uma cópia completa de segurança em arquivo para manter no seu computador ou pen drive.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleExportBackup}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 font-bold text-xs text-white flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar Arquivo de Backup (.json)</span>
            </button>

            <label className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 font-bold text-xs text-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-all">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Restaurar Banco de Dados de um Arquivo</span>
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* Versão e Atualização Automática */}
        <div className="col-span-full bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                Versão do Sistema: v{APP_VERSION}
                {updateInfo?.hasUpdate && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    Atualização Disponível: v{updateInfo.latestVersion}
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-400">
                Instalação com atualizações automáticas integradas diretamente ao GitHub Releases.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={checkingUpdate}
              onClick={checkUpdates}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>Checar Atualizações</span>
            </button>

            {updateInfo?.hasUpdate && updateInfo.downloadUrl && (
              <a
                href={updateInfo.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950"
              >
                Baixar Instalador v{updateInfo.latestVersion}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
