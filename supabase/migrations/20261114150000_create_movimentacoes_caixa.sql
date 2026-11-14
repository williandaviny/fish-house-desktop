-- Migration: 20261114150000_create_movimentacoes_caixa.sql
-- Description: Tabela para controle de Suprimento (entrada de troco) e Sangria (retirada de dinheiro) no PDV

CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    caixa_id UUID REFERENCES public.caixas(id) ON DELETE CASCADE NOT NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('suprimento', 'sangria')),
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    motivo TEXT NOT NULL,
    operador_id UUID,
    operador_nome TEXT
);

-- Enable RLS
ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins full access on movimentacoes_caixa" ON public.movimentacoes_caixa;
CREATE POLICY "Admins full access on movimentacoes_caixa" ON public.movimentacoes_caixa
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read/write access on movimentacoes_caixa" ON public.movimentacoes_caixa;
CREATE POLICY "Public read/write access on movimentacoes_caixa" ON public.movimentacoes_caixa
    FOR ALL TO public USING (true) WITH CHECK (true);
