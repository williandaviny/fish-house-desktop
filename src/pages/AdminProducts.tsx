import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  TrendingUp, 
  Eye, 
  EyeOff,
  ShoppingBag,
  RefreshCcw,
  Tag,
  DollarSign,
  AlertCircle,
  PackageCheck,
  Camera,
  Upload,
  TrendingDown,
  Copy,
  Filter,
  Zap,
  X,
  Search as SearchIcon,
  Barcode,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Star
} from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/image';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { motion, AnimatePresence } from 'motion/react';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  is_available: boolean;
  stock: number;
  unit: string;
  package_info?: string;
  is_combo?: boolean;
  is_featured?: boolean;
  barcode?: string;
  is_illustrative?: boolean;
  codigo_interno?: string;
  tipo_produto?: string;
  custo_medio?: number;
  estoque_minimo?: number;
  tributacao?: string;
  local_saida_padrao_id?: string;
  observacoes?: string;
  price_wholesale?: number;
  wholesale_min_qty?: number;
  plu_codigo?: string;
  validade_dias?: number;
  tara_id?: string;
  is_deleted?: boolean;
  ncm?: string;
  cfop?: string;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<{ id: string; nome: string }[]>([]);
  const [taras, setTaras] = useState<{ id: string; codigo: number; peso: number; descricao: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'waitlist' | 'low_stock'>('products');
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const ITEMS_PER_PAGE = 12;
  const [isUploading, setIsUploading] = useState(false);
  const [replenishValues, setReplenishValues] = useState<Record<string, number>>({});
  const [comboItems, setComboItems] = useState<{child_product_id: string, quantity: number, product_name?: string}[]>([]);
  const { settings } = useSettings();
  const [comboSearchTerm, setComboSearchTerm] = useState('');
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastCharTime, setLastCharTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchLocations();
    fetchTaras();
    
    // Barcode listener (Global)
    const handleGlobalScan = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return; // Don't intercept if user is typing in inputs
      
      const currentTime = Date.now();
      
      if (currentTime - lastCharTime > 100) {
        setBarcodeBuffer(e.key.length === 1 ? e.key : '');
      } else {
        if (e.key === 'Enter') {
          if (barcodeBuffer.length > 3) {
            handleScanComplete(barcodeBuffer);
          }
          setBarcodeBuffer('');
        } else if (e.key.length === 1) {
          setBarcodeBuffer(prev => prev + e.key);
        }
      }
      setLastCharTime(currentTime);
    };

    const handleScanComplete = (code: string) => {
      if (isModalOpen) {
        setSelectedProduct(prev => prev ? { ...prev, barcode: code } : null);
        return;
      }

      setSearchTerm(code);
      const matchedProduct = products.find(p => p.barcode === code);
      if (matchedProduct) {
        setSelectedProduct(matchedProduct);
        if (matchedProduct.is_combo) fetchComboItems(matchedProduct.id);
        setIsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalScan);
    return () => window.removeEventListener('keydown', handleGlobalScan);
  }, [barcodeBuffer, lastCharTime, isModalOpen, products]);


  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, category, image_url, is_available, stock, unit, package_info, barcode, codigo_interno, plu_codigo, is_combo, is_illustrative, is_featured, ncm, cfop, price_wholesale, wholesale_min_qty, custo_medio, is_deleted, tara_id, validade_dias, description')
      .order('name');
    
    if (error) {
      console.error('[Supabase Error] products:', error);
      alert('Erro ao carregar produtos do banco: ' + (error.message || JSON.stringify(error)));
    } else if (data) {
      // Filtra produtos excluídos em memória de forma segura
      const activeProducts = data.filter((p: any) => p.is_deleted !== true);
      setAllProducts(activeProducts);
    }
    setLoading(false);
  };

  useEffect(() => {
    const normalize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';

    const cleanSearch = normalize(debouncedSearch);
    
    const filtered = allProducts.filter(p => {
      const matchesSearch = !cleanSearch || 
        normalize(p.name).includes(cleanSearch) || 
        (p.barcode && p.barcode.includes(cleanSearch)) ||
        (p.plu_codigo && p.plu_codigo.includes(cleanSearch));
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });

    setTotalCount(filtered.length);

    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE;
    setProducts(filtered.slice(from, to));
  }, [allProducts, debouncedSearch, selectedCategory, currentPage]);

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locais_estoque')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    if (data) setLocations(data);
  };

  const fetchTaras = async () => {
    const { data } = await supabase
      .from('taras_balanca')
      .select('id, codigo, descricao, peso')
      .order('codigo');
    if (data) setTaras(data);
  };

  const fetchComboItems = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_combo_items')
      .select('*, products:child_product_id(name)')
      .eq('parent_product_id', productId);
    
    if (!error && data) {
      setComboItems(data.map(item => ({
        child_product_id: item.child_product_id,
        quantity: item.quantity,
        product_name: (item.products as any)?.name
      })));
    }
  };

  const fetchWaitlist = async () => {
    setWaitlistLoading(true);
    const { data, error } = await supabase
      .from('product_waitlist')
      .select('id, product_id, customer_name, customer_whatsapp, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error) setWaitlist(data || []);
    setWaitlistLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'waitlist') fetchWaitlist();
  }, [activeTab]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    setIsUploading(true);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(resolve => img.onload = resolve);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      const MAX_SIZE = 800;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/webp', 0.8)
      );
      if (!blob) throw new Error('Blob conversion failed');

      // Bloqueia se a imagem comprimida passar de 1MB
      if (blob.size > 1024 * 1024) {
        throw new Error('A imagem comprimida ainda excede 1MB. Por favor, utilize uma imagem de menor resolução.');
      }

      let safeName = 'produto';
      if (selectedProduct.name) {
        safeName = selectedProduct.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
      }
      
      const fileName = `${safeName}-${Date.now()}.webp`;
      
      let publicUrl = '';

      // 1. Tentar R2 Presigned Upload
      try {
        const { data: presignData, error: presignError } = await supabase.functions.invoke('r2-presign', {
          body: {
            filename: fileName,
            contentType: blob.type || 'image/webp'
          }
        });

        if (!presignError && presignData?.success && presignData.uploadUrl) {
          const uploadResponse = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': blob.type || 'image/webp' },
            body: blob
          });

          if (uploadResponse.ok) {
            publicUrl = presignData.publicUrl;
          }
        }
      } catch (r2Err) {
        console.warn('R2 Presign indisponível, aplicando fallback de upload:', r2Err);
      }

      // 2. Fallback: Upload para Supabase Storage se o R2 falhou
      if (!publicUrl) {
        try {
          const { data: storageData, error: storageErr } = await supabase.storage
            .from('products')
            .upload(fileName, blob, { contentType: 'image/webp', upsert: true });

          if (!storageErr && storageData) {
            const { data: publicData } = supabase.storage.from('products').getPublicUrl(storageData.path);
            publicUrl = publicData.publicUrl;
          }
        } catch (storageException) {
          console.warn('Supabase Storage exception:', storageException);
        }
      }

      // 3. Fallback 2: Converte a imagem comprimida em Data URL segura
      if (!publicUrl) {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      setSelectedProduct(prev => prev ? { ...prev, image_url: publicUrl } : null);

      // Se for um produto existente, salva a URL da foto no banco de dados imediatamente
      if (selectedProduct.id) {
        const { error: dbErr } = await supabase
          .from('products')
          .update({ image_url: publicUrl })
          .eq('id', selectedProduct.id);
        if (dbErr) {
          console.error('Erro ao atualizar foto no banco:', dbErr);
          alert('A foto foi enviada, mas ocorreu um aviso ao vincular ao produto: ' + dbErr.message);
        } else {
          fetchProducts();
        }
      }
      
      setIsUploading(false);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('Erro ao processar imagem: ' + error.message);
      setIsUploading(false);
    }
  };

  const handleDuplicate = async (product: Product) => {
    const { id, ...duplicatedData } = product;
    duplicatedData.name = `${duplicatedData.name} (Cópia)`;
    
    setLoading(true);
    const { error } = await supabase
      .from('products')
      .insert([duplicatedData]);
    
    if (error) {
      alert('Erro ao duplicar: ' + error.message);
    } else {
      fetchProducts();
    }
    setLoading(false);
  };

  const handleQuickReplenish = async (id: string, currentStock: number) => {
    const amount = replenishValues[id];
    if (!amount || amount <= 0) return;

    const newStock = Number((currentStock + amount).toFixed(2));
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar estoque no produto: ' + error.message);
      return;
    }

    // Sincroniza também na tabela saldos_estoque (local loja)
    try {
      const { data: loja } = await supabase
        .from('locais_estoque')
        .select('id')
        .eq('tipo', 'loja')
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      if (loja) {
        await supabase
          .from('saldos_estoque')
          .upsert({
            produto_id: id,
            local_estoque_id: loja.id,
            saldo_atual: newStock,
            saldo_reservado: 0
          }, { onConflict: 'produto_id,local_estoque_id' });
      }
    } catch (sSyncErr) {
      console.error('Erro ao sincronizar saldo por local:', sSyncErr);
    }

    setReplenishValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    fetchProducts();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    setIsSubmitting(true);
    const isEditing = !!selectedProduct.id;

    const productToSave = { ...selectedProduct };
    const idToSave = productToSave.id;
    delete (productToSave as any).id;

    let savedProductId = idToSave;

    if (isEditing) {
      const { error } = await supabase
        .from('products')
        .update(productToSave)
        .eq('id', idToSave);
      if (error) {
        alert('Erro ao atualizar: ' + error.message);
        setIsSubmitting(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert([productToSave])
        .select();
      if (error) {
        alert('Erro ao criar: ' + error.message);
        setIsSubmitting(false);
        return;
      }
      savedProductId = data[0].id;
    }

    // Sincroniza estoque na tabela saldos_estoque (local loja)
    if (savedProductId && productToSave.stock !== undefined && productToSave.stock !== null) {
      try {
        const { data: loja } = await supabase
          .from('locais_estoque')
          .select('id')
          .eq('tipo', 'loja')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();

        if (loja) {
          await supabase
            .from('saldos_estoque')
            .upsert({
              produto_id: savedProductId,
              local_estoque_id: loja.id,
              saldo_atual: productToSave.stock,
              saldo_reservado: 0
            }, { onConflict: 'produto_id,local_estoque_id' });
        }
      } catch (sSyncErr) {
        console.error('Erro ao sincronizar saldo por local no salvamento:', sSyncErr);
      }
    }

    if (savedProductId) {
      await supabase.from('product_combo_items').delete().eq('parent_product_id', savedProductId);
      if (selectedProduct.is_combo && comboItems.length > 0) {
        const itemsToInsert = comboItems.map(item => ({
          parent_product_id: savedProductId,
          child_product_id: item.child_product_id,
          quantity: item.quantity
        }));
        await supabase.from('product_combo_items').insert(itemsToInsert);
      }
    }

    setIsModalOpen(false);
    setComboItems([]);
    fetchProducts();
    setIsSubmitting(false);
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    const { error } = await supabase.from('products').update({ is_available: !current }).eq('id', id);
    if (error) {
      alert('Erro ao alterar disponibilidade do produto: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  const handleDelete = (id: string) => {
    setDeletingProductId(id);
  };

  const confirmDelete = async () => {
    if (!deletingProductId) return;
    const targetId = deletingProductId;
    try {
      // 1. Tenta exclusão lógica definindo is_deleted = true e is_available = false
      let { error } = await supabase
        .from('products')
        .update({ 
          is_deleted: true, 
          is_available: false 
        })
        .eq('id', targetId);
      
      // 2. Se a coluna is_deleted não existir ou falhar, tenta exclusão física (Hard Delete)
      if (error) {
        try {
          await supabase.from('saldos_estoque').delete().eq('produto_id', targetId);
          await supabase.from('product_combo_items').delete().eq('child_product_id', targetId);
          await supabase.from('product_combo_items').delete().eq('parent_product_id', targetId);
          await supabase.from('product_waitlist').delete().eq('product_id', targetId);
        } catch (_) {}

        const hardDeleteRes = await supabase
          .from('products')
          .delete()
          .eq('id', targetId);
        
        error = hardDeleteRes.error;
      }

      // 3. Remove imediatamente da lista local para sumir da tela instantaneamente
      setAllProducts(prev => prev.filter(p => p.id !== targetId));
      setDeletingProductId(null);
      alert('Produto removido com sucesso! ✨');
      fetchProducts();
    } catch (err: any) {
      alert(`Erro ao excluir produto: ${err.message}`);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-ink-900 border border-white/10 rounded-3xl p-6 gap-6 shadow-xl relative overflow-hidden">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Package className="text-gold-500" /> Gestão de Produtos
          </h1>
          <p className="text-gray-400 mt-1">Controle o estoque e preços da sua peixaria.</p>
        </div>
        <div className="flex gap-4">
          <div className="hidden md:flex bg-white/5 border border-white/10 rounded-2xl p-2 items-center gap-2 group hover:bg-gold-500/10 hover:border-gold-500/30 transition-all">
            <Barcode className="w-5 h-5 text-gold-500 group-hover:scale-110 transition-transform" />
            <div className="text-left pr-4">
              <p className="text-[10px] text-gray-500 font-bold uppercase leading-none">Scanner Ativo</p>
              <p className="text-[8px] text-gray-600 font-medium">Basta ler o código para localizar</p>
            </div>
          </div>
          <button 
            onClick={() => { 
              setSelectedProduct({ is_available: true, stock: 0, unit: 'kg', is_combo: false, wholesale_min_qty: 1, ncm: '03028990', cfop: '5102' }); 
              setComboItems([]);
              setIsModalOpen(true); 
            }}
            className="bg-gold-500 text-ink-950 px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-gold-500/20 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" /> Novo Produto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-ink-900 border border-white/10 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('products')} className={`px-6 py-2 rounded-xl text-sm font-bold ${activeTab === 'products' ? 'bg-gold-500 text-ink-950' : 'text-gray-500'}`}>Produtos</button>
        <button 
          onClick={() => setActiveTab('low_stock')} 
          className={`px-6 py-2 rounded-xl text-sm font-bold relative transition-all ${activeTab === 'low_stock' ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20' : 'text-gray-500 hover:text-white'}`}
        >
          Estoque Baixo
          {products.filter(p => p.stock <= 10).length > 0 && activeTab !== 'low_stock' && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-ink-950 font-black">
              {products.filter(p => p.stock <= 10).length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('waitlist')} className={`px-6 py-2 rounded-xl text-sm font-bold ${activeTab === 'waitlist' ? 'bg-gold-500 text-ink-950' : 'text-gray-500'}`}>Espera</button>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
             <div className="w-full md:w-80 lg:w-96 shrink-0 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full bg-ink-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:border-gold-500 outline-none text-white placeholder:text-gray-500 font-medium transition-all"
                />
             </div>
             <div className="flex-1 w-full flex gap-2 overflow-x-auto pb-2">
                <button 
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-gold-500/10 border border-gold-500 text-gold-500' : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-white'}`}
                >
                  Todos
                </button>
                {settings?.categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-gold-500/10 border border-gold-500 text-gold-500' : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 gap-4">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
               <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" />
               Mostrando <span className="text-white">{products.length}</span> de <span className="text-white">{totalCount}</span> produtos
             </p>
             <div className="flex items-center gap-4">
                <button 
                 disabled={currentPage === 1}
                 onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                 className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-10 transition-all active:scale-90"
                >
                   <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-white uppercase tabular-nums tracking-widest">Pág {currentPage}</span>
                  <span className="text-[8px] text-gray-600 font-bold uppercase">de {totalPages || 1}</span>
                </div>
                <button 
                 disabled={currentPage >= totalPages}
                 onClick={() => { setCurrentPage(p => p + 1); window.scrollTo(0, 0); }}
                 className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-10 transition-all active:scale-90"
                >
                   <ChevronRight className="w-5 h-5" />
                </button>
             </div>
          </div>

          <div className="hidden md:block bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead>
                  <tr className="bg-white/5 text-left">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Produto</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Cat.</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Preço Varejo</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Preço Atacado</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Estoque</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-white/5 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={getOptimizedImageUrl(p.image_url)} alt="" className="w-10 h-10 rounded-lg object-contain bg-gray-50/5" />
                          <div>
                            <p className="font-bold text-sm text-white">{p.name}</p>
                            {p.is_combo && <span className="text-[8px] bg-gold-500 text-ink-950 px-1 rounded font-black">COMBO</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{p.category}</td>
                      <td className="px-6 py-4 text-center font-bold text-gold-500">R$ {p.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center font-bold text-amber-500">
                        {(() => {
                          let calculatedWholesale = p.price_wholesale;
                          let isGlobal = false;
                          if ((calculatedWholesale === null || calculatedWholesale === undefined || Number(calculatedWholesale) === 0) && settings?.wholesale_discount_type && settings.wholesale_discount_type !== 'none') {
                            const val = Number(settings.wholesale_discount_value) || 0;
                            if (settings.wholesale_discount_type === 'percentage') {
                              calculatedWholesale = p.price * (1 - val / 100);
                              isGlobal = true;
                            } else if (settings.wholesale_discount_type === 'fixed') {
                              calculatedWholesale = Math.max(0, p.price - val);
                              isGlobal = true;
                            }
                          }

                          return calculatedWholesale && Number(calculatedWholesale) > 0 ? (
                            <div className="flex flex-col items-center">
                              <span>R$ {Number(calculatedWholesale).toFixed(2)}</span>
                              {isGlobal && <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter mt-0.5 leading-none">(Global)</span>}
                            </div>
                          ) : '—';
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className={`text-xs font-bold whitespace-nowrap min-w-[60px] ${p.stock <= 5 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                            {p.stock} {p.unit}
                          </span>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <input 
                              type="number" 
                              placeholder="+ Qtd" 
                              value={replenishValues[p.id] || ''}
                              onChange={e => setReplenishValues(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                              className="w-16 bg-ink-950 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-white focus:border-gold-500 focus:outline-none"
                            />
                            <button 
                              onClick={() => handleQuickReplenish(p.id, p.stock)}
                              className="bg-gold-500 text-ink-950 p-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => toggleAvailability(p.id, p.is_available)} className={`p-2 rounded-lg ${p.is_available ? 'text-green-500' : 'text-gray-600'}`}>
                          {p.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setSelectedProduct(p); if (p.is_combo) fetchComboItems(p.id); setIsModalOpen(true); }} className="p-2 text-gray-400"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDuplicate(p)} className="p-2 text-gold-500"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 md:hidden">
            {products.map((p) => (
              <div key={p.id} className="bg-ink-900 border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <img src={getOptimizedImageUrl(p.image_url)} alt="" className="w-16 h-16 rounded-2xl object-contain bg-gray-50/5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${p.is_available ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                        {p.is_available ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{p.category}</p>
                    <p className="text-gold-500 font-bold mt-1">R$ {p.price.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.2em]">Estoque</p>
                    <p className={`text-sm font-black ${p.stock <= 5 ? 'text-red-500' : 'text-white'}`}>
                      {p.stock} <span className="text-[10px] opacity-40 uppercase">{p.unit}</span>
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setSelectedProduct(p); if (p.is_combo) fetchComboItems(p.id); setIsModalOpen(true); }} className="p-3 bg-white/5 rounded-2xl text-gray-400 active:scale-95 transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDuplicate(p)} className="p-3 bg-gold-400/10 rounded-2xl text-gold-500 active:scale-95 transition-all"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-3 bg-red-400/10 rounded-2xl text-red-500 active:scale-95 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="bg-ink-950/50 rounded-2xl p-3 flex items-center justify-between gap-3 border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase">Reposição Rápida</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="+ Qtd" 
                      value={replenishValues[p.id] || ''}
                      onChange={e => setReplenishValues(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                      className="w-16 bg-ink-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center"
                    />
                    <button 
                      onClick={() => handleQuickReplenish(p.id, p.stock)}
                      className="bg-gold-500 text-ink-950 p-2 rounded-lg font-black"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'low_stock' && (
        <div className="bg-ink-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" /> Estoque Crítico
              </h2>
              <p className="text-xs text-gray-500 mt-1">Produtos com estoque abaixo do recomendado.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-left">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Produto</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Estoque</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.filter(p => p.stock <= 10).map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={getOptimizedImageUrl(p.image_url)} alt="" className="w-10 h-10 rounded-lg object-contain bg-gray-50/5" />
                        <span className="font-bold text-sm text-white">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-bold ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setSelectedProduct(p); setIsModalOpen(true); }} className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest px-4 py-2 rounded-lg border border-white/5">Ficha</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'waitlist' && (
        <div className="bg-ink-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Lista de Espera 
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-left">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">WhatsApp</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {waitlist.map((w) => (
                  <tr key={w.id} className="hover:bg-white/5 transition-all">
                    <td className="px-6 py-4 font-bold text-sm text-white">{w.products?.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">{w.whatsapp}</td>
                    <td className="px-6 py-4 text-right">
                      <a 
                        href={`https://wa.me/${w.whatsapp.replace(/\D/g, '')}?text=Olá! O produto ${w.products?.name} que você estava esperando já está disponível na Fish House! Reserve o seu agora.`}
                        target="_blank" rel="noreferrer"
                        className="bg-green-500/10 text-green-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                      >
                        Avisar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-4xl bg-ink-900 border border-white/10 rounded-[2.5rem] p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <h2 className="text-2xl font-display font-bold text-white mb-8">
                {selectedProduct.id ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Photo and Status */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2 ml-1">
                        <Camera className="w-4 h-4 text-gold-500" /> Foto do Produto
                      </label>
                      
                      <div className="relative group w-full aspect-square bg-ink-950 border-2 border-dashed border-white/10 rounded-[2.5rem] overflow-hidden flex items-center justify-center shadow-2xl transition-all hover:border-gold-500/30">
                        {selectedProduct.image_url ? (
                          <>
                            <img src={selectedProduct.image_url} alt="" className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                              <Upload className="text-white w-8 h-8" />
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-6">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                              <Upload className="w-8 h-8 text-gray-600" />
                            </div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-tight">Escolha ou<br/>Arraste uma foto</p>
                          </div>
                        )}
                        
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                        <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                        
                        <div className="absolute inset-0 flex flex-col">
                           <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 w-full bg-transparent" />
                           <button 
                             type="button"
                             onClick={() => cameraInputRef.current?.click()}
                             className="h-14 w-full bg-gold-500 text-ink-950 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gold-400 transition-all active:scale-95"
                           >
                             <Camera className="w-4 h-4" /> Tirar Foto
                           </button>
                        </div>

                        {isUploading && (
                          <div className="absolute inset-0 bg-ink-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-md">
                            <RefreshCcw className="w-8 h-8 text-gold-500 animate-spin mb-2" />
                            <span className="text-[10px] font-black text-gold-500 uppercase tracking-widest">Enviando...</span>
                          </div>
                        )}
                      </div>

                      <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer group hover:bg-white/10 transition-all">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={selectedProduct.is_illustrative || false}
                            onChange={e => setSelectedProduct({...selectedProduct, is_illustrative: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-6 h-6 border-2 border-white/10 rounded-lg transition-all peer-checked:bg-gold-500 peer-checked:border-gold-500 flex items-center justify-center group-hover:border-gold-500/50">
                            <CheckCircle2 className={`w-4 h-4 text-ink-950 transition-opacity ${selectedProduct.is_illustrative ? 'opacity-100' : 'opacity-0'}`} />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Imagem Ilustrativa</span>
                          <span className="text-[9px] text-gray-500 uppercase font-bold">Ative se não for a foto real</span>
                        </div>
                      </label>
                    </div>

                    <div className="space-y-3">
                      <button 
                        type="button" 
                        onClick={() => setSelectedProduct({...selectedProduct, is_featured: !selectedProduct.is_featured})}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedProduct.is_featured ? 'bg-gold-500/10 border-gold-500/50 text-gold-500' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Star className={`w-5 h-5 ${selectedProduct.is_featured ? 'fill-current' : ''}`} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Destaque na Home</span>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${selectedProduct.is_featured ? 'bg-gold-500' : 'bg-white/20'}`}>
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${selectedProduct.is_featured ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setSelectedProduct({...selectedProduct, is_combo: !selectedProduct.is_combo})}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedProduct.is_combo ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Zap className={`w-5 h-5 ${selectedProduct.is_combo ? 'fill-current' : ''}`} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Produto é um Combo</span>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${selectedProduct.is_combo ? 'bg-indigo-500' : 'bg-white/20'}`}>
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${selectedProduct.is_combo ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Nome do Produto</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Salmão Premium do Alasca"
                          value={selectedProduct.name || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, name: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white text-lg font-bold focus:border-gold-500 outline-none transition-all placeholder:text-gray-700" 
                          required 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Categoria</label>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                          <select 
                            value={selectedProduct.category || ''} 
                            onChange={e => setSelectedProduct({...selectedProduct, category: e.target.value})} 
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 pl-12 text-white font-bold focus:border-gold-500 outline-none appearance-none cursor-pointer"
                          >
                            <option value="">Selecione...</option>
                            {settings?.categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Unidade de Medida</label>
                        <div className="relative">
                          <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                          <select 
                            value={selectedProduct.unit || 'kg'} 
                            onChange={e => setSelectedProduct({...selectedProduct, unit: e.target.value})} 
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 pl-12 text-white font-bold focus:border-gold-500 outline-none appearance-none cursor-pointer"
                          >
                            <option value="kg">Quilo (kg)</option>
                            <option value="un">Unidade (un)</option>
                            <option value="pacote">Pacote</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-gold-500" /> Preço de Venda
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-500 font-black text-sm">R$</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={selectedProduct.price === undefined || selectedProduct.price === null ? '' : selectedProduct.price} 
                            onChange={e => setSelectedProduct({...selectedProduct, price: e.target.value === '' ? undefined : Number(e.target.value)})} 
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 pl-12 text-white font-black text-xl focus:border-gold-500 outline-none transition-all" 
                            required 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-2">
                          <RefreshCcw className="w-3.5 h-3.5 text-gold-500" /> Estoque Atual
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={selectedProduct.stock === undefined || selectedProduct.stock === null ? '' : selectedProduct.stock} 
                            onChange={e => setSelectedProduct({...selectedProduct, stock: e.target.value === '' ? undefined : Number(e.target.value)})} 
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-gold-500 outline-none transition-all" 
                            required 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-black uppercase">{selectedProduct.unit || 'kg'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Preço de Atacado (B2B)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-sm">R$</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="Vazio p/ desativar"
                            value={selectedProduct.price_wholesale === undefined || selectedProduct.price_wholesale === null ? '' : selectedProduct.price_wholesale} 
                            onChange={e => setSelectedProduct({...selectedProduct, price_wholesale: e.target.value === '' ? null : Number(e.target.value)})} 
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 pl-12 text-white font-black text-xl focus:border-gold-500 outline-none transition-all placeholder:text-gray-700" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-amber-500" /> Qtd Mínima Atacado
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.001" 
                            value={selectedProduct.wholesale_min_qty === undefined || selectedProduct.wholesale_min_qty === null ? '' : selectedProduct.wholesale_min_qty} 
                            onChange={e => setSelectedProduct({...selectedProduct, wholesale_min_qty: e.target.value === '' ? null : Number(e.target.value)})} 
                            className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-gold-500 outline-none transition-all" 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-black uppercase">{selectedProduct.unit || 'kg'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Info Adicional (Peso/Tam)</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Aprox. 500g / Limpo"
                          value={selectedProduct.package_info || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, package_info: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-800" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-2">
                          <Barcode className="w-3.5 h-3.5 text-gold-500" /> Código de Barras
                        </label>
                        <input 
                          type="text" 
                          placeholder="Escaneie ou digite..."
                          value={selectedProduct.barcode || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, barcode: e.target.value})} 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            }
                          }}
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all font-mono placeholder:text-gray-800" 
                        />
                      </div>

                      {/* ERP & Fiscal fields */}
                      <div className="md:col-span-2 border-t border-white/5 pt-4 mt-2">
                        <h4 className="text-xs text-gold-500 font-bold uppercase tracking-wider mb-2">Dados de ERP & Fiscal</h4>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Código Interno / SKU</label>
                        <input 
                          type="text" 
                          placeholder="Ex: SAL-PREM-01"
                          value={selectedProduct.codigo_interno || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, codigo_interno: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-800" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Tipo de Produto</label>
                        <select 
                          value={selectedProduct.tipo_produto || 'unidade'} 
                          onChange={e => setSelectedProduct({...selectedProduct, tipo_produto: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-gold-500 outline-none appearance-none cursor-pointer"
                        >
                          <option value="unidade">Por Unidade</option>
                          <option value="peso">Por Peso</option>
                          <option value="fracionado">Fracionado</option>
                          <option value="congelado">Congelado</option>
                          <option value="fresco">Fresco</option>
                          <option value="revenda">Item de Revenda</option>
                          <option value="producao_interna">Produção Interna</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Custo Médio (R$)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          value={selectedProduct.custo_medio === undefined || selectedProduct.custo_medio === null ? '' : selectedProduct.custo_medio} 
                          onChange={e => setSelectedProduct({...selectedProduct, custo_medio: e.target.value === '' ? undefined : Number(e.target.value)})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Estoque Mínimo</label>
                        <input 
                          type="number" 
                          step="0.001" 
                          placeholder="0.000"
                          value={selectedProduct.estoque_minimo === undefined || selectedProduct.estoque_minimo === null ? '' : selectedProduct.estoque_minimo} 
                          onChange={e => setSelectedProduct({...selectedProduct, estoque_minimo: e.target.value === '' ? undefined : Number(e.target.value)})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gold-500 uppercase font-black tracking-widest ml-1">Código NCM Fiscal</label>
                        <input 
                          type="text" 
                          placeholder="Padrão: 03028990"
                          value={selectedProduct.ncm || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, ncm: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-mono focus:border-gold-500 outline-none transition-all placeholder:text-gray-800" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gold-500 uppercase font-black tracking-widest ml-1">CFOP Fiscal</label>
                        <input 
                          type="text" 
                          placeholder="Padrão: 5102"
                          value={selectedProduct.cfop || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, cfop: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-mono focus:border-gold-500 outline-none transition-all placeholder:text-gray-800" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Local de Saída Padrão</label>
                        <select 
                          value={selectedProduct.local_saida_padrao_id || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, local_saida_padrao_id: e.target.value || undefined})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-gold-500 outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Scale Settings */}
                      <div className="md:col-span-2 border-t border-white/5 pt-4 mt-2">
                        <h4 className="text-xs text-gold-500 font-bold uppercase tracking-wider mb-2">Configurações da Balança (Toledo)</h4>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Código PLU</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 10 (Se vazio, usa Código Interno)"
                          value={selectedProduct.plu_codigo || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, plu_codigo: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-800" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Validade (Dias)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 5"
                          value={selectedProduct.validade_dias === undefined || selectedProduct.validade_dias === null ? '' : selectedProduct.validade_dias} 
                          onChange={e => setSelectedProduct({...selectedProduct, validade_dias: e.target.value === '' ? 0 : Number(e.target.value)})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all" 
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Tara Associada</label>
                        <select 
                          value={selectedProduct.tara_id || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, tara_id: e.target.value || undefined})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-gold-500 outline-none appearance-none cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        >
                          <option value="">Nenhuma tara associada (Sem tara)</option>
                          {taras.map(tara => (
                            <option key={tara.id} value={tara.id}>
                              [{tara.codigo}] {tara.descricao} ({(Number(tara.peso) * 1000).toFixed(0)}g)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Observações Internas</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Observações de compra/armazenamento..."
                          value={selectedProduct.observacoes || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, observacoes: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-800" 
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Descrição Completa</label>
                        <textarea 
                          placeholder="Descreva os detalhes do produto, origem, frescor..."
                          value={selectedProduct.description || ''} 
                          onChange={e => setSelectedProduct({...selectedProduct, description: e.target.value})} 
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white h-32 focus:border-gold-500 outline-none transition-all resize-none placeholder:text-gray-800" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gestão de Itens do Combo */}
                <AnimatePresence>
                  {selectedProduct.is_combo && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 border-t border-white/5 pt-6"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gold-500 uppercase font-bold flex items-center gap-2">
                          <PackageCheck className="w-4 h-4" /> Composição do Combo
                        </label>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">{comboItems.length} Itens adicionados</span>
                      </div>

                      <div className="space-y-2">
                        {comboItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                            <div className="flex-1">
                              <p className="text-xs font-bold text-white">{item.product_name || products.find(p => p.id === item.child_product_id)?.name || 'Produto'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={e => {
                                  const newItems = [...comboItems];
                                  newItems[idx].quantity = Number(e.target.value);
                                  setComboItems(newItems);
                                }}
                                className="w-16 bg-ink-950 border border-white/10 rounded-lg p-2 text-xs text-white text-center focus:border-gold-500 outline-none"
                              />
                              <button 
                                type="button"
                                onClick={() => setComboItems(comboItems.filter((_, i) => i !== idx))}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Buscar produto para adicionar ao combo..."
                          className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 pl-12 text-sm text-white focus:border-gold-500 outline-none"
                          onChange={(e) => setComboSearchTerm(e.target.value)}
                          value={comboSearchTerm}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        
                        {comboSearchTerm && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-ink-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                            {allProducts
                              .filter(p => {
                                const normalize = (str: string) => 
                                  str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
                                return normalize(p.name).includes(normalize(comboSearchTerm)) && p.id !== selectedProduct.id;
                              })
                              .map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setComboItems([...comboItems, { child_product_id: p.id, quantity: 1, product_name: p.name }]);
                                    setComboSearchTerm('');
                                  }}
                                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 text-left border-b border-white/5 last:border-0"
                                >
                                  <span className="text-gray-300">{p.name}</span>
                                  <Plus className="w-3 h-3 text-gold-500" />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting || isUploading} 
                    className="w-full bg-gold-500 text-ink-950 py-5 rounded-[2rem] font-bold uppercase tracking-widest text-sm shadow-xl shadow-gold-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        {selectedProduct.id ? 'Salvar Alterações' : 'Criar Produto'}
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingProductId && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div onClick={() => setDeletingProductId(null)} className="absolute inset-0 bg-black/80" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-md bg-ink-900 p-8 rounded-3xl text-center">
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Excluir Produto?</h3>
              <p className="text-gray-400">Esta ação não pode ser desfeita e removerá o produto permanentemente do catálogo.</p>
              <div className="flex gap-4 mt-6">
                <button onClick={() => setDeletingProductId(null)} className="flex-1 bg-white/5 py-3 rounded-xl text-gray-400 font-bold">Cancelar</button>
                <button onClick={confirmDelete} className="flex-1 bg-red-600 py-3 rounded-xl text-white font-bold">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
