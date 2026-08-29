import React, { useState, useEffect } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { useDatabase } from '../context/DatabaseContext';
import { CaixaSessao, MovimentoCaixa } from '../types/database';
import { DollarSign, Lock, Unlock, ArrowDownRight, ArrowUpRight, History } from 'lucide-react';

export const CashRegisterPage: React.FC = () => {
  const { activeCaixa, refreshCaixa } = useDatabase();
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);
  const [openingBalance, setOpeningBalance] = useState<string>('100.00');
  const [operadorNome, setOperadorNome] = useState<string>('Operador Caixa');
  const [closingBalance, setClosingBalance] = useState<string>('0.00');
  
  // Sangria / Suprimento
  const [isMovOpen, setIsMovOpen] = useState(false);
  const [movTipo, setMovTipo] = useState<'sangria' | 'suprimento'>('sangria');
  const [movValor, setMovValor] = useState<string>('');
  const [movMotivo, setMovMotivo] = useState<string>('');

  const loadMovimentos = async () => {
    if (activeCaixa) {
      const list = await sqliteService.getMovimentosCaixa(activeCaixa.id);
      setMovimentos(list);
    } else {
      setMovimentos([]);
    }
  };

  useEffect(() => {
    loadMovimentos();
  }, [activeCaixa]);

  const handleAbrirCaixa = async () => {
    const val = parseFloat(openingBalance.replace(',', '.')) || 0;
    await sqliteService.abrirCaixa(operadorNome, val);
    await refreshCaixa();
  };

  const handleFecharCaixa = async () => {
    if (!activeCaixa) return;
    if (!confirm('Deseja realmente fechar o turno deste caixa?')) return;
    const val = parseFloat(closingBalance.replace(',', '.')) || 0;
    await sqliteService.fecharCaixa(activeCaixa.id, val);
    await refreshCaixa();
  };

  const handleAddMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCaixa) return;
    const val = parseFloat(movValor.replace(',', '.')) || 0;
    if (val <= 0 || !movMotivo) return;

    await sqliteService.adicionarMovimentoCaixa(activeCaixa.id, movTipo, val, movMotivo);
    setIsMovOpen(false);
    setMovValor('');
    setMovMotivo('');
    loadMovimentos();
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-900/30 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-white">Controle de Caixa e Turno</h3>
          <p className="text-xs text-slate-400">Gerencie abertura de turno, sangrias, suprimentos e fechamento de caixa.</p>
        </div>

        {activeCaixa && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMovTipo('suprimento'); setIsMovOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-emerald-500/20"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>+ Suprimento (Entrada)</span>
            </button>
            <button
              onClick={() => { setMovTipo('sangria'); setIsMovOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold border border-rose-500/20"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>- Sangria (Retirada)</span>
            </button>
          </div>
        )}
      </div>

      {!activeCaixa ? (
        // Tela de Abertura de Caixa
        <div className="max-w-md mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center mx-auto text-white shadow-xl shadow-cyan-900/40">
            <Unlock className="w-8 h-8" />
          </div>

          <div>
            <h4 className="text-base font-extrabold text-white">Nenhum Caixa Aberto no Momento</h4>
            <p className="text-xs text-slate-400 mt-1">Informe o operador e o valor do fundo de troco para iniciar as vendas.</p>
          </div>

          <div className="space-y-4 text-left text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Nome do Operador</label>
              <input
                type="text"
                value={operadorNome}
                onChange={(e) => setOperadorNome(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Fundo de Troco Inicial (R$)</label>
              <input
                type="text"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full bg-slate-900 border-2 border-cyan-500/50 rounded-xl p-3 text-2xl font-black text-center text-emerald-400 font-mono outline-none"
              />
            </div>

            <button
              onClick={handleAbrirCaixa}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-lg shadow-cyan-950"
            >
              Abrir Caixa e Iniciar Vendas
            </button>
          </div>
        </div>
      ) : (
        // Painel do Caixa Atual
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Operador Responsável</span>
              <span className="text-lg font-black text-white">{activeCaixa.operador_nome}</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Fundo Inicial</span>
              <span className="text-lg font-black text-cyan-400 font-mono">
                R$ {Number(activeCaixa.saldo_inicial).toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Abertura do Turno</span>
              <span className="text-sm font-bold text-slate-300 font-mono">
                {new Date(activeCaixa.data_abertura).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Histórico de Sangrias e Suprimentos */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Movimentações Manuais deste Turno ({movimentos.length})</span>
            </h4>

            {movimentos.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nenhuma sangria ou suprimento registrado neste turno.</p>
            ) : (
              <div className="divide-y divide-slate-900">
                {movimentos.map(m => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        m.tipo === 'suprimento' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {m.tipo}
                      </span>
                      <span className="text-slate-300 font-medium">{m.motivo}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 font-mono">{new Date(m.created_at).toLocaleTimeString('pt-BR')}</span>
                      <span className={`font-black font-mono ${
                        m.tipo === 'suprimento' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {m.tipo === 'suprimento' ? '+' : '-'} R$ {Number(m.valor).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fechamento */}
          <div className="bg-slate-950/60 border border-rose-900/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-rose-400">Encerrar Turno de Caixa</h5>
              <p className="text-xs text-slate-500">Finaliza o turno e bloqueia novos lançamentos até a próxima abertura.</p>
            </div>
            <button
              onClick={handleFecharCaixa}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Fechar Caixa
            </button>
          </div>
        </div>
      )}

      {/* Modal Sangria / Suprimento */}
      {isMovOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <h4 className="font-extrabold text-white text-sm">
              Lançar {movTipo === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'}
            </h4>

            <form onSubmit={handleAddMovimento} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Valor (R$)</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="0.00"
                  value={movValor}
                  onChange={(e) => setMovValor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-400 font-mono font-bold text-lg outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pagamento Fornecedor Gelo"
                  value={movMotivo}
                  onChange={(e) => setMovMotivo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMovOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
