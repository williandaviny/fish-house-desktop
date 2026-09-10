import { supabase } from '../lib/supabase';

export type IndustrializationItem = {
  id?: string;
  ordem_id?: string;
  tipo: 'insumo_remetido' | 'produto_retornado';
  produto_id: string;
  quantidade: number;
  custo_unitario: number;
  subtotal: number;
  local_origem_id?: string;
  local_destino_id?: string;
  produtos?: { name: string; unit: string };
};

export type IndustrializationOrder = {
  id: string;
  created_at?: string;
  numero_ordem: string;
  empresa_id?: string;
  fornecedor_id: string;
  status: 'pendente' | 'remetido' | 'retornado_parcial' | 'concluido' | 'cancelado';
  data_remessa: string;
  data_retorno_prevista?: string;
  data_retorno_efetiva?: string;
  numero_nfe_remessa?: string;
  chave_nfe_remessa?: string;
  numero_nfe_retorno?: string;
  chave_nfe_retorno?: string;
  valor_servico_corte: number;
  rendimento_percentual?: number;
  quebra_kg?: number;
  responsavel?: string;
  observacoes?: string;
  fornecedores?: { razao_social: string; nome_fantasia?: string };
  itens?: IndustrializationItem[];
};

const LOCAL_STORAGE_KEY = 'fishhouse_industrialization_orders_fallback';

export const industrializationService = {
  // 1. List all orders
  async list(): Promise<IndustrializationOrder[]> {
    try {
      const { data, error } = await supabase
        .from('ordens_industrializacao')
        .select(`
          *,
          fornecedores (razao_social, nome_fantasia),
          itens:ordem_industrializacao_itens (
            *,
            produtos:produto_id (name, unit)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Fallback to local industrialization orders:', error.message);
        return this.getLocal();
      }

      return (data || []).map(o => ({
        ...o,
        valor_servico_corte: Number(o.valor_servico_corte || 0),
        rendimento_percentual: o.rendimento_percentual ? Number(o.rendimento_percentual) : undefined,
        quebra_kg: o.quebra_kg ? Number(o.quebra_kg) : undefined,
        itens: (o.itens || []).map((i: any) => ({
          ...i,
          quantidade: Number(i.quantidade),
          custo_unitario: Number(i.custo_unitario),
          subtotal: Number(i.subtotal)
        }))
      }));
    } catch {
      return this.getLocal();
    }
  },

  // 2. Create Remittance Order (Salmão Inteiro Enviado para Frigorífico)
  async createRemessa(params: {
    empresa_id?: string;
    fornecedor_id: string;
    insumo_produto_id: string;
    quantidade_remessa: number;
    custo_unitario: number;
    local_origem_id: string;
    numero_nfe_remessa?: string;
    chave_nfe_remessa?: string;
    data_retorno_prevista?: string;
    responsavel?: string;
    observacoes?: string;
  }): Promise<IndustrializationOrder> {
    const year = new Date().getFullYear();
    const orders = await this.list();
    const nextSeq = String(orders.length + 1).padStart(4, '0');
    const numero_ordem = `OM-${year}-${nextSeq}`;

    const subtotalInsumo = Number((params.quantidade_remessa * params.custo_unitario).toFixed(2));

    try {
      // 1. Insert order
      const { data: order, error: orderErr } = await supabase
        .from('ordens_industrializacao')
        .insert([{
          numero_ordem,
          empresa_id: params.empresa_id,
          fornecedor_id: params.fornecedor_id,
          status: 'remetido',
          data_remessa: new Date().toISOString().split('T')[0],
          data_retorno_prevista: params.data_retorno_prevista || null,
          numero_nfe_remessa: params.numero_nfe_remessa || null,
          chave_nfe_remessa: params.chave_nfe_remessa || null,
          responsavel: params.responsavel || 'Operador Fish House',
          observacoes: params.observacoes || null
        }])
        .select(`*, fornecedores (razao_social, nome_fantasia)`)
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert item
      const { data: item, error: itemErr } = await supabase
        .from('ordem_industrializacao_itens')
        .insert([{
          ordem_id: order.id,
          tipo: 'insumo_remetido',
          produto_id: params.insumo_produto_id,
          quantidade: params.quantidade_remessa,
          custo_unitario: params.custo_unitario,
          subtotal: subtotalInsumo,
          local_origem_id: params.local_origem_id
        }])
        .select(`*, produtos:produto_id (name, unit)`)
        .single();

      if (itemErr) throw itemErr;

      // 3. Subtract stock from local_origem
      try {
        const { data: currentStock } = await supabase
          .from('saldos_estoque')
          .select('id, saldo_atual')
          .eq('produto_id', params.insumo_produto_id)
          .eq('local_estoque_id', params.local_origem_id)
          .maybeSingle();

        if (currentStock) {
          const newQty = Math.max(0, Number(currentStock.saldo_atual) - params.quantidade_remessa);
          await supabase
            .from('saldos_estoque')
            .update({ saldo_atual: newQty })
            .eq('id', currentStock.id);
        }

        // Log movement
        await supabase
          .from('movimentacoes_estoque')
          .insert([{
            produto_id: params.insumo_produto_id,
            origem_local_id: params.local_origem_id,
            tipo_movimentacao: 'transferencia',
            quantidade: params.quantidade_remessa,
            custo_unitario: params.custo_unitario,
            motivo: `Remessa para Industrialização ${numero_ordem} (CFOP 5.901)`,
            referencia_tipo: 'industrializacao',
            referencia_id: order.id
          }]);
      } catch (stockErr) {
        console.warn('Stock update note:', stockErr);
      }

      return {
        ...order,
        itens: [item]
      };

    } catch (err: any) {
      console.warn('Saving industrialization order locally:', err.message);
      const localItem: IndustrializationItem = {
        id: 'item_' + Date.now(),
        tipo: 'insumo_remetido',
        produto_id: params.insumo_produto_id,
        quantidade: params.quantidade_remessa,
        custo_unitario: params.custo_unitario,
        subtotal: subtotalInsumo,
        local_origem_id: params.local_origem_id
      };

      const localOrder: IndustrializationOrder = {
        id: 'local_ind_' + Date.now(),
        numero_ordem,
        created_at: new Date().toISOString(),
        empresa_id: params.empresa_id,
        fornecedor_id: params.fornecedor_id,
        status: 'remetido',
        data_remessa: new Date().toISOString().split('T')[0],
        data_retorno_prevista: params.data_retorno_prevista,
        numero_nfe_remessa: params.numero_nfe_remessa,
        chave_nfe_remessa: params.chave_nfe_remessa,
        valor_servico_corte: 0,
        responsavel: params.responsavel || 'Operador Fish House',
        observacoes: params.observacoes,
        itens: [localItem]
      };

      const current = this.getLocal();
      current.unshift(localOrder);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
      return localOrder;
    }
  },

  // 3. Process Return & Calculate Yield (Retorno do Filé Pronto)
  async processRetorno(params: {
    ordem_id: string;
    produto_retornado_id: string;
    quantidade_retornada: number;
    valor_servico_corte: number;
    local_destino_id: string;
    numero_nfe_retorno?: string;
    chave_nfe_retorno?: string;
    data_vencimento_servico?: string;
  }): Promise<{ order: IndustrializationOrder; novoCustoFilé: number; rendimento: number; quebraKg: number }> {
    const orders = await this.list();
    const order = orders.find(o => o.id === params.ordem_id);
    if (!order) throw new Error('Ordem de manipulação não encontrada.');

    const insumoItem = order.itens?.find(i => i.tipo === 'insumo_remetido');
    if (!insumoItem) throw new Error('Insumo original não localizado nesta ordem.');

    const pesoInsumo = insumoItem.quantidade; // ex: 100 kg
    const custoInsumoTotal = insumoItem.subtotal; // ex: R$ 6.000,00
    const pesoFilé = params.quantidade_retornada; // ex: 60 kg

    // Yield and loss calculations
    const rendimento = Number(((pesoFilé / pesoInsumo) * 100).toFixed(1)); // ex: 60.0%
    const quebraKg = Number((pesoInsumo - pesoFilé).toFixed(3)); // ex: 40.000 kg

    // Recalculate Filet unit cost: (Total raw fish cost + Cutting service fee) / Filet Quantity
    const custoTotalBeneficiado = custoInsumoTotal + params.valor_servico_corte;
    const novoCustoFilé = Number((custoTotalBeneficiado / pesoFilé).toFixed(2)); // ex: (6000 + 480) / 60 = R$ 108,00/kg

    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // 1. Update Order in DB
      const { data: updatedOrder, error: orderErr } = await supabase
        .from('ordens_industrializacao')
        .update({
          status: 'concluido',
          data_retorno_efetiva: todayStr,
          numero_nfe_retorno: params.numero_nfe_retorno || null,
          chave_nfe_retorno: params.chave_nfe_retorno || null,
          valor_servico_corte: params.valor_servico_corte,
          rendimento_percentual: rendimento,
          quebra_kg: quebraKg
        })
        .eq('id', params.ordem_id)
        .select(`*, fornecedores (razao_social, nome_fantasia)`)
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert returned item
      await supabase
        .from('ordem_industrializacao_itens')
        .insert([{
          ordem_id: params.ordem_id,
          tipo: 'produto_retornado',
          produto_id: params.produto_retornado_id,
          quantidade: pesoFilé,
          custo_unitario: novoCustoFilé,
          subtotal: custoTotalBeneficiado,
          local_destino_id: params.local_destino_id
        }]);

      // 3. Update stock for Filé de Salmão
      try {
        const { data: destStock } = await supabase
          .from('saldos_estoque')
          .select('id, saldo_atual')
          .eq('produto_id', params.produto_retornado_id)
          .eq('local_estoque_id', params.local_destino_id)
          .maybeSingle();

        const curSaldo = destStock ? Number(destStock.saldo_atual) : 0;
        const newSaldo = curSaldo + pesoFilé;

        if (destStock) {
          await supabase
            .from('saldos_estoque')
            .update({ saldo_atual: newSaldo })
            .eq('id', destStock.id);
        } else {
          await supabase
            .from('saldos_estoque')
            .insert([{
              produto_id: params.produto_retornado_id,
              local_estoque_id: params.local_destino_id,
              saldo_atual: newSaldo,
              saldo_reservado: 0
            }]);
        }

        // Log movement
        await supabase
          .from('movimentacoes_estoque')
          .insert([{
            produto_id: params.produto_retornado_id,
            destino_local_id: params.local_destino_id,
            tipo_movimentacao: 'retorno',
            quantidade: pesoFilé,
            custo_unitario: novoCustoFilé,
            motivo: `Retorno de Industrialização ${order.numero_ordem} (CFOP 5.902/5.124)`,
            referencia_tipo: 'industrializacao',
            referencia_id: order.id
          }]);

        // Update product weighted average cost for the filet
        await supabase
          .from('products')
          .update({ custo_medio: novoCustoFilé })
          .eq('id', params.produto_retornado_id);

      } catch (stkErr) {
        console.warn('Stock update note on return:', stkErr);
      }

      // 4. Generate contas_pagar title for cutting service if valor > 0
      if (params.valor_servico_corte > 0) {
        try {
          const supplierName = updatedOrder.fornecedores?.nome_fantasia || updatedOrder.fornecedores?.razao_social || 'Prestador de Serviço';
          const dueDate = params.data_vencimento_servico || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          await supabase
            .from('contas_pagar')
            .insert([{
              descricao: `Serviço Industrialização/Corte ${order.numero_ordem} - ${supplierName}`,
              categoria: 'industrializacao_servico',
              valor: params.valor_servico_corte,
              vencimento: dueDate,
              empresa_id: order.empresa_id,
              fornecedor_id: order.fornecedor_id,
              status: 'pendente',
              documento_numero: params.numero_nfe_retorno || null,
              chave_nfe: params.chave_nfe_retorno || null,
              forma_pagamento: 'boleto',
              observacoes: `NF de Retorno #${params.numero_nfe_retorno || 'S/N'}. Rendimento: ${rendimento}%. Custo Filé resultante: R$ ${novoCustoFilé.toFixed(2)}/kg.`
            }]);
        } catch (finErr) {
          console.warn('Finance entry note on cutting service:', finErr);
        }
      }

      return {
        order: updatedOrder,
        novoCustoFilé,
        rendimento,
        quebraKg
      };

    } catch (err: any) {
      console.warn('Processing return locally:', err.message);
      // Local fallback
      const current = this.getLocal();
      const idx = current.findIndex(o => o.id === params.ordem_id);
      if (idx >= 0) {
        current[idx].status = 'concluido';
        current[idx].data_retorno_efetiva = todayStr;
        current[idx].numero_nfe_retorno = params.numero_nfe_retorno;
        current[idx].chave_nfe_retorno = params.chave_nfe_retorno;
        current[idx].valor_servico_corte = params.valor_servico_corte;
        current[idx].rendimento_percentual = rendimento;
        current[idx].quebra_kg = quebraKg;
        
        current[idx].itens = current[idx].itens || [];
        current[idx].itens!.push({
          id: 'item_ret_' + Date.now(),
          tipo: 'produto_retornado',
          produto_id: params.produto_retornado_id,
          quantidade: pesoFilé,
          custo_unitario: novoCustoFilé,
          subtotal: custoTotalBeneficiado,
          local_destino_id: params.local_destino_id
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
      }

      return {
        order: current[idx] || order,
        novoCustoFilé,
        rendimento,
        quebraKg
      };
    }
  },

  // Helpers for local fallback
  getLocal(): IndustrializationOrder[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) return JSON.parse(data);
      // Initial sample demonstration order
      const initial: IndustrializationOrder[] = [
        {
          id: 'local_ind_demo',
          numero_ordem: 'OM-2026-0001',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          fornecedor_id: 'forn_1',
          status: 'remetido',
          data_remessa: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          data_retorno_prevista: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          numero_nfe_remessa: 'NF-e 001.240',
          valor_servico_corte: 0,
          responsavel: 'Chefe de Manipulação Fish House',
          observacoes: 'Salmão Inteiro Fresco Premium para corte em filés limpos sem espinhas',
          fornecedores: {
            razao_social: 'Frigorífico & Beneficiamento Costa Sul Ltda',
            nome_fantasia: 'Costa Sul Cortes'
          },
          itens: [
            {
              id: 'demo_item_1',
              tipo: 'insumo_remetido',
              produto_id: 'prod_salmao_inteiro',
              quantidade: 120.000,
              custo_unitario: 58.00,
              subtotal: 6960.00,
              produtos: {
                name: 'Salmão Inteiro Fresco',
                unit: 'kg'
              }
            }
          ]
        }
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    } catch {
      return [];
    }
  }
};
