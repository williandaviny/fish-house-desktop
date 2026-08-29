import React, { useState } from 'react';
import { CreditCard, DollarSign, QrCode, UserCheck, X, Check, Calculator } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  isOpen: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (paymentData: {
    formaPagamento: string;
    desconto: number;
    acrescimo: number;
    valorFinal: number;
    troco: number;
    clienteNome?: string;
    clienteTelefone?: string;
  }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  total,
  onClose,
  onConfirm
}) => {
  const [method, setMethod] = useState<string>('Dinheiro');
  const [receivedStr, setReceivedStr] = useState<string>(total.toFixed(2));
  const [discountStr, setDiscountStr] = useState<string>('0');
  const [surchargeStr, setSurchargeStr] = useState<string>('0');
  const [clienteNome, setClienteNome] = useState<string>('');
  const [clienteTelefone, setClienteTelefone] = useState<string>('');

  if (!isOpen) return null;

  const discount = parseFloat(discountStr) || 0;
  const surcharge = parseFloat(surchargeStr) || 0;
  const valorFinal = Math.max(0, Number((total - discount + surcharge).toFixed(2)));
  const received = parseFloat(receivedStr.replace(',', '.')) || valorFinal;
  const troco = Math.max(0, Number((received - valorFinal).toFixed(2)));

  const handleFinalize = () => {
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 } });
    onConfirm({
      formaPagamento: method,
      desconto: discount,
      acrescimo: surcharge,
      valorFinal,
      troco: method === 'Dinheiro' ? troco : 0,
      clienteNome: clienteNome || undefined,
      clienteTelefone: clienteTelefone || undefined
    });
  };

  const methods = [
    { id: 'Dinheiro', icon: DollarSign, color: 'from-emerald-600 to-teal-500' },
    { id: 'Pix', icon: QrCode, color: 'from-cyan-600 to-blue-500' },
    { id: 'Cartão Débito', icon: CreditCard, color: 'from-blue-600 to-indigo-500' },
    { id: 'Cartão Crédito', icon: CreditCard, color: 'from-violet-600 to-purple-500' },
    { id: 'A Prazo (Fiado)', icon: UserCheck, color: 'from-amber-600 to-orange-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-lg">
            <Calculator className="w-6 h-6" />
            <span>Fechamento da Venda</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Métodos de Pagamento */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Selecione a Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {methods.map(m => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMethod(m.id);
                      if (m.id !== 'Dinheiro') setReceivedStr(valorFinal.toFixed(2));
                    }}
                    className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-2 border font-bold text-xs transition-all ${
                      isSelected
                        ? `bg-gradient-to-tr ${m.color} text-white border-transparent shadow-lg scale-[1.02]`
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{m.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dinheiro / Troco */}
          {method === 'Dinheiro' && (
            <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Valor Recebido (R$)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={receivedStr}
                  onChange={(e) => setReceivedStr(e.target.value)}
                  className="w-full bg-slate-900 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl py-2.5 px-3 text-xl font-black text-white text-center outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Troco a Devolver
                </label>
                <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xl font-black text-emerald-400 text-center">
                  R$ {troco.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Dados do Cliente (Opcional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Nome do Cliente (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos Silva"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                WhatsApp / Tel (Opcional)
              </label>
              <input
                type="text"
                placeholder="(47) 99999-9999"
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Totalizador Final */}
          <div className="bg-gradient-to-r from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total a Pagar</span>
              <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                R$ {valorFinal.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Forma selecionada</span>
              <span className="text-sm font-bold text-white">{method}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-sm"
          >
            Cancelar (ESC)
          </button>
          <button
            onClick={handleFinalize}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-950 flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Concluir Venda (F10)
          </button>
        </div>
      </div>
    </div>
  );
};
