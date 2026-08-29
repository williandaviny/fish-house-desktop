import initSqlJs, { Database } from 'sql.js';
import { INITIAL_SQL_SCHEMA } from './schema';
import { IDatabaseService } from './adapter';
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

const DB_STORAGE_KEY = 'fish_house_sqlite_db';

export class SQLiteDatabaseService implements IDatabaseService {
  private db: Database | null = null;
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `https://sql.js.org/dist/${file}`
      });

      // Carrega do IndexedDB/LocalStorage se existir
      const savedData = await this.loadFromStorage();
      if (savedData) {
        this.db = new SQL.Database(savedData);
      } else {
        this.db = new SQL.Database();
      }

      // Executa criação do schema
      this.db.run(INITIAL_SQL_SCHEMA);

      // Garante configuração padrão inicial
      this.db.run(`
        INSERT OR IGNORE INTO empresa_config (id, nome_empresa)
        VALUES ('default', 'Fish House - Peixaria Premium')
      `);

      this.isInitialized = true;
      await this.persist();
      console.log('[SQLite Local] Banco de dados inicializado com sucesso!');
    } catch (err) {
      console.error('[SQLite Local] Erro crítico ao inicializar banco local:', err);
      throw err;
    }
  }

  private async persist(): Promise<void> {
    if (!this.db) return;
    try {
      const data = this.db.export();
      await this.saveToStorage(data);
    } catch (err) {
      console.error('[SQLite Local] Erro ao persistir banco:', err);
    }
  }

  private async saveToStorage(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FishHouseDB_v1', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sqlite')) {
          db.createObjectStore('sqlite');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sqlite', 'readwrite');
        const store = tx.objectStore('sqlite');
        store.put(data, DB_STORAGE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async loadFromStorage(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('FishHouseDB_v1', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sqlite')) {
          db.createObjectStore('sqlite');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sqlite', 'readonly');
        const store = tx.objectStore('sqlite');
        const getReq = store.get(DB_STORAGE_KEY);
        getReq.onsuccess = () => {
          if (getReq.result instanceof Uint8Array) {
            resolve(getReq.result);
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  }

  // --- CONFIGURAÇÕES ---
  public async getConfig(): Promise<EmpresaConfig> {
    const res = this.db!.exec("SELECT * FROM empresa_config WHERE id = 'default' LIMIT 1");
    if (!res.length || !res[0].values.length) {
      return {
        id: 'default',
        nome_empresa: 'Fish House - Peixaria Premium',
        cnpj: '',
        telefone: '',
        endereco: '',
        mensagem_cupom: 'Obrigado pela preferência!',
        auto_sync_interval: 30,
        supabase_url: '',
        supabase_anon_key: '',
        impressora_largura: '80mm'
      };
    }
    return this.rowToObject<EmpresaConfig>(res[0].columns, res[0].values[0]);
  }

  public async saveConfig(config: Partial<EmpresaConfig>): Promise<void> {
    const current = await this.getConfig();
    const merged = { ...current, ...config, updated_at: new Date().toISOString() };
    this.db!.run(
      `INSERT OR REPLACE INTO empresa_config (
        id, nome_empresa, cnpj, telefone, endereco, mensagem_cupom, auto_sync_interval, supabase_url, supabase_anon_key, impressora_largura, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'default',
        merged.nome_empresa,
        merged.cnpj,
        merged.telefone,
        merged.endereco,
        merged.mensagem_cupom,
        merged.auto_sync_interval,
        merged.supabase_url,
        merged.supabase_anon_key,
        merged.impressora_largura,
        merged.updated_at
      ]
    );
    await this.persist();
  }

  // --- PRODUTOS ---
  public async getProducts(): Promise<Product[]> {
    const res = this.db!.exec("SELECT * FROM products WHERE is_deleted = 0 ORDER BY name ASC");
    if (!res.length) return [];
    return res[0].values.map(row => this.rowToObject<Product>(res[0].columns, row));
  }

  public async getProductById(id: string): Promise<Product | null> {
    const res = this.db!.exec("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    if (!res.length || !res[0].values.length) return null;
    return this.rowToObject<Product>(res[0].columns, res[0].values[0]);
  }

  public async getProductByBarcodeOrPLU(code: string): Promise<Product | null> {
    const clean = code.trim();
    const res = this.db!.exec(
      "SELECT * FROM products WHERE (barcode = ? OR plu_codigo = ? OR codigo_interno = ?) AND is_deleted = 0 LIMIT 1",
      [clean, clean, clean]
    );
    if (!res.length || !res[0].values.length) return null;
    return this.rowToObject<Product>(res[0].columns, res[0].values[0]);
  }

  public async saveProduct(product: Partial<Product> & { name: string; price: number }): Promise<Product> {
    const id = product.id || crypto.randomUUID();
    const now = new Date().toISOString();
    
    this.db!.run(
      `INSERT OR REPLACE INTO products (
        id, name, price, price_wholesale, wholesale_min_qty, category, image_url, unit,
        is_available, is_combo, is_featured, is_illustrative, barcode, codigo_interno,
        plu_codigo, validade_dias, tara_id, stock, custo_medio, ncm, cfop, description,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        product.name,
        product.price,
        product.price_wholesale || 0,
        product.wholesale_min_qty || 0,
        product.category || 'Geral',
        product.image_url || null,
        product.unit || 'kg',
        product.is_available !== false ? 1 : 0,
        product.is_combo ? 1 : 0,
        product.is_featured ? 1 : 0,
        product.is_illustrative ? 1 : 0,
        product.barcode || null,
        product.codigo_interno || null,
        product.plu_codigo || null,
        product.validade_dias || 0,
        product.tara_id || null,
        product.stock !== undefined ? product.stock : 0,
        product.custo_medio || 0,
        product.ncm || '03028990',
        product.cfop || '5102',
        product.description || null,
        product.is_deleted ? 1 : 0,
        product.created_at || now,
        now
      ]
    );
    await this.persist();
    return (await this.getProductById(id))!;
  }

  public async deleteProduct(id: string): Promise<void> {
    this.db!.run("UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?", [new Date().toISOString(), id]);
    await this.persist();
  }

  public async updateStock(productId: string, quantityDelta: number): Promise<void> {
    this.db!.run(
      "UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?",
      [quantityDelta, new Date().toISOString(), productId]
    );
    await this.persist();
  }

  // --- TARAS DE BALANÇA ---
  public async getTaras(): Promise<TaraBalanca[]> {
    const res = this.db!.exec("SELECT * FROM taras_balanca ORDER BY codigo ASC");
    if (!res.length) return [];
    return res[0].values.map(row => this.rowToObject<TaraBalanca>(res[0].columns, row));
  }

  public async saveTara(tara: Partial<TaraBalanca> & { codigo: number; descricao: string; peso: number }): Promise<TaraBalanca> {
    const id = tara.id || crypto.randomUUID();
    this.db!.run(
      `INSERT OR REPLACE INTO taras_balanca (id, codigo, descricao, peso)
      VALUES (?, ?, ?, ?)`,
      [id, tara.codigo, tara.descricao, tara.peso]
    );
    await this.persist();
    return { id, codigo: tara.codigo, descricao: tara.descricao, peso: tara.peso };
  }

  public async deleteTara(id: string): Promise<void> {
    this.db!.run("DELETE FROM taras_balanca WHERE id = ?", [id]);
    await this.persist();
  }

  // --- CAIXA E TURNO ---
  public async getCaixaAberto(): Promise<CaixaSessao | null> {
    const res = this.db!.exec("SELECT * FROM caixas WHERE status = 'aberto' ORDER BY data_abertura DESC LIMIT 1");
    if (!res.length || !res[0].values.length) return null;
    return this.rowToObject<CaixaSessao>(res[0].columns, res[0].values[0]);
  }

  public async abrirCaixa(operadorNome: string, valorInicial: number): Promise<CaixaSessao> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db!.run(
      `INSERT INTO caixas (id, operador_nome, saldo_inicial, status, data_abertura)
      VALUES (?, ?, ?, 'aberto', ?)`,
      [id, operadorNome, valorInicial, now]
    );
    await this.persist();
    return (await this.getCaixaAberto())!;
  }

  public async fecharCaixa(caixaId: string, saldoFinal: number, observacoes?: string): Promise<CaixaSessao> {
    const now = new Date().toISOString();
    this.db!.run(
      `UPDATE caixas SET saldo_final = ?, status = 'fechado', data_fechamento = ?, observacoes = ?
      WHERE id = ?`,
      [saldoFinal, now, observacoes || null, caixaId]
    );
    await this.persist();
    const res = this.db!.exec("SELECT * FROM caixas WHERE id = ? LIMIT 1", [caixaId]);
    return this.rowToObject<CaixaSessao>(res[0].columns, res[0].values[0]);
  }

  public async adicionarMovimentoCaixa(caixaId: string, tipo: 'sangria' | 'suprimento', valor: number, motivo: string): Promise<MovimentoCaixa> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db!.run(
      `INSERT INTO movimentos_caixa (id, caixa_id, tipo, valor, motivo, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, caixaId, tipo, valor, motivo, now]
    );
    await this.persist();
    return { id, caixa_id: caixaId, tipo, valor, motivo, created_at: now };
  }

  public async getMovimentosCaixa(caixaId: string): Promise<MovimentoCaixa[]> {
    const res = this.db!.exec("SELECT * FROM movimentos_caixa WHERE caixa_id = ? ORDER BY created_at DESC", [caixaId]);
    if (!res.length) return [];
    return res[0].values.map(row => this.rowToObject<MovimentoCaixa>(res[0].columns, row));
  }

  // --- VENDAS PDV ---
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
    const vendaId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Obter próximo número sequencial da venda
    const numRes = this.db!.exec("SELECT IFNULL(MAX(numero_venda), 1000) + 1 AS proximo FROM vendas");
    const numeroVenda = numRes.length && numRes[0].values.length ? Number(numRes[0].values[0][0]) : 1001;

    this.db!.run(
      `INSERT INTO vendas (
        id, numero_venda, caixa_id, cliente_nome, cliente_telefone, subtotal, desconto,
        acrescimo, valor_final, forma_pagamento, troco, status, observacoes, sync_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'concluida', ?, 'pending', ?)`,
      [
        vendaId,
        numeroVenda,
        vendaData.caixa_id,
        vendaData.cliente_nome || null,
        vendaData.cliente_telefone || null,
        vendaData.subtotal,
        vendaData.desconto,
        vendaData.acrescimo,
        vendaData.valor_final,
        vendaData.forma_pagamento,
        vendaData.troco || 0,
        vendaData.observacoes || null,
        now
      ]
    );

    // Salvar itens da venda e abater estoque
    for (const item of itens) {
      const itemId = crypto.randomUUID();
      this.db!.run(
        `INSERT INTO itens_venda (
          id, venda_id, produto_id, produto_nome, quantidade, unit, preco_unitario, subtotal, tara_peso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          vendaId,
          item.product.id,
          item.product.name,
          item.quantity,
          item.product.unit || 'kg',
          item.price_unit,
          item.subtotal,
          item.tara_peso || 0
        ]
      );

      // Baixa no estoque local
      this.db!.run(
        "UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?",
        [item.quantity, now, item.product.id]
      );
    }

    await this.persist();

    return {
      id: vendaId,
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
  }

  public async getVendas(limit: number = 50): Promise<Venda[]> {
    const res = this.db!.exec("SELECT * FROM vendas ORDER BY created_at DESC LIMIT ?", [limit]);
    if (!res.length) return [];
    return res[0].values.map(row => this.rowToObject<Venda>(res[0].columns, row));
  }

  public async getVendasPendentesSync(): Promise<Venda[]> {
    const res = this.db!.exec("SELECT * FROM vendas WHERE sync_status = 'pending' ORDER BY created_at ASC");
    if (!res.length) return [];
    const vendas = res[0].values.map(row => this.rowToObject<Venda>(res[0].columns, row));
    
    for (const venda of vendas) {
      const itemsRes = this.db!.exec("SELECT * FROM itens_venda WHERE venda_id = ?", [venda.id]);
      if (itemsRes.length) {
        venda.itens = itemsRes[0].values.map(r => this.rowToObject<ItemVenda>(itemsRes[0].columns, r));
      }
    }
    return vendas;
  }

  public async marcarVendasSincronizadas(vendaIds: string[]): Promise<void> {
    if (!vendaIds.length) return;
    const placeholders = vendaIds.map(() => '?').join(',');
    this.db!.run(`UPDATE vendas SET sync_status = 'synced' WHERE id IN (${placeholders})`, vendaIds);
    await this.persist();
  }

  // --- PEDIDOS ONLINE ---
  public async getPedidosOnline(status?: string): Promise<PedidoOnline[]> {
    let sql = "SELECT * FROM pedidos_online";
    const params: any[] = [];
    if (status && status !== 'all') {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const res = this.db!.exec(sql, params);
    if (!res.length) return [];
    return res[0].values.map(row => {
      const obj = this.rowToObject<any>(res[0].columns, row);
      return {
        ...obj,
        itens: JSON.parse(obj.itens_json || '[]')
      };
    });
  }

  public async salvarPedidoOnline(pedido: PedidoOnline): Promise<void> {
    this.db!.run(
      `INSERT OR REPLACE INTO pedidos_online (
        id, numero_pedido, cliente_nome, cliente_telefone, cliente_endereco,
        tipo_entrega, forma_pagamento, total, status, observacoes, itens_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pedido.id,
        pedido.numero_pedido,
        pedido.cliente_nome,
        pedido.cliente_telefone,
        pedido.cliente_endereco || null,
        pedido.tipo_entrega,
        pedido.forma_pagamento,
        pedido.total,
        pedido.status,
        pedido.observacoes || null,
        JSON.stringify(pedido.itens || []),
        pedido.created_at || new Date().toISOString()
      ]
    );
    await this.persist();
  }

  public async atualizarStatusPedidoOnline(pedidoId: string, status: PedidoOnline['status']): Promise<void> {
    this.db!.run("UPDATE pedidos_online SET status = ? WHERE id = ?", [status, pedidoId]);
    await this.persist();
  }

  // --- DASHBOARD MÉTRICAS ---
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    const hoje = new Date().toISOString().split('T')[0];
    
    const vendasHojeRes = this.db!.exec(
      "SELECT COUNT(*), IFNULL(SUM(valor_final), 0), IFNULL(AVG(valor_final), 0) FROM vendas WHERE date(created_at) = date(?) AND status = 'concluida'",
      [hoje]
    );
    const totalVendasHoje = Number(vendasHojeRes[0]?.values[0]?.[0] || 0);
    const faturamentoHoje = Number(vendasHojeRes[0]?.values[0]?.[1] || 0);
    const ticketMedioHoje = Number(vendasHojeRes[0]?.values[0]?.[2] || 0);

    const faturamentoMesRes = this.db!.exec(
      "SELECT IFNULL(SUM(valor_final), 0) FROM vendas WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', ?) AND status = 'concluida'",
      [hoje]
    );
    const faturamentoMes = Number(faturamentoMesRes[0]?.values[0]?.[0] || 0);

    const prodCountRes = this.db!.exec("SELECT COUNT(*) FROM products WHERE is_deleted = 0");
    const quantidadeProdutos = Number(prodCountRes[0]?.values[0]?.[0] || 0);

    const lowStockRes = this.db!.exec("SELECT * FROM products WHERE is_deleted = 0 AND stock <= 5 ORDER BY stock ASC LIMIT 6");
    const produtosEstoqueBaixo = lowStockRes.length 
      ? lowStockRes[0].values.map(r => this.rowToObject<Product>(lowStockRes[0].columns, r))
      : [];

    const vendasRecentes = await this.getVendas(5);

    return {
      totalVendasHoje,
      faturamentoHoje,
      faturamentoMes,
      ticketMedioHoje,
      quantidadeProdutos,
      produtosEstoqueBaixo,
      vendasRecentes,
      vendasPorFormaPagamento: {},
      vendasUltimosDias: []
    };
  }

  // --- BACKUP & RESTAURAÇÃO ---
  public async exportDatabaseJSON(): Promise<string> {
    const config = await this.getConfig();
    const products = await this.getProducts();
    const taras = await this.getTaras();
    const vendas = await this.getVendas(5000);
    
    return JSON.stringify({
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      config,
      products,
      taras,
      vendas
    }, null, 2);
  }

  public async importDatabaseJSON(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData);
    if (data.products && Array.isArray(data.products)) {
      for (const p of data.products) {
        await this.saveProduct(p);
      }
    }
    if (data.taras && Array.isArray(data.taras)) {
      for (const t of data.taras) {
        await this.saveTara(t);
      }
    }
    await this.persist();
  }

  public async resetDatabase(): Promise<void> {
    this.db!.run("DELETE FROM itens_venda; DELETE FROM vendas; DELETE FROM movimentos_caixa; DELETE FROM caixas;");
    await this.persist();
  }

  private rowToObject<T>(columns: string[], row: any[]): T {
    const obj: any = {};
    columns.forEach((col, idx) => {
      let val = row[idx];
      // Converte booleans do SQLite (0/1) para booleanos se o nome começa com is_
      if (col.startsWith('is_') && typeof val === 'number') {
        val = val === 1;
      }
      obj[col] = val;
    });
    return obj as T;
  }
}

export const sqliteService = new SQLiteDatabaseService();
