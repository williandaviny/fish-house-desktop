import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCcw, 
  ArrowRight, 
  DollarSign, 
  Scale, 
  Clock, 
  Truck, 
  Check, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  PieChart,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { industrializationService, IndustrializationOrder } from '../services/industrializationService';
import { useScale } from '../services/scale/useScale';

type Product = {
  id: string;
  name: string;
  unit: string;
  custo_medio?: number;
  barcode?: string;
};

type Supplier = {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
};

type LocalEstoque = {
  id: string;
  nome: string;
  tipo: string;
};

export default function AdminIndustrialization() {
  const [orders, setOrders] = useState<IndustrializationOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<LocalEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'remetido' | 'concluido'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<IndustrializationOrder | null>(null);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<IndustrializationOrder | null>(null);
  const [printType, setPrintType] = useState<'romaneio' | 'etiqueta_lote' | 'etiqueta_bandeja'>('romaneio');

  // New Order Form state
  const [newOrder, setNewOrder] = useState({
    insumo_produto_id: '',
    quantidade_remessa: '',
    custo_unitario: '',
    fornecedor_id: '',
    local_origem_id: '',
    numero_nfe_remessa: '',
    chave_nfe_remessa: '',
    data_retorno_prevista: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel: 'Chefe de Manipulação Fish House',
    observacoes: ''
  });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Return Order Form state
  const [returnData, setReturnData] = useState({
    produto_retornado_id: '',
    quantidade_retornada: '',
    valor_servico_corte: '',
    local_destino_id: '',
    numero_nfe_retorno: '',
    chave_nfe_retorno: '',
    data_vencimento_servico: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Web Serial Scale
  const scale = useScale();

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Products
      const { data: prods } = await supabase.from('products').select('id, name, unit, custo_medio, barcode').order('name');
      setProducts(prods || []);

      // 2. Suppliers
      const { data: sups } = await supabase.from('fornecedores').select('id, razao_social, nome_fantasia').order('razao_social');
      setSuppliers(sups || []);

      // 3. Locations
      const { data: locs } = await supabase.from('locais_estoque').select('id, nome, tipo');
      setLocations(locs || []);

      // Defaults
      if (locs && locs.length > 0) {
        setNewOrder(prev => ({ ...prev, local_origem_id: locs[0].id }));
        setReturnData(prev => ({ ...prev, local_destino_id: locs[0].id }));
      }

      // 4. Industrialization Orders
      const orderList = await industrializationService.list();
      setOrders(orderList);

    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro ao carregar dados de industrialização: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick Insumo Selection & Cost population
  const handleSelectInsumo = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    setNewOrder(prev => ({
      ...prev,
      insumo_produto_id: prodId,
      custo_unitario: prod?.custo_medio ? String(prod.custo_medio) : '55.00'
    }));
  };

  // Capture Scale Weight for Remessa
  const handleCaptureScaleWeight = () => {
    if (scale.weight && scale.weight > 0) {
      setNewOrder(prev => ({ ...prev, quantidade_remessa: String(scale.weight) }));
      showNotification('success', `Peso capturado da Toledo Prix: ${scale.weight.toFixed(3)} kg`);
    } else {
      scale.readWeight();
      setTimeout(() => {
        if (scale.weight && scale.weight > 0) {
          setNewOrder(prev => ({ ...prev, quantidade_remessa: String(scale.weight) }));
          showNotification('success', `Peso capturado da Toledo Prix: ${scale.weight.toFixed(3)} kg`);
        } else {
          showNotification('error', 'Balança não conectada ou prato vazio.');
        }
      }, 500);
    }
  };

  // Submit Remittance Order (Salmão Inteiro Enviado)
  const handleSubmitNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.insumo_produto_id || !newOrder.quantidade_remessa || !newOrder.fornecedor_id || !newOrder.local_origem_id) {
      showNotification('error', 'Preencha todos os campos obrigatórios da ordem.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      await industrializationService.createRemessa({
        insumo_produto_id: newOrder.insumo_produto_id,
        quantidade_remessa: Number(newOrder.quantidade_remessa),
        custo_unitario: Number(newOrder.custo_unitario || 0),
        fornecedor_id: newOrder.fornecedor_id,
        local_origem_id: newOrder.local_origem_id,
        numero_nfe_remessa: newOrder.numero_nfe_remessa || undefined,
        chave_nfe_remessa: newOrder.chave_nfe_remessa || undefined,
        data_retorno_prevista: newOrder.data_retorno_prevista || undefined,
        responsavel: newOrder.responsavel || undefined,
        observacoes: newOrder.observacoes || undefined
      });

      showNotification('success', 'Ordem de manipulação criada com sucesso! Romaneio gerado.');
      setIsNewOrderModalOpen(false);
      setNewOrder({
        insumo_produto_id: '',
        quantidade_remessa: '',
        custo_unitario: '',
        fornecedor_id: '',
        local_origem_id: locations[0]?.id || '',
        numero_nfe_remessa: '',
        chave_nfe_remessa: '',
        data_retorno_prevista: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        responsavel: 'Chefe de Manipulação Fish House',
        observacoes: ''
      });

      await fetchData();
    } catch (err: any) {
      showNotification('error', 'Falha ao criar ordem: ' + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (order: IndustrializationOrder) => {
    setSelectedReturnOrder(order);
    
    // Suggest finished filet product (e.g. products containing "Filé" or "Salmão")
    const suggestedFilet = products.find(p => 
      p.name.toLowerCase().includes('filé') && p.name.toLowerCase().includes('salmão')
    ) || products[0];

    const insumoItem = order.itens?.find(i => i.tipo === 'insumo_remetido');
    const pesoInsumo = insumoItem?.quantidade || 100;
    // Default 60% estimated yield
    const estimatedYield = Number((pesoInsumo * 0.60).toFixed(3));

    setReturnData({
      produto_retornado_id: suggestedFilet?.id || '',
      quantidade_retornada: String(estimatedYield),
      valor_servico_corte: String(Number((pesoInsumo * 8.00).toFixed(2))), // R$ 8/kg corte default
      local_destino_id: locations[0]?.id || '',
      numero_nfe_retorno: '',
      chave_nfe_retorno: '',
      data_vencimento_servico: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  // Submit Return (Entrada de Filé + Rendimento + Recálculo)
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnOrder || !returnData.produto_retornado_id || !returnData.quantidade_retornada || !returnData.local_destino_id) {
      showNotification('error', 'Preencha todos os campos do retorno.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const result = await industrializationService.processRetorno({
        ordem_id: selectedReturnOrder.id,
        produto_retornado_id: returnData.produto_retornado_id,
        quantidade_retornada: Number(returnData.quantidade_retornada),
        valor_servico_corte: Number(returnData.valor_servico_corte || 0),
        local_destino_id: returnData.local_destino_id,
        numero_nfe_retorno: returnData.numero_nfe_retorno || undefined,
        chave_nfe_retorno: returnData.chave_nfe_retorno || undefined,
        data_vencimento_servico: returnData.data_vencimento_servico || undefined
      });

      showNotification('success', `✨ Retorno concluído! Rendimento: ${result.rendimento}% | Novo custo do filé: R$ ${result.novoCustoFilé.toFixed(2)}/kg`);
      setSelectedReturnOrder(null);
      await fetchData();
    } catch (err: any) {
      showNotification('error', 'Erro ao processar retorno: ' + err.message);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Print Handlers
  const handlePrintDocument = (order: IndustrializationOrder, type: 'romaneio' | 'etiqueta_lote' | 'etiqueta_bandeja') => {
    setSelectedPrintOrder(order);
    setPrintType(type);

    const insumoItem = order.itens?.find(i => i.tipo === 'insumo_remetido');
    const retornadoItem = order.itens?.find(i => i.tipo === 'produto_retornado');
    const supName = order.fornecedores?.nome_fantasia || order.fornecedores?.razao_social || 'Prestador de Serviço';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    if (type === 'romaneio') {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Romaneio de Manipulação - ${order.numero_ordem}</title>
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 35px; color: #111; font-size: 13px; line-height: 1.4; }
              .header { border-bottom: 3px solid #cf9e46; padding-bottom: 12px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
              .title { font-size: 22px; font-weight: bold; color: #cf9e46; }
              .doc-badge { background: #eee; padding: 4px 8px; border-radius: 4px; font-mono; font-size: 11px; font-weight: bold; }
              .grid-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
              .box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #fafafa; }
              .box-title { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #666; margin-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
              th { background: #f2f2f2; text-align: left; padding: 10px; border-bottom: 2px solid #ccc; font-size: 11px; text-transform: uppercase; }
              td { padding: 10px; border-bottom: 1px solid #eee; }
              .text-right { text-align: right; }
              .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; text-align: center; }
              .sig-line { border-top: 1px solid #333; padding-top: 8px; font-weight: bold; font-size: 11px; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="header">
              <div>
                <div class="title">FISH HOUSE - PEIXARIA PREMIUM</div>
                <div>Romaneio de Remessa para Industrialização & Corte</div>
              </div>
              <div style="text-align: right;">
                <div class="doc-badge">${order.numero_ordem}</div>
                <div style="margin-top: 5px; font-size: 11px; color: #666;">Data: ${new Date(order.data_remessa).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>

            <div class="grid-box">
              <div class="box">
                <div class="box-title">Frigorífico / Prestador de Serviço</div>
                <strong>${supName}</strong><br>
                ${order.fornecedores?.razao_social || ''}<br>
                NF-e Remessa: <strong>${order.numero_nfe_remessa || 'CFOP 5.901 (Emissão Interna)'}</strong>
              </div>
              <div class="box">
                <div class="box-title">Dados de Transporte e Controle</div>
                Responsável: <strong>${order.responsavel || 'Operador Técnico'}</strong><br>
                Previsão de Retorno: <strong>${order.data_retorno_prevista ? new Date(order.data_retorno_prevista).toLocaleDateString('pt-BR') : 'A Combinar'}</strong><br>
                Temperatura Exigida: <strong>0°C a 2°C (Gelo Escama)</strong>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item Remetido (Insumo Bruto)</th>
                  <th class="text-right">Peso Remetido (kg)</th>
                  <th class="text-right">Custo Unit. (R$)</th>
                  <th class="text-right">Subtotal Insumo (R$)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${insumoItem?.produtos?.name || 'Salmão Inteiro Fresco'}</strong></td>
                  <td class="text-right font-bold">${Number(insumoItem?.quantidade || 0).toFixed(3)} kg</td>
                  <td class="text-right">R$ ${Number(insumoItem?.custo_unitario || 0).toFixed(2)}</td>
                  <td class="text-right"><strong>R$ ${Number(insumoItem?.subtotal || 0).toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div style="border: 1px dashed #ccc; padding: 12px; border-radius: 6px; font-size: 11px; color: #555;">
              <strong>Instruções de Manipulação:</strong> Descascar, eviscerar e cortar em filés limpos sem pele e sem espinhas em conformidade com as normas sanitárias e controle de temperatura. Registrar quebra de aparas e rendimento percentual no ato da devolução.
            </div>

            <div class="signatures">
              <div>
                <div class="sig-line">Expedição Fish House<br><span style="font-size: 9px; font-weight: normal; color: #777;">Responsável Técnico</span></div>
              </div>
              <div>
                <div class="sig-line">Recebido pelo Frigorífico / Transportador<br><span style="font-size: 9px; font-weight: normal; color: #777;">Assinatura e Data</span></div>
              </div>
            </div>
          </body>
        </html>
      `);
    } else if (type === 'etiqueta_lote') {
      // Thermal 100x50mm Lote Label
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Etiqueta de Lote - ${order.numero_ordem}</title>
            <style>
              @page { size: 100mm 50mm; margin: 0; }
              body { font-family: monospace; padding: 6mm; color: black; font-size: 11px; line-height: 1.2; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .header { font-size: 13px; border-bottom: 1px dashed black; padding-bottom: 2mm; margin-bottom: 2mm; }
              .barcode { letter-spacing: 3px; font-size: 14px; font-weight: bold; margin: 3mm 0; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="center header bold">FISH HOUSE • MANIPULAÇÃO</div>
            <div><strong>LOTE:</strong> ${order.numero_ordem}</div>
            <div><strong>ITEM:</strong> ${insumoItem?.produtos?.name || 'Salmão Inteiro'}</div>
            <div><strong>PESO REMESSA:</strong> ${Number(insumoItem?.quantidade || 0).toFixed(3)} kg</div>
            <div><strong>DATA ENVIO:</strong> ${new Date(order.data_remessa).toLocaleDateString('pt-BR')}</div>
            <div><strong>DESTINO:</strong> ${supName.substring(0, 24)}</div>
            <div class="center barcode">||| | | |||| | ||| | |||</div>
            <div class="center" style="font-size: 9px;">CONSERVAR ENTRE 0°C E 2°C</div>
          </body>
        </html>
      `);
    } else {
      // Fillet Tray Label (Bandeja de Filé)
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Etiqueta de Produto Manipulado - Fish House</title>
            <style>
              @page { size: 100mm 50mm; margin: 0; }
              body { font-family: sans-serif; padding: 5mm; color: black; font-size: 10px; line-height: 1.25; }
              .brand { font-size: 13px; font-weight: 900; letter-spacing: 1px; color: #000; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; }
              .prod-name { font-size: 14px; font-weight: 900; margin-bottom: 3px; }
              .grid { display: flex; justify-content: space-between; margin-top: 4px; }
              .barcode { text-align: center; font-family: monospace; font-size: 15px; font-weight: bold; letter-spacing: 4px; margin-top: 4px; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="brand">FISH HOUSE • PEIXARIA PREMIUM</div>
            <div class="prod-name">${retornadoItem?.produtos?.name || 'FILÉ DE SALMÃO FRESCO'}</div>
            <div>Beneficiado a partir de Salmão Fresco importado</div>
            <div class="grid">
              <div>
                <strong>LOTE:</strong> ${order.numero_ordem}<br>
                <strong>MANIPULADO:</strong> ${new Date(order.data_retorno_efetiva || Date.now()).toLocaleDateString('pt-BR')}<br>
                <strong>VALIDADE:</strong> ${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
              </div>
              <div style="text-align: right;">
                <span style="font-size: 9px;">CONSERVAÇÃO</span><br>
                <strong>0°C A 2°C</strong><br>
                <span style="font-size: 8px;">PRONTO P/ CONSUMO</span>
              </div>
            </div>
            <div class="barcode">*${order.numero_ordem}*</div>
            <div style="text-align: center; font-size: 8px;">AV. ATLÂNTICA • BALNEÁRIO CAMBORIÚ / SC • FISH HOUSE</div>
          </body>
        </html>
      `);
    }

    printWindow.document.close();
  };

  // Filtered Orders
  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const supName = o.fornecedores?.nome_fantasia || o.fornecedores?.razao_social || '';
    const matchesSearch = !searchQuery ||
      o.numero_ordem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const inProgressOrders = orders.filter(o => o.status === 'remetido');
  const completedOrders = orders.filter(o => o.status === 'concluido');

  const totalRawFishInThirdParty = inProgressOrders.reduce((sum, o) => {
    const insumo = o.itens?.find(i => i.tipo === 'insumo_remetido');
    return sum + (insumo?.quantidade || 0);
  }, 0);

  const averageYield = completedOrders.length > 0
    ? (completedOrders.reduce((sum, o) => sum + (o.rendimento_percentual || 0), 0) / completedOrders.length)
    : 60.5;

  const totalCuttingServiceCost = completedOrders.reduce((sum, o) => sum + (o.valor_servico_corte || 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-ink-950 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Layers className="text-gold-500 w-8 h-8" /> Industrialização & Beneficiamento
          </h1>
          <p className="text-gray-400 mt-1">
            Gestão do ciclo de manipulação: Salmão Inteiro ➔ Romaneio ➔ NF-e Remessa ➔ Retorno com Filé e Rendimento.
          </p>
        </div>

        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-lg shadow-gold-500/10 flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Nova Ordem de Manipulação
        </button>
      </div>

      {/* Notifications */}
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

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-yellow-400 uppercase font-black tracking-widest">Em Manipulação Externa</span>
            <Truck className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono mt-1">{inProgressOrders.length} ordens</p>
          <p className="text-xs text-gray-400 mt-1">Salmão em frigoríficos parceiros</p>
        </div>

        <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest">Peixe Inteiro em Terceiros</span>
            <Scale className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-400 font-mono mt-1">{totalRawFishInThirdParty.toFixed(1)} kg</p>
          <p className="text-xs text-gray-400 mt-1">Saldo de matéria-prima remetida</p>
        </div>

        <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-green-400 uppercase font-black tracking-widest">Rendimento Médio de Filé</span>
            <PieChart className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-black text-green-400 font-mono mt-1">{averageYield.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">Quebra média de corte: {(100 - averageYield).toFixed(1)}%</p>
        </div>

        <div className="bg-ink-900 border border-gold-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden bg-gold-500/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gold-400 uppercase font-black tracking-widest">Serviço de Corte Pago</span>
            <DollarSign className="w-5 h-5 text-gold-500" />
          </div>
          <p className="text-2xl font-black text-gold-400 font-mono mt-1">R$ {totalCuttingServiceCost.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">Mão de obra agregada ao custo</p>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-ink-900 border border-white/10 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest mr-2">Status:</span>
          {[
            { id: 'all', label: 'Todas as Ordens' },
            { id: 'remetido', label: 'Em Manipulação (Remetidas)' },
            { id: 'concluido', label: 'Concluídas (Retornadas)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'bg-ink-950 border border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por ordem, frigorífico..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-ink-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-gold-500"
          />
        </div>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-ink-900 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase font-black text-gray-500 bg-white/5">
                <th className="py-3.5 px-6">Ordem / Lote</th>
                <th className="py-3.5 px-4">Frigorífico / Prestador</th>
                <th className="py-3.5 px-4">Insumo Remetido</th>
                <th className="py-3.5 px-4">Retorno / Filé</th>
                <th className="py-3.5 px-4 text-center">Rendimento / Quebra</th>
                <th className="py-3.5 px-4">Situação</th>
                <th className="py-3.5 px-6 text-right">Ações & Documentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 italic">
                    Nenhuma ordem de manipulação encontrada.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const insumoItem = order.itens?.find(i => i.tipo === 'insumo_remetido');
                  const retornadoItem = order.itens?.find(i => i.tipo === 'produto_retornado');
                  const supName = order.fornecedores?.nome_fantasia || order.fornecedores?.razao_social || 'Prestador';

                  return (
                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gold-400 text-sm">{order.numero_ordem}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Remetido em: {new Date(order.data_remessa).toLocaleDateString('pt-BR')}
                        </p>
                        {order.numero_nfe_remessa && (
                          <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-gray-400 font-mono">
                            NF {order.numero_nfe_remessa}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-bold text-white">
                        {supName}
                        {order.responsavel && (
                          <p className="text-[9px] text-gray-500 font-normal">Resp: {order.responsavel}</p>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-bold text-white">{insumoItem?.produtos?.name || 'Salmão Inteiro'}</p>
                        <p className="text-[11px] font-mono font-bold text-blue-400 mt-0.5">
                          {Number(insumoItem?.quantidade || 0).toFixed(3)} kg
                        </p>
                        <span className="text-[9px] text-gray-500 font-mono">
                          R$ {Number(insumoItem?.custo_unitario || 0).toFixed(2)}/kg
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        {order.status === 'concluido' && retornadoItem ? (
                          <div>
                            <p className="font-bold text-green-400">{retornadoItem.produtos?.name || 'Filé de Salmão'}</p>
                            <p className="text-[11px] font-mono font-bold text-white mt-0.5">
                              {Number(retornadoItem.quantidade).toFixed(3)} kg
                            </p>
                            <span className="text-[9px] text-gold-400 font-mono font-bold">
                              Novo Custo: R$ {Number(retornadoItem.custo_unitario).toFixed(2)}/kg
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic text-[11px]">Aguardando corte...</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {order.rendimento_percentual ? (
                          <div>
                            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-black font-mono">
                              {order.rendimento_percentual}%
                            </span>
                            {order.quebra_kg !== undefined && (
                              <p className="text-[9px] text-gray-500 mt-1 font-mono">
                                Quebra: {Number(order.quebra_kg).toFixed(3)} kg
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-wider ${
                          order.status === 'concluido'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {order.status === 'concluido' ? 'Concluída' : 'Em Corte'}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status === 'remetido' && (
                            <button
                              onClick={() => handleOpenReturnModal(order)}
                              className="bg-green-500 hover:bg-green-600 text-ink-950 font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-md shadow-green-500/10 flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Registrar Retorno
                            </button>
                          )}

                          <button
                            onClick={() => handlePrintDocument(order, 'romaneio')}
                            className="p-2 text-gray-300 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                            title="Imprimir Romaneio de Manipulação"
                          >
                            <FileText className="w-4 h-4 text-gold-500" />
                          </button>

                          <button
                            onClick={() => handlePrintDocument(order, order.status === 'concluido' ? 'etiqueta_bandeja' : 'etiqueta_lote')}
                            className="p-2 text-gray-300 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                            title={order.status === 'concluido' ? 'Imprimir Etiquetas de Bandeja de Filé' : 'Imprimir Etiqueta de Lote'}
                          >
                            <Tag className="w-4 h-4 text-blue-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NOVA ORDEM DE MANIPULAÇÃO (REMESSA) */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-ink-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gold-500/20 text-gold-400">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">Nova Ordem de Manipulação (Remessa)</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Envio de salmão inteiro para filetagem/corte no frigorífico</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitNewOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Insumo selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                  Matéria-Prima / Insumo Bruto *
                </label>
                <select
                  required
                  value={newOrder.insumo_produto_id}
                  onChange={e => handleSelectInsumo(e.target.value)}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">Selecione o peixe inteiro...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) {p.custo_medio ? `• Custo Médio: R$ ${Number(p.custo_medio).toFixed(2)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Peso e Balança */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                      Quantidade Remetida (kg) *
                    </label>
                    <button
                      type="button"
                      onClick={handleCaptureScaleWeight}
                      className="text-[9px] text-gold-400 hover:text-gold-300 font-bold uppercase tracking-wider flex items-center gap-1"
                      title="Puxar peso ao vivo da Toledo Prix"
                    >
                      <Scale className="w-3 h-3" /> Puxar Balança
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="Ex: 100.000"
                    value={newOrder.quantidade_remessa}
                    onChange={e => setNewOrder({ ...newOrder, quantidade_remessa: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white font-mono focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                    Custo Unitário (R$/kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={newOrder.custo_unitario}
                    onChange={e => setNewOrder({ ...newOrder, custo_unitario: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white font-mono focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Prestador / Frigorífico & Local */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                    Frigorífico / Prestador do Corte *
                  </label>
                  <select
                    required
                    value={newOrder.fornecedor_id}
                    onChange={e => setNewOrder({ ...newOrder, fornecedor_id: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">Selecione o frigorífico parceiro...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.nome_fantasia || s.razao_social}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                    Local de Saída do Estoque *
                  </label>
                  <select
                    required
                    value={newOrder.local_origem_id}
                    onChange={e => setNewOrder({ ...newOrder, local_origem_id: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.nome} ({loc.tipo})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* NF-e Remessa & Previsão */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                    Nº NF-e Remessa
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 004.120"
                    value={newOrder.numero_nfe_remessa}
                    onChange={e => setNewOrder({ ...newOrder, numero_nfe_remessa: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                    Previsão de Retorno do Filé
                  </label>
                  <input
                    type="date"
                    value={newOrder.data_retorno_prevista}
                    onChange={e => setNewOrder({ ...newOrder, data_retorno_prevista: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold-500"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                  Instruções & Observações de Corte
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Corte em filés sem espinhas e sem pele, toalha higiênica e gelo escama."
                  value={newOrder.observacoes}
                  onChange={e => setNewOrder({ ...newOrder, observacoes: e.target.value })}
                  className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold-500 resize-none"
                />
              </div>

              {/* Subtotal Preview */}
              <div className="bg-ink-950 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase">Valor Total do Insumo Enviado:</span>
                <span className="text-xl font-black text-gold-400 font-mono">
                  R$ {(Number(newOrder.quantidade_remessa || 0) * Number(newOrder.custo_unitario || 0)).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="flex-1 px-4 py-3 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-gold-500/10 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingOrder ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Emitir Ordem de Remessa</>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: REGISTRAR RETORNO DE FILÉ & RENDIMENTO */}
      {selectedReturnOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-ink-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-green-500/20 text-green-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">
                    Registrar Retorno de Filé • {selectedReturnOrder.numero_ordem}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Entrada do peixe pronto, cálculo de rendimento e custo recalculado</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Order Raw Fish Summary */}
              {(() => {
                const insumo = selectedReturnOrder.itens?.find(i => i.tipo === 'insumo_remetido');
                const pesoInsumo = insumo?.quantidade || 0;
                const custoInsumo = insumo?.subtotal || 0;
                const pesoFilé = Number(returnData.quantidade_retornada || 0);
                const valorServico = Number(returnData.valor_servico_corte || 0);

                const rendimento = pesoInsumo > 0 ? ((pesoFilé / pesoInsumo) * 100) : 0;
                const quebraKg = Math.max(0, pesoInsumo - pesoFilé);
                const custoTotal = custoInsumo + valorServico;
                const novoCustoUnit = pesoFilé > 0 ? (custoTotal / pesoFilé) : 0;

                return (
                  <>
                    <div className="bg-ink-950 p-4 rounded-2xl border border-white/5 grid grid-cols-3 gap-3 text-center">
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block">Insumo Remetido</span>
                        <span className="text-base font-black text-white font-mono">{pesoInsumo.toFixed(3)} kg</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block">Custo da Matéria-Prima</span>
                        <span className="text-base font-black text-white font-mono">R$ {custoInsumo.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block">Prestador</span>
                        <span className="text-xs font-bold text-gold-400 truncate block">
                          {selectedReturnOrder.fornecedores?.nome_fantasia || selectedReturnOrder.fornecedores?.razao_social}
                        </span>
                      </div>
                    </div>

                    {/* Product Returned */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                        Produto Final / Filé Beneficiado *
                      </label>
                      <select
                        required
                        value={returnData.produto_retornado_id}
                        onChange={e => setReturnData({ ...returnData, produto_retornado_id: e.target.value })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="">Selecione o filé resultante...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </div>

                    {/* Yield / Quantidade e Serviço */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                          Peso de Filé Retornado (kg) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          placeholder="Ex: 60.000"
                          value={returnData.quantidade_retornada}
                          onChange={e => setReturnData({ ...returnData, quantidade_retornada: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white font-mono focus:outline-none focus:border-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                          Valor Serviço de Corte (R$) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Ex: 480.00"
                          value={returnData.valor_servico_corte}
                          onChange={e => setReturnData({ ...returnData, valor_servico_corte: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white font-mono focus:outline-none focus:border-gold-500"
                        />
                      </div>
                    </div>

                    {/* Live Yield & Quebra Calculation Banner */}
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <span className="text-[9px] text-green-400 uppercase font-black tracking-widest block">Rendimento Obtido</span>
                        <span className="text-xl font-black text-green-400 font-mono">{rendimento.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest block">Quebra / Resíduo</span>
                        <span className="text-base font-black text-gray-300 font-mono">{quebraKg.toFixed(3)} kg</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gold-400 uppercase font-black tracking-widest block">Novo Custo do Filé</span>
                        <span className="text-xl font-black text-gold-400 font-mono">R$ {novoCustoUnit.toFixed(2)}/kg</span>
                      </div>
                    </div>

                    {/* Return NF-e & Finance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                          Nº NF-e Retorno (CFOP 5.902 / 5.124)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 009.842"
                          value={returnData.numero_nfe_retorno}
                          onChange={e => setReturnData({ ...returnData, numero_nfe_retorno: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                          Vencimento Boleto do Serviço
                        </label>
                        <input
                          type="date"
                          value={returnData.data_vencimento_servico}
                          onChange={e => setReturnData({ ...returnData, data_vencimento_servico: e.target.value })}
                          className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-gold-500"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest ml-1">
                        Local de Destino no Estoque *
                      </label>
                      <select
                        required
                        value={returnData.local_destino_id}
                        onChange={e => setReturnData({ ...returnData, local_destino_id: e.target.value })}
                        className="w-full bg-ink-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.nome} ({loc.tipo})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReturnOrder(null)}
                        className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingReturn}
                        className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-ink-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-green-500/10 flex items-center justify-center gap-1.5"
                      >
                        {isSubmittingReturn ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Confirmar Entrada e Gerar Contas a Pagar</>}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
