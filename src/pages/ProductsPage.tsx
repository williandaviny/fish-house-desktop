import React, { useState, useEffect } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { ScaleMgv7Service } from '../services/hardware/scaleMgv7';
import { Product, TaraBalanca } from '../types/database';
import { Package, Plus, Search, Scale, Download, Edit2, Trash2, X, Check } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [taras, setTaras] = useState<TaraBalanca[]>([]);
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const load = async () => {
    setProducts(await sqliteService.getProducts());
    setTaras(await sqliteService.getTaras());
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name || editingProduct.price === undefined) return;
    await sqliteService.saveProduct(editingProduct as any);
    setEditingProduct(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente remover este produto?')) {
      await sqliteService.deleteProduct(id);
      load();
    }
  };

  const handleExportMgv7 = () => {
    const itensTxt = ScaleMgv7Service.generateItensTxt(products);
    const taraTxt = ScaleMgv7Service.generateTaraTxt(taras);
    const deptoTxt = ScaleMgv7Service.generateDeptoTxt();

    ScaleMgv7Service.downloadFile('ITENS.TXT', itensTxt);
    ScaleMgv7Service.downloadFile('TARA.TXT', taraTxt);
    ScaleMgv7Service.downloadFile('DEPTO.TXT', deptoTxt);
    alert('Arquivos da balança Toledo (ITENS.TXT, TARA.TXT, DEPTO.TXT) gerados com sucesso!');
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.plu_codigo?.includes(search) ||
    p.barcode?.includes(search)
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/30">
      {/* Topo */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto por nome ou PLU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportMgv7}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold border border-cyan-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Balança Toledo (MGV 7)</span>
          </button>

          <button
            onClick={() => setEditingProduct({ name: '', price: 0, unit: 'kg', is_available: true, category: 'Peixes' })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
              <th className="p-3">PLU</th>
              <th className="p-3">Produto</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Preço Venda</th>
              <th className="p-3">Unidade</th>
              <th className="p-3">Tara Balança</th>
              <th className="p-3">Estoque</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map(p => {
              const taraObj = taras.find(t => t.id === p.tara_id);
              return (
                <tr key={p.id} className="hover:bg-slate-900/40 text-slate-300 font-medium">
                  <td className="p-3 font-mono text-cyan-400 font-bold">{p.plu_codigo || '-'}</td>
                  <td className="p-3 font-bold text-white">{p.name}</td>
                  <td className="p-3 text-slate-400">{p.category}</td>
                  <td className="p-3 text-emerald-400 font-bold font-mono">R$ {Number(p.price).toFixed(2)}</td>
                  <td className="p-3 uppercase font-semibold text-slate-400">{p.unit}</td>
                  <td className="p-3 text-slate-400">
                    {taraObj ? `${taraObj.descricao} (${(taraObj.peso * 1000).toFixed(0)}g)` : 'Sem tara'}
                  </td>
                  <td className="p-3 font-mono">{Number(p.stock).toFixed(2)}</td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => setEditingProduct(p)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação / Edição */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-extrabold text-white text-sm">
                {editingProduct.id ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Preço Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-400 font-bold font-mono outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Unidade</label>
                  <select
                    value={editingProduct.unit || 'kg'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-cyan-500"
                  >
                    <option value="kg">Quilo (kg)</option>
                    <option value="un">Unidade (un)</option>
                    <option value="pct">Pacote (pct)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">PLU Balança</label>
                  <input
                    type="text"
                    value={editingProduct.plu_codigo || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, plu_codigo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-cyan-400 font-bold font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tara Toledo Padrão</label>
                  <select
                    value={editingProduct.tara_id || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, tara_id: e.target.value || undefined })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">Sem tara associada</option>
                    {taras.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.codigo}] {t.descricao} ({(t.peso * 1000).toFixed(0)}g)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Validade (Dias na Balança)</label>
                  <input
                    type="number"
                    value={editingProduct.validade_dias || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, validade_dias: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950/40 -mx-5 -mb-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
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
