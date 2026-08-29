export const INITIAL_SQL_SCHEMA = `
-- Tabela de Configurações da Empresa e Sistema
CREATE TABLE IF NOT EXISTS empresa_config (
  id TEXT PRIMARY KEY,
  nome_empresa TEXT NOT NULL DEFAULT 'Fish House - Peixaria Premium',
  cnpj TEXT DEFAULT '00.000.000/0001-00',
  telefone TEXT DEFAULT '(47) 99999-9999',
  endereco TEXT DEFAULT 'Navegantes - SC',
  mensagem_cupom TEXT DEFAULT 'Obrigado pela preferência! Peixes frescos todos os dias.',
  auto_sync_interval INTEGER DEFAULT 30,
  supabase_url TEXT DEFAULT 'https://mqktczeqkynqqgzkbrno.supabase.co',
  supabase_anon_key TEXT DEFAULT 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa3RjemVxa3lucXFnemticm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzI3MDUsImV4cCI6MjA5OTkwODcwNX0.vFo6S1aa1Uv2JsleRh50VkoL4aknzjepgUvqOI0frNY',
  impressora_largura TEXT DEFAULT '80mm',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabela de Taras de Balança Toledo
CREATE TABLE IF NOT EXISTS taras_balanca (
  id TEXT PRIMARY KEY,
  codigo INTEGER NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  peso REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  price_wholesale REAL DEFAULT 0,
  wholesale_min_qty REAL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Geral',
  image_url TEXT,
  unit TEXT NOT NULL DEFAULT 'kg',
  is_available INTEGER NOT NULL DEFAULT 1,
  is_combo INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  is_illustrative INTEGER DEFAULT 0,
  barcode TEXT,
  codigo_interno TEXT,
  plu_codigo TEXT,
  validade_dias INTEGER DEFAULT 0,
  tara_id TEXT REFERENCES taras_balanca(id),
  stock REAL NOT NULL DEFAULT 0,
  custo_medio REAL DEFAULT 0,
  ncm TEXT DEFAULT '03028990',
  cfop TEXT DEFAULT '5102',
  description TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Índices para busca ultrarrápida
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_plu ON products(plu_codigo);
CREATE INDEX IF NOT EXISTS idx_products_codigo_interno ON products(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Tabela de Sessões de Caixa
CREATE TABLE IF NOT EXISTS caixas (
  id TEXT PRIMARY KEY,
  operador_id TEXT,
  operador_nome TEXT NOT NULL DEFAULT 'Operador Caixa',
  saldo_inicial REAL NOT NULL DEFAULT 0,
  saldo_final REAL,
  data_abertura TEXT DEFAULT (datetime('now', 'localtime')),
  data_fechamento TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  observacoes TEXT
);

-- Tabela de Movimentos de Caixa (Sangria e Suprimento)
CREATE TABLE IF NOT EXISTS movimentos_caixa (
  id TEXT PRIMARY KEY,
  caixa_id TEXT NOT NULL REFERENCES caixas(id),
  tipo TEXT NOT NULL, -- 'sangria' ou 'suprimento'
  valor REAL NOT NULL,
  motivo TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabela de Vendas Realizadas no PDV
CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  numero_venda INTEGER,
  caixa_id TEXT NOT NULL REFERENCES caixas(id),
  cliente_id TEXT,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  subtotal REAL NOT NULL,
  desconto REAL DEFAULT 0,
  acrescimo REAL DEFAULT 0,
  valor_final REAL NOT NULL,
  forma_pagamento TEXT NOT NULL DEFAULT 'Dinheiro',
  troco REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'concluida',
  observacoes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' ou 'synced'
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Itens da Venda
CREATE TABLE IF NOT EXISTS itens_venda (
  id TEXT PRIMARY KEY,
  venda_id TEXT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  quantidade REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  preco_unitario REAL NOT NULL,
  subtotal REAL NOT NULL,
  tara_peso REAL DEFAULT 0
);

-- Tabela de Pedidos Online recebidos da Web
CREATE TABLE IF NOT EXISTS pedidos_online (
  id TEXT PRIMARY KEY,
  numero_pedido TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_endereco TEXT,
  tipo_entrega TEXT DEFAULT 'delivery',
  forma_pagamento TEXT DEFAULT 'Pix',
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo',
  observacoes TEXT,
  itens_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Histórico de Logs de Sincronização
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL,
  detalhes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`;
