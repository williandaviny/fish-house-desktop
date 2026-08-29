import React, { useState, useEffect } from 'react';
import { Product, TaraBalanca } from '../types/database';
import { Scale, X, Check } from 'lucide-react';

interface WeightModalProps {
  isOpen: boolean;
  product: Product | null;
  taras: TaraBalanca[];
  onClose: () => void;
  onConfirm: (weight: number, taraPeso: number, taraNome: string) => void;
}

export const WeightModal: React.FC<WeightModalProps> = ({
  isOpen,
  product,
  taras,
  onClose,
  onConfirm
}) => {
  const [rawWeight, setRawWeight] = useState<string>('1.000');
  const [selectedTaraId, setSelectedTaraId] = useState<string>('');

  useEffect(() => {
    if (product) {
      setRawWeight('1.000');
      setSelectedTaraId(product.tara_id || '');
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const selectedTara = taras.find(t => t.id === selectedTaraId);
  const taraPeso = selectedTara ? Number(selectedTara.peso) : 0;
  const pesoBruto = parseFloat(rawWeight.replace(',', '.')) || 0;
  const pesoLiquido = Math.max(0, Number((pesoBruto - taraPeso).toFixed(3)));
  const totalItem = Number((pesoLiquido * Number(product.price)).toFixed(2));

  const handleConfirm = () => {
    if (pesoLiquido <= 0) return;
    onConfirm(pesoLiquido, taraPeso, selectedTara ? selectedTara.descricao : 'Sem tara');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <Scale className="w-5 h-5" />
            <span>Pesar Produto (Balança)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-lg font-extrabold text-white">{product.name}</h3>
            <p className="text-sm text-cyan-400 font-semibold">
              R$ {Number(product.price).toFixed(2)} / kg
            </p>
          </div>

          {/* Campo Peso Bruto */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Peso Lido na Balança (Kg)
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={rawWeight}
                onChange={(e) => setRawWeight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                className="w-full bg-slate-950 border-2 border-cyan-500/60 focus:border-cyan-400 rounded-xl py-3.5 px-4 text-3xl font-black text-white text-center tracking-widest outline-none shadow-inner"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">KG</span>
            </div>
          </div>

          {/* Seleção de Tara */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Descontar Tara da Embalagem
            </label>
            <select
              value={selectedTaraId}
              onChange={(e) => setSelectedTaraId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="">Nenhuma tara (Peso direto)</option>
              {taras.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.codigo}] {t.descricao} ({(Number(t.peso) * 1000).toFixed(0)}g)
                </option>
              ))}
            </select>
          </div>

          {/* Resumo do Cálculo */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Peso Bruto:</span>
              <span className="font-mono">{pesoBruto.toFixed(3)} kg</span>
            </div>
            {taraPeso > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Tara descontada:</span>
                <span className="font-mono">- {taraPeso.toFixed(3)} kg</span>
              </div>
            )}
            <div className="flex justify-between text-slate-200 font-bold border-t border-slate-800 pt-2">
              <span>Peso Líquido:</span>
              <span className="font-mono text-cyan-400">{pesoLiquido.toFixed(3)} kg</span>
            </div>
            <div className="flex justify-between text-lg font-extrabold text-emerald-400 border-t border-slate-800 pt-2">
              <span>Subtotal:</span>
              <span className="font-mono">R$ {totalItem.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium text-sm"
          >
            Cancelar (ESC)
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-cyan-900/40 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Adicionar ao Cupom (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};
