import { motion } from 'motion/react';
import { Anchor, ShieldCheck, Clock, Fish } from 'lucide-react';

const features = [
  {
    icon: Anchor,
    title: 'Frescor Garantido',
    description: 'Produtos selecionados diariamente direto dos pescadores locais.',
  },
  {
    icon: ShieldCheck,
    title: 'Procedência e Confiança',
    description: 'Compra segura, origem controlada e alto padrão de higiene.',
  },
  {
    icon: Clock,
    title: 'Atendimento Rápido',
    description: 'Peça pelo WhatsApp em minutos e retire na loja ou receba em casa.',
  },
  {
    icon: Fish,
    title: 'Variedade Completa',
    description: 'Peixes, camarões, frutos do mar e opções congeladas premium.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-ink-900 relative border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 tracking-tight"
          >
            Qualidade que Você <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Sente no Sabor.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-400"
          >
            Mais que uma peixaria. Uma curadoria de frescor para transformar seus momentos à mesa.
          </motion.p>
        </div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className="group relative bg-ink-800/50 backdrop-blur-sm border border-white/5 hover:border-gold-500/30 rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(207,161,74,0.1)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-ink-900 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-gradient-to-br group-hover:from-gold-400 group-hover:to-gold-600 group-hover:border-transparent transition-all duration-500 shadow-lg">
                  <feature.icon className="w-6 h-6 text-gold-500 group-hover:text-ink-900 transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 font-display group-hover:text-gold-400 transition-colors">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed text-base">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-16 text-center"
        >
          <a 
            href="#catalog"
            className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-gold-500 text-gold-500 font-semibold hover:bg-gold-500 hover:text-ink-900 transition-all hover:scale-105 active:scale-95"
          >
            Quero Ver os Produtos
          </a>
        </motion.div>

      </div>
    </section>
  );
}
