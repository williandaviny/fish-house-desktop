import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

export default function About() {
  return (
    <section id="about" className="py-24 bg-gradient-to-b from-ink-900 to-ink-800 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gold-500/10 rounded-3xl transform -rotate-3" />
            <img 
              src="/faixada peixaria.png" 
              alt="Fachada da peixaria" 
              className="relative rounded-2xl shadow-2xl object-cover aspect-[4/3] w-full"
              referrerPolicy="no-referrer"
            />
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-8 -right-8 bg-ink-900/90 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl max-w-[220px]"
            >
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600 font-display font-bold text-2xl mb-2 leading-tight">Frescor Garantido</p>
              <p className="text-xs text-gray-300 font-medium uppercase tracking-wider">Seleção diária de produtos</p>
            </motion.div>
          </motion.div>

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
          >
            <motion.div 
              variants={{
                hidden: { opacity: 0, x: 30 },
                visible: { opacity: 1, x: 0 }
              }}
              className="mb-6"
            >
              <p className="text-gold-500 font-semibold tracking-wider uppercase text-sm mb-3">Uma nova proposta de peixaria em Navegantes</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight tracking-tight">
                Moderna, Organizada e <br className="hidden lg:block" />
                Pensada Para Quem <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Valoriza Qualidade.</span>
              </h2>
            </motion.div>
            
            <motion.div 
              variants={{
                hidden: { opacity: 0, x: 30 },
                visible: { opacity: 1, x: 0 }
              }}
              className="space-y-6 text-gray-400 text-lg leading-relaxed mb-8"
            >
              <p>
                Inaugurada em dezembro de 2025, a Fish House nasce com um propósito claro: elevar o padrão das peixarias da região.
              </p>
              <p>
                Mais do que vender peixe, entregamos frescor, organização e atendimento ágil — tudo em um ambiente moderno e preparado para oferecer a melhor experiência ao cliente.
              </p>
              <p>
                Cada produto é selecionado com rigor, garantindo qualidade do mar direto para sua mesa. Localizada no Centro de Navegantes, atendemos clientes que buscam sabor, confiança e praticidade no dia a dia.
              </p>
            </motion.div>

            <motion.a 
              variants={{
                hidden: { opacity: 0, x: 30 },
                visible: { opacity: 1, x: 0 }
              }}
              href="https://maps.google.com/?q=Centro+Navegantes+SC"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-full font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <MapPin className="w-5 h-5 text-gold-500" />
              Como Chegar
            </motion.a>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
