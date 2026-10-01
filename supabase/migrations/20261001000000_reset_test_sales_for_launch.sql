-- Migration: 20261001000000_reset_test_sales_for_launch.sql
-- Description: Limpeza e zeramento seguro de vendas e caixas de teste para o início oficial em 1º de outubro.
-- Preserva 100% dos pedidos online (tabelas orders e order_items), clientes, fornecedores e produtos.

CREATE OR REPLACE FUNCTION public.reset_vendas_pdv_lancamento()
RETURNS jsonb AS $$
DECLARE
    v_vendas_count INT := 0;
    v_caixas_count INT := 0;
    v_tef_count INT := 0;
    v_mov_count INT := 0;
BEGIN
    -- 1. Contagem prévia de registros de teste
    SELECT count(*) INTO v_vendas_count FROM public.vendas;
    SELECT count(*) INTO v_caixas_count FROM public.caixas;
    SELECT count(*) INTO v_tef_count FROM public.tef_transacoes;
    SELECT count(*) INTO v_mov_count FROM public.movimentacoes_estoque 
    WHERE tipo_movimentacao = 'saida_venda' OR referencia_tipo = 'venda';

    -- 2. Exclui documentos fiscais associados a vendas de teste
    DELETE FROM public.documentos_fiscais WHERE referencia_tipo = 'venda';

    -- 3. Exclui contas a receber geradas por vendas do balcão/PDV
    DELETE FROM public.contas_receber WHERE categoria = 'venda_balcao' OR venda_id IS NOT NULL;

    -- 4. Exclui transações TEF de teste
    DELETE FROM public.tef_transacoes;

    -- 5. Exclui itens de venda e parcelas/pagamentos de teste
    DELETE FROM public.venda_itens;
    DELETE FROM public.pagamentos_venda;

    -- 6. Exclui vendas do PDV
    DELETE FROM public.vendas;

    -- 7. Exclui caixas de teste
    DELETE FROM public.caixas;

    -- 8. Exclui movimentações de estoque geradas por vendas de teste do PDV
    DELETE FROM public.movimentacoes_estoque 
    WHERE tipo_movimentacao = 'saida_venda' OR referencia_tipo = 'venda';

    -- IMPORTANTE:
    -- As tabelas public.orders e public.order_items (pedidos feitos na loja virtual/online) NÃO são tocadas.
    -- O catálogo de produtos, estoque e clientes permanecem intactos.

    RETURN jsonb_build_object(
        'success', true,
        'vendas_removidas', v_vendas_count,
        'caixas_removidos', v_caixas_count,
        'tef_removidos', v_tef_count,
        'movimentacoes_removidas', v_mov_count,
        'message', 'Vendas e caixas de teste zerados com sucesso para o lançamento de 1º de outubro.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões de execução para usuários autenticados e anon
GRANT EXECUTE ON FUNCTION public.reset_vendas_pdv_lancamento() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_vendas_pdv_lancamento() TO anon;
