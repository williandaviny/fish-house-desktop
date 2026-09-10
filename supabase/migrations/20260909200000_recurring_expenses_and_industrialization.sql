-- Migration: 20260909200000_recurring_expenses_and_industrialization.sql
-- Description: Create tables for Despesas Recorrentes, Ordens de Industrializacao (Beneficiamento) e campos adicionais de Contas a Pagar

-- 1. Create public.despesas_recorrentes
CREATE TABLE IF NOT EXISTS public.despesas_recorrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    frequencia TEXT DEFAULT 'mensal' NOT NULL CHECK (frequencia IN ('mensal', 'semanal', 'anual')),
    dia_vencimento INTEGER DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
    data_inicio DATE DEFAULT CURRENT_DATE NOT NULL,
    data_fim DATE,
    ativo BOOLEAN DEFAULT true NOT NULL,
    ultimo_lancamento_em DATE,
    forma_pagamento TEXT DEFAULT 'boleto',
    observacoes TEXT
);

-- Enable RLS for despesas_recorrentes
ALTER TABLE public.despesas_recorrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on despesas_recorrentes" ON public.despesas_recorrentes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read on despesas_recorrentes" ON public.despesas_recorrentes
    FOR SELECT TO public USING (true);


-- 2. Add extra columns to public.contas_pagar
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS recorrente_id UUID REFERENCES public.despesas_recorrentes(id) ON DELETE SET NULL;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS numero_parcela INTEGER;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS total_parcelas INTEGER;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS documento_numero TEXT;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS chave_nfe TEXT;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS juros_multa NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS observacoes TEXT;


-- 3. Create public.ordens_industrializacao
CREATE TABLE IF NOT EXISTS public.ordens_industrializacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    numero_ordem TEXT NOT NULL UNIQUE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'remetido' NOT NULL CHECK (status IN ('pendente', 'remetido', 'retornado_parcial', 'concluido', 'cancelado')),
    data_remessa DATE DEFAULT CURRENT_DATE NOT NULL,
    data_retorno_prevista DATE,
    data_retorno_efetiva DATE,
    numero_nfe_remessa TEXT,
    chave_nfe_remessa TEXT,
    numero_nfe_retorno TEXT,
    chave_nfe_retorno TEXT,
    valor_servico_corte NUMERIC(10,2) DEFAULT 0.00,
    rendimento_percentual NUMERIC(5,2),
    quebra_kg NUMERIC(10,3),
    responsavel TEXT,
    observacoes TEXT
);

-- Enable RLS for ordens_industrializacao
ALTER TABLE public.ordens_industrializacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on ordens_industrializacao" ON public.ordens_industrializacao
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read on ordens_industrializacao" ON public.ordens_industrializacao
    FOR SELECT TO public USING (true);


-- 4. Create public.ordem_industrializacao_itens
CREATE TABLE IF NOT EXISTS public.ordem_industrializacao_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    ordem_id UUID REFERENCES public.ordens_industrializacao(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('insumo_remetido', 'produto_retornado')),
    produto_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    quantidade NUMERIC(10,3) NOT NULL CHECK (quantidade > 0),
    custo_unitario NUMERIC(10,2) NOT NULL CHECK (custo_unitario >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    local_origem_id UUID REFERENCES public.locais_estoque(id) ON DELETE SET NULL,
    local_destino_id UUID REFERENCES public.locais_estoque(id) ON DELETE SET NULL
);

-- Enable RLS for ordem_industrializacao_itens
ALTER TABLE public.ordem_industrializacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on ordem_industrializacao_itens" ON public.ordem_industrializacao_itens
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read on ordem_industrializacao_itens" ON public.ordem_industrializacao_itens
    FOR SELECT TO public USING (true);
