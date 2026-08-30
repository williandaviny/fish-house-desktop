import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import Cart from './Cart';
import FloatingWhatsApp from './FloatingWhatsApp';
import MobileNavbar from './MobileNavbar';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-ink-900 text-white selection:bg-gold-500 selection:text-ink-900">
      <Navbar />
      <Cart />
      <main className="pb-16 md:pb-0">
        {children}
      </main>
      <Footer />
      <FloatingWhatsApp />
      <MobileNavbar />
    </div>
  );
}
