import { 
  Product, 
  TaraBalanca, 
  CaixaSessao, 
  MovimentoCaixa, 
  Venda, 
  ItemVenda, 
  PedidoOnline, 
  EmpresaConfig, 
  DashboardMetrics,
  CartItem
} from '../../types/database';
import { IDatabaseService } from './adapter';

const DB_STORAGE_KEY = 'fish_house_v1_database';

interface DatabaseState {
  config: EmpresaConfig;
  products: Record<string, Product>;
  taras: Record<string, TaraBalanca>;
  vendas: Record<string, Venda>;
  itens_venda: Record<string, ItemVenda>;
  caixas: Record<string, CaixaSessao>;
  movimentos_caixa: Record<string, MovimentoCaixa>;
  pedidos_online: Record<string, PedidoOnline>;
  sequence_venda: number;
}

const DEFAULT_CONFIG: EmpresaConfig = {
  id: 'default',
  nome_empresa: 'Fish House - Peixaria Premium',
  cnpj: '00.000.000/0001-00',
  telefone: '(47) 99999-9999',
  endereco: 'Navegantes - SC',
  mensagem_cupom: 'Obrigado pela preferência! Peixes frescos todos os dias.',
  auto_sync_interval: 30,
  supabase_url: 'https://mqktczeqkynqqgzkbrno.supabase.co',
  supabase_anon_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa3RjemVxa3lucXFnemticm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzI3MDUsImV4cCI6MjA5OTkwODcwNX0.vFo6S1aa1Uv2JsleRh50VkoL4aknzjepgUvqOI0frNY',
  impressora_largura: '80mm'
};

const DEFAULT_TARAS: TaraBalanca[] = [
  { id: 'tara-1', codigo: 1, descricao: 'Bandeja P', peso: 0.025 },
  { id: 'tara-2', codigo: 2, descricao: 'Bandeja M', peso: 0.040 },
  { id: 'tara-3', codigo: 3, descricao: 'Bandeja G', peso: 0.060 },
  { id: 'tara-4', codigo: 4, descricao: 'Sacola Térmica', peso: 0.080 }
];

export class SQLiteDatabaseService implements IDatabaseService {
  private state: DatabaseState;
  private isLoaded = false;

  constructor() {
    this.state = this.getInitialEmptyState();
  }

  private getInitialEmptyState(): DatabaseState {
    const tarasMap: Record<string, TaraBalanca> = {};
    DEFAULT_TARAS.forEach(t => { tarasMap[t.id] = t; });

    return {
      config: { ...DEFAULT_CONFIG },
      products: {},
      taras: tarasMap,
      vendas: {},
      itens_venda: {},
      caixas: {},
      movimentos_caixa: {},
      pedidos_online: {},
      sequence_venda: 1000
    };
  }

  public async init(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // 1. Tenta carregar do IndexedDB
      const loaded = await this.loadFromStorage();
      if (loaded) {
        this.state = loaded;
      } else {
        // 2. Fallback para localStorage
        const local = localStorage.getItem(DB_STORAGE_KEY);
        if (local) {
          try {
            this.state = JSON.parse(local);
          } catch (_) {
            this.state = this.getInitialEmptyState();
          }
        } else {
          this.state = this.getInitialEmptyState();
        }
      }

      this.isLoaded = true;
      await this.persist();
      console.log('[Database Local] Banco inicializado instantaneamente!');
    } catch (e) {
      console.error('[Database Local] Erro ao inicializar:', e);
      this.state = this.getInitialEmptyState();
      this.isLoaded = true;
    }
  }

  private async persist(): Promise<void> {
    try {
      const serialized = JSON.stringify(this.state);
      // Salva no LocalStorage (instantâneo)
      try {
        localStorage.setItem(DB_STORAGE_KEY, serialized);
      } catch (_) {}

      // Salva no IndexedDB (persistência de longo prazo)
      await this.saveToIndexedDB(this.state);
    } catch (err) {
      console.error('[Database Local] Erro ao salvar:', err);
    }
  }

  private async saveToIndexedDB(data: DatabaseState): Promise<void> {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('FishHouseDB_v2', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('store')) {
            db.createObjectStore('store');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('store', 'readwrite');
          tx.objectStore('store').put(data, DB_STORAGE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  private async loadFromStorage(): Promise<DatabaseState | null> {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('FishHouseDB_v2', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('store')) {
            db.createObjectStore('store');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('store', 'readonly');
          const getReq = tx.objectStore('store').get(DB_STORAGE_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  // --- CONFIG ---
  public async getConfig(): Promise<EmpresaConfig> {
    return { ...this.state.config };
  }

  public async saveConfig(config: Partial<EmpresaConfig>): Promise<void> {
    this.state.config = { ...this.state.config, ...config };
    await this.persist();
  }

  // --- PRODUTOS ---
  public async getProducts(): Promise<Product[]> {
    return Object.values(this.state.products)
      .filter(p => !p.is_deleted)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getProductById(id: string): Promise<Product | null> {
    return this.state.products[id] || null;
  }

  public async getProductByBarcodeOrPLU(code: string): Promise<Product | null> {
    const clean = code.trim().toLowerCase();
    return Object.values(this.state.products).find(p => 
      !p.is_deleted && (
        p.barcode?.toLowerCase() === clean || 
        p.plu_codigo?.toLowerCase() === clean || 
        p.codigo_interno?.toLowerCase() === clean
      )
    ) || null;
  }

  public async saveProduct(product: Partial<Product> & { name: string; price: number }): Promise<Product> {
    const id = product.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const fullProduct: Product = {
      id,
      name: product.name,
      price: product.price,
      price_wholesale: product.price_wholesale || 0,
      wholesale_min_qty: product.wholesale_min_qty || 0,
      category: product.category || 'Geral',
      image_url: product.image_url,
      unit: product.unit || 'kg',
      is_available: product.is_available !== false,
      is_combo: !!product.is_combo,
      is_featured: !!product.is_featured,
      is_illustrative: !!product.is_illustrative,
      barcode: product.barcode,
      codigo_interno: product.codigo_interno,
      plu_codigo: product.plu_codigo,
      validade_dias: product.validade_dias || 0,
      tara_id: product.tara_id,
      stock: product.stock !== undefined ? product.stock : 0,
      custo_medio: product.custo_medio || 0,
      ncm: product.ncm || '03028990',
      cfop: product.cfop || '5102',
      description: product.description,
      is_deleted: !!product.is_deleted,
      created_at: product.created_at || now,
      updated_at: now
    };

    this.state.products[id] = fullProduct;
    await this.persist();
    return fullProduct;
  }

  public async deleteProduct(id: string): Promise<void> {
    if (this.state.products[id]) {
      this.state.products[id].is_deleted = true;
      this.state.products[id].updated_at = new Date().toISOString();
      await this.persist();
    }
  }

  public async updateStock(productId: string, quantityDelta: number): Promise<void> {
    if (this.state.products[productId]) {
      this.state.products[productId].stock += quantityDelta;
      this.state.products[productId].updated_at = new Date().toISOString();
      await this.persist();
    }
  }

  // --- TARAS ---
  public async getTaras(): Promise<TaraBalanca[]> {
    return Object.values(this.state.taras).sort((a, b) => a.codigo - b.codigo);
  }

  public async saveTara(tara: Partial<TaraBalanca> & { codigo: number; descricao: string; peso: number }): Promise<TaraBalanca> {
    const id = tara.id || crypto.randomUUID();
    const fullTara: TaraBalanca = {
      id,
      codigo: tara.codigo,
      descricao: tara.descricao,
      peso: tara.peso,
      created_at: tara.created_at || new Date().toISOString()
    };
    this.state.taras[id] = fullTara;
    await this.persist();
    return fullTara;
  }

  public async deleteTara(id: string): Promise<void> {
    delete this.state.taras[id];
    await this.persist();
  }

  // --- CAIXA ---
  public async getCaixaAberto(): Promise<CaixaSessao | null> {
    return Object.values(this.state.caixas).find(c => c.status === 'aberto') || null;
  }

  public async abrirCaixa(operadorNome: string, valorInicial: number): Promise<CaixaSessao> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const novoCaixa: CaixaSessao = {
      id,
      operador_nome: operadorNome,
      saldo_inicial: valorInicial,
      status: 'aberto',
      data_abertura: now
    };
    this.state.caixas[id] = novoCaixa;
    await this.persist();
    return novoCaixa;
  }

  public async fecharCaixa(caixaId: string, saldoFinal: number, observacoes?: string): Promise<CaixaSessao> {
    const cx = this.state.caixas[caixaId];
    if (cx) {
      cx.saldo_final = saldoFinal;
      cx.status = 'fechado';
      cx.data_fechamento = new Date().toISOString();
      cx.observacoes = observacoes;
      await this.persist();
      return cx;
    }
    throw new Error('Caixa não encontrado');
  }

  public async adicionarMovimentoCaixa(caixaId: string, tipo: 'sangria' | 'suprimento', valor: number, motivo: string): Promise<MovimentoCaixa> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const mov: MovimentoCaixa = { id, caixa_id: caixaId, tipo, valor, motivo, created_at: now };
    this.state.movimentos_caixa[id] = mov;
    await this.persist();
    return mov;
  }

  public async getMovimentosCaixa(caixaId: string): Promise<MovimentoCaixa[]> {
    return Object.values(this.state.movimentos_caixa)
      .filter(m => m.caixa_id === caixaId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- VENDAS ---
  public async criarVenda(
    vendaData: {
      caixa_id: string;
      cliente_nome?: string;
      cliente_telefone?: string;
      subtotal: number;
      desconto: number;
      acrescimo: number;
      valor_final: number;
      forma_pagamento: string;
      troco?: number;
      observacoes?: string;
    },
    itens: CartItem[]
  ): Promise<Venda> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const numeroVenda = (this.state.sequence_venda || 1000) + 1;
    this.state.sequence_venda = numeroVenda;

    const venda: Venda = {
      id,
      numero_venda: numeroVenda,
      caixa_id: vendaData.caixa_id,
      cliente_nome: vendaData.cliente_nome,
      cliente_telefone: vendaData.cliente_telefone,
      subtotal: vendaData.subtotal,
      desconto: vendaData.desconto,
      acrescimo: vendaData.acrescimo,
      valor_final: vendaData.valor_final,
      forma_pagamento: vendaData.forma_pagamento,
      troco: vendaData.troco,
      status: 'concluida',
      observacoes: vendaData.observacoes,
      sync_status: 'pending',
      created_at: now
    };

    this.state.vendas[id] = venda;

    // Salva itens e debita estoque
    for (const it of itens) {
      const itemId = crypto.randomUUID();
      this.state.itens_venda[itemId] = {
        id: itemId,
        venda_id: id,
        produto_id: it.product.id,
        produto_nome: it.product.name,
        quantidade: it.quantity,
        unit: it.product.unit || 'kg',
        preco_unitario: it.price_unit,
        subtotal: it.subtotal,
        tara_peso: it.tara_peso || 0
      };

      if (this.state.products[it.product.id]) {
        this.state.products[it.product.id].stock -= it.quantity;
      }
    }

    await this.persist();
    return venda;
  }

  public async getVendas(limit: number = 50): Promise<Venda[]> {
    return Object.values(this.state.vendas)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  public async getVendasPendentesSync(): Promise<Venda[]> {
    const pendentes = Object.values(this.state.vendas)
      .filter(v => v.sync_status === 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const v of pendentes) {
      v.itens = Object.values(this.state.itens_venda).filter(i => i.venda_id === v.id);
    }
    return pendentes;
  }

  public async marcarVendasSincronizadas(vendaIds: string[]): Promise<void> {
    for (const id of vendaIds) {
      if (this.state.vendas[id]) {
        this.state.vendas[id].sync_status = 'synced';
      }
    }
    await this.persist();
  }

  // --- PEDIDOS ONLINE ---
  public async getPedidosOnline(status?: string): Promise<PedidoOnline[]> {
    return Object.values(this.state.pedidos_online)
      .filter(p => !status || status === 'all' || p.status === status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async salvarPedidoOnline(pedido: PedidoOnline): Promise<void> {
    this.state.pedidos_online[pedido.id] = pedido;
    await this.persist();
  }

  public async atualizarStatusPedidoOnline(pedidoId: string, status: PedidoOnline['status']): Promise<void> {
    if (this.state.pedidos_online[pedidoId]) {
      this.state.pedidos_online[pedidoId].status = status;
      await this.persist();
    }
  }

  // --- DASHBOARD ---
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    const hoje = new Date().toISOString().split('T')[0];
    const vendas = Object.values(this.state.vendas).filter(v => v.status === 'concluida');
    const vendasHoje = vendas.filter(v => v.created_at.startsWith(hoje));

    const totalVendasHoje = vendasHoje.length;
    const faturamentoHoje = vendasHoje.reduce((acc, v) => acc + v.valor_final, 0);
    const ticketMedioHoje = totalVendasHoje > 0 ? faturamentoHoje / totalVendasHoje : 0;
    const mesAtual = hoje.slice(0, 7);
    const faturamentoMes = vendas.filter(v => v.created_at.startsWith(mesAtual)).reduce((acc, v) => acc + v.valor_final, 0);

    const prods = await this.getProducts();
    const lowStock = prods.filter(p => p.stock <= 5).slice(0, 6);

    return {
      totalVendasHoje,
      faturamentoHoje,
      faturamentoMes,
      ticketMedioHoje,
      quantidadeProdutos: prods.length,
      produtosEstoqueBaixo: lowStock,
      vendasRecentes: await this.getVendas(5),
      vendasPorFormaPagamento: {},
      vendasUltimosDias: []
    };
  }

  // --- BACKUP ---
  public async exportDatabaseJSON(): Promise<string> {
    return JSON.stringify(this.state, null, 2);
  }

  public async importDatabaseJSON(jsonData: string): Promise<void> {
    const parsed = JSON.parse(jsonData);
    this.state = { ...this.state, ...parsed };
    await this.persist();
  }

  public async resetDatabase(): Promise<void> {
    this.state = this.getInitialEmptyState();
    await this.persist();
  }
}

export const sqliteService = new SQLiteDatabaseService();
