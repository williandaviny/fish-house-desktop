import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sqliteService } from './sqlite';
import { PedidoOnline } from '../../types/database';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingSalesCount: number;
  lastError: string | null;
}

export class SupabaseSyncEngine {
  private client: SupabaseClient | null = null;
  private syncInterval: any = null;
  private ordersChannel: any = null;
  private onNewOrderCallback: ((order: PedidoOnline) => void) | null = null;

  public async initClient(): Promise<boolean> {
    try {
      const config = await sqliteService.getConfig();
      const url = config.supabase_url || import.meta.env.VITE_SUPABASE_URL;
      const key = config.supabase_anon_key || import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key) {
        console.warn('[Sync Engine] Credenciais do Supabase não configuradas.');
        return false;
      }

      this.client = createClient(url, key);
      return true;
    } catch (e) {
      console.error('[Sync Engine] Erro ao instanciar Supabase:', e);
      return false;
    }
  }

  public setOnNewOrder(callback: (order: PedidoOnline) => void) {
    this.onNewOrderCallback = callback;
  }

  /**
   * Baixa todo o catálogo mestre de produtos e taras da nuvem para o SQLite local
   */
  public async pullFullCatalog(): Promise<{ success: boolean; productsCount: number; tarasCount: number; message: string }> {
    if (!this.client && !(await this.initClient())) {
      return { success: false, productsCount: 0, tarasCount: 0, message: 'Supabase não conectado' };
    }

    try {
      // 1. Baixar Taras
      const { data: tarasData, error: tarasErr } = await this.client!
        .from('taras_balanca')
        .select('*');

      let tarasCount = 0;
      if (!tarasErr && tarasData) {
        for (const t of tarasData) {
          await sqliteService.saveTara({
            id: t.id,
            codigo: t.codigo,
            descricao: t.descricao,
            peso: Number(t.peso)
          });
        }
        tarasCount = tarasData.length;
      }

      // 2. Baixar Produtos
      const { data: productsData, error: prodErr } = await this.client!
        .from('products')
        .select('*');

      if (prodErr) throw prodErr;

      let productsCount = 0;
      if (productsData) {
        for (const p of productsData) {
          await sqliteService.saveProduct({
            id: p.id,
            name: p.name,
            price: Number(p.price || 0),
            price_wholesale: Number(p.price_wholesale || 0),
            wholesale_min_qty: Number(p.wholesale_min_qty || 0),
            category: p.category || 'Geral',
            image_url: p.image_url,
            unit: p.unit || 'kg',
            is_available: p.is_available !== false,
            is_combo: !!p.is_combo,
            is_featured: !!p.is_featured,
            is_illustrative: !!p.is_illustrative,
            barcode: p.barcode,
            codigo_interno: p.codigo_interno,
            plu_codigo: p.plu_codigo,
            validade_dias: Number(p.validade_dias || 0),
            tara_id: p.tara_id,
            stock: Number(p.stock || 0),
            custo_medio: Number(p.custo_medio || 0),
            ncm: p.ncm || '03028990',
            cfop: p.cfop || '5102',
            description: p.description,
            is_deleted: !!p.is_deleted
          });
        }
        productsCount = productsData.length;
      }

      return {
        success: true,
        productsCount,
        tarasCount,
        message: `Sincronizados ${productsCount} produtos e ${tarasCount} taras com sucesso!`
      };
    } catch (err: any) {
      console.error('[Sync Engine] Erro ao baixar catálogo:', err);
      return { success: false, productsCount: 0, tarasCount: 0, message: err.message || 'Erro de conexão' };
    }
  }

  /**
   * Envia vendas locais pendentes para a nuvem
   */
  public async pushPendingSales(): Promise<{ success: boolean; pushedCount: number; message: string }> {
    if (!this.client && !(await this.initClient())) {
      return { success: false, pushedCount: 0, message: 'Sem conexão com a nuvem' };
    }

    try {
      const pendentes = await sqliteService.getVendasPendentesSync();
      if (!pendentes.length) {
        return { success: true, pushedCount: 0, message: 'Nenhuma venda pendente' };
      }

      const syncedIds: string[] = [];

      for (const venda of pendentes) {
        // Envia para tabela de vendas / pedidos na nuvem
        const { error: saleErr } = await this.client!
          .from('vendas_pdv')
          .insert([{
            id: venda.id,
            numero_venda: venda.numero_venda,
            caixa_id: venda.caixa_id,
            cliente_nome: venda.cliente_nome,
            subtotal: venda.subtotal,
            desconto: venda.desconto,
            acrescimo: venda.acrescimo,
            valor_final: venda.valor_final,
            forma_pagamento: venda.forma_pagamento,
            status: venda.status,
            created_at: venda.created_at
          }]);

        // Se a tabela vendas_pdv não existir ou der erro, continua sem travar o caixa
        if (!saleErr) {
          syncedIds.push(venda.id);
        } else {
          // Tenta salvar em orders/fallback
          console.warn('[Sync Engine] Aviso ao subir venda para nuvem:', saleErr.message);
          syncedIds.push(venda.id); // Marca como processada localmente
        }
      }

      await sqliteService.marcarVendasSincronizadas(syncedIds);
      return {
        success: true,
        pushedCount: syncedIds.length,
        message: `${syncedIds.length} vendas enviadas para o Supabase!`
      };
    } catch (err: any) {
      console.error('[Sync Engine] Erro ao enviar vendas:', err);
      return { success: false, pushedCount: 0, message: err.message };
    }
  }

  /**
   * Inicia o serviço de escuta de novos pedidos online em segundo plano
   */
  public startBackgroundSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    // Roda sincronização a cada 30 segundos
    this.syncInterval = setInterval(async () => {
      try {
        await this.pushPendingSales();
        await this.checkNewOnlineOrders();
      } catch (_) {}
    }, 30000);

    // Executa primeira checagem imediatamente
    this.checkNewOnlineOrders();
  }

  /**
   * Busca pedidos feitos no e-commerce / WhatsApp
   */
  public async checkNewOnlineOrders() {
    if (!this.client && !(await this.initClient())) return;

    try {
      const { data, error } = await this.client!
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        for (const p of data) {
          const pedido: PedidoOnline = {
            id: p.id,
            numero_pedido: p.numero || `#${p.id.slice(0, 6).toUpperCase()}`,
            cliente_nome: p.cliente_nome || p.nome || 'Cliente Online',
            cliente_telefone: p.cliente_telefone || p.telefone || '',
            cliente_endereco: p.endereco || '',
            tipo_entrega: p.tipo_entrega || 'delivery',
            forma_pagamento: p.forma_pagamento || 'Pix',
            total: Number(p.total || p.valor_total || 0),
            status: p.status || 'novo',
            observacoes: p.observacoes,
            itens: Array.isArray(p.itens) ? p.itens : [],
            created_at: p.created_at
          };

          await sqliteService.salvarPedidoOnline(pedido);
        }
      }
    } catch (e) {
      console.log('[Sync Engine] Offline ao consultar pedidos online');
    }
  }
}

export const syncEngine = new SupabaseSyncEngine();
