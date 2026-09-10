import React, { useState, useEffect } from 'react';
import { 
  Repeat, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Zap, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCcw,
  Sparkles,
  Layers,
  Power
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { recurringExpensesService, RecurringExpense } from '../../services/recurringExpensesService';

interface RecurringExpensesManagerProps {
  companies: Array<{ id: string; nome_fantasia: string }>;
  suppliers: Array<{ id: string; razao_social: string; nome_fantasia?: string }>;
  onBillsGenerated?: () => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const RecurringExpensesManager: React.FC<RecurringExpensesManagerProps> = ({
  companies,
  suppliers,
  onBillsGenerated,
  showNotification
}) => {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    descricao: '',
    categoria: 'aluguel',
    valor: '',
    frequencia: 'mensal' as 'mensal' | 'semanal' | 'anual',
    dia_vencimento: 10,
    empresa_id: companies[0]?.id || '',
    fornecedor_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    forma_pagamento: 'boleto',
    observacoes: ''
  });

  // Batch generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<'current_month' | 'next_month'>('current_month');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await recurringExpensesService.list();
      setExpenses(data);
    } catch (e: any) {
      showNotification('error', 'Erro ao carregar despesas recorrentes.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditingExpense(null);
    setFormData({
      descricao: '',
      categoria: 'aluguel',
      valor: '',
      frequencia: 'mensal',
      dia_vencimento: 10,
      empresa_id: companies[0]?.id || '',
      fornecedor_id: '',
      data_inicio: new Date().toISOString().split('T')[0],
      forma_pagamento: 'boleto',
      observacoes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({
      descricao: expense.descricao,
      categoria: expense.categoria,
      valor: String(expense.valor),
      frequencia: expense.frequencia,
      dia_vencimento: expense.dia_vencimento,
      empresa_id: expense.empresa_id || companies[0]?.id || '',
      fornecedor_id: expense.fornecedor_id || '',
      data_inicio: expense.data_inicio,
      forma_pagamento: expense.forma_pagamento || 'boleto',
      observacoes: expense.observacoes || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao || !formData.valor) {
      showNotification('error', 'Preencha a descrição e o valor da despesa.');
      return;
    }

    try {
      await recurringExpensesService.save({
        id: editingExpense?.id,
        descricao: formData.descricao,
        categoria: formData.categoria,
        valor: Number(formData.valor),
        frequencia: formData.frequencia,
        dia_vencimento: Number(formData.dia_vencimento),
        empresa_id: formData.empresa_id || undefined,
        fornecedor_id: formData.fornecedor_id || null,
        data_inicio: formData.data_inicio,
        ativo: editingExpense ? editingExpense.ativo : true,
        forma_pagamento: formData.forma_pagamento,
        observacoes: formData.observacoes || null
      });

      showNotification('success', editingExpense ? 'Despesa recorrente atualizada!' : 'Despesa recorrente cadastrada!');
      setIsModalOpen(false);
      await loadExpenses();
    } catch (err: any) {
      showNotification('error', 'Erro ao salvar: ' + err.message);
    }
  };

  const handleToggle = async (expense: RecurringExpense) => {
    try {
      const newStatus = !expense.ativo;
      await recurringExpensesService.toggleActive(expense.id, newStatus);
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, ativo: newStatus } : e));
      showNotification('success', newStatus ? `Regra "${expense.descricao}" ativada!` : `Regra "${expense.descricao}" pausada.`);
    } catch (e: any) {
      showNotification('error', 'Falha ao alterar status.');
    }
  };

  const handleDelete = async (id: string, descricao: string) => {
    if (!confirm(`Deseja realmente remover a despesa recorrente "${descricao}"?`)) return;
    try {
      await recurringExpensesService.delete(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      showNotification('success', 'Regra recorrente excluída com sucesso.');
    } catch (e: any) {
      showNotification('error', 'Falha ao excluir regra.');
    }
  };

  const handleGenerateBills = async () => {
    setIsGenerating(true);
    try {
      const now = new Date();
      let targetYear = now.getFullYear();
      let targetMonth = now.getMonth() + 1; // 1-12

      if (generateTarget === 'next_month') {
        if (targetMonth === 12) {
          targetMonth = 1;
          targetYear += 1;
        } else {
          targetMonth += 1;
        }
      }

      const result = await recurringExpensesService.generateBillsForMonth(
        targetYear, 
        targetMonth, 
        companies[0]?.id
      );

      const monthName = new Date(targetYear, targetMonth - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

      if (result.generatedCount > 0) {
        showNotification('success', `✨ ${result.generatedCount} conta(s) a pagar gerada(s) com sucesso para ${monthName}! (${result.skippedCount} já existiam)`);
        if (onBillsGenerated) onBillsGenerated();
      } else {
        showNotification('success', `Nenhuma conta nova necessária para ${monthName}. Todas as ${result.skippedCount} regras ativas já constam no contas a pagar.`);
      }

      await loadExpenses();
    } catch (err: any) {
      showNotification('error', 'Erro ao gerar lançamentos: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const totalMonthlyCommitment = expenses
    .filter(e => e.ativo && e.frequencia === 'mensal')
    .reduce((sum, e) => sum + e.valor, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-gradient-to-r from-ink-900 via-ink-900 to-white/5 border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold-500/20 text-gold-400">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                Despesas Recorrentes & Contas Fixas
                <span className="text-[10px] bg-gold-500/20 text-gold-400 px-2.5 py-0.5 rounded-full uppercase font-black tracking-wider">
                  Automático
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Aluguel, Energia Câmaras Frias, Folha, Contabilidade e Assinaturas projetadas automaticamente.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-gray-400">
            <span className="bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
              Regras Ativas: <strong className="text-white">{expenses.filter(e => e.ativo).length}</strong>
            </span>
            <span className="bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
              Compromisso Mensal Fixo: <strong className="text-gold-400">R$ {totalMonthlyCommitment.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Quick Generator */}
          <div className="flex bg-ink-950 border border-white/10 rounded-2xl p-1 shrink-0">
            <select
              value={generateTarget}
              onChange={e => setGenerateTarget(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-gray-300 px-3 py-2 focus:outline-none cursor-pointer"
            >
              <option value="current_month">Lançar Mês Atual</option>
              <option value="next_month">Projetar Próximo Mês</option>
            </select>
            <button
              onClick={handleGenerateBills}
              disabled={isGenerating || expenses.filter(e => e.ativo).length === 0}
              className="bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-gold-500/10"
              title="Gera os títulos no Contas a Pagar sem duplicar"
            >
              {isGenerating ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Gerar Parcelas
            </button>
          </div>

          <button
            onClick={handleOpenNew}
            className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-2xl transition-all flex items-center gap-2 border border-white/10 shrink-0"
          >
            <Plus className="w-4 h-4 text-gold-500" />
            Nova Despesa Fixa
          </button>
        </div>
      </div>

      {/* List of Recurring Expenses */}
      {loading ? (
        <div className="h-48 bg-white/5 rounded-3xl animate-pulse" />
      ) : expenses.length === 0 ? (
        <div className="bg-ink-900 border border-white/10 rounded-3xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-gray-500">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Nenhuma despesa recorrente cadastrada</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Cadastre suas contas fixas (ex: aluguel, energia, água, contabilidade) para que o sistema gere e projete seu fluxo de caixa automaticamente.
            </p>
          </div>
          <button
            onClick={handleOpenNew}
            className="bg-gold-500 text-ink-950 font-bold text-xs px-6 py-3 rounded-xl uppercase tracking-wider hover:bg-gold-600 transition-colors"
          >
            Cadastrar Primeira Despesa
          </button>
        </div>
      ) : (
        <div className="bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase font-black text-gray-500 bg-white/5">
                  <th className="py-3.5 px-6">Descrição / Regra</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Frequência / Vencimento</th>
                  <th className="py-3.5 px-4 text-right">Valor Estimado</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {expenses.map(exp => {
                  const supplierObj = suppliers.find(s => s.id === exp.fornecedor_id);
                  const supplierName = supplierObj?.nome_fantasia || supplierObj?.razao_social || exp.fornecedores?.nome_fantasia || exp.fornecedores?.razao_social;

                  return (
                    <tr key={exp.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${exp.ativo ? 'bg-green-500 shadow-sm shadow-green-500' : 'bg-gray-600'}`} />
                          <div>
                            <p className="font-bold text-white text-sm">{exp.descricao}</p>
                            {supplierName && (
                              <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                Fornecedor: <span className="text-gray-300">{supplierName}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                          {exp.categoria.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-gold-500" />
                          <span className="font-bold text-gray-300">
                            {exp.frequencia === 'mensal' ? `Todo dia ${exp.dia_vencimento}` : exp.frequencia}
                          </span>
                        </div>
                        {exp.ultimo_lancamento_em && (
                          <p className="text-[9px] text-gray-500 mt-0.5 font-mono">
                            Último lote: {new Date(exp.ultimo_lancamento_em).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-black text-white font-mono">
                          R$ {Number(exp.valor).toFixed(2)}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggle(exp)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                            exp.ativo 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                              : 'bg-gray-700/30 text-gray-500 border border-gray-700/50 hover:bg-gray-700/50'
                          }`}
                        >
                          {exp.ativo ? 'Ativo' : 'Pausado'}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                            title="Editar Regra"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id, exp.descricao)}
                            className="p-2 text-red-400 hover:text-red-300 rounded-xl hover:bg-red-500/10 transition-colors"
                            title="Excluir Regra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-ink-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gold-500/20 text-gold-400">
                  <Repeat className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">
                    {editingExpense ? 'Editar Despesa Recorrente' : 'Nova Despesa Recorrente'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Contas fixas geradas automaticamente todo mês</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Descrição da Despesa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel da Peixaria / Energia Câmaras Frias"
                  value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Categoria *</label>
                  <select
                    value={formData.categoria}
                    onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="aluguel">Aluguel & Imóvel</option>
                    <option value="energia">Energia Elétrica</option>
                    <option value="folha">Folha de Pagamento / Pró-labore</option>
                    <option value="outros">Água / Saneamento</option>
                    <option value="servicos">Serviços Contábeis / TI</option>
                    <option value="industrializacao_servico">Serviço de Industrialização/Corte</option>
                    <option value="manutencao">Manutenção Preventiva</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Valor Médio (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={e => setFormData({ ...formData, valor: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Dia do Vencimento *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={formData.dia_vencimento}
                    onChange={e => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 10 })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Forma de Pagamento</label>
                  <select
                    value={formData.forma_pagamento}
                    onChange={e => setFormData({ ...formData, forma_pagamento: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="boleto">Boleto Bancário</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência Bancária (TED)</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="debito_automatico">Débito Automático</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Fornecedor / Beneficiário</label>
                <select
                  value={formData.fornecedor_id}
                  onChange={e => setFormData({ ...formData, fornecedor_id: e.target.value })}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">Nenhum / Não vinculado</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.nome_fantasia || s.razao_social}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">Observações Internas</label>
                <input
                  type="text"
                  placeholder="Ex: Contrato nº 884 / Código Débito 9821..."
                  value={formData.observacoes}
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-gold-500/10 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Salvar Regra
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
