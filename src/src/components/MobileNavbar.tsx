import { Home, ShoppingBag, ShoppingCart, MessageCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useSettings } from '../hooks/useSettings';
import { motion } from 'motion/react';

export default function MobileNavbar() {
  const location = useLocation();
  const { items, setIsCartOpen } = useCart();
  const { settings } = useSettings();
  
  const cartItemCount = items.reduce((total, item) => total + item.quantity, 0);
  const whatsappNumber = settings?.whatsapp || '4730114981';
  const whatsappUrl = `https://wa.me/55${whatsappNumber.replace(/\D/g, '')}`;

  const navLinks = [
    { name: 'Início', icon: Home, path: '/', isExternal: false },
    { name: 'Catálogo', icon: ShoppingBag, path: '/catalogo', isExternal: false },
    { name: 'Suporte', icon: MessageCircle, path: whatsappUrl, isExternal: true },
    { name: 'Minha Conta', icon: User, path: '/meus-pedidos', isExternal: false },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-ink-900/80 backdrop-blur-lg border-t border-white/5 pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;

          if (link.isExternal) {
            return (
              <a
                key={link.name}
                href={link.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 w-full text-gray-400"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{link.name}</span>
              </a>
            );
          }

          return (
            <Link
              key={link.name}
              to={link.path}
              className={`flex flex-col items-center justify-center gap-1 w-full transition-colors ${
                isActive ? 'text-gold-500' : 'text-gray-400'
              }`}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative"
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              <span className="text-[10px] font-medium">{link.name}</span>
            </Link>
          );
        })}

        {/* Carrinho Especial */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center gap-1 w-full text-gray-400 relative"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-gold-500 text-ink-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
              >
                {cartItemCount}
              </motion.span>
            )}
          </div>
          <span className="text-[10px] font-medium">Carrinho</span>
        </button>
      </div>
    </nav>
  );
}
