import { supabase } from '../lib/supabase';

export type RecurringExpense = {
  id: string;
  created_at?: string;
  empresa_id?: string;
  fornecedor_id?: string | null;
  descricao: string;
  categoria: string;
  valor: number;
  frequencia: 'mensal' | 'semanal' | 'anual';
  dia_vencimento: number; // 1 to 31
  dia_semana?: number;
  data_inicio: string; // YYYY-MM-DD
  data_fim?: string | null;
  ativo: boolean;
  ultimo_lancamento_em?: string | null;
  forma_pagamento?: string;
  observacoes?: string | null;
  fornecedores?: { razao_social: string; nome_fantasia?: string } | null;
};

const LOCAL_STORAGE_KEY = 'fishhouse_recurring_expenses_fallback';

export const recurringExpensesService = {
  // 1. Fetch all recurring expenses
  async list(): Promise<RecurringExpense[]> {
    try {
      const { data, error } = await supabase
        .from('despesas_recorrentes')
        .select(`
          *,
          fornecedores (razao_social, nome_fantasia)
        `)
        .order('descricao', { ascending: true });

      if (error) {
        // Fallback to localStorage if table is not yet in Supabase
        console.warn('Fallback to local storage for recurring expenses:', error.message);
        return this.getLocal();
      }

      return (data || []).map(d => ({
        ...d,
        valor: Number(d.valor)
      }));
    } catch (e) {
      return this.getLocal();
    }
  },

  // 2. Create or update recurring expense
  async save(expense: Omit<RecurringExpense, 'id' | 'created_at'> & { id?: string }): Promise<RecurringExpense> {
    const isUpdate = !!expense.id;
    try {
      if (isUpdate) {
        const { data, error } = await supabase
          .from('despesas_recorrentes')
          .update({
            descricao: expense.descricao,
            categoria: expense.categoria,
            valor: expense.valor,
            frequencia: expense.frequencia,
            dia_vencimento: expense.dia_vencimento,
            empresa_id: expense.empresa_id,
            fornecedor_id: expense.fornecedor_id || null,
            ativo: expense.ativo,
            data_inicio: expense.data_inicio,
            data_fim: expense.data_fim || null,
            forma_pagamento: expense.forma_pagamento || 'boleto',
            observacoes: expense.observacoes || null
          })
          .eq('id', expense.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('despesas_recorrentes')
          .insert([{
            descricao: expense.descricao,
            categoria: expense.categoria,
            valor: expense.valor,
            frequencia: expense.frequencia,
            dia_vencimento: expense.dia_vencimento,
            empresa_id: expense.empresa_id,
            fornecedor_id: expense.fornecedor_id || null,
            ativo: expense.ativo,
            data_inicio: expense.data_inicio,
            data_fim: expense.data_fim || null,
            forma_pagamento: expense.forma_pagamento || 'boleto',
            observacoes: expense.observacoes || null
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (err: any) {
      console.warn('Saving recurring expense locally due to error:', err.message);
      // Fallback local save
      const current = this.getLocal();
      let saved: RecurringExpense;
      if (isUpdate) {
        const idx = current.findIndex(c => c.id === expense.id);
        saved = { ...current[idx], ...expense } as RecurringExpense;
        if (idx >= 0) current[idx] = saved;
      } else {
        saved = {
          id: 'local_' + Date.now(),
          created_at: new Date().toISOString(),
          ...expense
        } as RecurringExpense;
        current.push(saved);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
      return saved;
    }
  },

  // 3. Toggle active/paused
  async toggleActive(id: string, ativo: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('despesas_recorrentes')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    } catch {
      const current = this.getLocal();
      const item = current.find(c => c.id === id);
      if (item) {
        item.ativo = ativo;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
      }
    }
  },

  // 4. Delete
  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('despesas_recorrentes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch {
      const current = this.getLocal().filter(c => c.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    }
  },

  // 5. Generate Bills for a target Month (e.g. Current Month or Next Month)
  async generateBillsForMonth(targetYear: number, targetMonth: number, empresaId?: string): Promise<{ generatedCount: number; skippedCount: number; errors: string[] }> {
    const list = await this.list();
    const activeRules = list.filter(r => r.ativo);
    
    // Month formatted as 'YYYY-MM'
    const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    let generatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Query existing bills in contas_pagar for this month
    const { data: existingBills } = await supabase
      .from('contas_pagar')
      .select('id, descricao, vencimento, recorrente_id')
      .gte('vencimento', `${monthStr}-01`)
      .lte('vencimento', `${monthStr}-31`);

    for (const rule of activeRules) {
      try {
        // Calculate due date
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const safeDay = Math.min(rule.dia_vencimento, daysInMonth);
        const dueDate = `${monthStr}-${String(safeDay).padStart(2, '0')}`;

        // Check if already generated for this rule and month
        const alreadyExists = (existingBills || []).some(b => 
          (b.recorrente_id && b.recorrente_id === rule.id) ||
          (b.descricao.toLowerCase().includes(rule.descricao.toLowerCase()) && b.vencimento === dueDate)
        );

        if (alreadyExists) {
          skippedCount++;
          continue;
        }

        // Insert into contas_pagar
        const { error: insertErr } = await supabase
          .from('contas_pagar')
          .insert({
            descricao: `${rule.descricao} (${String(targetMonth).padStart(2, '0')}/${targetYear})`,
            categoria: rule.categoria,
            valor: rule.valor,
            vencimento: dueDate,
            empresa_id: rule.empresa_id || empresaId,
            fornecedor_id: rule.fornecedor_id || null,
            status: 'pendente',
            recorrente_id: rule.id.startsWith('local_') ? null : rule.id,
            forma_pagamento: rule.forma_pagamento || 'boleto',
            observacoes: `Gerado automaticamente da regra recorrente: ${rule.descricao}`
          });

        if (insertErr) {
          errors.push(`Erro ao lançar ${rule.descricao}: ${insertErr.message}`);
        } else {
          generatedCount++;
          // Update ultimo_lancamento_em
          try {
            await supabase
              .from('despesas_recorrentes')
              .update({ ultimo_lancamento_em: dueDate })
              .eq('id', rule.id);
          } catch (_) {}
        }
      } catch (err: any) {
        errors.push(`Falha em ${rule.descricao}: ${err.message}`);
      }
    }

    return { generatedCount, skippedCount, errors };
  },

  // Helpers for local fallback
  getLocal(): RecurringExpense[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) return JSON.parse(data);
      // Default common fish market expenses if completely empty
      const initialDefaults: RecurringExpense[] = [
        {
          id: 'local_default_1',
          descricao: 'Aluguel do Imóvel Comercial',
          categoria: 'aluguel',
          valor: 6500.00,
          frequencia: 'mensal',
          dia_vencimento: 10,
          data_inicio: new Date().toISOString().split('T')[0],
          ativo: true,
          forma_pagamento: 'boleto'
        },
        {
          id: 'local_default_2',
          descricao: 'Energia Elétrica (Câmaras Frias)',
          categoria: 'energia',
          valor: 3200.00,
          frequencia: 'mensal',
          dia_vencimento: 15,
          data_inicio: new Date().toISOString().split('T')[0],
          ativo: true,
          forma_pagamento: 'boleto'
        },
        {
          id: 'local_default_3',
          descricao: 'Água e Saneamento',
          categoria: 'outros',
          valor: 450.00,
          frequencia: 'mensal',
          dia_vencimento: 20,
          data_inicio: new Date().toISOString().split('T')[0],
          ativo: true,
          forma_pagamento: 'boleto'
        },
        {
          id: 'local_default_4',
          descricao: 'Assessoria Contábil',
          categoria: 'outros',
          valor: 1200.00,
          frequencia: 'mensal',
          dia_vencimento: 5,
          data_inicio: new Date().toISOString().split('T')[0],
          ativo: true,
          forma_pagamento: 'pix'
        }
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialDefaults));
      return initialDefaults;
    } catch {
      return [];
    }
  }
};
