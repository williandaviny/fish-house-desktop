import React, { useState, useEffect, useRef } from 'react';
import { sqliteService } from '../services/database/sqlite';
import { useDatabase } from '../context/DatabaseContext';
import { Product, TaraBalanca, CartItem, Venda } from '../types/database';
import { ThermalPrinterService } from '../services/hardware/thermalPrinter';
import { WeightModal } from '../components/WeightModal';
import { PaymentModal } from '../components/PaymentModal';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Scale, 
  Printer, 
  DollarSign, 
  AlertCircle, 
  Barcode, 
  ShoppingBag,
  Fish
} from 'lucide-react';

export const PDVPage: React.FC = () => {
  const { activeCaixa, config } = useDatabase();
  const [products, setProducts] = useState<Product[]>([]);
  const [taras, setTaras] = useState<TaraBalanca[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Modais
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [lastVenda, setLastVenda] = useState<Venda | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const prods = await sqliteService.getProducts();
    const tList = await sqliteService.getTaras();
    setProducts(prods);
    setTaras(tList);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Atalhos de teclado (F2 busca, F10 pagamento, etc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F10' && cart.length > 0 && !isPaymentOpen) {
        e.preventDefault();
        setIsPaymentOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isPaymentOpen]);

  // Adicionar produto ao carrinho
  const handleAddProduct = (p: Product) => {
    if (p.unit.toLowerCase() === 'kg') {
      // Abre modal de pesagem/tara
      setWeightProduct(p);
    } else {
      // Produto unitário
      setCart(prev => {
        const existing = prev.find(item => item.product.id === p.id);
        if (existing) {
          return prev.map(item =>
            item.product.id === p.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  subtotal: Number(((item.quantity + 1) * item.price_unit).toFixed(2))
                }
              : item
          );
        }
        return [
          ...prev,
          {
            product: p,
            quantity: 1,
            price_unit: Number(p.price),
            tara_peso: 0,
            subtotal: Number(p.price)
          }
        ];
      });
    }
  };

  // Confirmação de pesagem
  const handleConfirmWeight = (weight: number, taraPeso: number, taraNome: string) => {
    if (!weightProduct) return;
    const priceUnit = Number(weightProduct.price);
    const subtotal = Number((weight * priceUnit).toFixed(2));

    setCart(prev => [
      ...prev,
      {
        product: weightProduct,
        quantity: weight,
        price_unit: priceUnit,
        tara_peso: taraPeso,
        tara_nome: taraNome,
        subtotal
      }
    ]);
    setWeightProduct(null);
  };

  // Atualizar quantidade no carrinho
  const handleUpdateQty = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index];
      const newQty = item.product.unit.toLowerCase() === 'kg' 
        ? Math.max(0.1, Number((item.quantity + delta * 0.1).toFixed(3)))
        : Math.max(1, item.quantity + delta);

      const newSubtotal = Number((newQty * item.price_unit).toFixed(2));

      return prev.map((it, idx) => idx === index ? { ...it, quantity: newQty, subtotal: newSubtotal } : it);
    });
  };

  // Remover item
  const handleRemoveItem = (index: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // Finalizar venda
  const handleFinalizeSale = async (paymentData: any) => {
    if (!activeCaixa) {
      alert('É necessário abrir um caixa antes de registrar vendas!');
      return;
    }

    try {
      const totalCart = cart.reduce((acc, i) => acc + i.subtotal, 0);
      const venda = await sqliteService.criarVenda(
        {
          caixa_id: activeCaixa.id,
          cliente_nome: paymentData.clienteNome,
          cliente_telefone: paymentData.clienteTelefone,
          subtotal: totalCart,
          desconto: paymentData.desconto,
          acrescimo: paymentData.acrescimo,
          valor_final: paymentData.valorFinal,
          forma_pagamento: paymentData.formaPagamento,
          troco: paymentData.troco
        },
        cart
      );

      setLastVenda(venda);
      setIsPaymentOpen(false);

      // Auto-impressão do cupom
      if (config) {
        const itensVenda = cart.map(i => ({
          id: '',
          venda_id: venda.id,
          produto_id: i.product.id,
          produto_nome: i.product.name,
          quantidade: i.quantity,
          unit: i.product.unit,
          preco_unitario: i.price_unit,
          subtotal: i.subtotal
        }));
        ThermalPrinterService.printVendaCupom(venda, itensVenda, config);
      }

      setCart([]);
      loadData();
    } catch (e: any) {
      alert('Erro ao salvar venda: ' + e.message);
    }
  };

  // Filtragem de produtos na grade
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.includes(searchTerm) ||
      p.plu_codigo?.includes(searchTerm);
    return matchesCat && matchesSearch;
  });

  const cartTotal = cart.reduce((acc, i) => acc + i.subtotal, 0);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Coluna Esquerda: Catálogo e Busca de Produtos */}
      <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900/30">
        {/* Barra de Busca e Filtros */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por Nome, Código de Barras ou PLU da Balança... (F2)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredProducts.length === 1) {
                  handleAddProduct(filteredProducts[0]);
                  setSearchTerm('');
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner"
            />
          </div>

          {/* Categorias */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {cat === 'all' ? 'Todos os Produtos' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grade de Produtos */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {filteredProducts.map(p => (
            <button
              key={p.id}
              onClick={() => handleAddProduct(p)}
              className="group bg-slate-950 border border-slate-800/90 hover:border-cyan-500/60 rounded-2xl p-3 flex flex-col justify-between text-left transition-all hover:scale-[1.02] shadow-sm hover:shadow-cyan-950/40 relative overflow-hidden"
            >
              {p.unit.toLowerCase() === 'kg' && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-extrabold flex items-center gap-1">
                  <Scale className="w-3 h-3" /> BALANÇA
                </span>
              )}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-slate-500 block">
                  {p.plu_codigo ? `PLU #${p.plu_codigo}` : p.category}
                </span>
                <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-2">
                  {p.name}
                </h4>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-900 flex items-baseline justify-between">
                <span className="text-base font-black text-emerald-400">
                  R$ {Number(p.price).toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 uppercase font-semibold">
                  /{p.unit}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Coluna Direita: Carrinho / Cupom Atual */}
      <div className="w-96 flex flex-col bg-slate-950 border-l border-slate-800 shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
            <span>Itens do Cupom ({cart.length})</span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Lista de Itens do Carrinho */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <Fish className="w-12 h-12 text-slate-700 mb-2" />
              <p className="text-sm font-medium">Nenhum item lançado no cupom</p>
              <p className="text-xs text-slate-600 mt-1">Selecione os produtos ao lado ou passe o código de barras</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 space-y-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-white">{item.product.name}</h5>
                    <span className="text-[10px] text-slate-400 font-mono">
                      R$ {item.price_unit.toFixed(2)} /{item.product.unit}
                      {item.tara_peso > 0 && ` (Tara: -${(item.tara_peso * 1000).toFixed(0)}g)`}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">
                    R$ {item.subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleUpdateQty(idx, -1)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-cyan-400 min-w-8 text-center font-mono">
                      {item.quantity} {item.product.unit}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(idx, 1)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé Totalizador e Ação de Pagamento */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs uppercase font-bold text-slate-400">Total a Pagar</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              R$ {cartTotal.toFixed(2)}
            </span>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setIsPaymentOpen(true)}
            className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              cart.length > 0
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950 scale-[1.01]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            RECEBER (F10)
          </button>
        </div>
      </div>

      {/* Modais */}
      <WeightModal
        isOpen={!!weightProduct}
        product={weightProduct}
        taras={taras}
        onClose={() => setWeightProduct(null)}
        onConfirm={handleConfirmWeight}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        total={cartTotal}
        onClose={() => setIsPaymentOpen(false)}
        onConfirm={handleFinalizeSale}
      />
    </div>
  );
};
