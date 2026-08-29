import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ArrowRight, Loader2, Moon, Sun, Clock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getOptimizedImageUrl } from '../utils/image';

interface CatalogProps {
  limit?: number;
  showButton?: boolean;
}

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
  combo_items?: string[];
};

const categories = ['Todos', '🌟 Destaques', '🍱 Combos', '🐟 Peixes', '🦐 Camarões', '🦀 Frutos do Mar', '❄️ Congelados', '🧂 Especiarias', '🌾 Farinhas', '🍷 Bebidas', '🍽️ Acompanhamentos'];

export default function Catalog({ limit = 0, showButton = false }: CatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const { addToCart } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, name, price, image_url, unit, is_available, category, is_combo, is_featured, stock')
        .eq('is_available', true);

      if (limit > 0) {
        // Prioritise featured for the home page catalog
        query = query.order('is_featured', { ascending: false }).limit(limit);
      }
      
      const { data: dbProducts, error } = await query;
      
      if (!error && dbProducts) {
        const comboIds = dbProducts.filter(p => p.is_combo).map(p => p.id);
        let comboItemsMap: Record<string, string[]> = {};

        if (comboIds.length > 0) {
          const { data: allComboItems } = await supabase
            .from('product_combo_items')
            .select('parent_product_id, quantity, products:child_product_id(name, unit)')
            .in('parent_product_id', comboIds);

          if (allComboItems) {
            allComboItems.forEach((i: any) => {
              const pid = i.parent_product_id;
              if (!comboItemsMap[pid]) comboItemsMap[pid] = [];
              const qty = Number(i.quantity);
              const unit = i.products?.unit === 'kg' ? 'kg' : 'x';
              if (i.products?.name) {
                comboItemsMap[pid].push(`${qty}${unit} ${i.products.name}`);
              }
            });
          }
        }

        const productsWithComboDetails = dbProducts.map(p => ({
          ...p,
          combo_items: p.is_combo ? (comboItemsMap[p.id] || []) : []
        }));
        const sortedProducts = productsWithComboDetails.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return 0;
        });
        setProducts(sortedProducts);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCleanCategory = (cat: string) => cat.split(' ').slice(1).join(' ') || cat;

  const filteredProducts = activeCategory === 'Todos'
    ? products
    : activeCategory === '🌟 Destaques'
      ? products.filter(p => p.is_featured)
      : activeCategory === '🍱 Combos'
        ? products.filter(p => p.is_combo)
        : products.filter(p => p.category.includes(getCleanCategory(activeCategory)));

  const displayedProducts = limit > 0 ? filteredProducts.slice(0, limit) : filteredProducts;

  // Store Opening Hours Logic
  const [isOpen, setIsOpen] = useState(true);
  const [nextOpen, setNextOpen] = useState("");

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();
      const day = now.getDay(); // 0-6 (Sun-Sat)
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours * 60 + minutes;

      const schedules = [
        { day: 0, open: "08:30", close: "12:30" }, // Sun
        { day: 1, open: "08:30", close: "19:30" }, // Mon
        { day: 2, open: "08:30", close: "19:30" }, // Tue
        { day: 3, open: "08:30", close: "19:30" }, // Wed
        { day: 4, open: "08:30", close: "19:30" }, // Thu
        { day: 5, open: "08:30", close: "19:30" }, // Fri
        { day: 6, open: "08:30", close: "18:30" }, // Sat
      ];

      const today = schedules.find(s => s.day === day);
      if (!today) return;

      const [oH, oM] = today.open.split(':').map(Number);
      const [cH, cM] = today.close.split(':').map(Number);
      const openTime = oH * 60 + oM;
      const closeTime = cH * 60 + cM;

      if (currentTime >= openTime && currentTime < closeTime) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
        const nextDayIdx = (day + 1) % 7;
        const nextDay = schedules.find(s => s.day === nextDayIdx);
        setNextOpen(`${nextDayIdx === day + 1 ? 'amanhã' : 'no próximo dia útil'} às ${nextDay?.open}`);
      }
    };

    checkStatus();
    const timer = setInterval(checkStatus, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="catalog" className="py-32 bg-[#f8f9fa] text-ink-900 relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Status Banner */}
        <div className="mb-12 flex justify-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-4 px-8 py-4 rounded-3xl border shadow-xl ${isOpen ? 'bg-green-500/5 border-green-500/20 text-green-700' : 'bg-gold-500/5 border-gold-500/20 text-gold-700'}`}
          >
            {isOpen ? (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold uppercase tracking-widest leading-none mb-1">Loja Aberta Agora</span>
                  <span className="text-[10px] font-medium opacity-80">Peça e receba em minutos! 🐟💨</span>
                </div>
              </>
            ) : (
              <>
                <Moon className="w-6 h-6 text-gold-600 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold uppercase tracking-widest leading-none mb-1">Estamos Descansando (Fechado) 🌙</span>
                  <span className="text-[10px] font-medium opacity-80 italic">Peça agora e agende sua entrega {nextOpen.replace('às', 'a partir das')}! 🛒📦</span>
                </div>
              </>
            )}
          </motion.div>
        </div>

        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 tracking-tight"
          >
            Nosso <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Catálogo</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Escolha seu produto e peça pelo WhatsApp em segundos.
          </motion.p>
        </div>

        {/* Categories Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${activeCategory === category
                ? 'bg-ink-900 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="min-h-[400px] relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-gold-500" />
              <p className="font-medium animate-pulse">Buscando o que há de mais fresco...</p>
            </div>
          ) : (
            <motion.div
              layout
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              <AnimatePresence mode="popLayout">
                {displayedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} addToCart={addToCart} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {!loading && displayedProducts.length === 0 && (
            <div className="text-center py-20 text-gray-500 italic">
              Nenhum produto encontrado nesta categoria no momento.
            </div>
          )}
        </div>

        {showButton && (
          <div className="mt-16 text-center">
            <Link
              to="/catalogo"
              className="inline-flex items-center justify-center gap-3 bg-ink-900 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-gold-500 hover:text-ink-900 transition-all shadow-xl hover:-translate-y-1"
            >
              Acessar Catálogo Completo
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        )}

      </div>
    </section>
  );
}

function ProductCard({ product, addToCart }: { product: Product, addToCart: any, key?: string }) {
  const [qty, setQty] = useState(product.unit === 'kg' ? 0.5 : 1);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [joined, setJoined] = useState(false);
  
  const step = product.unit === 'kg' ? 0.1 : 1;
  const min = step;
  const isOutOfStock = product.stock <= 0;

  const handleJoinWaitlist = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('product_waitlist')
      .insert([{ product_id: product.id, whatsapp }]);
    
    if (!error) {
      setJoined(true);
      setTimeout(() => {
        setIsJoiningWaitlist(false);
        setJoined(false);
        setWhatsapp('');
      }, 3000);
    }
  };

  return (
    <motion.div
      layout
      transition={{ duration: 0.3 }}
      className="group bg-white rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(207,161,74,0.15)] transition-[border-color,box-shadow,transform] duration-500 border border-gray-100 flex flex-col hover:-translate-y-1 animate-fadeIn"
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
          className="relative w-full h-full object-contain hover:scale-105 transition-transform duration-500 z-10"
          referrerPolicy="no-referrer"
        />
        {product.is_combo && (
          <div className="absolute top-4 right-4 bg-gold-500 text-ink-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-bounce-slow">
            <ShoppingBag className="w-3 h-3" /> COMBO COMPLETO
          </div>
        )}
        {product.is_featured && (
          <div className="absolute top-4 left-4 bg-gold-500 text-ink-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 z-20">
            <Sun className="w-3 h-3 fill-current" /> DESTAQUE
          </div>
        )}
        <div className={`absolute top-4 ${product.is_featured ? 'left-24' : 'left-4'} bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-ink-900 border border-gold-500/20 z-10 transition-all`}>
          {product.category}
        </div>
        {isOutOfStock && (
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">Fora de Estoque</span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold font-display">{product.name}</h3>
          <div className="text-right">
            <span className="text-lg font-bold text-gold-600 block">
              R$ {Number(product.price).toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[10px] text-gray-400 uppercase font-bold">
              {product.unit === 'pacote' && product.package_info 
                ? `Pacote (${product.package_info})` 
                : `por ${product.unit}`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-6 flex-grow line-clamp-2">{product.description}</p>

        <div className="space-y-4 mt-auto">
          {product.is_combo && product.combo_items && product.combo_items.length > 0 && (
            <div className="bg-gold-500/5 border border-gold-500/10 p-3 rounded-2xl mb-2">
              <span className="text-[9px] text-gold-600 font-black uppercase tracking-widest block mb-1.5">Itens Inclusos:</span>
              <ul className="space-y-1">
                {product.combo_items.map((item, i) => (
                  <li key={i} className="text-[10px] text-gray-500 font-bold uppercase tracking-tight flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-gold-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isOutOfStock ? (
            <>
              {/* Quantity Selector */}
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-2xl border border-gray-100">
                <button 
                  onClick={() => setQty(prev => Math.max(min, Number((prev - step).toFixed(1))))}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-ink-900 hover:bg-gray-100 transition-all font-bold"
                >
                  -
                </button>
                <div className="text-center">
                  <span className="text-lg font-bold text-ink-950">{qty.toString().replace('.', ',')}</span>
                  <span className="text-xs text-gray-500 ml-1 font-medium">{product.unit}</span>
                </div>
                <button 
                  onClick={() => setQty(prev => Number((prev + step).toFixed(1)))}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-ink-900 hover:bg-gray-100 transition-all font-bold"
                >
                  +
                </button>
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
                className="w-full flex items-center justify-center gap-2 bg-ink-900 hover:bg-gold-500 text-white hover:text-ink-900 px-6 py-4 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-ink-900/10"
              >
                <ShoppingBag className="w-5 h-5" />
                Adicionar ao Carrinho
              </button>
            </>
          ) : (
            <div className="pt-2">
              <AnimatePresence mode="wait">
                {!isJoiningWaitlist ? (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsJoiningWaitlist(true)}
                    className="w-full flex items-center justify-center gap-2 bg-gold-500/10 border border-gold-500 text-gold-600 px-6 py-4 rounded-2xl font-bold transition-all hover:bg-gold-500 hover:text-ink-900"
                  >
                    Avise-me quando chegar
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-gold-500/5 border border-gold-500/20 p-4 rounded-2xl space-y-3"
                  >
                    {joined ? (
                      <p className="text-gold-600 font-bold text-center py-2 animate-bounce">✨ Salvo! Te avisaremos.</p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 font-bold uppercase text-center">Informe seu WhatsApp</p>
                        <form onSubmit={handleJoinWaitlist} className="flex gap-2">
                          <input 
                            type="text"
                            required
                            placeholder="(00) 00000-0000"
                            value={whatsapp}
                            onChange={e => setWhatsapp(e.target.value)}
                            className="flex-1 bg-white border border-gold-500/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                          />
                          <button 
                            type="submit"
                            className="bg-gold-500 text-ink-900 px-4 py-2 rounded-xl text-sm font-bold hover:scale-105 transition-all"
                          >
                            Ir
                          </button>
                        </form>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
