import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { supabase } from './lib/supabase';
import Home from './pages/Home';
import CatalogPage from './pages/CatalogPage';
import BlogPost from './pages/BlogPost';
import Checkout from './pages/Checkout';
import AdminOrders from './pages/AdminOrders';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminProducts from './pages/AdminProducts';
import AdminCustomers from './pages/AdminCustomers';
import AdminSettings from './pages/AdminSettings';
import AdminDatabaseCleanup from './pages/AdminDatabaseCleanup';
import PDV from './pages/PDV';
import AdminInventory from './pages/AdminInventory';
import AdminPurchases from './pages/AdminPurchases';
import AdminIndustrialization from './pages/AdminIndustrialization';
import AdminFinancial from './pages/AdminFinancial';
import AdminLayout from './components/AdminLayout';
import PublicLayout from './components/PublicLayout';
import TrackingManager from './components/TrackingManager';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import CustomerLogin from './pages/CustomerLogin';
import CustomerDashboard from './pages/CustomerDashboard';
import WholesaleCatalogPage from './pages/WholesaleCatalogPage';
import WholesaleCheckout from './pages/WholesaleCheckout';

// Deteccao confiavel de runtime Desktop (Tauri / Localhost)
const isDesktop = typeof window !== 'undefined' && (
  '__TAURI_INTERNALS__' in window ||
  '__TAURI__' in window ||
  window.location.protocol === 'tauri:' ||
  window.location.protocol === 'asset:' ||
  window.location.protocol === 'file:' ||
  window.location.hostname === 'tauri.localhost'
);

const Router = isDesktop ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <TrackingManager />
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Public Routes - Wrapped in PublicLayout */}
            <Route 
              path="/" 
              element={
                isDesktop 
                  ? <Navigate to="/admin" replace /> 
                  : <PublicLayout><Home /></PublicLayout>
              } 
            />
            <Route path="/catalogo" element={<PublicLayout><CatalogPage /></PublicLayout>} />
            <Route path="/checkout" element={<PublicLayout><Checkout /></PublicLayout>} />
            <Route path="/atacado" element={<PublicLayout><WholesaleCatalogPage /></PublicLayout>} />
            <Route path="/atacado/checkout" element={<PublicLayout><WholesaleCheckout /></PublicLayout>} />
            <Route path="/blog" element={<PublicLayout><Home /></PublicLayout>} />
            <Route path="/blog/:slug" element={<PublicLayout><BlogPost /></PublicLayout>} />
            
            {/* Customer Auth Routes */}
            <Route path="/meus-pedidos" element={<PublicLayout><CustomerDashboard /></PublicLayout>} />
            <Route path="/verificar" element={<PublicLayout><CustomerLogin /></PublicLayout>} />

            {/* Admin Routes - Nested architecture for instant tab switching */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="pdv" element={<PDV />} />
              <Route path="estoque" element={<AdminInventory />} />
              <Route path="industrializacao" element={<AdminIndustrialization />} />
              <Route path="compras" element={<AdminPurchases />} />
              <Route path="financeiro" element={<AdminFinancial />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="produtos" element={<AdminProducts />} />
              <Route path="clientes" element={<AdminCustomers />} />
              <Route path="config" element={<AdminSettings />} />
              <Route path="cleanup" element={<AdminDatabaseCleanup />} />
            </Route>
          </Routes>
        </Router>
      </CustomerAuthProvider>
    </CartProvider>
  );
}
