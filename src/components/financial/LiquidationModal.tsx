import React, { useState } from 'react';
import { CheckCircle2, DollarSign, X, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  originalValue: number;
  dueDate: string;
  entityName?: string;
  type: 'payable' | 'receivable';
  onConfirm: (data: {
    paymentDate: string;
    finalValue: number;
    paymentMethod: string;
    jurosMulta: number;
    desconto: number;
    notes: string;
  }) => Promise<void>;
}

export const LiquidationModal: React.FC<LiquidationModalProps> = ({
  isOpen,
  onClose,
  title,
  originalValue,
  dueDate,
  entityName,
  type,
  onConfirm
}) => {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [jurosMulta, setJurosMulta] = useState<number>(0);
  const [desconto, setDesconto] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const finalValue = Math.max(0, Number((originalValue + Number(jurosMulta || 0) - Number(desconto || 0)).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm({
        paymentDate,
        finalValue,
        paymentMethod,
        jurosMulta: Number(jurosMulta || 0),
        desconto: Number(desconto || 0),
        notes
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverdue = new Date(dueDate) < new Date(new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-ink-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${type === 'payable' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">
                {type === 'payable' ? 'Liquidar / Baixar Conta a Pagar' : 'Receber / Baixar Conta a Receber'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Confirmação de liquidação financeira e extrato</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Summary Box */}
          <div className="bg-ink-950/70 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Título</span>
                <p className="font-bold text-white text-sm line-clamp-1">{title}</p>
                {entityName && (
                  <p className="text-xs text-gray-400 mt-0.5">{type === 'payable' ? 'Fornecedor:' : 'Cliente:'} <strong className="text-gray-300">{entityName}</strong></p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Vencimento</span>
                <span className={`text-xs font-bold ${isOverdue ? 'text-red-400' : 'text-gray-300'}`}>
                  {new Date(dueDate).toLocaleDateString('pt-BR')} {isOverdue && '(Vencida)'}
                </span>
              </div>
            </div>
            <div className="border-t border-white/5 pt-2 flex justify-between items-center">
              <span className="text-xs text-gray-400">Valor Original:</span>
              <span className="text-base font-black text-white">R$ {originalValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gold-500" /> Data do Pagamento *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-gold-500"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-gold-500" /> Forma de Pagamento *
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="pix">PIX (Instantâneo)</option>
                <option value="boleto">Boleto Bancário</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="transferencia">Transferência Bancária (TED)</option>
                <option value="dinheiro">Dinheiro em Espécie</option>
                <option value="caixa_loja">Caixa Físico da Loja</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-red-400 uppercase font-black tracking-widest ml-1">
                + Juros / Multa (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={jurosMulta || ''}
                placeholder="0,00"
                onChange={e => setJurosMulta(parseFloat(e.target.value) || 0)}
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-gold-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-green-400 uppercase font-black tracking-widest ml-1">
                - Desconto Obtido (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={desconto || ''}
                placeholder="0,00"
                onChange={e => setDesconto(parseFloat(e.target.value) || 0)}
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
              Comprovante / Autenticação / Observação
            </label>
            <input
              type="text"
              placeholder="Ex: Cód. Transação Banco do Brasil / PIX E23098..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* Total Liquidated Amount Highlight */}
          <div className="bg-gold-500/10 border border-gold-500/20 rounded-2xl p-4 flex justify-between items-center">
            <span className="text-xs font-bold text-gold-400 uppercase tracking-wider">
              Valor Final a {type === 'payable' ? 'Pagar' : 'Receber'}:
            </span>
            <span className="text-2xl font-black text-gold-400 font-mono">
              R$ {finalValue.toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-3 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                type === 'payable'
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Baixando...' : type === 'payable' ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
