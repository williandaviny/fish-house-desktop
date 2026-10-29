import { supabase } from '../../lib/supabase';
import { localDb, LocalSyncItem, LocalSyncStatus } from './localDb';

type SyncListener = (status: LocalSyncStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private timer: any = null;
  private listeners: Set<SyncListener> = new Set();
  private lastError: string | null = null;

  public subscribe(fn: SyncListener): () => void {
    this.listeners.add(fn);
    this.notify();
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const status: LocalSyncStatus = {
      last_synced_at: localDb.getLastSyncTimestamp(),
      is_syncing: this.isSyncing,
      pending_count: localDb.getSyncQueue().length,
      error: this.lastError
    };
    this.listeners.forEach(fn => {
      try { fn(status); } catch (e) { console.error(e); }
    });
  }

  // Baixa o catalogo completo inicial do Supabase para o banco local
  public async downloadInitialCatalog(force = false): Promise<{ success: boolean; count: number; error?: string }> {
    const existingProducts = localDb.getProducts();
    if (existingProducts.length > 0 && !force) {
      return { success: true, count: existingProducts.length };
    }

    try {
      this.isSyncing = true;
      this.notify();

      console.log('[SyncEngine] Baixando catálogo inicial da nuvem...');

      // 1. Produtos
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (prodErr) throw prodErr;
      if (prods) {
        const activeOnly = prods.filter((p: any) => p.is_deleted !== true);
        localDb.setProducts(activeOnly);
      }

      // 2. Taras de Balança
      const { data: taras } = await supabase
        .from('taras_balanca')
        .select('*')
        .order('ordem');
      if (taras) localDb.setTaras(taras);

      // 3. Formas de Pagamento
      const { data: pms } = await supabase
        .from('formas_pagamento')
        .select('*')
        .order('nome');
      if (pms) localDb.setPaymentMethods(pms);

      // 4. Clientes
      const { data: custs } = await supabase
        .from('customers')
        .select('id, name, telefone, cnpj_cpf, email')
        .order('name');
      if (custs) localDb.setCustomers(custs);

      const now = new Date().toISOString();
      localDb.setLastSyncTimestamp(now);
      this.lastError = null;

      console.log(`[SyncEngine] Download inicial concluído! ${prods?.length || 0} produtos sincronizados localmente.`);
      return { success: true, count: prods?.length || 0 };
    } catch (e: any) {
      console.error('[SyncEngine] Erro no download inicial:', e);
      this.lastError = e.message || 'Erro ao sincronizar com a nuvem';
      return { success: false, count: 0, error: this.lastError };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // Sobe itens pendentes (vendas locais) e puxa pedidos do site
  public async syncAll(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    if (this.isSyncing) return { success: false, syncedCount: 0 };

    try {
      this.isSyncing = true;
      this.notify();

      const queue = localDb.getSyncQueue();
      const syncedIds: string[] = [];

      // 1. Enviar vendas e atualizações locais para o Supabase
      // Busca antecipadamente a loja padrão ativa para garantir vínculo de estoque correto
      let defaultLojaId: string | null = null;
      try {
        const { data: loja } = await supabase
          .from('locais_estoque')
          .select('id')
          .eq('tipo', 'loja')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();
        if (loja) defaultLojaId = loja.id;
      } catch (_) {}

      for (const item of queue) {
        try {
          if (item.type === 'stock_movement') {
            const { product_id, stock, location_id, type, quantity, reason, change } = item.payload || {};
            const targetProductId = product_id || item.payload?.id;
            const targetStock = stock !== undefined ? stock : item.payload?.stock;

            if (targetProductId && targetStock !== undefined) {
              // 1. Atualiza na tabela products
              await supabase.from('products').update({ stock: targetStock }).eq('id', targetProductId);

              // 2. Atualiza no saldos_estoque (local loja)
              const targetLocId = location_id || defaultLojaId;
              if (targetLocId) {
                await supabase.from('saldos_estoque').upsert({
                  produto_id: targetProductId,
                  local_estoque_id: targetLocId,
                  saldo_atual: targetStock,
                  saldo_reservado: 0
                }, { onConflict: 'produto_id,local_estoque_id' });
              }

              // 3. Registra movimentação no histórico se houver dados
              if (quantity || change) {
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('movimentacoes_estoque').insert({
                  produto_id: targetProductId,
                  origem_local_id: change && change < 0 ? targetLocId : null,
                  destino_local_id: change && change > 0 ? targetLocId : null,
                  tipo_movimentacao: type || 'ajuste_manual',
                  quantidade: quantity || Math.abs(change || 0),
                  motivo: reason || 'Ajuste de estoque sincronizado da fila offline',
                  usuario_id: user?.id,
                  referencia_tipo: 'ajuste_offline'
                });
              }
            }
            syncedIds.push(item.id);
          } else if (item.type === 'product_update' || item.payload?.name || item.payload?.price !== undefined) {
            const product = item.payload?.data || item.payload;
            if (product && product.id) {
              // Se foi apenas atualização de cadastro, não sobrescreve o estoque atual com dados velhos da fila
              if (item.payload?.is_stock_adjustment || product.stock !== undefined) {
                await supabase.from('products').update({ stock: product.stock }).eq('id', product.id);
                if (defaultLojaId && product.stock !== undefined) {
                  await supabase.from('saldos_estoque').upsert({
                    produto_id: product.id,
                    local_estoque_id: defaultLojaId,
                    saldo_atual: product.stock,
                    saldo_reservado: 0
                  }, { onConflict: 'produto_id,local_estoque_id' });
                }
              } else {
                const { stock, ...productWithoutStock } = product;
                await supabase.from('products').update(productWithoutStock).eq('id', product.id);
              }
            }
            syncedIds.push(item.id);
          } else if (item.type === 'sale') {
            const { order, items } = item.payload || {};
            if (order && order.id) {
              // Verifica se a venda já existe no banco para não duplicar
              const { data: existingVenda } = await supabase
                .from('vendas')
                .select('id')
                .eq('id', order.id)
                .maybeSingle();

              if (!existingVenda && items && items.length > 0) {
                const dbItens = items.map((it: any) => ({
                  produto_id: it.product_id,
                  quantity: it.quantity,
                  price_unit: it.price_unit,
                  subtotal: it.subtotal,
                  local_saida_id: it.local_saida_id || defaultLojaId || order.empresa_id || null
                }));

                await supabase.rpc('registrar_venda_pdv', {
                  p_caixa_id: order.caixa_id,
                  p_empresa_id: order.empresa_id,
                  p_cliente_id: order.cliente_id || null,
                  p_valor_total: order.subtotal || order.total_amount,
                  p_desconto: order.desconto || 0,
                  p_acrescimo: order.acrescimo || 0,
                  p_valor_final: order.total_amount,
                  p_itens: dbItens,
                  p_pagamentos: [],
                  p_observacoes: 'Venda sincronizada da fila offline'
                });
              }
            }
            syncedIds.push(item.id);
          } else {
            syncedIds.push(item.id);
          }
        } catch (itemErr) {
          console.error('[SyncEngine] Falha ao sincronizar item:', item, itemErr);
          // Se for erro de rede, mantém na fila para tentar novamente
          if (navigator.onLine === false || (itemErr as any)?.message?.includes('fetch')) {
            // Mantém na fila
          } else {
            syncedIds.push(item.id); // Remove item com erro sintático para desobstruir a fila
          }
        }
      }

      if (syncedIds.length > 0) {
        localDb.removeFromSyncQueue(syncedIds);
      }

      // 2. Puxar produtos atualizados da nuvem (sem filtro updated_at que quebrava pois a coluna não existe)
      const { data: freshProds, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (!prodErr && freshProds && freshProds.length > 0) {
        const activeOnly = freshProds.filter((p: any) => p.is_deleted !== true);

        // Proteção contra sobrescrita de modificações locais pendentes:
        // Se houver algum produto com alteração pendente na fila, preserva o estoque local
        const remainingQueue = localDb.getSyncQueue();
        const pendingProductIds = new Set(
          remainingQueue.map(q => q.payload?.product_id || q.payload?.id || q.payload?.data?.id).filter(Boolean)
        );

        if (pendingProductIds.size > 0) {
          const currentLocal = localDb.getProducts();
          const merged = activeOnly.map((p: any) => {
            if (pendingProductIds.has(p.id)) {
              const localP = currentLocal.find((lp: any) => lp.id === p.id);
              if (localP && localP.stock !== undefined) {
                return { ...p, stock: localP.stock };
              }
            }
            return p;
          });
          localDb.setProducts(merged);
        } else {
          localDb.setProducts(activeOnly);
        }
      }

      const now = new Date().toISOString();
      localDb.setLastSyncTimestamp(now);
      this.lastError = null;

      return { success: true, syncedCount: syncedIds.length };
    } catch (e: any) {
      console.error('[SyncEngine] Erro na sincronização:', e);
      this.lastError = e.message || 'Erro na sincronização';
      return { success: false, syncedCount: 0, error: this.lastError };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // Inicia sincronização periódica em background (a cada 2 horas por padrão)
  public startBackgroundSync(intervalMs = 7200000) {
    if (this.timer) clearInterval(this.timer);
    
    // Tenta primeiro o download inicial se estiver vazio
    this.downloadInitialCatalog();

    this.timer = setInterval(() => {
      if (navigator.onLine) {
        this.syncAll();
      }
    }, intervalMs);

    console.log(`[SyncEngine] Background sync programado a cada ${intervalMs / (1000 * 60)} minutos`);
  }

  public stopBackgroundSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const syncEngine = new SyncEngine();
