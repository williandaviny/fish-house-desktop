import { supabase } from '../../lib/supabase';

export interface LocalSyncItem {
  id: string;
  type: 'sale' | 'product_update' | 'caixa_open' | 'caixa_close' | 'stock_movement';
  payload: any;
  created_at: string;
}

export interface LocalSyncStatus {
  last_synced_at: string | null;
  is_syncing: boolean;
  pending_count: number;
  error: string | null;
}

const STORAGE_KEYS = {
  PRODUCTS: 'fishhouse_local_products',
  CATEGORIES: 'fishhouse_local_categories',
  CUSTOMERS: 'fishhouse_local_customers',
  TARAS: 'fishhouse_local_taras',
  PAYMENT_METHODS: 'fishhouse_local_payment_methods',
  CAIXA_CURRENT: 'fishhouse_local_caixa_current',
  ORDERS: 'fishhouse_local_orders',
  SYNC_QUEUE: 'fishhouse_local_sync_queue',
  LAST_SYNC: 'fishhouse_local_last_sync_timestamp'
};

function getItem<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error(`[LocalDB] Erro ao ler ${key}:`, e);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[LocalDB] Erro ao salvar ${key}:`, e);
  }
}

export const localDb = {
  // --- PRODUTOS ---
  getProducts(): any[] {
    return getItem<any[]>(STORAGE_KEYS.PRODUCTS, []);
  },

  setProducts(products: any[]): void {
    setItem(STORAGE_KEYS.PRODUCTS, products);
  },

  saveProduct(product: any): void {
    const list = this.getProducts();
    const idx = list.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...product };
    } else {
      list.push(product);
    }
    this.setProducts(list);
    this.enqueueSync({
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'product_update',
      payload: product,
      created_at: new Date().toISOString()
    });
  },

  decrementStock(productId: string, quantity: number): void {
    const list = this.getProducts();
    const idx = list.findIndex(p => p.id === productId);
    if (idx >= 0) {
      list[idx].stock = Math.max(0, Number((Number(list[idx].stock || 0) - quantity).toFixed(3)));
      this.setProducts(list);
    }
  },

  // --- TARAS DE BALANÇA ---
  getTaras(): any[] {
    return getItem<any[]>(STORAGE_KEYS.TARAS, []);
  },

  setTaras(taras: any[]): void {
    setItem(STORAGE_KEYS.TARAS, taras);
  },

  // --- FORMAS DE PAGAMENTO ---
  getPaymentMethods(): any[] {
    return getItem<any[]>(STORAGE_KEYS.PAYMENT_METHODS, []);
  },

  setPaymentMethods(methods: any[]): void {
    setItem(STORAGE_KEYS.PAYMENT_METHODS, methods);
  },

  // --- CLIENTES ---
  getCustomers(): any[] {
    return getItem<any[]>(STORAGE_KEYS.CUSTOMERS, []);
  },

  setCustomers(customers: any[]): void {
    setItem(STORAGE_KEYS.CUSTOMERS, customers);
  },

  saveCustomer(customer: any): void {
    const list = this.getCustomers();
    const idx = list.findIndex(c => c.id === customer.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...customer };
    } else {
      list.unshift(customer);
    }
    this.setCustomers(list);
  },

  // --- CAIXA ---
  getCurrentCaixa(): any | null {
    return getItem<any | null>(STORAGE_KEYS.CAIXA_CURRENT, null);
  },

  setCurrentCaixa(caixa: any | null): void {
    setItem(STORAGE_KEYS.CAIXA_CURRENT, caixa);
  },

  // --- VENDAS & PEDIDOS ---
  getOrders(): any[] {
    return getItem<any[]>(STORAGE_KEYS.ORDERS, []);
  },

  saveOrderLocally(order: any, items: any[]): any {
    const orders = this.getOrders();
    const orderWithItems = {
      ...order,
      order_items: items,
      created_at: order.created_at || new Date().toISOString()
    };
    orders.unshift(orderWithItems);
    setItem(STORAGE_KEYS.ORDERS, orders);

    // Abate estoque local imediatamente
    for (const item of items) {
      if (item.product_id) {
        this.decrementStock(item.product_id, item.quantity);
      }
    }

    // Adiciona na fila de sincronizacao
    this.enqueueSync({
      id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'sale',
      payload: { order, items },
      created_at: new Date().toISOString()
    });

    return orderWithItems;
  },

  // --- FILA DE SINCRONIZAÇÃO (SYNC QUEUE) ---
  getSyncQueue(): LocalSyncItem[] {
    return getItem<LocalSyncItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
  },

  setSyncQueue(queue: LocalSyncItem[]): void {
    setItem(STORAGE_KEYS.SYNC_QUEUE, queue);
  },

  enqueueSync(item: LocalSyncItem): void {
    const queue = this.getSyncQueue();
    queue.push(item);
    this.setSyncQueue(queue);
  },

  removeFromSyncQueue(ids: string[]): void {
    const queue = this.getSyncQueue().filter(item => !ids.includes(item.id));
    this.setSyncQueue(queue);
  },

  getLastSyncTimestamp(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  },

  setLastSyncTimestamp(ts: string): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, ts);
  }
};
