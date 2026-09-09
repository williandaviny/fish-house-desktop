import React, { useState, useEffect } from 'react';
import { 
  Warehouse, 
  ArrowLeftRight, 
  History, 
  SlidersHorizontal, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Plus, 
  ArrowDown, 
  ArrowUp,
  RefreshCcw,
  Sparkles,
  Package,
  Clock,
  ChevronLeft,
  ChevronRight,
  Barcode
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { getOptimizedImageUrl } from '../utils/image';
import { useScale } from '../services/scale/useScale';

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  image_url: string;
  price?: number;
  plu_codigo?: string;
  barcode?: string;
  codigo_interno?: string;
};

type LocalEstoque = {
  id: string;
  nome: string;
  tipo: 'loja' | 'industria' | 'deposito' | 'outros';
  ativo: boolean;
};

type SaldoEstoque = {
  id: string;
  produto_id: string;
  local_estoque_id: string;
  saldo_atual: number;
  saldo_reservado: number;
  saldo_disponivel: number;
};

type Movimentacao = {
  id: string;
  created_at: string;
  produto_id: string;
  products: { name: string; unit: string };
  origem_local_id: string | null;
  origem_local?: { nome: string };
  destino_local_id: string | null;
  destino_local?: { nome: string };
  tipo_movimentacao: string;
  quantidade: number;
  motivo: string | null;
  referencia_tipo: string | null;
};

export default function AdminInventory() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transfer' | 'adjust' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<LocalEstoque[]>([]);
  const [stockBalances, setStockBalances] = useState<SaldoEstoque[]>([]);
  const [movements, setMovements] = useState<Movimentacao[]>([]);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Transfer Form State
  const [transferOrigin, setTransferOrigin] = useState('');
  const [transferDest, setTransferDest] = useState('');
  const [transferItems, setTransferItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [transferReason, setTransferReason] = useState('Transferência interna de reposição');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Adjustment Form State
  const [adjustProduct, setAdjustProduct] = useState('');
  const [adjustLocation, setAdjustLocation] = useState('');
  const [adjustType, setAdjustType] = useState<'ajuste_manual' | 'perda_quebra' | 'descarte'>('ajuste_manual');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Success message modal/alert
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Barcode states
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastCharTime, setLastCharTime] = useState(0);

  // Web Serial & Balança Toledo Hook
  const [activeWeighProduct, setActiveWeighProduct] = useState<Product | null>(null);
  const [weighTarget, setWeighTarget] = useState<'adjust' | { product_id: string } | null>(null);
  const scale = useScale();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleGlobalScan = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      const currentTime = Date.now();
      if (currentTime - lastCharTime > 100) {
        setBarcodeBuffer(e.key.length === 1 ? e.key : '');
      } else {
        if (e.key === 'Enter') {
          if (barcodeBuffer.length > 3) {
            handleBarcodeScanned(barcodeBuffer);
          }
          setBarcodeBuffer('');
        } else if (e.key.length === 1) {
          setBarcodeBuffer(prev => prev + e.key);
        }
      }
      setLastCharTime(currentTime);
    };

    window.addEventListener('keydown', handleGlobalScan);
    return () => window.removeEventListener('keydown', handleGlobalScan);
  }, [barcodeBuffer, lastCharTime, products, activeTab, transferItems]);

  const handleBarcodeScanned = (code: string) => {
    if (activeTab !== 'adjust' && activeTab !== 'transfer') return;

    if (code.length === 13 && code.startsWith('2')) {
      const plu6 = code.substring(1, 7); // e.g. "000657"
      const plu5 = code.substring(1, 6); // e.g. "00065"

      const valCents6 = Number(code.substring(7, 12));
      const valCents5 = Number(code.substring(6, 11));

      // 1. Try 6-digit PLU
      let prod = products.find(p => 
        (p.plu_codigo && (p.plu_codigo === plu6 || Number(p.plu_codigo) === Number(plu6))) ||
        (p.codigo_interno && (p.codigo_interno === plu6 || Number(p.codigo_interno) === Number(plu6))) ||
        (p.barcode && p.barcode.substring(1, 7) === plu6)
      );
      let valCents = valCents6;

      // 2. Try 5-digit PLU
      if (!prod) {
        prod = products.find(p => 
          (p.plu_codigo && (p.plu_codigo === plu5 || Number(p.plu_codigo) === Number(plu5))) ||
          (p.codigo_interno && (p.codigo_interno === plu5 || Number(p.codigo_interno) === Number(plu5))) ||
          (p.barcode && p.barcode.substring(1, 6) === plu5) ||
          (p.id.replace(/\D/g, '').substring(0, 5) === plu5)
        );
        valCents = valCents5;
      }

      if (prod) {
        const barcodeType = localStorage.getItem('scale_barcode_type') || 'price';
        let weight = 0;

        if (barcodeType === 'price') {
          const totalVal = valCents / 100;
          const retailPrice = prod.price || 10.00;
          weight = Number((totalVal / retailPrice).toFixed(3));
        } else {
          weight = Number((valCents / 1000).toFixed(3));
        }

        if (weight > 0) {
          if (activeTab === 'adjust') {
            setAdjustProduct(prod.id);
            setAdjustQty(weight.toString());
            showNotification('success', `Produto ${prod.name} selecionado com peso ${weight.toFixed(3)} kg`);
          } else if (activeTab === 'transfer') {
            const existing = transferItems.find(i => i.product_id === prod.id);
            if (existing) {
              handleUpdateTransferQty(prod.id, existing.quantity + weight);
              showNotification('success', `Transferência de ${prod.name} atualizada: +${weight.toFixed(3)} ${prod.unit}`);
            } else {
              setTransferItems(prev => [...prev, { product_id: prod.id, quantity: weight }]);
              showNotification('success', `Adicionado para transferência: ${prod.name} (${weight.toFixed(3)} ${prod.unit})`);
            }
          }
        }
        return;
      }
    }

    const standardProd = products.find(p => p.barcode === code || p.codigo_interno === code || p.plu_codigo === code);
    if (standardProd) {
      if (activeTab === 'adjust') {
        setAdjustProduct(standardProd.id);
        setAdjustQty('1');
        showNotification('success', `Produto ${standardProd.name} selecionado (Qtd: 1)`);
      } else if (activeTab === 'transfer') {
        const existing = transferItems.find(i => i.product_id === standardProd.id);
        if (existing) {
          handleUpdateTransferQty(standardProd.id, existing.quantity + 1);
          showNotification('success', `Transferência de ${standardProd.name} atualizada: +1 ${standardProd.unit}`);
        } else {
          setTransferItems(prev => [...prev, { product_id: standardProd.id, quantity: 1 }]);
          showNotification('success', `Adicionado para transferência: ${standardProd.name} (1 ${standardProd.unit})`);
        }
      }
    }
  };

  const openWeighModal = (product: Product, target: 'adjust' | { product_id: string }) => {
    setActiveWeighProduct(product);
    setWeighTarget(target);
    if (scale.status === 'connected') {
      scale.requestWeight();
    } else {
      scale.connect();
    }
  };

  const handleConfirmWeight = () => {
    if (scale.weight > 0) {
      if (weighTarget === 'adjust') {
        setAdjustQty(scale.weight.toFixed(3));
      } else if (weighTarget && typeof weighTarget === 'object') {
        handleUpdateTransferQty(weighTarget.product_id, scale.weight);
      }
      showNotification('success', `Peso confirmado: ${scale.weight.toFixed(3)} kg`);
      setActiveWeighProduct(null);
      setWeighTarget(null);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch products (ignoring deleted products)
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('id, name, category, unit, image_url, price, plu_codigo, barcode, is_available, is_deleted')
        .order('name');
      
      if (prodErr) throw prodErr;
      const activeProds = (prods || []).filter((p: any) => p.is_deleted !== true);
      setProducts(activeProds);

      // Extract unique categories
      if (activeProds) {
        const cats = Array.from(new Set(activeProds.map(p => p.category))).filter(Boolean);
        setCategories(cats);
      }

      // 2. Fetch locations
      const { data: locs, error: locErr } = await supabase
        .from('locais_estoque')
        .select('id, nome, tipo, ativo')
        .eq('ativo', true)
        .order('nome');
      
      if (locErr) throw locErr;
      setLocations(locs || []);

      // Set default transfer locations if available
      const ind = locs?.find(l => l.tipo === 'industria');
      const store = locs?.find(l => l.tipo === 'loja');
      if (ind) setTransferOrigin(ind.id);
      if (store) {
        setTransferDest(store.id);
        setAdjustLocation(store.id);
      } else if (locs && locs.length > 0) {
        setTransferDest(locs[0].id);
        setAdjustLocation(locs[0].id);
      }

      // 3. Fetch balances
      await fetchBalances();

      // 4. Fetch movements
      await fetchMovements();

    } catch (err: any) {
      console.error('Error fetching inventory data:', err);
      showNotification('error', 'Erro ao carregar dados do estoque: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async () => {
    const { data, error } = await supabase
      .from('saldos_estoque')
      .select('id, produto_id, local_estoque_id, saldo_atual, saldo_reservado, saldo_disponivel');
    if (error) throw error;
    setStockBalances(
      (data || []).map(b => ({
        id: b.id,
        produto_id: b.produto_id,
        local_estoque_id: b.local_estoque_id,
        saldo_atual: Number(b.saldo_atual),
        saldo_reservado: Number(b.saldo_reservado),
        saldo_disponivel: Number(b.saldo_disponivel)
      }))
    );
  };

  const fetchMovements = async () => {
    const { data, error } = await supabase
      .from('movimentacoes_estoque')
      .select(`
        id,
        created_at,
        produto_id,
        origem_local_id,
        destino_local_id,
        tipo_movimentacao,
        quantidade,
        motivo,
        referencia_tipo,
        products (name, unit),
        origem_local: origem_local_id (nome),
        destino_local: destino_local_id (nome)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    setMovements(data as any[] || []);
  };

  // Helper to get stock of a product at a specific location
  const getStock = (productId: string, locationId: string) => {
    const balance = stockBalances.find(b => b.produto_id === productId && b.local_estoque_id === locationId);
    return balance ? balance.saldo_atual : 0;
  };

  const handleSuggestReplenishment = () => {
    // Suggest items to transfer where Loja stock is low (< 15) and Industria has available stock
    const loja = locations.find(l => l.tipo === 'loja');
    const ind = locations.find(l => l.tipo === 'industria');
    if (!loja || !ind) {
      showNotification('error', 'Locais de loja e indústria não encontrados.');
      return;
    }

    const suggestions: { product_id: string; quantity: number }[] = [];
    products.forEach(p => {
      const storeStock = getStock(p.id, loja.id);
      const indStock = getStock(p.id, ind.id);
      
      // If store stock is less than 15 units, suggest replenishing up to 30 units (if industry has it)
      if (storeStock < 15 && indStock > 0) {
        const target = 30;
        const needed = target - storeStock;
        const toTransfer = Math.min(needed, indStock);
        if (toTransfer > 0) {
          suggestions.push({
            product_id: p.id,
            quantity: Number(toTransfer.toFixed(3))
          });
        }
      }
    });

    if (suggestions.length === 0) {
      showNotification('success', 'Todos os produtos na Loja estão abastecidos.');
    } else {
      setTransferItems(suggestions);
      showNotification('success', `${suggestions.length} sugestões de reposição adicionadas.`);
    }
  };

  const handleAddTransferItem = (productId: string) => {
    if (!productId) return;
    if (transferItems.some(i => i.product_id === productId)) return;
    setTransferItems(prev => [...prev, { product_id: productId, quantity: 1 }]);
  };

  const handleRemoveTransferItem = (productId: string) => {
    setTransferItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleUpdateTransferQty = (productId: string, qty: number) => {
    setTransferItems(prev => prev.map(item => 
      item.product_id === productId ? { ...item, quantity: Math.max(0.001, qty) } : item
    ));
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferItems.length === 0 || !transferOrigin || !transferDest) return;
    if (transferOrigin === transferDest) {
      showNotification('error', 'Origem e destino não podem ser iguais.');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const item of transferItems) {
        const availStock = getStock(item.product_id, transferOrigin);
        if (item.quantity > availStock) {
          throw new Error(`Quantidade solicitada para ${products.find(p=>p.id===item.product_id)?.name} excede o saldo disponível na origem.`);
        }
      }

      // Perform updates sequentially
      for (const item of transferItems) {
        // 1. Deduct from origin
        const origBal = stockBalances.find(b => b.produto_id === item.product_id && b.local_estoque_id === transferOrigin);
        const newOrigStock = (origBal ? origBal.saldo_atual : 0) - item.quantity;
        if (origBal) {
          const { error } = await supabase
            .from('saldos_estoque')
            .update({ saldo_atual: newOrigStock })
            .eq('id', origBal.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('saldos_estoque')
            .insert({ produto_id: item.product_id, local_estoque_id: transferOrigin, saldo_atual: -item.quantity, saldo_reservado: 0 });
          if (error) throw error;
        }

        // 2. Add to destination
        const destBal = stockBalances.find(b => b.produto_id === item.product_id && b.local_estoque_id === transferDest);
        const newDestStock = (destBal ? destBal.saldo_atual : 0) + item.quantity;
        if (destBal) {
          const { error } = await supabase
            .from('saldos_estoque')
            .update({ saldo_atual: newDestStock })
            .eq('id', destBal.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('saldos_estoque')
            .insert({ produto_id: item.product_id, local_estoque_id: transferDest, saldo_atual: item.quantity, saldo_reservado: 0 });
          if (error) throw error;
        }

        // 3. Log movement
        const { error: logErr } = await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: item.product_id,
            origem_local_id: transferOrigin,
            destino_local_id: transferDest,
            tipo_movimentacao: 'transferencia',
            quantidade: item.quantity,
            motivo: transferReason,
            usuario_id: user?.id,
            referencia_tipo: 'transferencia'
          });
        if (logErr) throw logErr;
      }

      showNotification('success', 'Transferência interna efetuada com sucesso!');
      setTransferItems([]);
      setTransferReason('Transferência interna de reposição');
      
      // Refresh stock balances & movements
      await fetchBalances();
      await fetchMovements();
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao transferir estoque: ' + err.message);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || !adjustLocation || !adjustQty) return;

    const qtyNum = Number(adjustQty);
    if (qtyNum <= 0) {
      showNotification('error', 'A quantidade deve ser maior que zero.');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const actualChange = adjustMode === 'add' ? qtyNum : -qtyNum;

      // 1. Get existing balance
      const existing = stockBalances.find(b => b.produto_id === adjustProduct && b.local_estoque_id === adjustLocation);
      const newStock = (existing ? existing.saldo_atual : 0) + actualChange;

      if (existing) {
        const { error } = await supabase
          .from('saldos_estoque')
          .update({ saldo_atual: newStock })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saldos_estoque')
          .insert({
            produto_id: adjustProduct,
            local_estoque_id: adjustLocation,
            saldo_atual: newStock,
            saldo_reservado: 0
          });
        if (error) throw error;
      }

      // 2. Log movement
      const { error: logErr } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          produto_id: adjustProduct,
          origem_local_id: adjustMode === 'subtract' ? adjustLocation : null,
          destino_local_id: adjustMode === 'add' ? adjustLocation : null,
          tipo_movimentacao: adjustType,
          quantidade: qtyNum,
          motivo: adjustReason || `Ajuste manual (${adjustMode === 'add' ? 'Entrada' : 'Saída'})`,
          usuario_id: user?.id,
          referencia_tipo: 'ajuste'
        });
      if (logErr) throw logErr;

      showNotification('success', 'Ajuste de estoque lançado com sucesso!');
      setAdjustQty('');
      setAdjustReason('');
      
      // Refresh
      await fetchBalances();
      await fetchMovements();
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao lançar ajuste: ' + err.message);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Filter products for overview table
  const filteredProducts = products.filter(p => {
    const normalize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
    const cleanSearch = normalize(searchTerm);
    const matchesSearch = !cleanSearch || normalize(p.name).includes(cleanSearch);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-ink-950 text-white">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Warehouse className="text-gold-500 w-8 h-8" /> Gestão de Estoque
          </h1>
          <p className="text-gray-400 mt-1">Controle multiempresa, transferências e auditoria de locais de estoque.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start md:self-center">
          {[
            { id: 'overview', label: 'Saldos por Local', icon: Warehouse },
            { id: 'transfer', label: 'Transferência', icon: ArrowLeftRight },
            { id: 'adjust', label: 'Ajustes', icon: SlidersHorizontal },
            { id: 'history', label: 'Histórico', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-bold rounded-lg text-xs md:text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/10' 
                : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 ${
              notification.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-12 bg-white/5 rounded-2xl w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-white/5 rounded-3xl lg:col-span-2" />
            <div className="h-64 bg-white/5 rounded-3xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 bg-ink-900 border border-white/10 p-4 rounded-3xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Pesquisar produto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-ink-950 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${
                      selectedCategory === 'all'
                      ? 'bg-gold-500/10 border-gold-500 text-gold-500'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${
                        selectedCategory === cat
                        ? 'bg-gold-500/10 border-gold-500 text-gold-500'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stocks Table */}
              <div className="bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <th className="py-4 px-6">Produto</th>
                        <th className="py-4 px-6">Unidade</th>
                        <th className="py-4 px-6">Categoria</th>
                        {locations.map(loc => (
                          <th key={loc.id} className="py-4 px-6 text-right">
                            {loc.nome}
                            <span className="block text-[9px] text-gray-500 font-normal normal-case">
                              ({loc.tipo})
                            </span>
                          </th>
                        ))}
                        <th className="py-4 px-6 text-right text-gold-500">Saldo Consolidado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={3 + locations.length + 1} className="py-12 text-center text-gray-500 italic">
                            Nenhum produto encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map(p => {
                          let totalStock = 0;
                          const locStocks = locations.map(loc => {
                            const stock = getStock(p.id, loc.id);
                            totalStock += stock;
                            return { id: loc.id, stock };
                          });

                          return (
                            <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                              <td className="py-4 px-6 flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 rounded-xl p-1 shrink-0 flex items-center justify-center border border-white/5">
                                  {p.image_url ? (
                                    <img src={getOptimizedImageUrl(p.image_url)} alt="" className="max-w-full max-h-full object-contain" />
                                  ) : (
                                    <Package className="w-5 h-5 text-gray-600" />
                                  )}
                                </div>
                                <span className="font-bold text-white group-hover:text-gold-500 transition-colors">
                                  {p.name}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-gray-400 font-bold uppercase text-xs">{p.unit}</td>
                              <td className="py-4 px-6">
                                <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-gray-400 rounded-full text-[10px] font-bold">
                                  {p.category}
                                </span>
                              </td>
                              {locStocks.map(ls => (
                                <td key={ls.id} className="py-4 px-6 text-right font-bold">
                                  <span className={ls.stock <= 0 ? 'text-gray-600' : 'text-white'}>
                                    {ls.stock.toFixed(3)}
                                  </span>
                                </td>
                              ))}
                              <td className="py-4 px-6 text-right font-black text-gold-500 text-base bg-gold-500/5">
                                {totalStock.toFixed(3)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSFER */}
          {activeTab === 'transfer' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Transfer setup & List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                      <ArrowLeftRight className="text-gold-500 w-5 h-5" /> Itens para Transferência
                    </h3>
                    <button
                      type="button"
                      onClick={handleSuggestReplenishment}
                      className="bg-gold-500/10 border border-gold-500/30 text-gold-500 hover:bg-gold-500 hover:text-ink-950 font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-current" /> Sugerir Reposição Loja
                    </button>
                  </div>

                  {transferItems.length === 0 ? (
                    <div className="py-16 text-center text-gray-500 italic flex flex-col items-center justify-center">
                      <ArrowLeftRight className="w-12 h-12 opacity-10 mb-4" />
                      Escolha produtos na busca lateral para transferir ou clique em "Sugerir Reposição Loja".
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transferItems.map((item, idx) => {
                        const prod = products.find(p => p.id === item.product_id);
                        const originStock = transferOrigin ? getStock(item.product_id, transferOrigin) : 0;
                        const destStock = transferDest ? getStock(item.product_id, transferDest) : 0;

                        return (
                          <div 
                            key={item.product_id}
                            className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/10 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-sm truncate">{prod?.name}</p>
                              <div className="flex gap-4 mt-1 text-[10px] text-gray-500 font-bold uppercase">
                                <span>Saldo Origem: <strong className="text-white">{originStock.toFixed(3)} {prod?.unit}</strong></span>
                                <span>Saldo Destino: <strong className="text-white">{destStock.toFixed(3)} {prod?.unit}</strong></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <div className="flex items-center bg-ink-950 border border-white/10 rounded-xl px-2.5 py-1">
                                <input
                                  type="number"
                                  step="0.001"
                                  value={item.quantity}
                                  onChange={e => handleUpdateTransferQty(item.product_id, Number(e.target.value))}
                                  className="w-20 bg-transparent text-right font-bold text-sm text-white focus:outline-none"
                                />
                                <span className="text-[10px] text-gray-500 font-black uppercase ml-1.5">{prod?.unit}</span>
                              </div>
                              {prod?.unit === 'kg' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    openWeighModal(prod, { product_id: item.product_id });
                                  }}
                                  className="p-2 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 border border-gold-500/20 rounded-xl transition-all flex items-center justify-center shrink-0"
                                  title="Ler Peso da Balança"
                                >
                                  <Barcode className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveTransferItem(item.product_id)}
                                className="text-gray-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar with search and configurations */}
              <div className="space-y-6">
                <form onSubmit={handleSubmitTransfer} className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                  <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4">
                    Configurações
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Origem (Retirar)</label>
                      <select
                        value={transferOrigin}
                        onChange={e => { setTransferOrigin(e.target.value); setTransferItems([]); }}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-gold-500"
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.nome} ({loc.tipo})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Destino (Abastecer)</label>
                      <select
                        value={transferDest}
                        onChange={e => { setTransferDest(e.target.value); setTransferItems([]); }}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-gold-500"
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.nome} ({loc.tipo})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Motivo / Obs</label>
                      <textarea
                        rows={2}
                        value={transferReason}
                        onChange={e => setTransferReason(e.target.value)}
                        placeholder="Ex: Transferência de reposição..."
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-gold-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingTransfer || transferItems.length === 0}
                    className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-gold-500/10 flex items-center justify-center gap-2"
                  >
                    {isSubmittingTransfer ? <RefreshCcw className="w-4.5 h-4.5 animate-spin" /> : 'Confirmar Transferência'}
                  </button>
                </form>

                {/* Quick Add Product List */}
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                    Adicionar Produtos
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-ink-950 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {products
                      .filter(p => {
                        const normalize = (str: string) => 
                          str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
                        return normalize(p.name).includes(normalize(searchTerm));
                      })
                      .map(p => {
                        const inOrigin = transferOrigin ? getStock(p.id, transferOrigin) : 0;
                        const isAdded = transferItems.some(i => i.product_id === p.id);
                        return (
                          <div key={p.id} className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddTransferItem(p.id)}
                              disabled={isAdded || inOrigin <= 0}
                              className={`flex-1 flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                                isAdded 
                                ? 'bg-gold-500/5 border-gold-500/30 text-gold-500/50 cursor-default'
                                : inOrigin <= 0
                                ? 'opacity-40 border-white/5 cursor-not-allowed'
                                : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <span className="truncate pr-2">{p.name}</span>
                              <span className="shrink-0 text-[10px] text-gray-500 font-bold">
                                {inOrigin.toFixed(1)} {p.unit}
                              </span>
                            </button>
                            {p.unit === 'kg' && !isAdded && inOrigin > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddTransferItem(p.id);
                                  openWeighModal(p, { product_id: p.id });
                                }}
                                className="p-2.5 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 border border-gold-500/20 rounded-xl transition-all flex items-center justify-center shrink-0"
                                title="Pesar na Balança"
                              >
                                <Barcode className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ADJUST */}
          {activeTab === 'adjust' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form panel */}
              <div className="lg:col-span-2">
                <form onSubmit={handleSubmitAdjustment} className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                  <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4 flex items-center gap-2">
                    <SlidersHorizontal className="text-gold-500 w-5 h-5" /> Lançar Ajuste Manual / Perda
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Produto</label>
                      <select
                        value={adjustProduct}
                        onChange={e => setAdjustProduct(e.target.value)}
                        required
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-gold-500"
                      >
                        <option value="">Selecione o produto...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Local de Estoque</label>
                      <select
                        value={adjustLocation}
                        onChange={e => setAdjustLocation(e.target.value)}
                        required
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-gold-500"
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.nome} ({loc.tipo})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Tipo de Ajuste</label>
                      <select
                        value={adjustType}
                        onChange={e => setAdjustType(e.target.value as any)}
                        required
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-gold-500"
                      >
                        <option value="ajuste_manual">Ajuste Manual Genérico</option>
                        <option value="perda_quebra">Perda ou Quebra</option>
                        <option value="descarte">Descarte / Desperdício</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Sentido do Ajuste</label>
                      <div className="grid grid-cols-2 gap-2 bg-ink-950 p-1.5 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => setAdjustMode('add')}
                          className={`py-2 rounded-lg font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5 ${
                            adjustMode === 'add'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" /> Adicionar (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustMode('subtract')}
                          className={`py-2 rounded-lg font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5 ${
                            adjustMode === 'subtract'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" /> Subtrair (-)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Quantidade</label>
                      <div className="flex gap-2">
                        <div className="flex-1 flex bg-ink-950 border border-white/10 rounded-xl px-4 py-3 items-center">
                          <input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={adjustQty}
                            onChange={e => setAdjustQty(e.target.value)}
                            required
                            className="w-full bg-transparent font-bold text-sm text-white focus:outline-none"
                          />
                          <span className="text-xs text-gray-500 font-bold uppercase shrink-0">
                            {adjustProduct ? products.find(p => p.id === adjustProduct)?.unit : 'UN'}
                          </span>
                        </div>
                        {adjustProduct && products.find(p => p.id === adjustProduct)?.unit === 'kg' && (
                          <button
                            type="button"
                            onClick={() => {
                              const prod = products.find(p => p.id === adjustProduct);
                              if (prod) {
                                openWeighModal(prod, 'adjust');
                              }
                            }}
                            className="p-3 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 border border-gold-500/20 rounded-xl transition-all flex items-center justify-center shrink-0"
                            title="Ler Peso da Balança"
                          >
                            <Barcode className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Motivo / Descrição</label>
                      <input
                        type="text"
                        value={adjustReason}
                        onChange={e => setAdjustReason(e.target.value)}
                        placeholder="Ex: Peixe descartado por expiração de validade, contagem manual de balanço..."
                        required
                        className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-gold-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAdjust}
                    className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-gold-500/10 flex items-center justify-center gap-2"
                  >
                    {isSubmittingAdjust ? <RefreshCcw className="w-4.5 h-4.5 animate-spin" /> : 'Registrar Ajuste no Estoque'}
                  </button>
                </form>
              </div>

              {/* Details card */}
              <div className="space-y-6">
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                    Saldo Atual do Produto Selecionado
                  </h3>
                  {adjustProduct ? (
                    <div className="space-y-3 pt-2">
                      {locations.map(loc => {
                        const bal = getStock(adjustProduct, loc.id);
                        return (
                          <div key={loc.id} className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-gray-400 font-bold">{loc.nome}</span>
                            <span className="font-bold text-sm text-white">
                              {bal.toFixed(3)} {products.find(p=>p.id===adjustProduct)?.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Selecione um produto para visualizar os saldos por local.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4 flex items-center gap-2">
                <History className="text-gold-500 w-5 h-5" /> Registro Auditável de Movimentações de Estoque
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Data / Hora</th>
                      <th className="py-3.5 px-4">Produto</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Origem</th>
                      <th className="py-3.5 px-4">Destino</th>
                      <th className="py-3.5 px-4 text-right">Qtd</th>
                      <th className="py-3.5 px-4">Motivo / Obs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500 italic">
                          Nenhuma movimentação registrada recentemente.
                        </td>
                      </tr>
                    ) : (
                      movements.map(m => {
                        let badgeClass = 'bg-white/5 text-gray-400';
                        let typeText = m.tipo_movimentacao;

                        if (m.tipo_movimentacao === 'entrada_compra') {
                          badgeClass = 'bg-green-500/10 text-green-400 border border-green-500/20';
                          typeText = 'Entrada Compra';
                        } else if (m.tipo_movimentacao === 'saida_venda') {
                          badgeClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                          typeText = 'Saída Venda PDV';
                        } else if (m.tipo_movimentacao === 'transferencia') {
                          badgeClass = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                          typeText = 'Transferência';
                        } else if (m.tipo_movimentacao === 'perda_quebra') {
                          badgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
                          typeText = 'Perda/Quebra';
                        } else if (m.tipo_movimentacao === 'descarte') {
                          badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                          typeText = 'Descarte';
                        } else if (m.tipo_movimentacao === 'ajuste_manual') {
                          badgeClass = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                          typeText = 'Ajuste Manual';
                        }

                        return (
                          <tr key={m.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-500">
                              {new Date(m.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {m.products?.name}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${badgeClass}`}>
                                {typeText}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-400">
                              {m.origem_local?.nome || <span className="text-gray-700">-</span>}
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-400">
                              {m.destino_local?.nome || <span className="text-gray-700">-</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-white text-sm">
                              {Number(m.quantidade).toFixed(3)} <span className="text-[10px] text-gray-500 font-bold uppercase">{m.products?.unit}</span>
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate text-gray-400 font-medium">
                              {m.motivo || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL PESAGEM SERIAL */}
      {activeWeighProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => { setActiveWeighProduct(null); setWeighTarget(null); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-ink-900 border border-white/10 rounded-[2.5rem] w-full max-w-md p-8 relative z-10 shadow-2xl space-y-6 text-xs font-bold text-gray-300"
          >
            <div>
              <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Barcode className="text-gold-500 w-6 h-6" /> Pesagem na Balança
              </h3>
              <p className="text-gray-500 text-xs mt-1 font-medium">Produto: <strong className="text-white">{activeWeighProduct.name}</strong></p>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-between p-4 bg-ink-950 rounded-2xl border border-white/5">
              <span className="text-gray-400">Status da Balança:</span>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${
                  scale.status === 'connected'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : scale.status === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    scale.status === 'connected' ? 'bg-green-500' : scale.status === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  {scale.status === 'connected' ? 'Conectado (Toledo Prix)' : scale.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </span>
                {scale.status === 'connected' && (
                  <button
                    type="button"
                    onClick={() => scale.requestWeight()}
                    className="p-1.5 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 rounded-lg transition-all"
                    title="Ler Peso Agora"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Baud Rate Config */}
            {scale.status === 'disconnected' && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Velocidade (Baud Rate)</label>
                <select
                  value={scale.config.baudRate}
                  onChange={e => scale.setConfig({ baudRate: Number(e.target.value) })}
                  className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none cursor-pointer"
                >
                  <option value={2400}>2400 bps (Padrão Toledo Prix 3 Plus)</option>
                  <option value={9600}>9600 bps</option>
                  <option value={4800}>4800 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>
            )}

            {/* Weight Display */}
            <div className="bg-ink-950/80 border border-white/10 rounded-[2rem] p-8 text-center space-y-2 relative overflow-hidden">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest block">Peso Atual</span>
              <span className="text-5xl font-black font-mono text-gold-500 tracking-tight block">
                {scale.weight.toFixed(3)}
              </span>
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest block">kg</span>
            </div>

            {scale.error && (
              <p className="text-xs text-red-500 font-bold bg-red-500/10 border border-red-500/20 p-4 rounded-xl leading-relaxed">
                ⚠️ {scale.error}
              </p>
            )}

            <div className="flex gap-4">
              {scale.status === 'disconnected' ? (
                <button
                  type="button"
                  onClick={() => scale.connect(true)}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5"
                >
                  Conectar Balança
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => scale.requestWeight()}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Ler Peso
                </button>
              )}
              <button
                type="button"
                disabled={scale.status !== 'connected' || scale.weight <= 0}
                onClick={handleConfirmWeight}
                className="flex-1 bg-green-500 disabled:opacity-50 hover:bg-green-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-green-500/10"
              >
                Confirmar Peso
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
