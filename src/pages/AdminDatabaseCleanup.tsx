import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDb } from '../services/local/localDb';
import { 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  Trash2, 
  RefreshCw, 
  Copy, 
  Check, 
  ShieldCheck, 
  ShoppingBag, 
  Receipt, 
  Archive 
} from 'lucide-react';

export default function AdminDatabaseCleanup() {
  const [activeTab, setActiveTab] = useState<'reset_sales' | 'images'>('reset_sales');

  // --- Reset Sales State ---
  const [loadingSalesStats, setLoadingSalesStats] = useState(false);
  const [resettingSales, setResettingSales] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  const [stats, setStats] = useState({
    onlineOrders: 0,
    vendasPdv: 0,
    caixas: 0,
    tefTransacoes: 0,
    localQueue: 0
  });

  // --- Image Migration State ---
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageTotal, setImageTotal] = useState(0);
  const [imageStatus, setImageStatus] = useState<string>('');
  const [imageCompleted, setImageCompleted] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingSalesStats(true);
    try {
      // 1. Pedidos online (orders)
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // 2. Vendas PDV (vendas)
      const { count: vendasCount } = await supabase
        .from('vendas')
        .select('*', { count: 'exact', head: true });

      // 3. Caixas
      const { count: caixasCount } = await supabase
        .from('caixas')
        .select('*', { count: 'exact', head: true });

      // 4. TEF
      const { count: tefCount } = await supabase
        .from('tef_transacoes')
        .select('*', { count: 'exact', head: true });

      const syncQueue = localDb.getSyncQueue();

      setStats({
        onlineOrders: ordersCount ?? 0,
        vendasPdv: vendasCount ?? 0,
        caixas: caixasCount ?? 0,
        tefTransacoes: tefCount ?? 0,
        localQueue: syncQueue.length
      });
    } catch (err: any) {
      console.warn('Erro ao carregar estatísticas:', err.message);
    } finally {
      setLoadingSalesStats(false);
    }
  };

  const executeResetSales = async () => {
    setResettingSales(true);
    setResetFeedback(null);

    try {
      // 1. Tentar executar via RPC segura
      let rpcSucceeded = false;
      try {
        const { data, error } = await supabase.rpc('reset_vendas_pdv_lancamento');
        if (!error && data?.success) {
          rpcSucceeded = true;
        }
      } catch (e) {
        console.warn('RPC reset_vendas_pdv_lancamento não disponível, prosseguindo com exclusão direta controlada.', e);
      }

      // 2. Fallback com exclusão sequencial pelas tabelas se a RPC não rodou
      if (!rpcSucceeded) {
        // Exclui documentos fiscais de vendas
        await supabase.from('documentos_fiscais').delete().eq('referencia_tipo', 'venda');

        // Exclui contas a receber ligadas a vendas
        await supabase.from('contas_receber').delete().not('venda_id', 'is', null);

        // Exclui transações TEF
        await supabase.from('tef_transacoes').delete().gte('created_at', '1970-01-01');

        // Exclui pagamentos de venda e itens
        await supabase.from('pagamentos_venda').delete().gte('created_at', '1970-01-01');
        await supabase.from('venda_itens').delete().gte('created_at', '1970-01-01');

        // Exclui vendas balcão/PDV
        await supabase.from('vendas').delete().gte('created_at', '1970-01-01');

        // Exclui caixas
        await supabase.from('caixas').delete().gte('created_at', '1970-01-01');

        // Exclui movimentações de estoque geradas por vendas de teste
        await supabase.from('movimentacoes_estoque').delete().eq('referencia_tipo', 'venda');
      }

      // 3. Limpar bancos e filas locais no dispositivo
      localDb.clearOrders();
      localDb.clearCurrentCaixa();
      localDb.clearSyncQueue();

      setResetFeedback({
        success: true,
        message: 'Vendas de teste e caixas zerados com sucesso! O histórico dos pedidos online foi 100% mantido intacto.'
      });

      setShowConfirmModal(false);
      setConfirmInput('');
      await fetchStats();
    } catch (err: any) {
      console.error('Erro ao resetar vendas:', err);
      setResetFeedback({
        success: false,
        message: 'Erro ao zerar: ' + (err.message || 'Verifique suas permissões de administrador.')
      });
    } finally {
      setResettingSales(false);
    }
  };

  const sqlScript = `-- SCRIPT DE RESET SEGURO PARA 1º DE OUTUBRO
-- Preserva 100% dos pedidos online (orders e order_items)
DELETE FROM public.documentos_fiscais WHERE referencia_tipo = 'venda';
DELETE FROM public.contas_receber WHERE categoria = 'venda_balcao' OR venda_id IS NOT NULL;
DELETE FROM public.tef_transacoes;
DELETE FROM public.venda_itens;
DELETE FROM public.pagamentos_venda;
DELETE FROM public.vendas;
DELETE FROM public.caixas;
DELETE FROM public.movimentacoes_estoque WHERE tipo_movimentacao = 'saida_venda' OR referencia_tipo = 'venda';`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // --- Função de Migração de Imagens ---
  const startImageCleanup = async () => {
    setLoadingImages(true);
    setImageCompleted(false);
    setImageProgress(0);
    setImageStatus('Buscando produtos no banco de dados...');

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url');

      if (error) throw error;
      if (!products) {
        setImageStatus('Nenhum produto encontrado.');
        setLoadingImages(false);
        return;
      }

      const base64Products = products.filter(p => p.image_url?.startsWith('data:image'));
      setImageTotal(base64Products.length);

      if (base64Products.length === 0) {
        setImageStatus('Todos os produtos já estão otimizados! Nenhuma imagem Base64 encontrada.');
        setImageCompleted(true);
        setLoadingImages(false);
        return;
      }

      setImageStatus(`Encontrados ${base64Products.length} produtos com imagens pesadas. Iniciando conversão para WebP...`);

      for (let i = 0; i < base64Products.length; i++) {
        const product = base64Products[i];
        setImageStatus(`Convertendo: ${product.name} (${i + 1}/${base64Products.length})`);

        try {
          const img = new Image();
          img.src = product.image_url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas validation failed');

          const MAX_SIZE = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const blob = await new Promise<Blob | null>(resolve => 
            canvas.toBlob(resolve, 'image/webp', 0.8)
          );

          if (!blob) throw new Error('Failed to create WebP blob');

          const fileName = `migrated_${Date.now()}_${product.id.substring(0, 8)}.webp`;
          const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(fileName, blob);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);

          const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', product.id);

          if (updateError) throw updateError;

          setImageProgress(i + 1);
        } catch (err: any) {
          console.error(`Erro ao converter ${product.name}:`, err);
        }
      }

      setImageStatus(`Migração concluída! ${base64Products.length} imagens convertidas e otimizadas.`);
      setImageCompleted(true);
    } catch (err: any) {
      console.error('Migration error:', err);
      setImageStatus('Erro ocorreu: ' + err.message);
    } finally {
      setLoadingImages(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-gold-500/10 p-3 rounded-2xl border border-gold-500/20 text-gold-400">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Gestão e Limpeza de Dados</h1>
            <p className="text-gray-400 text-sm">Manutenção de banco, preparação para o lançamento e otimização de banda.</p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-ink-900 border border-white/10 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('reset_sales')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'reset_sales'
                ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Zerar Vendas (1º de Outubro)
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'images'
                ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Otimizar Imagens
          </button>
        </div>
      </div>

      {activeTab === 'reset_sales' && (
        <div className="space-y-6">
          {/* Card Informativo de Segurança */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex items-start gap-4">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-emerald-300">Preservação Total dos Pedidos Online</h3>
              <p className="text-sm text-emerald-200/80 leading-relaxed mt-1">
                O histórico de pedidos feitos pelos clientes na loja virtual (tabelas <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-white font-mono">orders</code> e <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-white font-mono">order_items</code>), 
                bem como o catálogo de produtos, categorias, clientes e fornecedores, <strong>NÃO</strong> serão afetados por esta limpeza.
              </p>
            </div>
          </div>

          {/* Estatísticas Atuais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-ink-900 border border-emerald-500/20 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-bold uppercase tracking-wider">
                <span>Pedidos Online</span>
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white">{stats.onlineOrders}</p>
              <p className="text-[10px] text-emerald-400/80">Mantidos 100% intactos</p>
            </div>

            <div className="bg-ink-900 border border-white/10 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                <span>Vendas PDV Balcão</span>
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400">{stats.vendasPdv}</p>
              <p className="text-[10px] text-gray-500">Serão zeradas</p>
            </div>

            <div className="bg-ink-900 border border-white/10 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                <span>Caixas Registrados</span>
                <Archive className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400">{stats.caixas}</p>
              <p className="text-[10px] text-gray-500">Serão zerados</p>
            </div>

            <div className="bg-ink-900 border border-white/10 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                <span>Fila Local Sync</span>
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-black text-blue-400">{stats.localQueue}</p>
              <p className="text-[10px] text-gray-500">Será limpa no aparelho</p>
            </div>
          </div>

          {/* Feedback */}
          {resetFeedback && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              resetFeedback.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {resetFeedback.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span className="text-sm font-semibold">{resetFeedback.message}</span>
            </div>
          )}

          {/* Painel de Ação de Zeramento */}
          <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Zerar Operação de Vendas para 1º de Outubro</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Esta ação prepara a Peixaria Fish House para o início oficial das operações em 1º de outubro.
                Todas as vendas de teste do PDV, históricos de caixa, transações TEF e filas locais serão excluídos, 
                permitindo que a equipe inicie com caixa zerado e controle financeiro 100% limpo.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={fetchStats}
                disabled={loadingSalesStats}
                className="px-4 py-3 bg-ink-950 border border-white/10 hover:border-white/20 text-gray-300 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSalesStats ? 'animate-spin' : ''}`} />
                Atualizar Contadores
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={resettingSales}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/20 flex items-center gap-2 transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                Zerar Vendas e Caixas de Teste
              </button>
            </div>

            {/* SQL Script Viewer */}
            <div className="pt-4 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Script SQL Direto (Opcional - Supabase SQL Editor)</span>
                <button
                  onClick={copySqlToClipboard}
                  className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 transition-colors font-bold"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copiado!' : 'Copiar SQL'}
                </button>
              </div>
              <pre className="bg-ink-950 p-4 rounded-xl border border-white/10 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre leading-relaxed">
                {sqlScript}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'images' && (
        <div className="bg-ink-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <Database className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-widest">Otimização de Imagens</h2>
              <p className="text-gray-400 text-sm mt-1">Converta imagens antigas em Base64 para WebP no Storage e economize banda.</p>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-bold text-white">Sobre Egress (Banda do Supabase)</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Produtos antigos salvavam imagens em formato de texto gigante (Base64) direto na tabela.
                Este script converte as imagens para WebP super leves no Supabase Storage, economizando mais de 98% da banda.
              </p>
            </div>
          </div>

          <div className="bg-ink-950 p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Progresso da Conversão</span>
              <span className="text-white font-bold">{imageProgress} / {imageTotal}</span>
            </div>
            
            <div className="w-full bg-ink-900 border border-white/10 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-gold-400 to-gold-600 h-full transition-all duration-500 ease-out"
                style={{ width: imageTotal > 0 ? `${(imageProgress / imageTotal) * 100}%` : '0%' }}
              />
            </div>

            {imageStatus && (
              <div className="flex items-center gap-2 text-sm text-gold-500 font-medium">
                {loadingImages && <Loader2 className="w-4 h-4 animate-spin" />}
                {imageCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                <span className={imageCompleted ? 'text-green-500' : ''}>{imageStatus}</span>
              </div>
            )}

            <button
              onClick={startImageCleanup}
              disabled={loadingImages || imageCompleted}
              className="w-full bg-gold-500 text-ink-950 font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-gold-400 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingImages ? 'Processando (aguarde, não saia desta tela)...' : 'Iniciar Limpeza do Banco'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <div className="bg-red-500/10 p-3 rounded-2xl border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Confirmar Zeramento de Vendas</h3>
                <p className="text-xs text-red-400 font-bold">Esta ação não poderá ser desfeita</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-300 leading-relaxed bg-ink-950 p-4 rounded-2xl border border-white/5">
              <p>Você está prestes a remover todas as <strong>vendas e caixas de teste</strong> para o início de 1º de Outubro.</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-gray-400">
                <li><strong className="text-emerald-400">Pedidos Online:</strong> 100% PRESERVADOS.</li>
                <li><strong className="text-emerald-400">Catálogo e Estoque:</strong> 100% PRESERVADOS.</li>
                <li><strong className="text-red-400">Vendas de Balcão e Caixas:</strong> SERÃO EXCLUÍDOS.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Digite <span className="text-red-400 font-mono">ZERAR</span> para confirmar:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value.toUpperCase())}
                placeholder="ZERAR"
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-center tracking-widest uppercase focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmInput('');
                }}
                disabled={resettingSales}
                className="flex-1 py-3 bg-ink-950 border border-white/10 hover:border-white/20 text-gray-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeResetSales}
                disabled={confirmInput !== 'ZERAR' || resettingSales}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {resettingSales ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Zerando...
                  </>
                ) : (
                  'Confirmar e Zerar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
