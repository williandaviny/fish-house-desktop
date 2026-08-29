import { ShoppingBag, Instagram, Facebook, MapPin, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export default function Footer() {
  return (
    <footer className="bg-ink-900 border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12"
        >

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            className="col-span-1 md:col-span-2"
          >
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="Fish House Logo" className="h-14 w-auto object-contain" />
            </div>
            <p className="text-gray-400 mb-6 max-w-sm">
              Peixes e frutos do mar premium, direto do mar para a sua mesa em Navegantes/SC.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/fishhousepeixaria"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-gold-500 hover:text-ink-900 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <h4 className="text-white font-bold mb-6 font-display">Contato</h4>
            <ul className="space-y-4 text-gray-400">
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gold-500" />
                (47) 3011-4981
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gold-500 shrink-0 mt-1" />
                <span>Pref. Juvenal Mafra, 42<br />Centro, Navegantes - SC</span>
              </li>
            </ul>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <h4 className="text-white font-bold mb-6 font-display">Horário</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Seg a Sex: Das 8h às 20h</li>
              <li>Sábado: Das 8h às 20h</li>
              <li>Domingo: Das 9h às 14h</li>
            </ul>
          </motion.div>

        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500"
        >
          <p>&copy; {new Date().getFullYear()} Fish House. Todos os direitos reservados.</p>
          <p>Desenvolvido com excelência.</p>
        </motion.div>
      </div>
    </footer>
  );
}
