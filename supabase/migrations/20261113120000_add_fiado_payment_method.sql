-- Migration: 20261113120000_add_fiado_payment_method.sql
-- Description: Adiciona forma de pagamento "A Prazo (Fiado)" caso ainda não exista

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.formas_pagamento 
        WHERE nome ILIKE '%prazo%' OR nome ILIKE '%fiado%'
    ) THEN
        INSERT INTO public.formas_pagamento (nome, tipo, recebimento_imediato, taxa)
        VALUES ('A Prazo (Fiado)', 'convenio', false, 0.00);
    END IF;
END $$;
