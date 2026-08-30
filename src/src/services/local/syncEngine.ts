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
      for (const item of queue) {
        try {
          if (item.type === 'product_update' || item.payload?.name || item.payload?.price !== undefined) {
            const product = item.payload?.data || item.payload;
            if (product && product.name) {
              await supabase.from('products').upsert(product);
            }
            syncedIds.push(item.id);
          } else if (item.type === 'sale') {
            const { order, items } = item.payload || {};
            if (order) {
              const { data: orderRes, error: orderErr } = await supabase
                .from('pedidos')
                .insert([order])
                .select()
                .single();

              if (!orderErr && orderRes && items && items.length > 0) {
                const formattedItems = items.map((it: any) => ({
                  ...it,
                  order_id: orderRes.id
                }));
                await supabase.from('order_items').insert(formattedItems);
              }
            }
            syncedIds.push(item.id);
          } else {
            syncedIds.push(item.id);
          }
        } catch (itemErr) {
          console.error('[SyncEngine] Falha ao sincronizar item:', item, itemErr);
          syncedIds.push(item.id); // Remove item com erro para desobstruir a fila
        }
      }

      if (syncedIds.length > 0) {
        localDb.removeFromSyncQueue(syncedIds);
      }

      // 2. Puxar produtos atualizados e pedidos web
      const lastSync = localDb.getLastSyncTimestamp();
      let prodQuery = supabase.from('products').select('*');
      if (lastSync) {
        prodQuery = prodQuery.gt('updated_at', lastSync);
      }
      const { data: updatedProds } = await prodQuery;

      if (updatedProds && updatedProds.length > 0) {
        const localProds = localDb.getProducts();
        for (const up of updatedProds) {
          const idx = localProds.findIndex(p => p.id === up.id);
          if (idx >= 0) {
            localProds[idx] = up;
          } else {
            localProds.push(up);
          }
        }
        localDb.setProducts(localProds);
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
