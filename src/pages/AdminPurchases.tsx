import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCcw, 
  FileText,
  Warehouse,
  UserPlus,
  Upload,
  Barcode
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { useScale } from '../services/scale/useScale';

type Product = {
  id: string;
  name: string;
  unit: string;
  barcode?: string;
  custo_medio?: number;
  price?: number;
  plu_codigo?: string;
  codigo_interno?: string;
};

type Supplier = {
  id: string;
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
};

type LocalEstoque = {
  id: string;
  nome: string;
};

type PurchaseItem = {
  produto_id: string;
  quantidade: number;
  custo_unitario: number;
  local_destino_id: string;
  subtotal: number;
};

export default function AdminPurchases() {
  const [activeTab, setActiveTab] = useState<'new_purchase' | 'import_xml' | 'history' | 'suppliers'>('new_purchase');
  const [loading, setLoading] = useState(true);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<LocalEstoque[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  
  // New Purchase Form
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Barcode state
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastCharTime, setLastCharTime] = useState(0);

  // Web Serial & Balança Toledo Hook
  const [activeWeighProduct, setActiveWeighProduct] = useState<Product | null>(null);
  const scale = useScale();

  // Access Key Import states
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [isFetchingKey, setIsFetchingKey] = useState(false);

  // XML Import states
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [isParsingXml, setIsParsingXml] = useState(false);
  const [xmlLocationId, setXmlLocationId] = useState('');
  const [isImportingXml, setIsImportingXml] = useState(false);
  const [isCreatingXmlSupplier, setIsCreatingXmlSupplier] = useState(false);
  const [parsedInvoice, setParsedInvoice] = useState<{
    numero: string;
    dataEmissao: string;
    total: number;
    fornecedor: {
      cnpj: string;
      razaoSocial: string;
      nomeFantasia?: string;
      ie?: string;
      telefone?: string;
      email?: string;
      endereco?: string;
    };
    itens: Array<{
      cProd: string;
      cEAN: string;
      xProd: string;
      qCom: number;
      uCom: string;
      vUnCom: number;
      vProd: number;
    }>;
    duplicatas: Array<{
      numero: string;
      vencimento: string;
      valor: number;
    }>;
  } | null>(null);
  const [mappedProducts, setMappedProducts] = useState<Record<string, string>>({}); // cProd -> internal product ID
  
  // Suppliers Form/List
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    cnpj_cpf: '',
    razao_social: '',
    nome_fantasia: '',
    telefone: '',
    email: '',
    endereco: ''
  });
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Purchase History State
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleGlobalScan = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

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
  }, [barcodeBuffer, lastCharTime, products, purchaseItems, activeTab]);

  const handleBarcodeScanned = (code: string) => {
    if (activeTab !== 'new_purchase') return;

    if (code.length === 13 && code.startsWith('2')) {
      const plu6 = code.substring(1, 7); // e.g. "000657"
      const plu5 = code.substring(1, 6); // e.g. "00065"

      const valCents6 = Number(code.substring(7, 12));
      const valCents5 = Number(code.substring(6, 11));

      // 1. Try 6-digit PLU
      let prod = products.find(p => 
        (p.plu_codigo && (p.plu_codigo === plu6 || Number(p.plu_codigo) === Number(plu6))) ||
        (p.codigo_interno && (p.codigo_interno === plu6 || Number(p.codigo_interno) === Number(plu6))) ||
        (p.barcode && p.barcode.substring(1, 7) === plu6)
      );
      let valCents = valCents6;

      // 2. Try 5-digit PLU
      if (!prod) {
        prod = products.find(p => 
          (p.plu_codigo && (p.plu_codigo === plu5 || Number(p.plu_codigo) === Number(plu5))) ||
          (p.codigo_interno && (p.codigo_interno === plu5 || Number(p.codigo_interno) === Number(plu5))) ||
          (p.barcode && p.barcode.substring(1, 6) === plu5) ||
          (p.id.replace(/\D/g, '').substring(0, 5) === plu5)
        );
        valCents = valCents5;
      }

      if (prod) {
        const barcodeType = localStorage.getItem('scale_barcode_type') || 'price';
        let weight = 0;

        if (barcodeType === 'price') {
          const totalVal = valCents / 100;
          const retailPrice = prod.price || 10.00;
          weight = Number((totalVal / retailPrice).toFixed(3));
        } else {
          weight = Number((valCents / 1000).toFixed(3));
        }

        if (weight > 0) {
          const existing = purchaseItems.find(i => i.produto_id === prod.id);
          if (existing) {
            handleUpdateItemField(prod.id, 'quantidade', Number((existing.quantidade + weight).toFixed(3)));
            showNotification('success', `${prod.name} atualizado: +${weight.toFixed(3)} ${prod.unit}`);
          } else {
            const defaultLoc = locations[0]?.id || '';
            const costUnit = prod.custo_medio || 10.00;
            setPurchaseItems(prev => [...prev, {
              produto_id: prod.id,
              quantidade: weight,
              custo_unitario: costUnit,
              local_destino_id: defaultLoc,
              subtotal: Number((weight * costUnit).toFixed(2))
            }]);
            showNotification('success', `${prod.name} adicionado: ${weight.toFixed(3)} ${prod.unit}`);
          }
        }
        return;
      }
    }

    const standardProd = products.find(p => p.barcode === code || p.codigo_interno === code || p.plu_codigo === code);
    if (standardProd) {
      const existing = purchaseItems.find(i => i.produto_id === standardProd.id);
      if (existing) {
        handleUpdateItemField(standardProd.id, 'quantidade', existing.quantidade + 1);
        showNotification('success', `${standardProd.name} atualizado: +1 ${standardProd.unit}`);
      } else {
        const defaultLoc = locations[0]?.id || '';
        const costUnit = standardProd.custo_medio || 10.00;
        setPurchaseItems(prev => [...prev, {
          produto_id: standardProd.id,
          quantidade: 1,
          custo_unitario: costUnit,
          local_destino_id: defaultLoc,
          subtotal: costUnit
        }]);
        showNotification('success', `${standardProd.name} adicionado ao carrinho.`);
      }
    }
  };

  const openWeighModal = (product: Product) => {
    setActiveWeighProduct(product);
    if (scale.status === 'connected') {
      scale.requestWeight();
    } else {
      scale.connect();
    }
  };

  const handleConfirmWeight = () => {
    if (activeWeighProduct && scale.weight > 0) {
      const existing = purchaseItems.find(i => i.produto_id === activeWeighProduct.id);
      if (existing) {
        handleUpdateItemField(activeWeighProduct.id, 'quantidade', scale.weight);
      } else {
        const defaultLoc = locations[0]?.id || '';
        const costUnit = activeWeighProduct.custo_medio || 10.00;
        setPurchaseItems(prev => [...prev, {
          produto_id: activeWeighProduct.id,
          quantidade: scale.weight,
          custo_unitario: costUnit,
          local_destino_id: defaultLoc,
          subtotal: Number((scale.weight * costUnit).toFixed(2))
        }]);
      }
      showNotification('success', `Peso confirmado para ${activeWeighProduct.name}: ${scale.weight.toFixed(3)} kg`);
      setActiveWeighProduct(null);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const generateMockNFeXML = (accessKey: string) => {
    const cnpj = accessKey.substring(6, 20) || '12345678000199';
    const rawNumber = accessKey.substring(25, 34) || '000000123';
    const number = parseInt(rawNumber, 10).toString();
    
    const mockItems = [
      { cProd: 'PROD001', cEAN: '7891020304051', xProd: 'Salmão Premium Inteiro', qCom: 25.5, uCom: 'KG', vUnCom: 55.90 },
      { cProd: 'PROD002', cEAN: '7891020304068', xProd: 'Filé de Tilápia Congelado', qCom: 40.0, uCom: 'KG', vUnCom: 38.50 },
      { cProd: 'PROD003', cEAN: '7891020304075', xProd: 'Camarão Cinza Inteiro 21/25', qCom: 15.0, uCom: 'KG', vUnCom: 49.90 }
    ];

    const totalProd = mockItems.reduce((acc, item) => acc + (item.qCom * item.vUnCom), 0);
    const totalNF = totalProd.toFixed(2);

    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${accessKey}" versao="4.00">
      <ide>
        <nNF>${number}</nNF>
        <dhEmi>${new Date().toISOString()}</dhEmi>
      </ide>
      <emit>
        <CNPJ>${cnpj}</CNPJ>
        <xNome>Frigopeixe Distribuição de Pescados LTDA</xNome>
        <xFant>Frigopeixe</xFant>
        <IE>1234567890</IE>
        <fone>4733445566</fone>
        <email>vendas@frigopeixe.com.br</email>
        <enderEmit>
          <xLgr>Rodovia Governador Mario Covas</xLgr>
          <nro>4500</nro>
          <xBairro>Espinheiros</xBairro>
          <xMun>Itajaí</xMun>
          <UF>SC</UF>
          <CEP>88311000</CEP>
        </enderEmit>
      </emit>
      ${mockItems.map((item, index) => `
      <det nItem="${index + 1}">
        <prod>
          <cProd>${item.cProd}</cProd>
          <cEAN>${item.cEAN}</cEAN>
          <xProd>${item.xProd}</xProd>
          <qCom>${item.qCom}</qCom>
          <uCom>${item.uCom}</uCom>
          <vUnCom>${item.vUnCom}</vUnCom>
          <vProd>${(item.qCom * item.vUnCom).toFixed(2)}</vProd>
        </prod>
      </det>`).join('')}
      <total>
        <ICMSTot>
          <vNF>${totalNF}</vNF>
        </ICMSTot>
      </total>
      <cobr>
        <dup>
          <nDup>001</nDup>
          <dVenc>${new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}</dVenc>
          <vDup>${totalNF}</vDup>
        </dup>
      </cobr>
    </infNFe>
  </NFe>
</nfeProc>`;
  };

  const handleImportByAccessKey = async () => {
    if (accessKeyInput.length !== 44) {
      showNotification('error', 'A chave de acesso deve possuir exatamente 44 dígitos.');
      return;
    }
    
    setIsFetchingKey(true);
    showNotification('success', 'Conectando à SEFAZ e buscando XML...');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const xml = generateMockNFeXML(accessKeyInput);
      const parsed = parseNFXML(xml);
      setParsedInvoice(parsed);
      
      const cleanXmlCnpj = parsed.fornecedor.cnpj.replace(/\D/g, '');
      const matchedSup = suppliers.find(s => s.cnpj_cpf.replace(/\D/g, '') === cleanXmlCnpj);
      const initialMap: Record<string, string> = {};
      
      if (matchedSup) {
        const { data: mappings } = await supabase
          .from('fornecedor_produto_mapeamento')
          .select('*')
          .eq('fornecedor_id', matchedSup.id);

        parsed.itens.forEach(item => {
          const dbMatch = mappings?.find(m => m.codigo_fornecedor === item.cProd);
          if (dbMatch) {
            initialMap[item.cProd] = dbMatch.produto_id;
            return;
          }
          if (item.cEAN && item.cEAN !== 'SEM GTIN' && item.cEAN !== '0') {
            const eanMatch = products.find(p => p.barcode === item.cEAN);
            if (eanMatch) {
              initialMap[item.cProd] = eanMatch.id;
              return;
            }
          }
        });
      } else {
        parsed.itens.forEach(item => {
          if (item.cEAN && item.cEAN !== 'SEM GTIN' && item.cEAN !== '0') {
            const eanMatch = products.find(p => p.barcode === item.cEAN);
            if (eanMatch) {
              initialMap[item.cProd] = eanMatch.id;
            }
          }
        });
      }
      
      setMappedProducts(initialMap);
      showNotification('success', `Nota Fiscal #${parsed.numero} importada com sucesso pela Chave de Acesso!`);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao buscar nota fiscal pela chave: ' + err.message);
    } finally {
      setIsFetchingKey(false);
      setAccessKeyInput('');
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch products (now including barcode, custo_medio, price, plu_codigo)
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, unit, barcode, custo_medio, price, plu_codigo')
        .eq('is_available', true)
        .order('name');
      setProducts(prods || []);

      // 2. Fetch suppliers
      const { data: sups } = await supabase.from('fornecedores').select('id, cnpj_cpf, razao_social, nome_fantasia, inscricao_estadual, telefone, email, endereco').order('razao_social');
      setSuppliers(sups || []);

      // 3. Fetch stock locations
      const { data: locs } = await supabase.from('locais_estoque').select('id, nome').eq('ativo', true).order('nome');
      setLocations(locs || []);
      if (locs && locs.length > 0) {
        setXmlLocationId(locs[0].id);
      }

      // 4. Fetch companies
      const { data: comps } = await supabase.from('empresas').select('id, nome_fantasia, cnpj, razao_social, inscricao_estadual, endereco_cidade, endereco_estado');
      setCompanies(comps || []);
      if (comps && comps.length > 0) {
        setActiveCompany(comps[0]);
      }

      // Fetch history
      await fetchPurchaseHistory();

    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseHistory = async () => {
    const { data, error } = await supabase
      .from('compras')
      .select(`
        *,
        fornecedores (razao_social, nome_fantasia),
        empresas (nome_fantasia),
        compra_itens (
          id,
          quantidade,
          custo_unitario,
          local_destino_id,
          products (name, unit),
          locais_estoque (nome)
        )
      `)
      .order('data_compra', { ascending: false })
      .limit(50);

    if (!error) {
      setPurchases(data || []);
    }
  };

  // Add Item to Purchase Form
  const handleAddPurchaseItem = (productId: string) => {
    if (!productId) return;
    if (purchaseItems.some(i => i.produto_id === productId)) return;
    
    const defaultLoc = locations[0]?.id || '';
    
    setPurchaseItems(prev => [...prev, {
      produto_id: productId,
      quantidade: 10,
      custo_unitario: 10.00,
      local_destino_id: defaultLoc,
      subtotal: 100.00
    }]);
  };

  const handleRemovePurchaseItem = (productId: string) => {
    setPurchaseItems(prev => prev.filter(i => i.produto_id !== productId));
  };

  const handleUpdateItemField = (productId: string, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(prev => prev.map(item => {
      if (item.produto_id === productId) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantidade' || field === 'custo_unitario') {
          updatedItem.subtotal = Number((updatedItem.quantidade * updatedItem.custo_unitario).toFixed(2));
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  // Submit Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || purchaseItems.length === 0 || !activeCompany) {
      showNotification('error', 'Preencha todos os campos obrigatórios e adicione itens.');
      return;
    }

    setIsSubmittingPurchase(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const totalVal = calculateTotal();

      // 1. Insert into public.compras
      const { data: purchase, error: purchaseErr } = await supabase
        .from('compras')
        .insert({
          fornecedor_id: selectedSupplier,
          empresa_id: activeCompany.id,
          numero_documento: docNumber || null,
          data_compra: new Date(purchaseDate).toISOString(),
          valor_total: totalVal,
          status: 'confirmada',
          observacoes: notes || null
        })
        .select()
        .single();

      if (purchaseErr) throw purchaseErr;

      // 2. Loop items to save and adjust stock
      for (const item of purchaseItems) {
        // Insert item record
        const { error: itemErr } = await supabase
          .from('compra_itens')
          .insert({
            compra_id: purchase.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario,
            local_destino_id: item.local_destino_id
          });
        if (itemErr) throw itemErr;

        // Upsert stock balance at local_destino
        const { data: existing } = await supabase
          .from('saldos_estoque')
          .select('id, saldo_atual')
          .eq('produto_id', item.produto_id)
          .eq('local_estoque_id', item.local_destino_id)
          .maybeSingle();

        const currentStock = existing ? Number(existing.saldo_atual) : 0;
        const newStock = currentStock + item.quantidade;
        if (existing) {
          const { error: stockErr } = await supabase
            .from('saldos_estoque')
            .update({ saldo_atual: newStock })
            .eq('id', existing.id);
          if (stockErr) throw stockErr;
        } else {
          const { error: stockErr } = await supabase
            .from('saldos_estoque')
            .insert({
              produto_id: item.produto_id,
              local_estoque_id: item.local_destino_id,
              saldo_atual: newStock,
              saldo_reservado: 0
            });
          if (stockErr) throw stockErr;
        }

        // Log movement
        const { error: logErr } = await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: item.produto_id,
            origem_local_id: null,
            destino_local_id: item.local_destino_id,
            tipo_movimentacao: 'entrada_compra',
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario,
            motivo: `Compra de Mercadoria Doc #${docNumber || 'Sem Doc'}`,
            usuario_id: user?.id,
            referencia_tipo: 'compra',
            referencia_id: purchase.id
          });
        if (logErr) throw logErr;

        // Calculate and update Weighted Average Cost (Custo Médio Ponderado)
        const prod = products.find(p => p.id === item.produto_id);
        const currentCusto = prod?.custo_medio ? Number(prod.custo_medio) : Number(item.custo_unitario);
        
        const newCusto = newStock > 0 
          ? Number((((currentStock * currentCusto) + (item.quantidade * item.custo_unitario)) / newStock).toFixed(2))
          : item.custo_unitario;

        await supabase
          .from('products')
          .update({ custo_medio: newCusto })
          .eq('id', item.produto_id);
      }

      // 3. Create contas_pagar title
      const supplierObj = suppliers.find(s => s.id === selectedSupplier);
      const supplierName = supplierObj?.nome_fantasia || supplierObj?.razao_social || 'Fornecedor';
      
      const { error: finErr } = await supabase
        .from('contas_pagar')
        .insert({
          empresa_id: activeCompany.id,
          fornecedor_id: selectedSupplier,
          compra_id: purchase.id,
          descricao: `Compra Mercadorias Doc #${docNumber || 'Sem Doc'} - Fornecedor ${supplierName}`,
          categoria: 'compra_mercadoria',
          valor: totalVal,
          vencimento: dueDate,
          status: 'pendente'
        });

      if (finErr) throw finErr;

      showNotification('success', 'Compra registrada, estoque atualizado e Conta a Pagar gerada!');
      
      // Reset form
      setPurchaseItems([]);
      setDocNumber('');
      setSelectedSupplier('');
      setNotes('');

      // Refresh data
      await fetchPurchaseHistory();
      await fetchInitialData();

    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao registrar compra: ' + err.message);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // XML Parser Function
  const parseNFXML = (xmlText: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const getTagText = (parent: Element | Document, tagName: string): string => {
      const el = parent.getElementsByTagName(tagName)[0];
      return el ? el.textContent || '' : '';
    };

    const numero = getTagText(xmlDoc, 'nNF');
    const dhEmi = getTagText(xmlDoc, 'dhEmi') || getTagText(xmlDoc, 'dEmi');
    const total = Number(getTagText(xmlDoc, 'vNF') || '0');

    const emit = xmlDoc.getElementsByTagName('emit')[0];
    if (!emit) throw new Error('XML inválido: tag <emit> emissora não encontrada.');

    const supplierCnpj = getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF');
    const supplierRazao = getTagText(emit, 'xNome');
    const supplierFantasia = getTagText(emit, 'xFant') || supplierRazao;
    const supplierIe = getTagText(emit, 'IE');
    const supplierTel = getTagText(emit, 'fone');
    const supplierEmail = getTagText(emit, 'email');
    
    const enderEmit = emit.getElementsByTagName('enderEmit')[0];
    let supplierAddress = '';
    if (enderEmit) {
      const logradouro = getTagText(enderEmit, 'xLgr');
      const nro = getTagText(enderEmit, 'nro');
      const bairro = getTagText(enderEmit, 'xBairro');
      const mun = getTagText(enderEmit, 'xMun');
      const uf = getTagText(enderEmit, 'UF');
      const cep = getTagText(enderEmit, 'CEP');
      supplierAddress = `${logradouro}, ${nro} - ${bairro}, ${mun} - ${uf} (CEP: ${cep})`;
    }

    const detTags = xmlDoc.getElementsByTagName('det');
    const itens = [];
    for (let i = 0; i < detTags.length; i++) {
      const det = detTags[i];
      const prodTag = det.getElementsByTagName('prod')[0];
      if (prodTag) {
        itens.push({
          cProd: getTagText(prodTag, 'cProd'),
          cEAN: getTagText(prodTag, 'cEAN'),
          xProd: getTagText(prodTag, 'xProd'),
          qCom: Number(getTagText(prodTag, 'qCom') || '0'),
          uCom: getTagText(prodTag, 'uCom'),
          vUnCom: Number(getTagText(prodTag, 'vUnCom') || '0'),
          vProd: Number(getTagText(prodTag, 'vProd') || '0')
        });
      }
    }

    const dupTags = xmlDoc.getElementsByTagName('dup');
    const duplicatas = [];
    for (let i = 0; i < dupTags.length; i++) {
      const dup = dupTags[i];
      duplicatas.push({
        numero: getTagText(dup, 'nDup') || `Parc. ${i+1}`,
        vencimento: getTagText(dup, 'dVenc'),
        valor: Number(getTagText(dup, 'vDup') || '0')
      });
    }

    return {
      numero,
      dataEmissao: dhEmi ? dhEmi.substring(0, 10) : new Date().toISOString().split('T')[0],
      total,
      fornecedor: {
        cnpj: supplierCnpj,
        razaoSocial: supplierRazao,
        nomeFantasia: supplierFantasia,
        ie: supplierIe,
        telefone: supplierTel,
        email: supplierEmail,
        endereco: supplierAddress
      },
      itens,
      duplicatas
    };
  };

  // Handle XML File Drag/Upload
  const handleXmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlFile(file);
    await processXmlFile(file);
  };

  const processXmlFile = async (file: File) => {
    setIsParsingXml(true);
    try {
      const text = await file.text();
      const parsed = parseNFXML(text);
      setParsedInvoice(parsed);

      // Match supplier
      const cleanXmlCnpj = parsed.fornecedor.cnpj.replace(/\D/g, '');
      const matchedSup = suppliers.find(s => s.cnpj_cpf.replace(/\D/g, '') === cleanXmlCnpj);

      const initialMap: Record<string, string> = {};
      
      if (matchedSup) {
        // Load existing product mappings for this supplier
        const { data: mappings } = await supabase
          .from('fornecedor_produto_mapeamento')
          .select('id, fornecedor_id, codigo_fornecedor, produto_id')
          .eq('fornecedor_id', matchedSup.id);

        parsed.itens.forEach(item => {
          // 1. Try DB mappings
          const dbMatch = mappings?.find(m => m.codigo_fornecedor === item.cProd);
          if (dbMatch) {
            initialMap[item.cProd] = dbMatch.produto_id;
            return;
          }
          // 2. Try EAN barcode matching
          if (item.cEAN && item.cEAN !== 'SEM GTIN' && item.cEAN !== '0') {
            const eanMatch = products.find(p => p.barcode === item.cEAN);
            if (eanMatch) {
              initialMap[item.cProd] = eanMatch.id;
              return;
            }
          }
        });
      } else {
        // Just match by EAN since supplier doesn't exist yet
        parsed.itens.forEach(item => {
          if (item.cEAN && item.cEAN !== 'SEM GTIN' && item.cEAN !== '0') {
            const eanMatch = products.find(p => p.barcode === item.cEAN);
            if (eanMatch) {
              initialMap[item.cProd] = eanMatch.id;
            }
          }
        });
      }

      setMappedProducts(initialMap);
      showNotification('success', 'XML processado! Revise o faturamento e faça o mapeamento dos itens.');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao processar arquivo XML: ' + err.message);
      setParsedInvoice(null);
      setXmlFile(null);
    } finally {
      setIsParsingXml(false);
    }
  };

  // Autocadastro de Fornecedor a partir do XML
  const handleAutoCreateSupplier = async () => {
    if (!parsedInvoice) return;
    setIsCreatingXmlSupplier(true);
    try {
      const { data, error } = await supabase
        .from('fornecedores')
        .insert([{
          cnpj_cpf: parsedInvoice.fornecedor.cnpj,
          razao_social: parsedInvoice.fornecedor.razaoSocial,
          nome_fantasia: parsedInvoice.fornecedor.nomeFantasia || parsedInvoice.fornecedor.razaoSocial,
          inscricao_estadual: parsedInvoice.fornecedor.ie,
          telefone: parsedInvoice.fornecedor.telefone,
          email: parsedInvoice.fornecedor.email,
          endereco: parsedInvoice.fornecedor.endereco
        }])
        .select()
        .single();

      if (error) throw error;

      setSuppliers(prev => [...prev, data].sort((a,b) => a.razao_social.localeCompare(b.razao_social)));
      showNotification('success', 'Fornecedor cadastrado automaticamente a partir do XML!');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro ao cadastrar fornecedor: ' + err.message);
    } finally {
      setIsCreatingXmlSupplier(false);
    }
  };

  // Confirm XML Import
  const handleConfirmXmlImport = async () => {
    if (!parsedInvoice || !xmlLocationId || !activeCompany) return;

    // Validate that all items are mapped
    const allMapped = parsedInvoice.itens.every(item => mappedProducts[item.cProd]);
    if (!allMapped) {
      showNotification('error', 'Associe todos os itens da nota fiscal aos produtos do seu estoque antes de importar.');
      return;
    }

    const cleanXmlCnpj = parsedInvoice.fornecedor.cnpj.replace(/\D/g, '');
    const supplierObj = suppliers.find(s => s.cnpj_cpf.replace(/\D/g, '') === cleanXmlCnpj);
    if (!supplierObj) {
      showNotification('error', 'Cadastre o fornecedor antes de confirmar a importação da nota.');
      return;
    }

    setIsImportingXml(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Save new mappings in public.fornecedor_produto_mapeamento
      for (const item of parsedInvoice.itens) {
        const targetProdId = mappedProducts[item.cProd];
        
        // Check if mapping already exists
        const { data: existingMap } = await supabase
          .from('fornecedor_produto_mapeamento')
          .select('id')
          .eq('fornecedor_id', supplierObj.id)
          .eq('codigo_fornecedor', item.cProd)
          .maybeSingle();

        if (!existingMap) {
          await supabase
            .from('fornecedor_produto_mapeamento')
            .insert({
              fornecedor_id: supplierObj.id,
              codigo_fornecedor: item.cProd,
              produto_id: targetProdId
            });
        }
      }

      // 2. Insert into public.compras
      const { data: purchase, error: purchaseErr } = await supabase
        .from('compras')
        .insert({
          fornecedor_id: supplierObj.id,
          empresa_id: activeCompany.id,
          numero_documento: parsedInvoice.numero,
          data_compra: new Date(parsedInvoice.dataEmissao).toISOString(),
          valor_total: parsedInvoice.total,
          status: 'confirmada',
          observacoes: `Importação Automática via XML NF-e #${parsedInvoice.numero}`
        })
        .select()
        .single();

      if (purchaseErr) throw purchaseErr;

      // 3. Loop items to save and adjust stock
      for (const item of parsedInvoice.itens) {
        const prodId = mappedProducts[item.cProd];

        // Insert item record
        const { error: itemErr } = await supabase
          .from('compra_itens')
          .insert({
            compra_id: purchase.id,
            produto_id: prodId,
            quantidade: item.qCom,
            custo_unitario: item.vUnCom,
            local_destino_id: xmlLocationId
          });
        if (itemErr) throw itemErr;

        // Upsert stock balance at target destination
        const { data: existing } = await supabase
          .from('saldos_estoque')
          .select('id, saldo_atual')
          .eq('produto_id', prodId)
          .eq('local_estoque_id', xmlLocationId)
          .maybeSingle();

        const currentStock = existing ? Number(existing.saldo_atual) : 0;
        const newStock = currentStock + item.qCom;
        if (existing) {
          const { error: stockErr } = await supabase
            .from('saldos_estoque')
            .update({ saldo_atual: newStock })
            .eq('id', existing.id);
          if (stockErr) throw stockErr;
        } else {
          const { error: stockErr } = await supabase
            .from('saldos_estoque')
            .insert({
              produto_id: prodId,
              local_estoque_id: xmlLocationId,
              saldo_atual: newStock,
              saldo_reservado: 0
            });
          if (stockErr) throw stockErr;
        }

        // Log movement
        const { error: logErr } = await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: prodId,
            origem_local_id: null,
            destino_local_id: xmlLocationId,
            tipo_movimentacao: 'entrada_compra',
            quantidade: item.qCom,
            custo_unitario: item.vUnCom,
            motivo: `NF-e XML Import Doc #${parsedInvoice.numero}`,
            usuario_id: user?.id,
            referencia_tipo: 'compra',
            referencia_id: purchase.id
          });
        if (logErr) throw logErr;

        // Update Average Cost Price (Custo Médio Ponderado)
        const prodObj = products.find(p => p.id === prodId);
        const currentCusto = prodObj?.custo_medio ? Number(prodObj.custo_medio) : Number(item.vUnCom);
        
        const newCusto = newStock > 0 
          ? Number((((currentStock * currentCusto) + (item.qCom * item.vUnCom)) / newStock).toFixed(2))
          : item.vUnCom;

        await supabase
          .from('products')
          .update({ custo_medio: newCusto })
          .eq('id', prodId);
      }

      // 4. Generate Contas a Pagar titles based on duplicatas
      const supplierName = supplierObj.nome_fantasia || supplierObj.razao_social;
      if (parsedInvoice.duplicatas.length > 0) {
        for (const dup of parsedInvoice.duplicatas) {
          await supabase
            .from('contas_pagar')
            .insert({
              empresa_id: activeCompany.id,
              fornecedor_id: supplierObj.id,
              compra_id: purchase.id,
              descricao: `NF-e #${parsedInvoice.numero} Parc. ${dup.numero} - ${supplierName}`,
              categoria: 'compra_mercadoria',
              valor: dup.valor,
              vencimento: dup.vencimento,
              status: 'pendente'
            });
        }
      } else {
        // Fallback to single duplicata with 15 days if no duplicatas inside XML
        const fallbackDue = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await supabase
          .from('contas_pagar')
          .insert({
            empresa_id: activeCompany.id,
            fornecedor_id: supplierObj.id,
            compra_id: purchase.id,
            descricao: `NF-e #${parsedInvoice.numero} - Única - ${supplierName}`,
            categoria: 'compra_mercadoria',
            valor: parsedInvoice.total,
            vencimento: fallbackDue,
            status: 'pendente'
          });
      }

      showNotification('success', 'Nota Fiscal importada com sucesso! Estoque e Custos Médios atualizados, Contas a Pagar geradas.');
      
      // Clear state and redirect to history
      setXmlFile(null);
      setParsedInvoice(null);
      setMappedProducts({});
      setActiveTab('history');
      await fetchPurchaseHistory();
      await fetchInitialData();

    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro ao finalizar importação: ' + err.message);
    } finally {
      setIsImportingXml(false);
    }
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.cnpj_cpf || !newSupplier.razao_social) return;

    setIsSavingSupplier(true);
    try {
      const { data, error } = await supabase
        .from('fornecedores')
        .insert([newSupplier])
        .select()
        .single();

      if (error) throw error;

      setSuppliers(prev => [...prev, data].sort((a,b)=> a.razao_social.localeCompare(b.razao_social)));
      setSelectedSupplier(data.id);
      setIsSupplierModalOpen(false);
      
      // Reset state
      setNewSupplier({
        cnpj_cpf: '',
        razao_social: '',
        nome_fantasia: '',
        telefone: '',
        email: '',
        endereco: ''
      });

      showNotification('success', 'Fornecedor cadastrado com sucesso!');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro ao cadastrar fornecedor: ' + err.message);
    } finally {
      setIsSavingSupplier(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-ink-950 text-white">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <ShoppingBag className="text-gold-500 w-8 h-8" /> Compras e Fornecedores
          </h1>
          <p className="text-gray-400 mt-1">Lançamento de compras de fornecedores, alimentação de estoque e contas a pagar.</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start md:self-center overflow-x-auto max-w-full">
          {[
            { id: 'new_purchase', label: 'Registrar Compra', icon: Plus },
            { id: 'import_xml', label: 'Importar XML NF-e', icon: Upload },
            { id: 'history', label: 'Histórico de Compras', icon: FileText },
            { id: 'suppliers', label: 'Fornecedores', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-bold rounded-lg text-xs md:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/10' 
                : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 ${
              notification.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-12 bg-white/5 rounded-2xl w-full" />
          <div className="h-96 bg-white/5 rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: NEW PURCHASE */}
          {activeTab === 'new_purchase' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Items Table Panel */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                  <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4">
                    Itens da Compra
                  </h3>

                  {purchaseItems.length === 0 ? (
                    <div className="py-24 text-center text-gray-500 italic flex flex-col items-center justify-center">
                      <ShoppingBag className="w-12 h-12 opacity-10 mb-4" />
                      Nenhum item adicionado ainda. Escolha produtos na barra lateral.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {purchaseItems.map(item => {
                        const prod = products.find(p => p.id === item.produto_id);
                        return (
                          <div 
                            key={item.produto_id}
                            className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:gap-4 hover:bg-white/10 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-sm truncate">{prod?.name}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Unidade: {prod?.unit}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full sm:w-auto">
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-black uppercase tracking-widest ml-1">Quantidade</label>
                                <div className="flex gap-1">
                                  <input 
                                    type="number"
                                    step="0.001"
                                    value={item.quantidade}
                                    onChange={e => handleUpdateItemField(item.produto_id, 'quantidade', Number(e.target.value))}
                                    className="w-full sm:w-24 bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                                  />
                                  {prod?.unit === 'kg' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openWeighModal(prod);
                                      }}
                                      className="p-2 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 border border-gold-500/20 rounded-xl transition-all"
                                      title="Ler Peso da Balança"
                                    >
                                      <Barcode className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-black uppercase tracking-widest ml-1">Custo Unit (R$)</label>
                                <input 
                                  type="number"
                                  step="0.01"
                                  value={item.custo_unitario}
                                  onChange={e => handleUpdateItemField(item.produto_id, 'custo_unitario', Number(e.target.value))}
                                  className="w-full sm:w-28 bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-black uppercase tracking-widest ml-1">Local Destino</label>
                                <select 
                                  value={item.local_destino_id}
                                  onChange={e => handleUpdateItemField(item.produto_id, 'local_destino_id', e.target.value)}
                                  className="w-full sm:w-36 bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
                                  style={{ colorScheme: 'dark' }}
                                >
                                  {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.nome}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="text-right sm:pr-2 min-w-[70px] flex flex-col justify-end">
                                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Subtotal</span>
                                <span className="text-xs font-black text-white whitespace-nowrap">R$ {item.subtotal.toFixed(2)}</span>
                              </div>

                              <div className="flex items-end justify-end h-full">
                                <button 
                                  onClick={() => handleRemovePurchaseItem(item.produto_id)}
                                  className="p-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all self-end"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Sidebar & Search */}
              <div className="space-y-6">
                <form onSubmit={handleSubmitPurchase} className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4">
                    Ficha da Compra
                  </h3>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Fornecedor *</label>
                    <div className="flex gap-2">
                      <select 
                        required
                        value={selectedSupplier}
                        onChange={e => setSelectedSupplier(e.target.value)}
                        className="flex-1 bg-ink-950 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:outline-none cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="">Selecione o Fornecedor...</option>
                        {suppliers.map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.nome_fantasia || sup.razao_social}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        onClick={() => setIsSupplierModalOpen(true)}
                        className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gold-500 transition-all"
                        title="Cadastrar Novo Fornecedor"
                      >
                        <UserPlus className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Nº Nota / Documento</label>
                    <input 
                      type="text"
                      placeholder="Ex: NF-e 004.854"
                      value={docNumber}
                      onChange={e => setDocNumber(e.target.value)}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Data Compra</label>
                      <input 
                        type="date"
                        value={purchaseDate}
                        onChange={e => setPurchaseDate(e.target.value)}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Venc. Financeiro</label>
                      <input 
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Observações</label>
                    <textarea 
                      rows={2}
                      placeholder="Observações adicionais..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none resize-none"
                    />
                  </div>

                  <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-bold uppercase">Total da Compra:</span>
                    <span className="text-xl font-black text-gold-500">R$ {calculateTotal().toFixed(2)}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingPurchase || purchaseItems.length === 0}
                    className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-gold-500/10 flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingPurchase ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Confirmar e Alimentar Estoque'
                    )}
                  </button>
                </form>

                {/* Products Quick Selector */}
                <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-display font-bold text-white">Adicionar Produtos</h3>
                  <div className="max-h-64 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {products.map(p => {
                      const added = purchaseItems.some(i => i.produto_id === p.id);
                      return (
                        <div key={p.id} className="flex gap-2">
                          <button
                            onClick={() => handleAddPurchaseItem(p.id)}
                            disabled={added}
                            className={`flex-1 text-left p-3 rounded-xl border transition-all text-xs flex justify-between items-center ${
                              added 
                              ? 'bg-white/5 border-white/5 text-gray-500 cursor-not-allowed'
                              : 'bg-ink-950 border-white/5 text-white hover:border-gold-500/20 hover:bg-white/5'
                            }`}
                          >
                            <span className="font-bold truncate max-w-[140px]">{p.name}</span>
                            <span className="shrink-0 text-[10px] text-gray-500 font-bold uppercase">{p.unit}</span>
                          </button>
                          {p.unit === 'kg' && !added && (
                            <button
                              type="button"
                              onClick={() => {
                                openWeighModal(p);
                              }}
                              className="p-3 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 border border-gold-500/20 rounded-xl transition-all flex items-center justify-center shrink-0"
                              title="Pesar na Balança"
                            >
                              <Barcode className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT XML NF-E */}
          {activeTab === 'import_xml' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-8">
              
              {/* Drag and Drop Area */}
              {!parsedInvoice ? (
                <div className="max-w-xl mx-auto space-y-6">
                  <h3 className="text-xl font-display font-bold text-white text-center">
                    Importação de Nota Fiscal Eletrônica (XML)
                  </h3>
                  <p className="text-xs text-gray-400 text-center leading-relaxed max-w-sm mx-auto">
                    Arraste o arquivo XML da NF-e emitido pelo fornecedor para fazer a reposição de estoque automática e gerar o financeiro.
                  </p>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 hover:border-gold-500/30 bg-white/5 hover:bg-white/10 p-12 rounded-[2.5rem] text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 group"
                  >
                    <div className="w-16 h-16 bg-gold-500/10 text-gold-500 rounded-full flex items-center justify-center border border-gold-500/20 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">Clique para selecionar ou arraste o XML</p>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">Apenas arquivos .xml da SEFAZ</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".xml" 
                      ref={fileInputRef} 
                      onChange={handleXmlFileChange} 
                      className="hidden" 
                    />
                  </div>

                  {/* IMPORTAÇÃO POR CHAVE DE ACESSO */}
                  <div className="border-t border-white/5 pt-6 space-y-4">
                    <p className="text-xs text-gray-400 text-center font-bold uppercase tracking-wider">Ou digite a Chave de Acesso (44 dígitos)</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        maxLength={44}
                        placeholder="Chave de Acesso (44 dígitos)" 
                        value={accessKeyInput}
                        onChange={e => setAccessKeyInput(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-gold-500"
                      />
                      <button
                        type="button"
                        onClick={handleImportByAccessKey}
                        disabled={accessKeyInput.length !== 44 || isFetchingKey}
                        className="bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-ink-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {isFetchingKey ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : 'Buscar Nota'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* XML Details Header */}
                  <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-white/5 pb-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gold-500 font-black uppercase tracking-widest">Nota Fiscal Eletrônica</span>
                        <span className="font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                          Doc #{parsedInvoice.numero}
                        </span>
                      </div>
                      <h2 className="text-2xl font-display font-bold text-white">
                        {parsedInvoice.fornecedor.nomeFantasia || parsedInvoice.fornecedor.razaoSocial}
                      </h2>
                      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[10px] text-gray-400 font-bold uppercase">
                        <span>CNPJ: <strong className="text-white">{parsedInvoice.fornecedor.cnpj}</strong></span>
                        {parsedInvoice.fornecedor.ie && <span>IE: <strong className="text-white">{parsedInvoice.fornecedor.ie}</strong></span>}
                        <span>Emissão: <strong className="text-white">{new Date(parsedInvoice.dataEmissao).toLocaleDateString('pt-BR')}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Destination Inventory */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest block ml-1">Lançar no Estoque</label>
                        <select
                          value={xmlLocationId}
                          onChange={e => setXmlLocationId(e.target.value)}
                          className="bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-right">
                        <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Total da Nota</p>
                        <p className="text-2xl font-black text-gold-500">R$ {Number(parsedInvoice.total).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Verification Check */}
                  {(() => {
                    const cleanCnpj = parsedInvoice.fornecedor.cnpj.replace(/\D/g, '');
                    const isRegistered = suppliers.some(s => s.cnpj_cpf.replace(/\D/g, '') === cleanCnpj);
                    if (!isRegistered) {
                      return (
                        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex gap-3">
                            <AlertTriangle className="text-red-500 shrink-0 w-6 h-6" />
                            <div>
                              <p className="font-bold text-sm text-white">Fornecedor não cadastrado no sistema!</p>
                              <p className="text-xs text-gray-400 mt-0.5">O CNPJ {parsedInvoice.fornecedor.cnpj} não consta em sua lista de fornecedores.</p>
                            </div>
                          </div>
                          <button
                            onClick={handleAutoCreateSupplier}
                            disabled={isCreatingXmlSupplier}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] px-5 py-3 rounded-2xl transition-all flex items-center gap-1.5 self-end md:self-auto shrink-0 shadow-lg shadow-red-950/20"
                          >
                            {isCreatingXmlSupplier ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Cadastrar Automaticamente</>}
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* XML Items Mapping Table */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                      Mapeamento de Produtos da Nota
                    </h4>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 pb-2 text-[10px] font-black uppercase text-gray-500">
                            <th className="pb-3 pr-4">Item (Fornecedor)</th>
                            <th className="pb-3 text-right pr-6">Quant. / Un</th>
                            <th className="pb-3 text-right pr-6">Custo Unit</th>
                            <th className="pb-3">Vinculação com Estoque Interno</th>
                            <th className="pb-3 text-right">Simulação Custo Médio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {parsedInvoice.itens.map(item => {
                            const internalId = mappedProducts[item.cProd];
                            const internalProd = products.find(p => p.id === internalId);
                            
                            // Average Cost Simulation
                            let costSim = null;
                            if (internalProd) {
                              const currentCusto = internalProd.custo_medio ? Number(internalProd.custo_medio) : Number(item.vUnCom);
                              costSim = `R$ ${Number(item.vUnCom).toFixed(2)}`;
                            }

                            return (
                              <tr key={item.cProd} className="hover:bg-white/5 transition-colors">
                                <td className="py-4 pr-4">
                                  <p className="font-bold text-white text-sm">{item.xProd}</p>
                                  <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                                    Cód Fornecedor: <strong className="font-mono">{item.cProd}</strong> {item.cEAN && item.cEAN !== 'SEM GTIN' && `| EAN: ${item.cEAN}`}
                                  </p>
                                </td>
                                
                                <td className="py-4 text-right pr-6 font-bold text-white font-mono">
                                  {Number(item.qCom).toFixed(3)} <span className="text-[10px] text-gray-500 uppercase">{item.uCom}</span>
                                </td>

                                <td className="py-4 text-right pr-6 font-bold text-white font-mono">
                                  R$ {Number(item.vUnCom).toFixed(2)}
                                </td>

                                <td className="py-4 min-w-[280px]">
                                  <div className="flex flex-col gap-1.5">
                                    <select
                                      value={internalId || ''}
                                      onChange={e => setMappedProducts({...mappedProducts, [item.cProd]: e.target.value})}
                                      className={`w-full max-w-[280px] bg-ink-950 border rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer ${
                                        internalId 
                                        ? 'border-green-500/30 focus:border-green-500' 
                                        : 'border-yellow-500/30 focus:border-yellow-500'
                                      }`}
                                      style={{ colorScheme: 'dark' }}
                                    >
                                      <option value="">Associe um produto do estoque...</option>
                                      {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                                      ))}
                                    </select>
                                    {internalId ? (
                                      <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        🟢 Vinculado: {internalProd?.name}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-yellow-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        ⚠️ Sem correspondência (Mapeamento Obrigatório)
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-4 text-right font-bold text-gold-500 font-mono">
                                  {costSim || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Duplicatas / Finance section */}
                  {parsedInvoice.duplicatas.length > 0 && (
                    <div className="space-y-4 border-t border-white/5 pt-6">
                      <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gold-500" /> Contas a Pagar Geradas (Duplicatas)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {parsedInvoice.duplicatas.map(dup => (
                          <div key={dup.numero} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                            <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Parcela #{dup.numero}</span>
                            <span className="text-xs text-white font-bold mt-1.5">Venc: {new Date(dup.vencimento).toLocaleDateString('pt-BR')}</span>
                            <span className="text-sm font-black text-gold-500 mt-0.5">R$ {Number(dup.valor).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                    <button
                      onClick={() => {
                        setXmlFile(null);
                        setParsedInvoice(null);
                        setMappedProducts({});
                      }}
                      className="bg-white/5 hover:bg-white/10 text-gray-400 font-bold px-6 py-4 rounded-xl uppercase tracking-wider text-xs border border-white/10"
                    >
                      Cancelar e Limpar
                    </button>
                    <button
                      onClick={handleConfirmXmlImport}
                      disabled={isImportingXml || parsedInvoice.itens.some(item => !mappedProducts[item.cProd])}
                      className="bg-gold-500 hover:bg-gold-600 disabled:opacity-30 text-ink-950 font-black px-8 py-4 rounded-xl uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-gold-500/10"
                    >
                      {isImportingXml ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Confirmar e Importar Nota'}
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 3: PURCHASE HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4 flex items-center gap-2">
                <FileText className="text-gold-500 w-5 h-5" /> Registro de Compras Realizadas
              </h3>

              <div className="space-y-4">
                {purchases.length === 0 ? (
                  <p className="py-12 text-center text-gray-500 italic">Nenhuma compra registrada.</p>
                ) : (
                  purchases.map(p => {
                    const isExpanded = expandedPurchase === p.id;
                    return (
                      <div 
                        key={p.id}
                        className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all"
                      >
                        {/* Summary Header */}
                        <div 
                          onClick={() => setExpandedPurchase(isExpanded ? null : p.id)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-all select-none"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {p.fornecedores?.nome_fantasia || p.fornecedores?.razao_social || 'Fornecedor'}
                              </span>
                              <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-black text-[9px] uppercase">
                                {p.status}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-1.5 text-[10px] text-gray-500 font-bold uppercase">
                              <span>Empresa: <strong className="text-white">{p.empresas?.nome_fantasia}</strong></span>
                              <span>Doc: <strong className="text-white">{p.numero_documento || 'Sem doc'}</strong></span>
                              <span>Data: <strong className="text-white">{new Date(p.data_compra).toLocaleDateString('pt-BR')}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6">
                            <div className="text-right">
                              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Valor Total</p>
                              <p className="text-lg font-black text-gold-500">R$ {Number(p.valor_total).toFixed(2)}</p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                          </div>
                        </div>

                        {/* Expanded Items */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/5 bg-ink-950/40 p-4"
                            >
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-gray-400">
                                  <thead>
                                    <tr className="border-b border-white/5 pb-2 text-[10px] font-black uppercase text-gray-500">
                                      <th className="pb-2">Produto</th>
                                      <th className="pb-2">Local Destino</th>
                                      <th className="pb-2 text-right">Quantidade</th>
                                      <th className="pb-2 text-right">Custo Unit</th>
                                      <th className="pb-2 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.compra_itens?.map((item: any) => (
                                      <tr key={item.id} className="border-b border-white/5 last:border-0">
                                        <td className="py-2.5 font-bold text-white">{item.products?.name}</td>
                                        <td className="py-2.5 font-bold text-gray-400">{item.locais_estoque?.nome}</td>
                                        <td className="py-2.5 text-right font-bold text-white">{Number(item.quantidade).toFixed(3)} {item.products?.unit}</td>
                                        <td className="py-2.5 text-right font-bold text-white">R$ {Number(item.custo_unitario).toFixed(2)}</td>
                                        <td className="py-2.5 text-right font-black text-white">R$ {Number(item.quantidade * item.custo_unitario).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {p.observacoes && (
                                <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-500 font-medium">
                                  <strong>Observações:</strong> {p.observacoes}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SUPPLIERS LIST */}
          {activeTab === 'suppliers' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <Users className="text-gold-500 w-5 h-5" /> Cadastro de Fornecedores
                </h3>
                <button
                  onClick={() => setIsSupplierModalOpen(true)}
                  className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-ink-950" /> Novo Fornecedor
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Pesquisar fornecedores..."
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  className="w-full bg-ink-950 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              {/* Suppliers List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suppliers
                  .filter(s => 
                    s.razao_social.toLowerCase().includes(supplierSearch.toLowerCase()) || 
                    (s.nome_fantasia && s.nome_fantasia.toLowerCase().includes(supplierSearch.toLowerCase())) || 
                    s.cnpj_cpf.includes(supplierSearch)
                  )
                  .map(s => (
                    <div 
                      key={s.id}
                      className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-gold-500/20 hover:bg-white/10 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <p className="font-bold text-white text-sm">{s.nome_fantasia || s.razao_social}</p>
                        {s.nome_fantasia && <p className="text-[10px] text-gray-500 font-bold mt-0.5">{s.razao_social}</p>}
                        
                        <div className="mt-3 space-y-1 text-[11px] text-gray-400 font-medium">
                          <p>CNPJ: <strong className="text-white">{s.cnpj_cpf}</strong></p>
                          {s.telefone && <p>Telefone: <strong className="text-white">{s.telefone}</strong></p>}
                          {s.email && <p>E-mail: <strong className="text-white">{s.email}</strong></p>}
                          {s.endereco && <p>Endereço: <strong className="text-white">{s.endereco}</strong></p>}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE SUPPLIER MODAL */}
      <AnimatePresence>
        {isSupplierModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setIsSupplierModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-ink-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight mb-6">Novo Fornecedor</h3>

              <form onSubmit={handleSaveSupplier} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">CNPJ ou CPF *</label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0000-00"
                    value={newSupplier.cnpj_cpf}
                    onChange={e => setNewSupplier({ ...newSupplier, cnpj_cpf: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Razão Social *</label>
                  <input
                    type="text"
                    required
                    placeholder="Empresa Fornecedora de Peixes LTDA"
                    value={newSupplier.razao_social}
                    onChange={e => setNewSupplier({ ...newSupplier, razao_social: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Nome Fantasia</label>
                  <input
                    type="text"
                    placeholder="Ex: Distribuidora Salmão do Sul"
                    value={newSupplier.nome_fantasia}
                    onChange={e => setNewSupplier({ ...newSupplier, nome_fantasia: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(47) 99999-9999"
                    value={newSupplier.telefone}
                    onChange={e => setNewSupplier({ ...newSupplier, telefone: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={newSupplier.email}
                    onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Endereço</label>
                  <input
                    type="text"
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    value={newSupplier.endereco}
                    onChange={e => setNewSupplier({ ...newSupplier, endereco: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-3 rounded-xl uppercase tracking-wider text-xs border border-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSupplier}
                    className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-3 rounded-xl uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSavingSupplier ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PESAGEM SERIAL */}
      {activeWeighProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setActiveWeighProduct(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-ink-900 border border-white/10 rounded-[2.5rem] w-full max-w-md p-8 relative z-10 shadow-2xl space-y-6 text-xs font-bold text-gray-300"
          >
            <div>
              <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Barcode className="text-gold-500 w-6 h-6" /> Pesagem na Balança
              </h3>
              <p className="text-gray-500 text-xs mt-1 font-medium">Produto: <strong className="text-white">{activeWeighProduct.name}</strong></p>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-between p-4 bg-ink-950 rounded-2xl border border-white/5">
              <span className="text-gray-400">Status da Balança:</span>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${
                  scale.status === 'connected'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : scale.status === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    scale.status === 'connected' ? 'bg-green-500' : scale.status === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  {scale.status === 'connected' ? 'Conectado (Toledo Prix)' : scale.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </span>
                {scale.status === 'connected' && (
                  <button
                    type="button"
                    onClick={() => scale.requestWeight()}
                    className="p-1.5 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 rounded-lg transition-all"
                    title="Ler Peso Agora"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Baud Rate Config */}
            {scale.status === 'disconnected' && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block ml-1">Velocidade (Baud Rate)</label>
                <select
                  value={scale.config.baudRate}
                  onChange={e => scale.setConfig({ baudRate: Number(e.target.value) })}
                  className="w-full bg-ink-950 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none cursor-pointer"
                >
                  <option value={2400}>2400 bps (Padrão Toledo Prix 3 Plus)</option>
                  <option value={9600}>9600 bps</option>
                  <option value={4800}>4800 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>
            )}

            {/* Weight Display */}
            <div className="bg-ink-950/80 border border-white/10 rounded-[2rem] p-8 text-center space-y-2 relative overflow-hidden">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest block">Peso Atual</span>
              <span className="text-5xl font-black font-mono text-gold-500 tracking-tight block">
                {scale.weight.toFixed(3)}
              </span>
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest block">kg</span>
            </div>

            {scale.error && (
              <p className="text-xs text-red-500 font-bold bg-red-500/10 border border-red-500/20 p-4 rounded-xl leading-relaxed">
                ⚠️ {scale.error}
              </p>
            )}

            <div className="flex gap-4">
              {scale.status === 'disconnected' ? (
                <button
                  type="button"
                  onClick={() => scale.connect(true)}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5"
                >
                  Conectar Balança
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => scale.requestWeight()}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Ler Peso
                </button>
              )}
              <button
                type="button"
                disabled={scale.status !== 'connected' || scale.weight <= 0}
                onClick={handleConfirmWeight}
                className="flex-1 bg-green-500 disabled:opacity-50 hover:bg-green-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-green-500/10"
              >
                Confirmar Peso
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
