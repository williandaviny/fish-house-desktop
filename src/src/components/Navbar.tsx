import { Menu, X, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, setIsCartOpen } = useCart();
  const location = useLocation();
  const { settings } = useSettings();
  
  const whatsappNumber = settings?.whatsapp || '4730114981';
  const whatsappUrl = `https://wa.me/55${whatsappNumber.replace(/\D/g, '')}`;

  const cartItemCount = items.reduce((total, item) => total + item.quantity, 0);

  const links = [
    { name: 'Início', href: '/#home' },
    { name: 'Diferenciais', href: '/#features' },
    { name: 'Catálogo', href: '/catalogo' },
    { name: 'Dicas', href: '/#blog' },
    { name: 'Sobre', href: '/#about' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink-900/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Fish House Logo" className="h-16 w-auto object-contain" />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {links.map((link) => {
              const isHashLink = link.href.includes('#');
              return isHashLink ? (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-gray-300 hover:text-gold-500 transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${location.pathname === link.href ? 'text-gold-500' : 'text-gray-300 hover:text-gold-500'
                    }`}
                >
                  {link.name}
                </Link>
              );
            })}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-gray-300 hover:text-gold-500 transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 bg-gold-500 text-ink-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
            <Link
              to="/catalogo"
              className="bg-gold-500 hover:bg-gold-400 text-ink-900 px-6 py-2.5 rounded-full font-semibold text-sm transition-all shadow-[0_0_15px_rgba(207,161,74,0.3)] hover:shadow-[0_0_25px_rgba(207,161,74,0.5)]"
            >
              Pedir Agora
            </Link>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-gray-300 hover:text-gold-500 transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 bg-gold-500 text-ink-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white p-2 ml-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-ink-800 border-b border-white/5 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {links.map((link) => {
                const isHashLink = link.href.includes('#');
                return isHashLink ? (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-4 text-base font-medium text-gray-300 hover:text-gold-500 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-4 text-base font-medium rounded-lg transition-colors ${location.pathname === link.href ? 'text-gold-500 bg-white/5' : 'text-gray-300 hover:text-gold-500 hover:bg-white/5'
                      }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
              <Link
                to="/catalogo"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center mt-4 bg-gold-500 text-ink-900 px-6 py-3 rounded-xl font-semibold text-base"
              >
                Fazer Pedido
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
