import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  ShoppingBag, 
  ChevronRight, 
  Star, 
  Tag, 
  LayoutGrid, 
  List, 
  X, 
  ArrowLeft,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Clock,
  Zap,
  TrendingUp,
  Package,
  Heart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useSettings } from '../hooks/useSettings';
import { Link, useNavigate } from 'react-router-dom';
import { getOptimizedImageUrl } from '../utils/image';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  is_available: boolean;
  unit: string;
  stock: number;
  package_info?: string;
  is_combo?: boolean;
  is_featured?: boolean;
  is_illustrative?: boolean;
};

interface ProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
  addToCart: (product: any) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void | Promise<void>;
  key?: string | number;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const ITEMS_PER_PAGE = 12;
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const { addToCart } = useCart();
  const { settings } = useSettings();
  const { customerPhone, isAuthenticated } = useCustomerAuth();
  const navigate = useNavigate();

  const categories = useMemo(() => {
    const base = ['Todos', '🌟 Destaques', '🍱 Combos'];
    const extra = settings?.categories?.filter(c => 
      !c.toLowerCase().includes('combo') && 
      !c.toLowerCase().includes('destaque')
    ) || [];
    return [...base, ...extra];
  }, [settings]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Refetch when filters or page change
  useEffect(() => {
    fetchProducts();
    window.scrollTo(0, 0);
  }, [debouncedSearch, activeCategory, sortBy, currentPage]);

  useEffect(() => {
    if (isAuthenticated && customerPhone) {
      fetchFavorites();
    }
  }, [isAuthenticated, customerPhone]);

  const fetchFavorites = async () => {
    const { data, error } = await supabase
      .from('customer_favorites')
      .select('product_id')
      .eq('customer_whatsapp', customerPhone);
    
    if (!error && data) {
      setFavorites(data.map(f => f.product_id));
    }
  };

  const toggleFavorite = async (productId: string) => {
    if (!isAuthenticated) {
      navigate('/verificar');
      return;
    }

    const isFavorite = favorites.includes(productId);

    if (isFavorite) {
      const { error } = await supabase
        .from('customer_favorites')
        .delete()
        .eq('customer_whatsapp', customerPhone)
        .eq('product_id', productId);
      
      if (!error) {
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } else {
      const { error } = await supabase
        .from('customer_favorites')
        .insert({ customer_whatsapp: customerPhone, product_id: productId });
      
      if (!error) {
        setFavorites(prev => [...prev, productId]);
      }
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Build query with server-side filters
      let query = supabase
        .from('products')
        .select('id, name, price, image_url, unit, category, is_combo, is_featured, package_info, is_illustrative, stock', { count: 'exact' })
        .eq('is_available', true);

      // Category filter
      if (activeCategory === '🌟 Destaques') {
        query = query.eq('is_featured', true);
      } else if (activeCategory === '🍱 Combos') {
        query = query.eq('is_combo', true);
      } else if (activeCategory !== 'Todos') {
        const cleanCat = activeCategory.split(' ').slice(1).join(' ') || activeCategory;
        query = query.eq('category', cleanCat);
      }

      // Search filter (server-side ilike)
      if (debouncedSearch.trim()) {
        query = query.ilike('name', `%${debouncedSearch.trim()}%`);
      }

      // Sort
      if (sortBy === 'price_asc') {
        query = query.order('price', { ascending: true });
      } else if (sortBy === 'price_desc') {
        query = query.order('price', { ascending: false });
      } else if (sortBy === 'name') {
        query = query.order('name', { ascending: true });
      } else {
        // featured: destaques primeiro
        query = query.order('is_featured', { ascending: false }).order('name', { ascending: true });
      }

      // Paginate
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (!error && data) {
        setProducts(data);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products;

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, debouncedSearch, sortBy]);

  return (
    <main className="bg-[#fcfcfc] min-h-screen pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <Link to="/" className="hover:text-gold-500 transition-colors">Início</Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-ink-900">Catálogo Completo</span>
          {activeCategory !== 'Todos' && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="text-gold-600">{activeCategory}</span>
            </>
          )}
        </nav>

        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 shrink-0 space-y-10 sticky top-32 h-fit">
            
            {/* Categories Menu */}
            <div>
              <h3 className="text-lg font-display font-bold text-ink-950 mb-6 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-gold-500" /> Categorias
              </h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                      activeCategory === cat 
                        ? 'bg-ink-950 text-white shadow-xl shadow-ink-950/20' 
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-bold">{cat}</span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${activeCategory === cat ? 'text-gold-500 translate-x-1' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Banner/Info */}
            <div className="bg-gold-500 rounded-3xl p-6 relative overflow-hidden group shadow-2xl shadow-gold-500/20">
              <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-700">
                <ShoppingBag className="w-24 h-24 text-ink-950" />
              </div>
              <h4 className="text-ink-950 font-display font-black text-xl mb-2 relative z-10">Qualidade Premium</h4>
              <p className="text-ink-950/70 text-xs font-bold leading-relaxed relative z-10">
                Produtos selecionados diariamente para garantir o melhor na sua mesa. 🦐🐟
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-8">
            
            {/* Search and Sort Bar */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gold-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Pesquisar peixes, camarões, temperos..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border-2 border-gray-100 rounded-2xl pl-14 pr-6 py-4 focus:border-gold-500 text-ink-950 outline-none transition-all shadow-sm"
                />
              </div>
              <div className="flex gap-4">
                <select 
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-xs font-bold text-gray-600 focus:border-gold-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="featured">Padrão (Destaques)</option>
                  <option value="price_asc">Menor Preço</option>
                  <option value="price_desc">Maior Preço</option>
                  <option value="name">Ordem Alfabética</option>
                </select>
                <button 
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden bg-ink-950 text-white p-4 rounded-2xl shadow-lg ring-4 ring-white"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Categories Scroller */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 thin-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                    activeCategory === cat 
                      ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20' 
                      : 'bg-white border border-gray-100 text-gray-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Count */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Mostrando <span className="text-ink-950">{products.length}</span> de <span className="text-gold-600">{totalCount}</span> produtos
              </p>
              <div className="flex gap-2 text-gray-400">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'text-gold-500 bg-gold-50' : 'hover:text-ink-950'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'text-gold-500 bg-gold-50' : 'hover:text-ink-950'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="relative min-h-[400px]">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-20 text-center space-y-4 animate-fadeIn">
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-gray-300" />
                  </div>
                  <div>
                    <h5 className="text-lg font-bold text-ink-950">Nenhum resultado</h5>
                    <p className="text-gray-400 text-sm">Tente outros termos ou remova os filtros.</p>
                  </div>
                </div>
              ) : (
                <div
                  className={viewMode === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                    : "space-y-4"
                  }
                >
                  {filteredProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      viewMode={viewMode}
                      addToCart={addToCart}
                      isFavorite={favorites.includes(p.id)}
                      onToggleFavorite={() => toggleFavorite(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-4 rounded-2xl bg-white border border-gray-100 text-ink-950 disabled:opacity-30 transition-all hover:bg-gray-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    if (
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-12 h-12 rounded-xl text-xs font-black transition-all ${
                            currentPage === page 
                              ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20' 
                              : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 || 
                      page === currentPage + 2
                    ) {
                      return <span key={page} className="text-gray-300 mx-1">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-4 rounded-2xl bg-white border border-gray-100 text-ink-950 disabled:opacity-30 transition-all hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Mobile Filter Sheet */}
      <AnimatePresence>
        {showFilters && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-[85%] bg-white p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-display font-bold text-ink-950">Filtros</h3>
                <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-ink-950" />
                </button>
              </div>

              <div className="space-y-12">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-gold-600 mb-6 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" /> Categorias
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setShowFilters(false); }}
                        className={`text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                          activeCategory === cat 
                            ? 'bg-ink-950 text-white shadow-lg shadow-ink-950/20' 
                            : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gold-500 rounded-3xl p-6 shadow-xl shadow-gold-500/20">
                  <h4 className="text-ink-950 font-display font-black text-lg mb-2">Fish House</h4>
                  <p className="text-ink-950/70 text-xs font-bold leading-relaxed mb-6">
                    A melhor peixaria premium da região agora 100% online.
                  </p>
                  <Link
                    to="/catalogo"
                    className="block text-center bg-ink-950 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                  >
                    Ver Produtos
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function ProductCard({ 
  product, 
  viewMode, 
  addToCart,
  isFavorite,
  onToggleFavorite
}: ProductCardProps) {
  const [qty, setQty] = useState(product.unit === 'kg' ? 0.5 : 1);
  const step = product.unit === 'kg' ? 0.1 : 1;

  if (viewMode === 'list') {
    return (
      <div
        className="group bg-white border-2 border-gray-50 rounded-3xl p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 hover:border-gold-500/30 transition-[border-color,box-shadow,background-color] duration-300 hover:bg-white hover:shadow-xl hover:shadow-gold-500/5 relative overflow-hidden animate-fadeIn"
      >
        <div className="w-full sm:w-24 h-40 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-white relative flex items-center justify-center">
          <img 
            src={getOptimizedImageUrl(product.image_url)} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover blur-md opacity-60 scale-110" 
          />
          <img 
            src={getOptimizedImageUrl(product.image_url)} 
            alt="" 
            className="relative w-full h-full object-contain group-hover:scale-110 transition-transform duration-700 z-10" 
          />
          {product.is_illustrative && (
            <div className="absolute bottom-1 left-0 right-0 z-20 flex justify-center">
              <span className="bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded text-[6px] font-black text-white/70 uppercase tracking-tighter">
                Ilustrativa
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 mb-1 pr-10 sm:pr-0">
            <h4 className="font-bold text-ink-950 truncate shrink-0">{product.name}</h4>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter bg-gray-50 px-1.5 py-0.5 rounded leading-none">{product.unit}</span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 sm:line-clamp-1 mb-4 sm:mb-2 leading-relaxed italic pr-10 sm:pr-0">"{product.description}"</p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-gold-600 font-bold block">R$ {Number(product.price).toFixed(2).replace('.', ',')}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 shrink-0 border border-gray-200">
                <button 
                  onClick={() => setQty(prev => Math.max(step, Number((prev - step).toFixed(1))))} 
                  className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-ink-950 hover:bg-gold-500 transition-colors text-xs font-black"
                >
                  -
                </button>
                <div className="text-center min-w-[2.4rem]">
                  <span className="text-[11px] font-black text-ink-950 block leading-tight">{qty.toString().replace('.', ',')}</span>
                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter leading-none">{product.unit}</span>
                </div>
                <button 
                  onClick={() => setQty(prev => Number((prev + step).toFixed(1)))} 
                  className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-ink-950 hover:bg-gold-500 transition-colors text-xs font-black"
                >
                  +
                </button>
              </div>
              <button 
                onClick={() => addToCart({ ...product, quantity: qty, image: product.image_url })}
                className="flex-1 sm:flex-none bg-ink-950 text-white px-4 py-3 sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gold-500 hover:text-ink-950 transition-all shadow-lg"
              >
                Add
              </button>
              {/* Heart button - Hidden in row on small mobile if screen very or just let it wrap? Let's use absolute on mobile and row on desktop */}
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite();
                }}
                className={`hidden sm:block p-2 rounded-xl transition-all ${
                  isFavorite ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Heart Button (absolute) */}
        <button 
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite();
          }}
          className={`sm:hidden absolute top-4 right-4 p-3 rounded-2xl transition-all shadow-xl ${
            isFavorite ? 'bg-red-500 text-white shadow-red-500/30' : 'bg-white/90 backdrop-blur-md text-ink-950'
          }`}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group bg-white rounded-[2.5rem] overflow-hidden border-2 border-gray-50 flex flex-col hover:border-gold-500/20 transition-[border-color,box-shadow,transform] duration-500 hover:shadow-2xl hover:shadow-gold-500/10 hover:-translate-y-2 animate-fadeIn"
    >
      <div className="relative h-64 overflow-hidden bg-white flex items-center justify-center">
        {/* Recognizeable Blurred Background */}
        <img 
          src={getOptimizedImageUrl(product.image_url)} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-60 select-none pointer-events-none" 
        />
        
        {/* Main Subject Image */}
        <img 
          src={getOptimizedImageUrl(product.image_url)} 
          alt={product.name} 
          className="relative w-full h-full object-contain transition-transform duration-1000 group-hover:scale-105 z-10" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent self-bottom z-10 pointer-events-none" />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 transition-transform group-hover:translate-x-1">
          {product.is_featured && (
            <div className="bg-gold-500 text-ink-950 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5 backdrop-blur-md ring-4 ring-gold-500/20">
              <Star className="w-3 h-3 fill-current" /> Destaque
            </div>
          )}
          {product.is_combo && (
            <div className="bg-ink-950 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5 backdrop-blur-md ring-4 ring-ink-950/20">
              <Zap className="w-3 h-3 text-gold-500" /> Combo
            </div>
          )}
        </div>
        
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button 
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite();
            }}
            className={`p-3 rounded-2xl shadow-xl transition-all active:scale-95 ${
              isFavorite 
                ? 'bg-red-500 text-white shadow-red-500/30' 
                : 'bg-white/90 backdrop-blur-md text-ink-950 hover:bg-white'
            }`}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl text-ink-950">
            <Info className="w-5 h-5" />
          </div>
        </div>

        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-red-500/20 flex items-center justify-between shadow-xl">
              <span className="text-[8px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Restam apenas {product.stock} {product.unit}
              </span>
              <div className="w-12 h-1 bg-red-600/10 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full w-[30%]" />
              </div>
            </div>
          </div>
        )}

        {product.is_illustrative && (
          <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center">
            <span className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-bold text-white/80 uppercase tracking-widest">
              Imagem Ilustrativa
            </span>
          </div>
        )}
      </div>

      <div className="p-8 flex flex-col flex-1 space-y-4">
        <div>
          <span className="text-[10px] font-black text-gold-600 uppercase tracking-tighter mb-1 block">{product.category}</span>
          <h3 className="text-xl font-display font-bold text-ink-950 group-hover:text-gold-600 transition-colors duration-300 transform group-hover:translate-x-1">{product.name}</h3>
        </div>
        
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1 italic group-hover:text-gray-900 transition-colors">
          "{product.description}"
        </p>

        <div className="pt-4 space-y-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Preço unitário</span>
              <span className="text-2xl font-black text-ink-950 tracking-tighter">
                <span className="text-xs font-bold text-gray-400 mr-1 uppercase">R$</span>
                {Number(product.price).toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Por {product.unit}</span>
            </div>
            
            {/* Quantity Selector */}
            <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <button 
                onClick={() => setQty(prev => Math.max(step, Number((prev - step).toFixed(1))))}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-ink-900 hover:bg-gold-500 hover:text-ink-950 transition-all font-black text-lg active:scale-90 shadow-sm"
              >
                -
              </button>
              <div className="text-center min-w-[3rem]">
                <span className="text-sm font-black text-ink-950 block leading-none">{qty.toString().replace('.', ',')}</span>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter leading-none">{product.unit}</span>
              </div>
              <button 
                onClick={() => setQty(prev => Number((prev + step).toFixed(1)))}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-ink-900 hover:bg-gold-500 hover:text-ink-950 transition-all font-black text-lg active:scale-90 shadow-sm"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={() => addToCart({
              id: product.id,
              name: product.name,
              price: Number(product.price),
              image: product.image_url,
              quantity: qty,
              unit: product.unit
            })}
            className="w-full flex items-center justify-center gap-3 bg-ink-950 text-white px-8 py-5 rounded-[1.5rem] font-bold uppercase tracking-widest text-[10px] hover:bg-gold-500 hover:text-ink-950 transition-all duration-500 shadow-xl shadow-ink-950/10 group-hover:shadow-gold-500/20 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gold-400/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <ShoppingBag className="w-4 h-4 relative z-10 transition-transform group-hover:scale-110" />
            <span className="relative z-10">Adicionar ao Carrinho</span>
          </button>
        </div>
      </div>
    </div>
  );
}
