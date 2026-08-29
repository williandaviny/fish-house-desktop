import React, { useState, useEffect } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { TaraBalanca } from '../types/database';
import { Scale, Plus, Trash2, Edit2, X, Check } from 'lucide-react';

export const TarasPage: React.FC = () => {
  const [taras, setTaras] = useState<TaraBalanca[]>([]);
  const [editingTara, setEditingTara] = useState<Partial<TaraBalanca> | null>(null);

  const load = async () => {
    setTaras(await sqliteService.getTaras());
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTara || !editingTara.codigo || !editingTara.descricao || editingTara.peso === undefined) return;
    await sqliteService.saveTara(editingTara as any);
    setEditingTara(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir esta tara?')) {
      await sqliteService.deleteTara(id);
      load();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-extrabold text-white">Taras de Balança (Toledo MGV 7)</h3>
          <p className="text-xs text-slate-400">Cadastre as taras de bandejas, sacolas e embalagens para desconto automático no PDV.</p>
        </div>

        <button
          onClick={() => setEditingTara({ codigo: (taras.length + 1), descricao: '', peso: 0.040 })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Tara</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {taras.map(t => (
          <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">CÓDIGO #{t.codigo}</span>
              <h4 className="text-sm font-bold text-white">{t.descricao}</h4>
              <span className="text-xs font-mono font-black text-emerald-400">
                {(Number(t.peso) * 1000).toFixed(0)} gramas ({Number(t.peso).toFixed(3)} kg)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingTara(t)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingTara && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h4 className="font-extrabold text-white text-sm">
                {editingTara.id ? 'Editar Tara' : 'Cadastrar Tara'}
              </h4>
              <button onClick={() => setEditingTara(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Código (Toledo)</label>
                <input
                  type="number"
                  required
                  value={editingTara.codigo || ''}
                  onChange={(e) => setEditingTara({ ...editingTara, codigo: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bandeja Isopor G"
                  value={editingTara.descricao || ''}
                  onChange={(e) => setEditingTara({ ...editingTara, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Peso da Tara (em Kg - Ex: 0.040 para 40g)</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={editingTara.peso !== undefined ? editingTara.peso : 0.040}
                  onChange={(e) => setEditingTara({ ...editingTara, peso: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-400 font-bold font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950/40 -mx-5 -mb-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTara(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
