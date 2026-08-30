import { motion } from 'motion/react';
import { MapPin, MessageCircle, ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center pt-40 pb-20 overflow-hidden">
      {/* Background Texture/Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(207,161,74,0.15)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, staggerChildren: 0.2 }}
            className="text-left"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6"
            >
              <MapPin className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-medium text-gray-300">Pref. Juvenal Mafra, 42 – Centro, Navegantes</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold leading-[1.1] mb-6 tracking-tight"
            >
              Peixes e Frutos do Mar <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                Direto do Mar
              </span><br/>
              Para Sua Mesa.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-400 mb-8 max-w-xl leading-relaxed"
            >
              Frescos, selecionados e prontos para transformar sua refeição em uma experiência inesquecível. Na Fish House você encontra qualidade, procedência e atendimento rápido.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a 
                href="#catalog"
                className="inline-flex items-center justify-center gap-2 bg-white text-ink-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all hover:scale-105 active:scale-95"
              >
                Ver Catálogo Agora
                <ArrowRight className="w-5 h-5" />
              </a>
              <a 
                href="https://wa.me/554730114981"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-gold-500 text-ink-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gold-400 transition-all shadow-[0_0_20px_rgba(207,161,74,0.4)] hover:shadow-[0_0_30px_rgba(207,161,74,0.6)] hover:scale-105 active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
                Pedir no WhatsApp
              </a>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-10 flex items-center gap-4 text-sm text-gray-500"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <img 
                    key={i}
                    src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                    alt="Customer" 
                    className="w-8 h-8 rounded-full border-2 border-ink-900"
                  />
                ))}
              </div>
              <p>Mais de <strong className="text-white">2.000</strong> clientes satisfeitos</p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              {/* Decorative circle */}
              <div className="absolute inset-0 rounded-full border border-gold-500/20 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-4 rounded-full border border-gold-500/10 animate-[spin_15s_linear_infinite_reverse]" />
              
              {/* Main Image */}
              <div className="absolute inset-8 rounded-full overflow-hidden border-4 border-ink-800 shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?q=80&w=1000&auto=format&fit=crop" 
                  alt="Prato premium com frutos do mar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Floating Badge */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 -right-4 bg-ink-800 border border-white/10 p-4 rounded-2xl shadow-xl backdrop-blur-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center">
                    <span className="text-2xl">🐟</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Frescor Diário</p>
                    <p className="text-xs text-gray-400">Direto do barco</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
