import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, ShoppingBag, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabase';
import { getOptimizedImageUrl } from '../utils/image';

type Combo = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  items?: string[];
};

export default function Combos() {
  const { addToCart } = useCart();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealCombos() {
      setLoading(true);
      try {
        const { data: dbProducts, error: pError } = await supabase
          .from('products')
          .select('id, name, description, price, image_url')
          .eq('is_combo', true)
          .eq('is_available', true);

        if (pError) throw pError;

        const combosWithItems = await Promise.all(
          (dbProducts || []).map(async (p) => {
            const { data: items } = await supabase
              .from('product_combo_items')
              .select('quantity, products:child_product_id(name, unit)')
              .eq('parent_product_id', p.id);
            
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              price: Number(p.price),
              image_url: p.image_url,
              items: items?.map((i: any) => {
                const qty = Number(i.quantity);
                const unit = i.products?.unit === 'kg' ? 'kg' : 'x';
                return `${qty}${unit} ${i.products?.name}`;
              }).filter(Boolean) || []
            };
          })
        );

        setCombos(combosWithItems);
      } catch (err) {
        console.error('Error fetching combos:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRealCombos();
  }, []);

  if (!loading && combos.length === 0) return null;

  return (
    <section className="py-24 bg-ink-800 border-t border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-6"
            >
              <Timer className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider">Ofertas da Semana</span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white"
            >
              Combos <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Especiais</span>
            </motion.h2>
          </div>
          
          <motion.p 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-gray-400 max-w-sm md:text-right"
          >
            Aproveite nossos combos com preços exclusivos. Quantidades limitadas!
          </motion.p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gold-500" />
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.2
                }
              }
            }}
            className="grid md:grid-cols-2 gap-8"
          >
            <AnimatePresence>
              {combos.map((combo) => (
                <motion.div
                  key={combo.id}
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className="group flex flex-col sm:flex-row bg-ink-900/80 backdrop-blur-md rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-gold-500/40 transition-all duration-500 hover:shadow-[0_20px_40px_rgba(207,161,74,0.2)]"
                >
                  <div className="sm:w-2/5 h-64 sm:h-auto relative overflow-hidden">
                    <div className="absolute inset-0 bg-white flex items-center justify-center">
                      <img 
                        src={getOptimizedImageUrl(combo.image_url)} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-60 select-none pointer-events-none" 
                      />
                      <img 
                        src={getOptimizedImageUrl(combo.image_url)} 
                        alt={combo.name} 
                        className="relative w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 z-10"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent sm:hidden" />
                  </div>
                  
                  <div className="p-8 sm:w-3/5 flex flex-col justify-between relative z-10 -mt-16 sm:mt-0 bg-ink-900 sm:bg-transparent rounded-t-3xl sm:rounded-none">
                    <div>
                      <h3 className="text-2xl font-bold font-display mb-4 text-white uppercase tracking-tight">{combo.name}</h3>
                      <p className="text-gray-500 text-xs mb-6 line-clamp-2 italic">{combo.description}</p>
                      <ul className="space-y-2 mb-6">
                        {combo.items?.map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-gold-500 shadow-[0_0_8px_rgba(154,128,80,0.5)]" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <div className="flex items-end gap-3 mb-6">
                        <span className="text-3xl font-bold text-gold-500 font-display">
                          R$ {combo.price.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-xs text-gray-600 font-medium mb-1">Pagamento Único</span>
                      </div>
                      
                      <button
                        onClick={() => addToCart({
                          id: combo.id,
                          name: combo.name,
                          price: combo.price,
                          image: combo.image_url,
                          quantity: 1,
                          unit: 'un'
                        })}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-gold-500 hover:text-ink-900 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 border border-white/10 hover:border-transparent hover:scale-[1.02] active:scale-95 shadow-xl"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        Comprar Agora
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
}
