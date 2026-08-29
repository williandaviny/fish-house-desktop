export interface Product {
  id: string;
  name: string;
  price: number;
  price_wholesale?: number;
  wholesale_min_qty?: number;
  category: string;
  image_url?: string;
  unit: string;
  is_available: boolean;
  is_combo?: boolean;
  is_featured?: boolean;
  is_illustrative?: boolean;
  barcode?: string;
  codigo_interno?: string;
  plu_codigo?: string;
  validade_dias?: number;
  tara_id?: string;
  stock: number;
  custo_medio?: number;
  ncm?: string;
  cfop?: string;
  description?: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TaraBalanca {
  id: string;
  codigo: number;
  descricao: string;
  peso: number; // em kg (ex: 0.040 para 40g)
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  price_unit: number;
  tara_peso: number;
  tara_nome?: string;
  peso_bruto?: number;
  subtotal: number;
  notes?: string;
}

export interface CaixaSessao {
  id: string;
  operador_id?: string;
  operador_nome: string;
  saldo_inicial: number;
  saldo_final?: number;
  data_abertura: string;
  data_fechamento?: string;
  status: 'aberto' | 'fechado';
  observacoes?: string;
}

export interface MovimentoCaixa {
  id: string;
  caixa_id: string;
  tipo: 'sangria' | 'suprimento';
  valor: number;
  motivo: string;
  created_at: string;
}

export interface Venda {
  id: string;
  numero_venda: number;
  caixa_id: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  subtotal: number;
  desconto: number;
  acrescimo: number;
  valor_final: number;
  forma_pagamento: string;
  troco?: number;
  status: 'concluida' | 'cancelada';
  observacoes?: string;
  sync_status: 'pending' | 'synced';
  created_at: string;
  itens?: ItemVenda[];
}

export interface ItemVenda {
  id: string;
  venda_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  unit: string;
  preco_unitario: number;
  subtotal: number;
  tara_peso?: number;
}

export interface PedidoOnline {
  id: string;
  numero_pedido: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_endereco?: string;
  tipo_entrega: 'delivery' | 'retirada';
  forma_pagamento: string;
  total: number;
  status: 'novo' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelado';
  observacoes?: string;
  itens: Array<{
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }>;
  created_at: string;
}

export interface EmpresaConfig {
  id: string;
  nome_empresa: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  mensagem_cupom: string;
  auto_sync_interval: number; // em segundos
  supabase_url: string;
  supabase_anon_key: string;
  impressora_largura: '58mm' | '80mm';
}

export interface DashboardMetrics {
  totalVendasHoje: number;
  faturamentoHoje: number;
  faturamentoMes: number;
  ticketMedioHoje: number;
  quantidadeProdutos: number;
  produtosEstoqueBaixo: Product[];
  vendasRecentes: Venda[];
  vendasPorFormaPagamento: Record<string, number>;
  vendasUltimosDias: { data: string; total: number }[];
}
