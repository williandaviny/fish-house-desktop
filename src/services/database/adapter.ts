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

export interface IDatabaseService {
  init(): Promise<void>;
  
  // Configurações
  getConfig(): Promise<EmpresaConfig>;
  saveConfig(config: Partial<EmpresaConfig>): Promise<void>;

  // Produtos e Balança
  getProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  getProductByBarcodeOrPLU(code: string): Promise<Product | null>;
  saveProduct(product: Partial<Product> & { name: string; price: number }): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  updateStock(productId: string, quantityDelta: number): Promise<void>;

  // Taras Balança Toledo
  getTaras(): Promise<TaraBalanca[]>;
  saveTara(tara: Partial<TaraBalanca> & { codigo: number; descricao: string; peso: number }): Promise<TaraBalanca>;
  deleteTara(id: string): Promise<void>;

  // Caixa e Turno
  getCaixaAberto(): Promise<CaixaSessao | null>;
  abrirCaixa(operadorNome: string, valorInicial: number): Promise<CaixaSessao>;
  fecharCaixa(caixaId: string, saldoFinal: number, observacoes?: string): Promise<CaixaSessao>;
  adicionarMovimentoCaixa(caixaId: string, tipo: 'sangria' | 'suprimento', valor: number, motivo: string): Promise<MovimentoCaixa>;
  getMovimentosCaixa(caixaId: string): Promise<MovimentoCaixa[]>;

  // Vendas PDV
  criarVenda(
    venda: {
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
  ): Promise<Venda>;
  getVendas(limit?: number): Promise<Venda[]>;
  getVendasPendentesSync(): Promise<Venda[]>;
  marcarVendasSincronizadas(vendaIds: string[]): Promise<void>;

  // Pedidos Online (Web / Delivery)
  getPedidosOnline(status?: string): Promise<PedidoOnline[]>;
  salvarPedidoOnline(pedido: PedidoOnline): Promise<void>;
  atualizarStatusPedidoOnline(pedidoId: string, status: PedidoOnline['status']): Promise<void>;

  // Métricas
  getDashboardMetrics(): Promise<DashboardMetrics>;

  // Backup & Import
  exportDatabaseJSON(): Promise<string>;
  importDatabaseJSON(jsonData: string): Promise<void>;
  resetDatabase(): Promise<void>;
}
