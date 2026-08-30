import React, { useState, useEffect, useRef } from 'react';
import { 
  Calculator, 
  Search, 
  Trash2, 
  CreditCard, 
  QrCode, 
  DollarSign, 
  Printer, 
  Clock, 
  User, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCcw, 
  AlertCircle, 
  Check, 
  X,
  Play,
  Square,
  Percent,
  Plus,
  Package,
  Barcode,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { motion, AnimatePresence } from 'motion/react';
import { getOptimizedImageUrl } from '../utils/image';
import { tefService } from '../services/tef/TefService';
import { TefConfig } from '../services/tef/types';
import { localDb } from '../services/local/localDb';
import { syncEngine } from '../services/local/syncEngine';
import { downloadFiscalDocumentBlob, triggerPrintAndDownload } from '../services/fiscal/fiscalService';

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string;
  is_available: boolean;
  stock: number;
  unit: string;
  barcode?: string;
  codigo_interno?: string;
  plu_codigo?: string;
};

type CartItem = {
  product: Product;
  quantity: number;
  price_unit: number;
  subtotal: number;
};

type PaymentMethod = {
  id: string;
  nome: string;
  tipo: string;
  recebimento_imediato: boolean;
  taxa: number;
};

type Caixa = {
  id: string;
  status: 'aberto' | 'fechado';
  saldo_inicial: number;
  data_abertura: string;
};

type Customer = {
  id: string;
  name: string;
  telefone: string;
};

export default function PDV() {
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [loadingCaixa, setLoadingCaixa] = useState(true);
  const [openingBalance, setOpeningBalance] = useState<string>('100.00');
  const [closingBalance, setClosingBalance] = useState<string>('0.00');
  const [isOpeningCaixa, setIsOpeningCaixa] = useState(false);
  const [isClosingCaixa, setIsClosingCaixa] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductForWeight, setSelectedProductForWeight] = useState<Product | null>(null);
  const [manualWeight, setManualWeight] = useState<string>('1.000');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [surchargeAmount, setSurchargeAmount] = useState<number>(0);
  
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [activeLocation, setActiveLocation] = useState<any>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [saleNotes, setSaleNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const { settings } = useSettings();
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastCharTime, setLastCharTime] = useState(0);
  const [manualBarcode, setManualBarcode] = useState('');

  // TEF Integration States
  const [tefConfig, setTefConfig] = useState<TefConfig>(tefService.getConfig());
  const [isTefModalOpen, setIsTefModalOpen] = useState(false);
  const [tefStatusMessage, setTefStatusMessage] = useState('');
  const [isTefAdminModalOpen, setIsTefAdminModalOpen] = useState(false);
  const [tefAdminTab, setTefAdminTab] = useState<'admin' | 'config'>('admin');
  const [tefReprintNsu, setTefReprintNsu] = useState('');
  const [tefCancelNsu, setTefCancelNsu] = useState('');
  const [tefCancelAmount, setTefCancelAmount] = useState('');
  const [tefInstallments, setTefInstallments] = useState(1);
  const [tefResponse, setTefResponse] = useState<any | null>(null);
  const [bypassTef, setBypassTef] = useState(false);

  useEffect(() => {
    checkCaixaStatus();
    fetchPaymentMethods();
    fetchCompanyAndLocation();
  }, []);

  useEffect(() => {
    // Barcode scanner logic
    const handleGlobalScan = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return; // Don't intercept if user is typing in inputs

      const currentTime = Date.now();
      if (currentTime - lastCharTime > 100) {
        setBarcodeBuffer(e.key.length === 1 ? e.key : '');
      } else {
        if (e.key === 'Enter') {
          if (barcodeBuffer.length > 3) {
            handleBarcodeScanned(barcodeBuffer);
          }
          setBarcodeBuffer('');
        } else if (e.key.length === 1) {
          setBarcodeBuffer(prev => prev + e.key);
        }
      }
      setLastCharTime(currentTime);
    };

    window.addEventListener('keydown', handleGlobalScan);
    return () => window.removeEventListener('keydown', handleGlobalScan);
  }, [barcodeBuffer, lastCharTime, products, caixa]);

  const handleBarcodeScanned = (code: string) => {
    if (!caixa) return;

    // Toledo Prix 4 Uno barcode parsing (EAN-13 starting with 2)
    if (code.length === 13 && code.startsWith('2')) {
      const plu6 = code.substring(1, 7); // e.g. "000657"
      const plu5 = code.substring(1, 6); // e.g. "00065"

      const valCents6 = Number(code.substring(7, 12)); // e.g. "02071"
      const valCents5 = Number(code.substring(6, 11)); // e.g. "70207"

      // 1. Try 6-digit PLU
      let prod = products.find(p => 
        (p.plu_codigo && (p.plu_codigo === plu6 || Number(p.plu_codigo) === Number(plu6))) ||
        (p.codigo_interno && (p.codigo_interno === plu6 || Number(p.codigo_interno) === Number(plu6))) ||
        (p.barcode && p.barcode.substring(1, 7) === plu6)
      );
      let valCents = valCents6;
      let used6 = true;

      // 2. Try 5-digit PLU
      if (!prod) {
        prod = products.find(p => 
          (p.plu_codigo && (p.plu_codigo === plu5 || Number(p.plu_codigo) === Number(plu5))) ||
          (p.codigo_interno && (p.codigo_interno === plu5 || Number(p.codigo_interno) === Number(plu5))) ||
          (p.barcode && p.barcode.substring(1, 6) === plu5) ||
          (p.barcode && p.barcode.substring(0, 6) === code.substring(0, 6)) ||
          (p.id.replace(/\D/g, '').substring(0, 5) === plu5)
        );
        valCents = valCents5;
        used6 = false;
      }

      if (prod) {
        const barcodeType = localStorage.getItem('scale_barcode_type') || 'price';
        let weight = 0;

        if (barcodeType === 'price') {
          const totalVal = valCents / 100;
          weight = Number((totalVal / prod.price).toFixed(3));
        } else {
          weight = Number((valCents / 1000).toFixed(3));
        }

        if (weight > 0) {
          if (prod.unit === 'kg') {
            addToCart(prod, weight);
          } else {
            addToCart(prod, 1);
          }
        }
        return;
      }
    }

    // Standard barcode matching
    const prod = products.find(p => p.barcode === code || p.codigo_interno === code || p.plu_codigo === code);
    if (prod) {
      handleProductSelected(prod);
    }
  };

  const fetchCompanyAndLocation = async () => {
    // Fetch default company
    const { data: companies } = await supabase.from('empresas').select('*').limit(1);
    if (companies && companies.length > 0) {
      setActiveCompany(companies[0]);
      
      // Fetch loja location
      const { data: locations } = await supabase
        .from('locais_estoque')
        .select('*')
        .eq('empresa_id', companies[0].id)
        .eq('tipo', 'loja')
        .limit(1);
        
      if (locations && locations.length > 0) {
        setActiveLocation(locations[0]);
      }
    }
  };

  const checkCaixaStatus = async () => {
    setLoadingCaixa(true);
    const { data, error } = await supabase
      .from('caixas')
      .select('*')
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      setCaixa(data[0] as Caixa);
      fetchProducts();
      fetchCustomers();
    } else {
      setCaixa(null);
    }
    setLoadingCaixa(false);
  };

  const fetchPaymentMethods = async () => {
    const local = localDb.getPaymentMethods();
    if (local && local.length > 0) {
      setPaymentMethods(local);
      const defaultPm = local.find(p => p.tipo === 'dinheiro') || local[0];
      setSelectedPaymentMethod(defaultPm);
    } else {
      const { data } = await supabase.from('formas_pagamento').select('*').order('nome');
      if (data) {
        localDb.setPaymentMethods(data);
        setPaymentMethods(data);
        const defaultPm = data.find(p => p.tipo === 'dinheiro') || data[0];
        setSelectedPaymentMethod(defaultPm);
      }
    }
  };

  const fetchProducts = async () => {
    const local = localDb.getProducts();
    if (local && local.length > 0) {
      setProducts(local as any);
      setFilteredProducts(local as any);
    } else {
      // Primeira instalacao: baixa catalogo completo da nuvem
      const res = await syncEngine.downloadInitialCatalog();
      if (res.success) {
        const fresh = localDb.getProducts();
        setProducts(fresh as any);
        setFilteredProducts(fresh as any);
      }
    }
  };

  const fetchCustomers = async () => {
    const local = localDb.getCustomers();
    if (local && local.length > 0) {
      setCustomers(local as any);
    } else {
      const { data } = await supabase.from('customers').select('id, name, telefone, cnpj_cpf, email').order('name');
      if (data) {
        localDb.setCustomers(data);
        setCustomers(data as any);
      }
    }
  };

  const handleOpenCaixa = async () => {
    if (!activeCompany) return;
    setIsOpeningCaixa(true);
    
    // Get logged-in user
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('caixas')
      .insert([{
        empresa_id: activeCompany.id,
        operador_abertura_id: user?.id,
        saldo_inicial: Number(openingBalance),
        status: 'aberto'
      }])
      .select()
      .single();

    if (!error && data) {
      setCaixa(data as Caixa);
      fetchProducts();
      fetchCustomers();
    } else {
      alert('Erro ao abrir caixa: ' + (error?.message || 'Verifique suas permissões'));
    }
    setIsOpeningCaixa(false);
  };

  const handleCloseCaixa = async () => {
    if (!caixa) return;
    setIsClosingCaixa(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('caixas')
      .update({
        saldo_final: Number(closingBalance),
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        operador_fechamento_id: user?.id
      })
      .eq('id', caixa.id);

    if (!error) {
      setCaixa(null);
      setCart([]);
      setSelectedCustomer(null);
      alert('Caixa fechado com sucesso!');
    } else {
      alert('Erro ao fechar caixa: ' + error.message);
    }
    setIsClosingCaixa(false);
  };

  const handleProductSelected = (product: Product) => {
    if (product.unit === 'kg') {
      setSelectedProductForWeight(product);
      setManualWeight('1.000');
    } else {
      addToCart(product, 1);
    }
  };

  const addToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        return prev.map(item => item.product.id === product.id ? {
          ...item,
          quantity: newQty,
          subtotal: Number((newQty * product.price).toFixed(2))
        } : item);
      } else {
        return [...prev, {
          product,
          quantity,
          price_unit: product.price,
          subtotal: Number((quantity * product.price).toFixed(2))
        }];
      }
    });
  };

  const handleWeightSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductForWeight) {
      const weight = Number(manualWeight);
      if (weight > 0) {
        addToCart(selectedProductForWeight, weight);
        setSelectedProductForWeight(null);
      }
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartItemQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    const formattedQty = Number(qty.toFixed(3));
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity: formattedQty,
          subtotal: Number((formattedQty * item.product.price).toFixed(2))
        };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName) return;

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        name: newCustomerName,
        telefone: newCustomerPhone
      }])
      .select()
      .single();

    if (!error && data) {
      setCustomers(prev => [...prev, data]);
      setSelectedCustomer(data);
      setIsCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } else {
      alert('Erro ao cadastrar cliente: ' + error.message);
    }
  };

  // Search filter
  useEffect(() => {
    const normalize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
    const cleanSearch = normalize(searchTerm);
    let result = products;
    if (cleanSearch) {
      result = result.filter(p => 
        normalize(p.name).includes(cleanSearch) || 
        p.barcode?.includes(cleanSearch)
      );
    }
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }
    setFilteredProducts(result);
  }, [searchTerm, selectedCategory, products]);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
  const finalTotal = Math.max(0, Number((subtotal - discountAmount + surchargeAmount).toFixed(2)));
  const changeAmount = receivedAmount ? Math.max(0, Number((Number(receivedAmount) - finalTotal).toFixed(2))) : 0;

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !caixa || !activeCompany || !activeLocation || !selectedPaymentMethod) return;

    let currentTefRes = null;

    if (
      tefConfig.enabled && 
      !bypassTef &&
      (selectedPaymentMethod.tipo === 'credito' || selectedPaymentMethod.tipo === 'debito' || selectedPaymentMethod.tipo === 'pix')
    ) {
      try {
        setIsTefModalOpen(true);
        tefService.onMessage((msg) => setTefStatusMessage(msg));
        const cardType = selectedPaymentMethod.tipo === 'credito' ? 'credito' : (selectedPaymentMethod.tipo === 'pix' ? 'pix' : 'debito');
        const res = await tefService.processPayment(
          finalTotal,
          cardType,
          {
            installments: cardType === 'credito' ? tefInstallments : 1
          }
        );

        setIsTefModalOpen(false);

        if (!res.success) {
          alert('Transação TEF recusada: ' + res.message);
          return;
        }

        currentTefRes = res;
        setTefResponse(res);
      } catch (err: any) {
        setIsTefModalOpen(false);
        alert('Erro no processamento TEF: ' + err.message);
        return;
      }
    }

    try {
      const dbItens = cart.map(item => ({
        produto_id: item.product.id,
        quantity: item.quantity,
        price_unit: item.price_unit,
        subtotal: item.subtotal,
        local_saida_id: activeLocation.id
      }));

      const dbPayments = [{
        forma_pagamento_id: selectedPaymentMethod.id,
        valor: finalTotal,
        parcelas: selectedPaymentMethod.tipo === 'credito' ? tefInstallments : 1,
        status_recebimento: selectedPaymentMethod.recebimento_imediato ? 'recebido' : 'pendente',
        data_prevista: new Date().toISOString().split('T')[0]
      }];

      const { data, error } = await supabase.rpc('registrar_venda_pdv', {
        p_caixa_id: caixa.id,
        p_empresa_id: activeCompany.id,
        p_cliente_id: selectedCustomer?.id || null,
        p_valor_total: subtotal,
        p_desconto: discountAmount,
        p_acrescimo: surchargeAmount,
        p_valor_final: finalTotal,
        p_itens: dbItens,
        p_pagamentos: dbPayments,
        p_observacoes: saleNotes || null
      });

      if (error) {
        // Recovery notice if TEF was charged but DB register failed
        if (currentTefRes) {
          alert(
            `⚠️ ATENÇÃO: O cartão foi cobrado no TEF com sucesso (NSU: ${currentTefRes.nsu}), mas ocorreu um erro ao registrar a venda no sistema: "${error.message}". NÃO COBRE O CARTÃO NOVAMENTE! Anote o NSU e chame o suporte para conciliação.`
          );
        }
        throw error;
      }

      // If TEF transaction was processed, save metadata in database
      if (currentTefRes) {
        const { error: tefSaveError } = await supabase
          .from('tef_transacoes')
          .insert([{
            venda_id: data,
            nsu: currentTefRes.nsu,
            autorizacao: currentTefRes.autorizacao,
            rede: currentTefRes.rede,
            bandeira: currentTefRes.bandeira,
            valor: finalTotal,
            tipo: selectedPaymentMethod.tipo,
            parcelas: selectedPaymentMethod.tipo === 'credito' ? tefInstallments : 1,
            comprovante_cliente: currentTefRes.comprovante_cliente,
            comprovante_estabelecimento: currentTefRes.comprovante_estabelecimento,
            status: 'aprovado'
          }]);
        if (tefSaveError) {
          console.error('Erro ao salvar metadados do TEF no banco:', tefSaveError);
        }
      }

      setLastSaleId(data);
      
      // Salva no banco local e abate estoque imediatamente
      try {
        localDb.saveOrderLocally(
          {
            id: data,
            caixa_id: caixa.id,
            empresa_id: activeCompany.id,
            cliente_id: selectedCustomer?.id || null,
            total_amount: finalTotal,
            subtotal: subtotal,
            desconto: discountAmount,
            acrescimo: surchargeAmount,
            status: 'concluido',
            forma_pagamento: selectedPaymentMethod.nome,
            created_at: new Date().toISOString()
          },
          cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price_unit: item.price_unit,
            subtotal: item.subtotal
          }))
        );
      } catch (e) {
        console.error('[PDV] Erro ao gravar localmente:', e);
      }

      setIsSuccessModalOpen(true);
      
      // Auto emit & print NFC-e
      handleEmitAndPrintNfce(data);

      // Reset state for next sale
      setCart([]);
      setSelectedCustomer(null);
      setDiscountPercent(0);
      setSurchargeAmount(0);
      setReceivedAmount('');
      setSaleNotes('');
      
      // Update local product stocks
      fetchProducts();
    } catch (err: any) {
      alert('Erro ao finalizar venda: ' + err.message);
    }
  };

  const [isEmittingNfce, setIsEmittingNfce] = useState(false);

  const handleEmitAndPrintNfce = async (saleId: string) => {
    setIsEmittingNfce(true);
    try {
      // 1. Ensure any invalid/null NCMs in products table are updated to active 03028990
      try {
        await supabase.from('products').update({ ncm: '03028990' }).or('ncm.eq.03029990,ncm.is.null');
      } catch (_) {}

      // 2. Invoke Edge Function to issue NFC-e
      const { data, error } = await supabase.functions.invoke('nfe-io-invoice', {
        body: {
          referencia_tipo: 'venda',
          referencia_id: saleId,
          tipo_documento: 'nfce'
        }
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || data.message || 'Erro ao emitir NFC-e na SEFAZ');
      }

      const invoiceId = data.doc?.id || data.doc?.flowId;

      // 3. Supabase Realtime: reage instantaneamente quando a SEFAZ autoriza
      const docData: any = await new Promise((resolve) => {
        const channel = supabase
          .channel(`nfce-${saleId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'documentos_fiscais',
              filter: `referencia_id=eq.${saleId}`,
            },
            (payload: any) => {
              const doc = payload.new;
              if (doc && (doc.pdf_url || doc.status === 'emitido' || doc.status === 'rejeitado' || doc.erro_retorno)) {
                supabase.removeChannel(channel);
                resolve(doc);
              }
            }
          )
          .subscribe();

        // Fallback: consulta ativa a cada 800ms (mais rápido)
        let attempts = 0;
        const fallbackInterval = setInterval(async () => {
          attempts++;
          const { data: currentDoc } = await supabase
            .from('documentos_fiscais')
            .select('id, status, pdf_url, erro_retorno, created_at, chave')
            .eq('referencia_id', saleId)
            .eq('referencia_tipo', 'venda')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (currentDoc && (currentDoc.pdf_url || currentDoc.status === 'emitido' || currentDoc.status === 'rejeitado' || currentDoc.erro_retorno)) {
            clearInterval(fallbackInterval);
            supabase.removeChannel(channel);
            resolve(currentDoc);
          } else if (attempts >= 8) {
            clearInterval(fallbackInterval);
            supabase.removeChannel(channel);
            resolve(currentDoc || null);
          }
        }, 800);
      });

      if (docData?.status === 'rejeitado' || docData?.erro_retorno) {
        throw new Error(`REJEIÇÃO SEFAZ: ${docData.erro_retorno || 'Nota rejeitada pela SEFAZ.'}`);
      }

      const targetDocId = docData?.chave || docData?.id || invoiceId;
      if (targetDocId) {
        await resolveAndPrintPdf(targetDocId, saleId);
      } else {
        alert('NFC-e enviada à SEFAZ! O documento está sendo processado e você pode consultá-lo na aba Financeiro ➔ Fiscal.');
      }
    } catch (err: any) {
      alert('⚠️ ' + err.message);
    } finally {
      setIsEmittingNfce(false);
    }
  };

  const resolveAndPrintPdf = async (invoiceIdOrUrl: string, saleId: string) => {
    try {
      const res = await downloadFiscalDocumentBlob(invoiceIdOrUrl, 'pdf', saleId);
      if (res) {
        // Abre o PDF OFICIAL da SEFAZ com diálogo de impressão automático
        triggerPrintAndDownload(res.blobUrl, res.filename, true);
      } else {
        // Se não conseguiu o PDF, imprime o cupom interno como fallback
        await handlePrintReceipt(saleId);
      }
    } catch (err: any) {
      console.error('Erro ao baixar PDF SEFAZ:', err);
      // Fallback: cupom interno
      await handlePrintReceipt(saleId);
    }
  };

  const handlePrintReceipt = async (saleId: string) => {
    // Fetch sale details
    const { data: sale } = await supabase.from('vendas').select('*, customers(name, telefone)').eq('id', saleId).single();
    const { data: items } = await supabase.from('venda_itens').select('*, products(name, unit)').eq('venda_id', saleId);
    const { data: payments } = await supabase.from('pagamentos_venda').select('*, formas_pagamento(nome)').eq('venda_id', saleId);
    
    if (!sale || !items || !payments) return;

    const itemsHtml = items.map(i => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 13px;">
        <span>${i.quantidade}${i.products?.unit} x ${i.products?.name}</span>
        <span>R$ ${Number(i.subtotal).toFixed(2)}</span>
      </div>
    `).join('');

    const paymentsHtml = payments.map(p => `
      <div><strong>FORMA:</strong> ${p.formas_pagamento?.nome}</div>
    `).join('');

    const receiptHtml = `
      <html>
        <head>
          <title>Cupom Não Fiscal - Fish House</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              padding: 15px; 
              width: 80mm; 
              margin: 0 auto; 
              color: black;
            }
            .header { text-align: center; border-bottom: 1px dashed black; padding-bottom: 8px; margin-bottom: 8px; }
            .title { font-size: 18px; font-weight: bold; }
            .info { font-size: 11px; margin-bottom: 5px; }
            .items { border-bottom: 1px dashed black; padding-bottom: 8px; margin-bottom: 8px; }
            .total { font-size: 16px; font-weight: bold; text-align: right; }
            .footer { text-align: center; font-size: 9px; margin-top: 15px; border-top: 1px dashed black; padding-top: 8px; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <div class="title">${activeCompany?.nome_fantasia || 'FISH HOUSE PEIXARIA'}</div>
            <div class="info">CNPJ: ${activeCompany?.cnpj || '50.123.456/0001-89'}</div>
            <div class="info">${activeCompany?.logradouro || 'Rua das Gaivotas, 100'} - ${activeCompany?.cidade || 'Navegantes'}/${activeCompany?.uf || 'SC'}</div>
            <div class="info">Fone: ${activeCompany?.telefone || '(47) 99999-9999'}</div>
            <div style="margin-top: 5px; font-weight: bold;">*** CUPOM NÃO FISCAL ***</div>
            <div style="font-size: 9px;">Venda #${sale.id.slice(0, 8).toUpperCase()} - ${new Date(sale.created_at).toLocaleString('pt-BR')}</div>
          </div>
          
          <div class="info">
            <strong>CLIENTE:</strong> ${sale.customers?.name || 'Consumidor Final'}<br/>
            ${sale.customers?.telefone ? `<strong>FONE:</strong> ${sale.customers.telefone}<br/>` : ''}
          </div>
          <div style="border-bottom: 1px dashed black; margin-bottom: 8px;"></div>
          
          <div class="items">
            ${itemsHtml}
          </div>
          
          <div class="total">
            ${sale.desconto > 0 ? `<div style="font-size: 11px; color: #555;">Desconto: -R$ ${Number(sale.desconto).toFixed(2)}</div>` : ''}
            ${sale.acrescimo > 0 ? `<div style="font-size: 11px; color: #555;">Acréscimo: +R$ ${Number(sale.acrescimo).toFixed(2)}</div>` : ''}
            <div>TOTAL: R$ ${Number(sale.valor_final).toFixed(2)}</div>
          </div>
          <div style="border-bottom: 1px dashed black; margin: 8px 0;"></div>
          
          <div class="info">
            <strong>PAGAMENTO:</strong><br/>
            ${paymentsHtml}
          </div>
          
          <div class="footer">
            Obrigado pela preferência!<br/>
            Volte Sempre!<br/>
            www.peixariafishhouse.com.br
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(receiptHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 300);
    }
  };

  const handlePrintTefReceipt = (receipt: string) => {
    if (!receipt) return;

    const tefHtml = `
      <html>
        <head>
          <title>Comprovante TEF - Fish House</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              padding: 15px; 
              width: 80mm; 
              margin: 0 auto;
              color: black;
              font-size: 11px;
              line-height: 1.2;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body onload="window.print();">
          <div>${receipt.replace(/\\n/g, '<br/>')}</div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(tefHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 300);
    }
  };

  const handleReprintLastTef = async () => {
    try {
      const { data, error } = await supabase
        .from('tef_transacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Nenhuma transação TEF recente encontrada.');
        return;
      }
      if (data[0].comprovante_cliente) {
        handlePrintTefReceipt(data[0].comprovante_cliente);
      }
      if (data[0].comprovante_estabelecimento) {
        setTimeout(() => handlePrintTefReceipt(data[0].comprovante_estabelecimento), 500);
      }
    } catch (err: any) {
      alert('Erro ao reimprimir último TEF: ' + err.message);
    }
  };

  const handleReprintByNsu = async () => {
    if (!tefReprintNsu.trim()) return;
    try {
      const { data, error } = await supabase
        .from('tef_transacoes')
        .select('*')
        .eq('nsu', tefReprintNsu.trim())
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) {
        alert(`Transação com o NSU ${tefReprintNsu} não foi encontrada.`);
        return;
      }
      if (data[0].comprovante_cliente) {
        handlePrintTefReceipt(data[0].comprovante_cliente);
      }
      if (data[0].comprovante_estabelecimento) {
        setTimeout(() => handlePrintTefReceipt(data[0].comprovante_estabelecimento), 500);
      }
    } catch (err: any) {
      alert('Erro ao buscar transação: ' + err.message);
    }
  };

  const handleCancelTef = async () => {
    if (!tefCancelNsu.trim() || !tefCancelAmount.trim()) {
      alert('Por favor, info o NSU e o Valor.');
      return;
    }
    if (!confirm(`Confirma o cancelamento administrativo da transação NSU ${tefCancelNsu} de R$ ${tefCancelAmount}?`)) {
      return;
    }

    try {
      setIsTefModalOpen(true);
      setTefStatusMessage('Conectando ao pin pad para cancelamento...');
      const res = await tefService.cancelTransaction(Number(tefCancelAmount), tefCancelNsu.trim());
      setIsTefModalOpen(false);

      if (res.success) {
        await supabase
          .from('tef_transacoes')
          .update({ status: 'cancelado' })
          .eq('nsu', tefCancelNsu.trim());

        alert('Transação cancelada e estornada com sucesso!');
        if (res.comprovante_cliente) {
          handlePrintTefReceipt(res.comprovante_cliente);
        }
        setTefCancelNsu('');
        setTefCancelAmount('');
      } else {
        alert('O TEF recusou o cancelamento: ' + res.message);
      }
    } catch (err: any) {
      setIsTefModalOpen(false);
      alert('Erro no cancelamento TEF: ' + err.message);
    }
  };

  const handleSaveTefConfig = (newConfig: TefConfig) => {
    tefService.saveConfig(newConfig);
    setTefConfig(newConfig);
    alert('Configurações do TEF salvas com sucesso!');
  };

  if (loadingCaixa) {
    return (
      <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center">
        <RefreshCcw className="w-10 h-10 text-gold-500 animate-spin mb-4" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Carregando Informações...</p>
      </div>
    );
  }

  // CAIXA FECHADO SCREEN
  if (!caixa) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-ink-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-full blur-3xl" />
          <div className="w-20 h-20 bg-gold-500/10 text-gold-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-gold-500/20">
            <Calculator className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-display font-black text-center text-gold-500 mb-2 uppercase tracking-tight">Caixa Fechado</h1>
          <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">
            Para iniciar as vendas no balcão e no caixa, é necessário registrar a abertura do turno informando o saldo inicial em dinheiro.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handleOpenCaixa(); }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Fundo de Troco (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                value={openingBalance} 
                onChange={e => setOpeningBalance(e.target.value)} 
                className="w-full bg-ink-950 border border-white/10 rounded-2xl py-4 px-6 text-2xl font-bold text-center text-white focus:border-gold-500 focus:outline-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={isOpeningCaixa || !activeCompany}
              className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-gold-500/10 flex items-center justify-center gap-2"
            >
              {isOpeningCaixa ? (
                <RefreshCcw className="w-5 h-5 animate-spin" />
              ) : (
                <><Play className="w-5 h-5 fill-current" /> Abrir Caixa</>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN PDV SCREEN
  return (
    <div className="h-[calc(100vh-5rem)] bg-ink-950 flex flex-col md:flex-row">
      
      {/* LEFT COLUMN: Shopping Cart & Totals */}
      <div className="flex-1 md:w-1/2 flex flex-col border-r border-white/10 h-full overflow-hidden bg-ink-900/30">
        
        {/* Cart Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 animate-pulse">
              <Clock className="w-3.5 h-3.5" /> Caixa Aberto
            </span>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (manualBarcode.trim()) {
                  handleBarcodeScanned(manualBarcode.trim());
                  setManualBarcode('');
                }
              }}
              className="flex items-center gap-1.5 bg-gold-500/10 text-gold-500 border border-gold-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase"
            >
              <Barcode className="w-3.5 h-3.5 animate-pulse shrink-0" />
              <input 
                type="text" 
                placeholder="Digitar Código..." 
                value={manualBarcode}
                onChange={e => setManualBarcode(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black text-gold-500 placeholder-gold-500/50 focus:outline-none w-28 p-0"
              />
            </form>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsTefAdminModalOpen(true)}
              className="text-xs text-gold-400 hover:text-gold-300 font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" /> Menu TEF
            </button>
            <button 
              onClick={() => setIsClosingCaixa(true)}
              className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Fechar Caixa
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 italic">
              <Calculator className="w-16 h-16 opacity-10 mb-4" />
              Nenhum produto no carrinho.
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.product.id}
                className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-between items-center group hover:bg-white/10 hover:border-white/10 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-white truncate">{item.product.name}</p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">
                    R$ {item.product.price.toFixed(2)} / {item.product.unit}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {/* Quantity Editor */}
                  <div className="flex items-center bg-ink-950 border border-white/10 rounded-xl overflow-hidden p-0.5">
                    <button
                      type="button"
                      onClick={() => updateCartItemQuantity(item.product.id, item.quantity - (item.product.unit === 'kg' ? 0.1 : 1))}
                      className="px-2.5 py-1 text-gray-400 hover:text-white transition-colors font-bold text-xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step={item.product.unit === 'kg' ? '0.001' : '1'}
                      min="0.001"
                      value={item.quantity}
                      onChange={e => updateCartItemQuantity(item.product.id, Number(e.target.value))}
                      className="w-14 text-center bg-transparent border-none text-white text-xs font-bold focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateCartItemQuantity(item.product.id, item.quantity + (item.product.unit === 'kg' ? 0.1 : 1))}
                      className="px-2.5 py-1 text-gray-400 hover:text-white transition-colors font-bold text-xs"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-bold text-white text-sm whitespace-nowrap w-20 text-right">
                    R$ {item.subtotal.toFixed(2)}
                  </span>
                  
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Totals & Checkout Panel */}
        <div className="p-3 border-t border-white/10 bg-white/5 space-y-3 shrink-0">
          
          {/* Quick Adjustments & Customer Row Combined */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                <Percent className="w-2.5 h-2.5 text-gold-500" /> Desc (%)
              </label>
              <input 
                type="number"
                min="0"
                max="100"
                value={discountPercent || ''}
                onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                placeholder="0"
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                <Plus className="w-2.5 h-2.5 text-blue-500" /> Acrésc. (R$)
              </label>
              <input 
                type="number"
                min="0"
                value={surchargeAmount || ''}
                onChange={e => setSurchargeAmount(Math.max(0, Number(e.target.value)))}
                placeholder="0.00"
                className="w-full bg-ink-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                <User className="w-2.5 h-2.5 text-amber-500" /> Cliente
              </label>
              <div className="flex gap-1">
                <button 
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className={`flex-1 px-2 py-1.5 rounded-xl border text-[10px] font-bold truncate transition-all ${
                    selectedCustomer 
                    ? 'bg-gold-500/10 border-gold-500 text-gold-500' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {selectedCustomer ? selectedCustomer.name : 'Vincular'}
                </button>
                {selectedCustomer && (
                  <button 
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="space-y-0.5 py-1 border-t border-b border-white/5">
            <div className="flex justify-between items-center text-[10px] text-gray-400">
              <span>Subtotal: R$ {subtotal.toFixed(2)}</span>
              <div className="flex gap-2 font-mono">
                {discountAmount > 0 && <span className="text-red-400 font-bold">Desc: -R$ {discountAmount.toFixed(2)}</span>}
                {surchargeAmount > 0 && <span className="text-blue-400 font-bold">Acrésc: +R$ {surchargeAmount.toFixed(2)}</span>}
              </div>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-xs font-bold text-white">Total a Pagar:</span>
              <span className="text-xl font-black text-gold-500">R$ {finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-1.5">
              {paymentMethods.slice(0, 6).map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => {
                    setSelectedPaymentMethod(pm);
                    setBypassTef(false);
                  }}
                  className={`py-1.5 px-1 rounded-xl border text-[9px] font-bold uppercase flex flex-col items-center justify-center gap-1 transition-all ${
                    selectedPaymentMethod?.id === pm.id
                    ? 'bg-gold-500/10 border-gold-500 text-gold-500 shadow-lg shadow-gold-500/5'
                    : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {pm.tipo === 'dinheiro' && <DollarSign className="w-3.5 h-3.5" />}
                  {pm.tipo === 'pix' && <QrCode className="w-3.5 h-3.5" />}
                  {pm.tipo === 'debito' && <CreditCard className="w-3.5 h-3.5 text-blue-400" />}
                  {pm.tipo === 'credito' && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
                  {pm.tipo === 'vale_refeicao' && <CreditCard className="w-3.5 h-3.5 text-green-400" />}
                  {pm.tipo === 'convenio' && <User className="w-3.5 h-3.5 text-amber-400" />}
                  <span className="truncate max-w-[80px]">{pm.nome}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Change Panel */}
          {selectedPaymentMethod?.tipo === 'dinheiro' && (
            <div className="flex gap-4 items-center bg-white/5 border border-white/5 p-2 rounded-2xl">
              <div className="flex-1">
                <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest ml-1">Valor Recebido (R$)</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={receivedAmount}
                  onChange={e => setReceivedAmount(e.target.value)}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                />
              </div>
              <div className="text-right pr-2">
                <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Troco</p>
                <p className="text-base font-black text-green-500">R$ {changeAmount.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* TEF Installments Panel */}
          {selectedPaymentMethod?.tipo === 'credito' && tefConfig.enabled && (
            <div className="flex gap-4 items-center bg-white/5 border border-white/5 p-2 rounded-2xl">
              <div className="flex-1">
                <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest ml-1">Parcelamento (TEF)</label>
                <select 
                  value={tefInstallments}
                  onChange={e => setTefInstallments(Number(e.target.value))}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:border-gold-500 focus:outline-none"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1 === 1 ? '1x à Vista' : `${i + 1}x sem Juros`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TEF Bypass Switch */}
          {tefConfig.enabled && (selectedPaymentMethod?.tipo === 'credito' || selectedPaymentMethod?.tipo === 'debito' || selectedPaymentMethod?.tipo === 'pix') && (
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cobrança Manual (Sem Pin Pad)</span>
              <input
                type="checkbox"
                checked={bypassTef}
                onChange={e => setBypassTef(e.target.checked)}
                className="w-4 h-4 rounded text-gold-500 focus:ring-gold-500 bg-ink-950 border-white/10"
              />
            </div>
          )}

          {/* Collapsible Sale Notes */}
          <div className="space-y-1">
            {!showNotes ? (
              <button 
                type="button"
                onClick={() => setShowNotes(true)}
                className="text-[9px] text-gray-500 hover:text-white font-bold uppercase tracking-widest flex items-center gap-1.5 ml-1 transition-colors"
              >
                + Adicionar Observação
              </button>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest ml-1">Observações da Venda</label>
                  <button 
                    type="button" 
                    onClick={() => { setShowNotes(false); setSaleNotes(''); }} 
                    className="text-[8px] text-red-400 font-bold uppercase"
                  >
                    Excluir
                  </button>
                </div>
                <textarea 
                  rows={1}
                  placeholder="Observações do pedido..."
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>
            )}
          </div>

          {/* Finalize Button */}
          <button
            onClick={handleFinalizeSale}
            disabled={cart.length === 0 || !selectedPaymentMethod}
            className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black py-3 rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-gold-500/10 flex items-center justify-center gap-1.5 text-xs animate-none"
          >
            Finalizar Venda
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Product Search & Categories */}
      <div className="flex-1 md:w-1/2 flex flex-col h-full overflow-hidden">
        
        {/* Search & Categories */}
        <div className="p-4 border-b border-white/10 bg-ink-900/50 space-y-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-ink-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button 
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCategory === 'all' ? 'bg-gold-500/10 border border-gold-500 text-gold-500' : 'bg-white/5 text-gray-500 border border-white/5'}`}
            >
              Todos
            </button>
            {settings?.categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCategory === cat ? 'bg-gold-500/10 border border-gold-500 text-gold-500' : 'bg-white/5 text-gray-500 border border-white/5'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 custom-scrollbar">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductSelected(product)}
              className="bg-ink-900/60 border border-white/10 hover:border-gold-500/30 rounded-2xl p-3 flex flex-col justify-between text-left transition-all hover:bg-white/5 active:scale-95 group relative overflow-hidden min-h-[170px]"
            >
              {/* Image Container */}
              <div className="w-full h-24 rounded-xl bg-white/5 flex items-center justify-center p-2 mb-2 relative overflow-hidden group-hover:bg-white/10 transition-colors">
                {product.image_url ? (
                  <>
                    <img src={getOptimizedImageUrl(product.image_url)} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm opacity-20" />
                    <img src={getOptimizedImageUrl(product.image_url)} alt="" className="relative max-w-full max-h-full object-contain z-10" />
                  </>
                ) : (
                  <Package className="w-8 h-8 text-gray-700" />
                )}
              </div>
              
              {/* Product Info */}
              <div className="space-y-1 w-full">
                <p className="font-bold text-[11px] text-white line-clamp-2 leading-snug group-hover:text-gold-500 transition-colors min-h-[2.0rem]">
                  {product.name}
                </p>
                <div className="flex justify-between items-end pt-1">
                  <span className="text-xs font-black text-gold-500">R$ {product.price.toFixed(2)}</span>
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                    {product.unit}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* WEIGHT PROMPT MODAL */}
      <AnimatePresence>
        {selectedProductForWeight && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setSelectedProductForWeight(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-ink-900 border border-white/10 rounded-[2rem] p-6 shadow-2xl overflow-hidden"
            >
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight mb-2">Informe o Peso</h3>
              <p className="text-xs text-gray-500 mb-6">{selectedProductForWeight.name}</p>

              <form onSubmit={handleWeightSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Quantidade em KG</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    value={manualWeight} 
                    onChange={e => setManualWeight(e.target.value)} 
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-xl font-bold text-center text-white focus:border-gold-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setSelectedProductForWeight(null)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-3 rounded-xl uppercase tracking-wider text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-3 rounded-xl uppercase tracking-wider text-xs"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOMER SELECTION MODAL */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setIsCustomerModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-ink-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">Selecionar Cliente</h3>
                <button onClick={() => setIsCustomerModalOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {/* Search Customer */}
              <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Pesquisar cliente..." 
                  value={customerSearch} 
                  onChange={e => setCustomerSearch(e.target.value)} 
                  className="w-full bg-ink-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              {/* Customers List */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-6 custom-scrollbar">
                {customers
                  .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setIsCustomerModalOpen(false); }}
                      className="w-full bg-white/5 border border-white/5 hover:border-gold-500/30 p-3 rounded-xl text-left flex justify-between items-center transition-all"
                    >
                      <div>
                        <p className="font-bold text-xs text-white">{c.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{c.telefone || 'Sem telefone'}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  ))}
              </div>

              {/* Create Customer Inline */}
              <form onSubmit={handleCreateCustomer} className="border-t border-white/10 pt-4 space-y-3 shrink-0">
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">Novo Cadastro Rápido</p>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Nome"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    className="bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="WhatsApp"
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    className="bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full bg-gold-500 text-ink-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-widest">Salvar e Selecionar</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FECHAR CAIXA MODAL */}
      <AnimatePresence>
        {isClosingCaixa && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setIsClosingCaixa(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-ink-900 border border-white/10 rounded-[2rem] p-6 shadow-2xl"
            >
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight mb-2">Conferência de Caixa</h3>
              <p className="text-xs text-gray-500 mb-6">Informe o saldo em dinheiro contado fisicamente na gaveta.</p>

              <form onSubmit={(e) => { e.preventDefault(); handleCloseCaixa(); }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Saldo Final Contado (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={closingBalance} 
                    onChange={e => setClosingBalance(e.target.value)} 
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-3 px-4 text-xl font-bold text-center text-white focus:border-gold-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsClosingCaixa(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-3 rounded-xl uppercase tracking-wider text-xs"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl uppercase tracking-wider text-xs"
                  >
                    Confirmar Fechamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SALE SUCCESS MODAL */}
      <AnimatePresence>
        {isSuccessModalOpen && lastSaleId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => { setIsSuccessModalOpen(false); setTefResponse(null); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-ink-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-2">Venda Realizada!</h3>
              <p className="text-xs text-gray-400 mb-8 leading-relaxed">A venda foi registrada com sucesso, os estoques foram atualizados e o lançamento financeiro foi gerado.</p>

              <div className="space-y-3">
                <button 
                  onClick={() => { handleEmitAndPrintNfce(lastSaleId); }}
                  disabled={isEmittingNfce}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-ink-950 font-black py-3.5 rounded-xl uppercase tracking-widest text-xs border border-green-400 flex items-center justify-center gap-2"
                >
                  {isEmittingNfce ? (
                    <RefreshCcw className="w-4 h-4 animate-spin text-ink-950" />
                  ) : (
                    <FileText className="w-4 h-4 text-ink-950" />
                  )}
                  {isEmittingNfce ? 'Emitindo na SEFAZ...' : 'Emitir & Imprimir Cupom Fiscal (NFC-e)'}
                </button>

                <button 
                  onClick={() => { handlePrintReceipt(lastSaleId); }}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl uppercase tracking-widest text-xs border border-white/10 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4 text-gold-500" /> Imprimir Comanda Interna
                </button>

                {tefResponse?.comprovante_cliente && (
                  <button 
                    onClick={() => { handlePrintTefReceipt(tefResponse.comprovante_cliente); }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl uppercase tracking-widest text-xs border border-white/10 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4 text-gold-500" /> Comprovante Cliente (Cartão)
                  </button>
                )}

                {tefResponse?.comprovante_estabelecimento && (
                  <button 
                    onClick={() => { handlePrintTefReceipt(tefResponse.comprovante_estabelecimento); }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl uppercase tracking-widest text-xs border border-white/10 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4 text-gold-500" /> Comprovante Loja (Cartão)
                  </button>
                )}

                <button 
                  onClick={() => { setIsSuccessModalOpen(false); setTefResponse(null); }}
                  className="w-full bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-3.5 rounded-xl uppercase tracking-widest text-xs"
                >
                  Nova Venda
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN PAD STATUS MODAL */}
      <AnimatePresence>
        {isTefModalOpen && (
          <div className="fixed inset-0 z-[165] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-ink-900 border border-gold-500/20 rounded-[2rem] p-8 shadow-2xl text-center flex flex-col items-center"
            >
              <RefreshCcw className="w-10 h-10 text-gold-500 animate-spin mb-6" />
              <h3 className="text-xs font-black uppercase tracking-widest text-gold-500 mb-4">Aguardando Pin Pad</h3>
              <p className="text-white font-bold text-sm leading-relaxed uppercase font-mono tracking-tight animate-pulse min-h-[3rem] flex items-center justify-center bg-ink-950/50 border border-white/5 px-4 py-3 rounded-2xl w-full">
                {tefStatusMessage || 'Processando transação...'}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEF ADMINISTRATIVE & CONFIG MODAL */}
      <AnimatePresence>
        {isTefAdminModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setIsTefAdminModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-ink-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-lg font-display font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <CreditCard className="text-gold-500 w-5 h-5" /> Integração TEF
                </h3>
                <button onClick={() => setIsTefAdminModalOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-white/5 pb-4 mb-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setTefAdminTab('admin')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    tefAdminTab === 'admin' 
                    ? 'bg-gold-500/10 border border-gold-500/30 text-gold-500' 
                    : 'bg-white/5 border border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  Funções TEF
                </button>
                <button
                  type="button"
                  onClick={() => setTefAdminTab('config')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    tefAdminTab === 'config' 
                    ? 'bg-gold-500/10 border border-gold-500/30 text-gold-500' 
                    : 'bg-white/5 border border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  Configuração
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                {tefAdminTab === 'admin' ? (
                  <div className="space-y-6">
                    {/* Reprint Last */}
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                      <p className="text-[10px] text-gold-500 uppercase font-black tracking-widest">Reimpressão Rápida</p>
                      <button
                        type="button"
                        onClick={handleReprintLastTef}
                        className="w-full bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all"
                      >
                        Reimprimir Último Comprovante
                      </button>
                    </div>

                    {/* Reprint By NSU */}
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                      <p className="text-[10px] text-gold-500 uppercase font-black tracking-widest">Reimpressão por NSU</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Digite o NSU..."
                          value={tefReprintNsu}
                          onChange={e => setTefReprintNsu(e.target.value)}
                          className="flex-1 bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-500"
                        />
                        <button
                          type="button"
                          onClick={handleReprintByNsu}
                          disabled={!tefReprintNsu.trim()}
                          className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold px-4 rounded-xl text-xs uppercase"
                        >
                          Buscar
                        </button>
                      </div>
                    </div>

                    {/* Cancel Transaction */}
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                      <p className="text-[10px] text-red-400 uppercase font-black tracking-widest">Cancelamento / Estorno TEF</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="NSU da transação..."
                          value={tefCancelNsu}
                          onChange={e => setTefCancelNsu(e.target.value)}
                          className="bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor (R$)..."
                          value={tefCancelAmount}
                          onChange={e => setTefCancelAmount(e.target.value)}
                          className="bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelTef}
                        disabled={!tefCancelNsu.trim() || !tefCancelAmount.trim()}
                        className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all"
                      >
                        Estornar Transação
                      </button>
                    </div>
                  </div>
                ) : (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveTefConfig(tefConfig);
                    }}
                    className="space-y-4"
                  >
                    {/* Habilitar */}
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                      <span className="text-xs font-bold text-white">Ativar Módulo TEF</span>
                      <input
                        type="checkbox"
                        checked={tefConfig.enabled}
                        onChange={e => setTefConfig({ ...tefConfig, enabled: e.target.checked })}
                        className="w-4 h-4 rounded text-gold-500 focus:ring-gold-500 bg-ink-950 border-white/10"
                      />
                    </div>

                    {/* Provedor */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">Provedor TEF</label>
                      <select
                        value={tefConfig.provider}
                        onChange={e => setTefConfig({ ...tefConfig, provider: e.target.value as any })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="mock">MOCK (Simulador de Pin Pad)</option>
                        <option value="sitef">SITEF (SiTef Local)</option>
                        <option value="paygo">PAYGO (PayGo Local)</option>
                        <option value="generico">GENÉRICO (Troca de Arquivos GP)</option>
                      </select>
                    </div>

                    {/* Porta Pinpad */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">Porta Serial do Pin Pad (PPC930)</label>
                      <select
                        value={tefConfig.pinpadPort}
                        onChange={e => setTefConfig({ ...tefConfig, pinpadPort: e.target.value })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                      >
                        {[...Array(9)].map((_, i) => (
                          <option key={i + 1} value={"COM" + (i + 1)}>{"COM" + (i + 1) + " (USB/Serial)"}</option>
                        ))}
                        <option value="AUTO">AUTO (Detecção Automática)</option>
                      </select>
                    </div>

                    {/* CNPJ */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">CNPJ da Loja</label>
                      <input
                        type="text"
                        value={tefConfig.cnpj}
                        onChange={e => setTefConfig({ ...tefConfig, cnpj: e.target.value })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {/* Código da Loja & Terminal */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">Código Loja (Empresa)</label>
                        <input
                          type="text"
                          value={tefConfig.storeCode}
                          onChange={e => setTefConfig({ ...tefConfig, storeCode: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">ID Terminal (PDV)</label>
                        <input
                          type="text"
                          value={tefConfig.terminalId}
                          onChange={e => setTefConfig({ ...tefConfig, terminalId: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Timeout */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">Timeout de Transação (Segundos)</label>
                      <input
                        type="number"
                        value={tefConfig.timeoutSeconds}
                        onChange={e => setTefConfig({ ...tefConfig, timeoutSeconds: Number(e.target.value) })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {/* Configs por Provedor */}
                    {tefConfig.provider !== 'mock' && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">URL do Agente Local Bridge</label>
                        <input
                          type="text"
                          value={tefConfig.agentUrl}
                          placeholder={tefConfig.provider === 'paygo' ? 'http://localhost:5105' : (tefConfig.provider === 'generico' ? 'http://localhost:3003' : 'http://localhost:2018')}
                          onChange={e => setTefConfig({ ...tefConfig, agentUrl: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}

                    {tefConfig.provider === 'generico' && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">Pasta Troca de Arquivos (Gerenciador Padrão)</label>
                        <input
                          type="text"
                          value={tefConfig.fileExchangeDir}
                          onChange={e => setTefConfig({ ...tefConfig, fileExchangeDir: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Simulação Mock Selector */}
                    {tefConfig.provider === 'mock' && (
                      <div className="bg-gold-500/5 border border-gold-500/10 p-3 rounded-2xl space-y-1.5">
                        <label className="text-[9px] text-gold-500 uppercase font-black tracking-widest ml-1">Comportamento do Simulador</label>
                        <select
                          value={localStorage.getItem('tef_mock_behavior') || 'success'}
                          onChange={e => {
                            localStorage.setItem('tef_mock_behavior', e.target.value);
                            setTefInstallments(prev => prev); 
                          }}
                          className="w-full bg-ink-950 border border-gold-500/20 rounded-xl px-3 py-2 text-xs text-gold-500 focus:outline-none"
                        >
                          <option value="success">Sucesso (Aprovar Pagamento)</option>
                          <option value="reject">Recusado (Saldo Insuficiente)</option>
                          <option value="timeout">Timeout (Sem resposta do servidor)</option>
                          <option value="error">Erro Físico (Pin Pad desconectado)</option>
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all mt-4"
                    >
                      Salvar Configurações
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
