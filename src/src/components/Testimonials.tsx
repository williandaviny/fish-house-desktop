import { motion } from 'motion/react';
import { Star, Instagram } from 'lucide-react';

const testimonials = [
  {
    name: 'Carlos Silva',
    text: 'Melhor peixaria de Navegantes! O salmão estava fresquíssimo e o atendimento via WhatsApp foi super rápido.',
    rating: 5,
  },
  {
    name: 'Mariana Costa',
    text: 'Comprei o kit paella e foi um sucesso no almoço de domingo. Produtos limpos e de altíssima qualidade.',
    rating: 5,
  },
  {
    name: 'Roberto Almeida',
    text: 'Ambiente impecável e variedade incrível. Virou minha peixaria de confiança na região.',
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-ink-900 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 tracking-tight"
          >
            Quem Compra, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Recomenda.</span>
          </motion.h2>
        </div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.15
              }
            }
          }}
          className="grid md:grid-cols-3 gap-8 mb-16"
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 }
              }}
              className="bg-ink-800/50 backdrop-blur-sm p-10 rounded-3xl border border-white/5 hover:border-gold-500/20 transition-all duration-500 shadow-xl hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(207,161,74,0.1)]"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-gold-500 text-gold-500" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 italic">"{t.text}"</p>
              <p className="font-bold text-white font-display">{t.name}</p>
              <p className="text-xs text-gray-500">Avaliação do Google</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gold-500 hover:text-gold-400 font-semibold transition-all hover:scale-105 active:scale-95"
          >
            <Instagram className="w-5 h-5" />
            Ver mais no Instagram
          </a>
        </motion.div>

      </div>
    </section>
  );
}
