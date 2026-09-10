import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  LayoutGrid, 
  List, 
  ChevronRight, 
  ShoppingBag, 
  Lock, 
  Unlock, 
  FileText, 
  Phone, 
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  Share2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { getOptimizedImageUrl } from '../utils/image';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  price_wholesale: number;
  wholesale_min_qty: number;
  category: string;
  image_url: string;
  is_available: boolean;
  unit: string;
  stock: number;
  package_info?: string;
  is_illustrative?: boolean;
};

export function cleanWholesaleName(name: string): string {
  return name
    .replace(/(?:\.|\s)+\d+\s*(?:GR|G|KG)\b/gi, '')
    .replace(/\s+(?:PCT|PACOTE)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
}

export default function WholesaleCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // B2B Gate state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [isGateSubmitting, setIsGateSubmitting] = useState(false);

  const { addToCart, items, clearCart } = useCart();
  const navigate = useNavigate();

  // Check if B2B is already unlocked in localStorage
  useEffect(() => {
    const savedCnpj = localStorage.getItem('fishhouse_b2b_cnpj');
    const savedWhatsapp = localStorage.getItem('fishhouse_b2b_whatsapp');
    const savedName = localStorage.getItem('fishhouse_b2b_name');

    if (savedCnpj && savedWhatsapp) {
      setCnpj(savedCnpj);
      setWhatsapp(savedWhatsapp);
      setRestaurantName(savedName || '');
      setIsUnlocked(true);
    }
  }, []);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/atacado`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Canal de Atacado B2B - Fish House',
          text: 'Preços especiais e fornecimento de pescados premium para empresas.',
          url: shareUrl,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link do Canal de Atacado copiado para a área de transferência!');
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchWholesaleProducts();
    }
  }, [isUnlocked]);

  const fetchWholesaleProducts = async () => {
    setLoading(true);
    try {
      // 1. Fetch site settings to get global wholesale rules
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('wholesale_discount_type, wholesale_discount_value')
        .limit(1)
        .single();

      const type = settingsData?.wholesale_discount_type || 'none';
      const val = Number(settingsData?.wholesale_discount_value) || 0;

      // 2. Fetch products
      let query = supabase.from('products').select('id, name, description, price, price_wholesale, wholesale_min_qty, image_url, unit, is_available, category, is_combo, is_featured, stock').eq('is_available', true);
      
      // If there is no global rule, only show manually configured ones
      if (type === 'none' || val <= 0) {
        query = query.not('price_wholesale', 'is', null);
      }

      const { data, error } = await query.order('name');

      if (!error && data) {
        const cleanedData = data
          .map(p => {
            let finalWholesalePrice = p.price_wholesale;
            
            // If the wholesale price is not configured manually, apply the global rule
            if (p.price_wholesale === null || p.price_wholesale === undefined || Number(p.price_wholesale) === 0) {
              if (type === 'percentage') {
                finalWholesalePrice = Number(p.price) * (1 - val / 100);
              } else if (type === 'fixed') {
                finalWholesalePrice = Math.max(0, Number(p.price) - val);
              } else {
                return null;
              }
            }

            // Fallback for minimum wholesale quantity if not configured
            const minQty = p.wholesale_min_qty || 15;

            return {
              ...p,
              name: cleanWholesaleName(p.name),
              price_wholesale: finalWholesalePrice,
              wholesale_min_qty: minQty
            };
          })
          .filter(Boolean);

        setProducts(cleanedData as Product[]);
      }
    } catch (err) {
      console.error('Error fetching wholesale products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleB2BUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnpj || !whatsapp || !restaurantName) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    setIsGateSubmitting(true);
    try {
      // Save to local storage for persistent login
      localStorage.setItem('fishhouse_b2b_cnpj', cnpj);
      localStorage.setItem('fishhouse_b2b_whatsapp', whatsapp);
      localStorage.setItem('fishhouse_b2b_name', restaurantName);
      
      // Also register/update B2B customer in our database
      const { error } = await supabase
        .from('customers')
        .upsert({
          whatsapp: whatsapp,
          name: restaurantName,
          email: '', // empty for B2B catalog unlock
          address_city: 'B2B Client'
        }, { onConflict: 'whatsapp' });

      setIsUnlocked(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGateSubmitting(false);
    }
  };

  const handleLogoutB2B = () => {
    if (confirm('Deseja sair do canal de Atacado? Seu carrinho será limpo.')) {
      localStorage.removeItem('fishhouse_b2b_cnpj');
      localStorage.removeItem('fishhouse_b2b_whatsapp');
      localStorage.removeItem('fishhouse_b2b_name');
      clearCart();
      setIsUnlocked(false);
    }
  };

  // Categories list derived from wholesale products
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ['Todos', ...Array.from(list)];
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const normalize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
    const cleanSearch = normalize(searchTerm);
    return products.filter(p => {
      const matchesSearch = !cleanSearch || 
                            normalize(p.name).includes(cleanSearch) || 
                            normalize(p.description).includes(cleanSearch);
      const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  if (!isUnlocked) {
    return (
      <main className="bg-ink-950 min-h-screen pt-32 pb-20 flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Decorative Circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-400/5 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full bg-ink-900/40 backdrop-blur-xl border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl relative z-10"
        >
          <div className="text-center space-y-4 mb-10">
            <div className="w-16 h-16 bg-gold-500/10 border border-gold-500/30 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-gold-500/5">
              <Lock className="w-8 h-8 text-gold-500 animate-pulse" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white">Canal de Atacado B2B</h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              Preços diferenciados e condições exclusivas de fornecimento para restaurantes, hotéis e mercados parceiros.
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="mt-2 text-[10px] bg-white/5 border border-white/10 hover:border-gold-500/30 text-gray-400 hover:text-gold-500 px-4 py-2.5 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 mx-auto"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartilhar Canal / Copiar Link
            </button>
          </div>

          <form onSubmit={handleB2BUnlock} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Razão Social / Nome do Restaurante</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Bistrô do Mar Ltda"
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  className="w-full bg-ink-950 border border-white/5 rounded-2xl p-4 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-700"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">CNPJ da Empresa</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input 
                  type="text" 
                  required
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={e => setCnpj(e.target.value)}
                  className="w-full bg-ink-950 border border-white/5 rounded-2xl p-4 pl-12 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-700 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">WhatsApp Comercial</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input 
                  type="text" 
                  required
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="w-full bg-ink-950 border border-white/5 rounded-2xl p-4 pl-12 text-white focus:border-gold-500 outline-none transition-all placeholder:text-gray-700"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isGateSubmitting}
              className="w-full bg-gold-500 hover:bg-gold-400 text-ink-950 font-bold uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl shadow-gold-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isGateSubmitting ? 'Verificando...' : 'Liberar Catálogo de Atacado'}
              <Unlock className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
              ⚠️ ATENÇÃO: Os preços listados nesta área exigem comprovação jurídica (CNPJ ativo) e faturamento mínimo de atacado no fechamento.
            </p>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="bg-ink-950 min-h-screen pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-ink-900 border border-white/10 rounded-3xl p-8 gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
            <ShoppingBag className="w-64 h-64 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-gold-500/10 text-gold-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-gold-500/20 shadow-md">
                Canal Corporativo B2B
              </span>
              <span className="text-[10px] text-gray-500 font-medium">| {restaurantName}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mt-3">
              Fornecimento de Pescados Premium
            </h1>
            <p className="text-gray-400 text-sm mt-1">Preços diferenciados para chefs, restaurantes e parceiros comerciais.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={handleShare}
              className="text-[10px] bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500 hover:text-ink-950 text-gold-500 px-5 py-3 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartilhar Canal
            </button>
            <button 
              onClick={handleLogoutB2B}
              className="text-[10px] bg-white/5 border border-white/10 text-gray-400 hover:text-white px-5 py-3 rounded-xl font-bold uppercase tracking-widest transition-all"
            >
              Sair do Canal Atacado
            </button>
          </div>
        </div>

        {/* B2B Rules Alert Banner */}
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-xl shrink-0 text-amber-500">
            <Percent className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-white text-xs font-black uppercase tracking-wider mb-0.5">Como funciona a compra B2B?</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              O carrinho exibirá os preços especiais de atacado. Não realizamos cobrança financeira automática: ao enviar o pedido, nosso comercial receberá a lista detalhada no WhatsApp e confirmará prazos de entrega e faturamento.
            </p>
          </div>
        </div>

        {/* Core Layout Grid */}
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Categories Sidebar */}
          <aside className="hidden lg:block w-72 shrink-0 space-y-8 sticky top-32 h-fit">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gold-500 mb-4 ml-1">Categorias</h3>
              <div className="space-y-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                      activeCategory === cat 
                        ? 'bg-gold-500 text-ink-950 shadow-xl shadow-gold-500/20 font-black' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5 font-bold'
                    }`}
                  >
                    <span className="text-sm">{cat}</span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${activeCategory === cat ? 'text-ink-950 translate-x-1' : 'text-gray-600 opacity-0 group-hover:opacity-100'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* B2B Advantages Card */}
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 space-y-4">
              <h4 className="text-white font-display font-bold text-sm">Vantagens Parceiro B2B</h4>
              <ul className="space-y-2 text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-gold-500 shrink-0" /> Entrega diária programada</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-gold-500 shrink-0" /> Pescado eviscerado e limpo</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-gold-500 shrink-0" /> Faturamento faturado quinzenal</li>
              </ul>
            </div>
          </aside>

          {/* Catalog Content Area */}
          <div className="flex-1 space-y-8">
            
            {/* Search and view toggle bar */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Pesquisar por pescados para o restaurante..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-ink-900 border border-white/10 rounded-2xl pl-14 pr-6 py-4 focus:border-gold-500 text-white outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              
              <div className="flex justify-between items-center gap-4">
                {/* Mobile categories selector */}
                <div className="lg:hidden">
                  <select 
                    value={activeCategory}
                    onChange={e => setActiveCategory(e.target.value)}
                    className="bg-ink-900 border border-white/10 text-white p-4 rounded-2xl text-xs font-bold focus:border-gold-500 outline-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div className="flex gap-1.5 text-gray-500 bg-ink-900 p-1.5 rounded-2xl border border-white/10 shrink-0">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'text-gold-500 bg-white/5 shadow-inner' : 'hover:text-white'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'text-gold-500 bg-white/5 shadow-inner' : 'hover:text-white'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Products grid */}
            <div className={`relative min-h-[300px] ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-gray-600 mx-auto" />
                  <div>
                    <h5 className="text-lg font-bold text-white">Nenhum pescado encontrado</h5>
                    <p className="text-gray-500 text-sm">Tente redefinir os filtros ou mudar a palavra-chave.</p>
                  </div>
                </div>
              ) : (
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" 
                  : "space-y-4"
                }>
                  {filteredProducts.map(p => (
                    <WholesaleProductCard 
                      key={p.id} 
                      product={p} 
                      viewMode={viewMode}
                      addToCart={addToCart}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* B2B Cart Checkout Button Panel */}
            {items.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky bottom-6 bg-gold-500 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 border border-gold-400 z-50 text-ink-950"
              >
                <div>
                  <p className="text-[10px] uppercase font-black tracking-widest text-ink-950/70">Carrinho Corporativo Ativo</p>
                  <p className="text-2xl font-black">{items.length} {items.length === 1 ? 'item' : 'itens'} adicionados</p>
                </div>
                <button
                  onClick={() => navigate('/atacado/checkout')}
                  className="bg-ink-950 text-white font-bold uppercase tracking-widest text-xs py-4 px-10 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-ink-950/20 flex items-center gap-2 group"
                >
                  Continuar para Pedido <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}

interface WholesaleProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
  addToCart: (item: any) => void;
  key?: string | number;
}

function WholesaleProductCard({ product, viewMode, addToCart }: WholesaleProductCardProps) {
  const minBoxes = Math.max(1, Math.round(product.wholesale_min_qty / 15));
  const [qty, setQty] = useState(minBoxes);
  const step = 1;

  // Handle increasing/decreasing quantities respecting min wholesale boundaries
  const handleIncrease = () => {
    setQty(prev => prev + step);
  };

  const handleDecrease = () => {
    setQty(prev => {
      const target = prev - step;
      return target < minBoxes ? minBoxes : target;
    });
  };

  const formattedWholesalePricePerKg = Number(product.price_wholesale).toFixed(2).replace('.', ',');
  const boxPrice = Number(product.price_wholesale) * 15;
  const formattedBoxPrice = boxPrice.toFixed(2).replace('.', ',');
  const formattedRetailPrice = Number(product.price).toFixed(2).replace('.', ',');
  const discountPercent = Math.round(((product.price - product.price_wholesale) / product.price) * 100);

  if (viewMode === 'list') {
    return (
      <div className="bg-ink-900 border border-white/5 hover:border-gold-500/20 p-4 rounded-3xl flex flex-col sm:flex-row items-center gap-6 hover:shadow-xl hover:shadow-gold-500/5 transition-all group">
        <div className="w-full sm:w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-ink-950 flex items-center justify-center relative border border-white/5">
          <img src={getOptimizedImageUrl(product.image_url)} alt="" className="w-full h-full object-contain" />
          {discountPercent > 0 && (
            <div className="absolute top-1 left-1 bg-amber-500 text-ink-950 text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded leading-none">
              -{discountPercent}%
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 w-full space-y-1 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h4 className="font-bold text-white text-base">{product.name}</h4>
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded w-fit mx-auto sm:mx-0">{product.category}</span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-1 italic leading-relaxed">"{product.description}"</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
          <div className="text-center sm:text-right">
            <span className="text-gray-500 text-[10px] font-bold line-through block">De R$ {formattedRetailPrice}/{product.unit}</span>
            <span className="text-gold-500 text-lg font-black block">
              <span className="text-[10px] font-bold text-gold-500/60 mr-0.5">R$</span>{formattedWholesalePricePerKg}
              <span className="text-[10px] text-gray-400 font-bold ml-1">/kg</span>
            </span>
            <span className="text-[9px] text-gray-400 block font-medium">Ref: R$ {formattedBoxPrice}/cx (15kg)</span>
            <span className="text-[8px] text-amber-400 font-bold uppercase tracking-widest block mt-0.5">Mínimo: {minBoxes} {minBoxes === 1 ? 'caixa' : 'caixas'} ({minBoxes * 15}kg)</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center bg-ink-950 border border-white/10 p-1.5 rounded-xl shrink-0">
              <button 
                onClick={handleDecrease}
                className="w-7 h-7 flex items-center justify-center bg-white/5 rounded-lg text-white hover:bg-gold-500 hover:text-ink-950 transition-all font-black text-sm"
              >
                -
              </button>
              <div className="text-center min-w-[2.5rem]">
                <span className="text-xs font-black text-white block leading-none">{qty}</span>
                <span className="text-[7px] text-gray-500 font-bold uppercase tracking-tighter leading-none">{qty === 1 ? 'caixa' : 'caixas'}</span>
              </div>
              <button 
                onClick={handleIncrease}
                className="w-7 h-7 flex items-center justify-center bg-white/5 rounded-lg text-white hover:bg-gold-500 hover:text-ink-950 transition-all font-black text-sm"
              >
                +
              </button>
            </div>

            <button 
              onClick={() => addToCart({
                id: product.id,
                name: product.name,
                price: boxPrice,
                image: product.image_url,
                quantity: qty,
                unit: 'cx'
              })}
              className="bg-gold-500 text-ink-950 p-3 rounded-xl font-bold uppercase tracking-widest text-[9px] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ink-900 border border-white/5 hover:border-gold-500/20 rounded-[2rem] overflow-hidden flex flex-col hover:shadow-2xl hover:shadow-gold-500/5 transition-all group duration-500">
      <div className="relative h-48 bg-ink-950 flex items-center justify-center border-b border-white/5 p-4">
        <img src={getOptimizedImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
        
        {discountPercent > 0 && (
          <div className="absolute top-4 left-4 bg-amber-500 text-ink-950 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
            Economize {discountPercent}%
          </div>
        )}

        <div className="absolute bottom-3 left-4 right-4">
          <div className="bg-ink-900/90 backdrop-blur-sm border border-white/5 px-3 py-1.5 rounded-xl flex items-center justify-between">
            <span className="text-[8px] text-amber-400 font-black uppercase tracking-widest">Pedido Mínimo</span>
            <span className="text-[10px] text-white font-black">{minBoxes} cx ({minBoxes * 15}kg)</span>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <span className="text-[9px] font-black text-gold-500 uppercase tracking-widest mb-1 block">{product.category}</span>
          <h3 className="text-lg font-display font-bold text-white group-hover:text-gold-500 transition-colors">{product.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-2 italic">"{product.description}"</p>
        </div>

        <div className="space-y-4 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] font-bold line-through">De R$ {formattedRetailPrice}/{product.unit}</span>
              <span className="text-xl font-black text-gold-500">
                <span className="text-xs font-bold text-gold-500/60 mr-0.5">R$</span>
                {formattedWholesalePricePerKg}
                <span className="text-[10px] text-gray-400 font-bold ml-1">/kg</span>
              </span>
              <span className="text-[9px] text-gray-500 font-medium mt-0.5">Ref: R$ {formattedBoxPrice}/cx (15kg)</span>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center bg-ink-950 border border-white/10 p-1.5 rounded-xl shrink-0">
              <button 
                onClick={handleDecrease}
                className="w-7 h-7 flex items-center justify-center bg-white/5 rounded-lg text-white hover:bg-gold-500 hover:text-ink-950 transition-all font-black text-sm"
              >
                -
              </button>
              <div className="text-center min-w-[2.5rem]">
                <span className="text-xs font-black text-white block leading-none">{qty}</span>
                <span className="text-[7px] text-gray-500 font-bold uppercase tracking-tighter leading-none">{qty === 1 ? 'caixa' : 'caixas'}</span>
              </div>
              <button 
                onClick={handleIncrease}
                className="w-7 h-7 flex items-center justify-center bg-white/5 rounded-lg text-white hover:bg-gold-500 hover:text-ink-950 transition-all font-black text-sm"
              >
                +
              </button>
            </div>
          </div>

          <button 
            onClick={() => addToCart({
              id: product.id,
              name: product.name,
              price: boxPrice,
              image: product.image_url,
              quantity: qty,
              unit: 'cx'
            })}
            className="w-full bg-gold-500 text-ink-950 py-4 rounded-xl font-bold uppercase tracking-widest text-[9px] hover:bg-gold-400 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Adicionar ao Pedido
          </button>
        </div>
      </div>
    </div>
  );
}
