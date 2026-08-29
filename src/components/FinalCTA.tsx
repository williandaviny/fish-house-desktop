import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FinalCTA() {
  return (
    <section className="py-32 bg-ink-900 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(207,161,74,0.1)_0%,transparent_50%)] pointer-events-none" />
      
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
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
      >
        <motion.h2 
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0 }
          }}
          className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight tracking-tight"
        >
          Vai Preparar Algo <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Especial Hoje?</span>
        </motion.h2>
        
        <motion.p 
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0 }
          }}
          className="text-xl text-gray-400 mb-12"
        >
          Garanta ingredientes frescos agora mesmo e transforme sua refeição.
        </motion.p>
        
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.9, y: 30 },
            visible: { opacity: 1, scale: 1, y: 0 }
          }}
        >
          <Link 
            to="/catalogo"
            className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-gold-400 to-gold-600 text-ink-900 px-12 py-6 rounded-full font-bold text-xl hover:from-gold-300 hover:to-gold-500 transition-all shadow-[0_0_40px_rgba(207,161,74,0.4)] hover:shadow-[0_0_60px_rgba(207,161,74,0.6)] hover:scale-105 active:scale-95"
          >
            <ShoppingBag className="w-7 h-7" />
            Fazer Pedido Agora
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
