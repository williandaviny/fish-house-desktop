import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  FileText, 
  RefreshCcw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Layers,
  ArrowRightLeft,
  ExternalLink,
  Printer,
  Repeat,
  RotateCcw,
  Search,
  Download,
  Trash2,
  Bell,
  CheckCircle,
  CalendarDays
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { downloadFiscalDocumentBlob, triggerPrintAndDownload } from '../services/fiscal/fiscalService';
import { LiquidationModal } from '../components/financial/LiquidationModal';
import { RecurringExpensesManager } from '../components/financial/RecurringExpensesManager';

type Company = {
  id: string;
  nome_fantasia: string;
};

type Supplier = {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
};

type AccountsPayable = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  data_pagamento?: string;
  forma_pagamento?: string;
  valor_pago?: number;
  juros_multa?: number;
  desconto?: number;
  documento_numero?: string;
  chave_nfe?: string;
  observacoes?: string;
  recorrente_id?: string;
  fornecedores?: { nome_fantasia: string; razao_social: string };
  empresas?: { nome_fantasia: string };
};

type AccountsReceivable = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  data_recebimento?: string;
  forma_pagamento?: string;
  valor_pago?: number;
  juros_multa?: number;
  desconto?: number;
  observacoes?: string;
  cliente_nome?: string;
  empresas?: { nome_fantasia: string };
};

type CaixaLog = {
  id: string;
  created_at: string;
  data_abertura: string;
  data_fechamento?: string;
  saldo_inicial: number;
  saldo_final?: number;
  status: 'aberto' | 'fechado';
  empresa_id: string;
  empresas?: { nome_fantasia: string };
  total_vendas?: number;
};

export default function AdminFinancial() {
  const [activeTab, setActiveTab] = useState<'payables' | 'receivables' | 'recorrentes' | 'ledger' | 'caixas' | 'fiscal'>('payables');
  const [loading, setLoading] = useState(true);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [caixas, setCaixas] = useState<CaixaLog[]>([]);

  // Fiscal states
  const [vendasFiscal, setVendasFiscal] = useState<any[]>([]);
  const [docsFiscal, setDocsFiscal] = useState<any[]>([]);
  const [tefTransactions, setTefTransactions] = useState<any[]>([]);
  const [loadingFiscal, setLoadingFiscal] = useState(false);
  const [emittingSaleId, setEmittingSaleId] = useState<string | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Advanced Conta Azul Filter States
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'next_month' | 'custom'>('this_month');
  const [filterStatus, setFilterStatus] = useState<'all' | 'vencidas' | 'vence_hoje' | 'a_vencer' | 'pago'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Liquidation Modal State
  const [activeLiquidation, setActiveLiquidation] = useState<{
    item: AccountsPayable | AccountsReceivable;
    type: 'payable' | 'receivable';
  } | null>(null);

  // Launch Modals
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  
  const [newPayable, setNewPayable] = useState({
    descricao: '',
    categoria: 'aluguel',
    valor: '',
    vencimento: new Date().toISOString().split('T')[0],
    empresa_id: '',
    fornecedor_id: '',
  });

  const [newReceivable, setNewReceivable] = useState({
    descricao: '',
    categoria: 'venda_balcao',
    valor: '',
    vencimento: new Date().toISOString().split('T')[0],
    empresa_id: '',
    cliente_nome: '',
  });

  const [isSavingPayable, setIsSavingPayable] = useState(false);
  const [isSavingReceivable, setIsSavingReceivable] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch companies
      const { data: comps } = await supabase.from('empresas').select('id, nome_fantasia');
      setCompanies(comps || []);
      if (comps && comps.length > 0) {
        setNewPayable(prev => ({ ...prev, empresa_id: comps[0].id }));
        setNewReceivable(prev => ({ ...prev, empresa_id: comps[0].id }));
      }

      // 2. Fetch suppliers
      const { data: sups } = await supabase.from('fornecedores').select('id, razao_social, nome_fantasia').order('razao_social');
      setSuppliers(sups || []);

      // 3. Fetch financials
      await fetchFinancialRecords();

    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Erro ao carregar dados financeiros: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialRecords = async () => {
    // 1. Payables
    const { data: pay } = await supabase
      .from('contas_pagar')
      .select(`
        *,
        fornecedores (razao_social, nome_fantasia),
        empresas (nome_fantasia)
      `)
      .order('vencimento', { ascending: true })
      .limit(100);
    setPayables(
      (pay || []).map(p => ({
        ...p,
        valor: Number(p.valor)
      }))
    );

    // 2. Receivables
    const { data: rec } = await supabase
      .from('contas_receber')
      .select(`
        *,
        empresas (nome_fantasia)
      `)
      .order('vencimento', { ascending: true })
      .limit(100);
    setReceivables(
      (rec || []).map(r => ({
        ...r,
        valor: Number(r.valor)
      }))
    );

    // 3. Caixas & their sales
    const { data: cx } = await supabase
      .from('caixas')
      .select(`
        *,
        empresas (nome_fantasia)
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (cx) {
      // Fetch sales totals for all caixas in a single batch query (eliminates N+1 egress overhead)
      const caixaIds = cx.map((c: any) => c.id);
      const { data: sales } = await supabase
        .from('vendas')
        .select('caixa_id, valor_final')
        .in('caixa_id', caixaIds)
        .eq('status', 'concluida');
      
      const salesByCaixa: Record<string, number> = {};
      (sales || []).forEach((s: any) => {
        salesByCaixa[s.caixa_id] = (salesByCaixa[s.caixa_id] || 0) + Number(s.valor_final);
      });

      const updatedCaixas = cx.map((c: any) => ({
        ...c,
        saldo_inicial: Number(c.saldo_inicial),
        saldo_final: c.saldo_final ? Number(c.saldo_final) : undefined,
        total_vendas: salesByCaixa[c.id] || 0
      }));
      setCaixas(updatedCaixas);
    }
  };

  const fetchFiscalData = async () => {
    setLoadingFiscal(true);
    try {
      const { data: sales, error: salesErr } = await supabase
        .from('vendas')
        .select('id, created_at, valor_total, valor_final, desconto, acrescimo, status, status_fiscal, cliente_id, customers:cliente_id(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (salesErr) throw salesErr;

      const { data: docs, error: docsErr } = await supabase
        .from('documentos_fiscais')
        .select('id, referencia_id, referencia_tipo, tipo_documento, status, pdf_url, xml_url, protocolo, erro_retorno, created_at, chave')
        .eq('referencia_tipo', 'venda')
        .order('created_at', { ascending: false })
        .limit(100);
      if (docsErr) throw docsErr;

      const { data: tefTrans } = await supabase
        .from('tef_transacoes')
        .select('id, venda_id, nsu, autorizacao, rede, bandeira, valor, tipo, parcelas, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      setVendasFiscal(sales || []);
      setDocsFiscal(docs || []);
      setTefTransactions(tefTrans || []);
    } catch (err: any) {
      console.error('Erro ao buscar dados fiscais:', err);
      showNotification('error', 'Erro ao carregar dados fiscais: ' + err.message);
    } finally {
      setLoadingFiscal(false);
    }
  };

  const handleEmitInvoice = async (saleId: string) => {
    setEmittingSaleId(saleId);
    try {
      const { data, error } = await supabase.functions.invoke('nfe-io-invoice', {
        body: {
          referencia_tipo: 'venda',
          referencia_id: saleId,
          tipo_documento: 'nfce'
        }
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || data.message || 'Erro de validação ou processamento na API');
      }

      showNotification('success', 'Enviado para a SEFAZ... Verificando autorização.');
      // Aguarda 4 segundos para a NFe.io receber o retorno da SEFAZ
      await new Promise(r => setTimeout(r, 4000));
      await fetchFiscalData();

      showNotification('success', 'Status da Nota Fiscal atualizado com a SEFAZ! ✨');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao emitir nota: ' + err.message);
      await fetchFiscalData();
    } finally {
      setEmittingSaleId(null);
    }
  };

  const handlePrintLocalReceipt = (venda: any) => {
    if (!venda) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprovante de Venda - Fish House</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              padding: 15px; 
              width: 80mm; 
              margin: 0 auto;
              color: black;
              font-size: 11px;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .flex-bw { display: flex; justify-content: space-between; font-weight: bold; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="center">
            <h2 style="margin: 0; font-size: 14px;">FISH HOUSE PEIXARIA</h2>
            <p style="margin: 2px 0; font-size: 10px;">COMPROVANTE DE VENDA DE TESTE</p>
            <p style="margin: 0; font-size: 9px;">${new Date(venda.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <div class="line"></div>
          <div><strong>CLIENTE:</strong> ${venda.customers?.name || 'Consumidor Final'}</div>
          <div class="line"></div>
          <div class="flex-bw" style="font-size: 13px;">
            <span>TOTAL FINAL:</span>
            <span>R$ ${Number(venda.valor_final).toFixed(2)}</span>
          </div>
          <div class="line"></div>
          <div class="center" style="font-size: 9px; margin-top: 10px;">
            Obrigado pela preferência!<br/>
            Fish House Peixaria Premium
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadFiscalDoc = async (invoiceIdOrChave: string, format: 'pdf' | 'xml', _directUrl?: string, vendaObj?: any) => {
    if (!invoiceIdOrChave) {
      showNotification('error', 'Identificador da nota não encontrado.');
      return;
    }
    const docKey = `${invoiceIdOrChave}_${format}`;
    setLoadingDocId(docKey);

    try {
      const res = await downloadFiscalDocumentBlob(invoiceIdOrChave, format, vendaObj?.id);
      if (res) {
        triggerPrintAndDownload(res.blobUrl, res.filename, res.directUrl);
        showNotification('success', `${format.toUpperCase()} aberto com sucesso! ✨`);
      } else {
        showNotification('error', `Não foi possível obter o ${format.toUpperCase()} da SEFAZ no momento.`);
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Falha ao obter ' + format.toUpperCase() + ': ' + err.message);
    } finally {
      setLoadingDocId(null);
    }
  };

  const handlePrintTefReceipt = (receipt: string) => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
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
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div style="white-space: pre-wrap; font-family: monospace;">${receipt}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (activeTab === 'fiscal') {
      fetchFiscalData();
    }
  }, [activeTab]);

  // Today's date reference
  const todayStr = new Date().toISOString().split('T')[0];

  // Liquidation Confirmation
  const handleConfirmLiquidation = async (data: {
    paymentDate: string;
    finalValue: number;
    paymentMethod: string;
    jurosMulta: number;
    desconto: number;
    notes: string;
  }) => {
    if (!activeLiquidation) return;
    const { item, type } = activeLiquidation;

    try {
      if (type === 'payable') {
        const { error } = await supabase
          .from('contas_pagar')
          .update({
            status: 'pago',
            data_pagamento: data.paymentDate,
            valor_pago: data.finalValue,
            forma_pagamento: data.paymentMethod,
            juros_multa: data.jurosMulta,
            desconto: data.desconto,
            observacoes: data.notes || (item as AccountsPayable).observacoes || null
          })
          .eq('id', item.id);

        if (error) throw error;
        showNotification('success', `Conta "${item.descricao}" baixada com sucesso como PAGA!`);
      } else {
        const { error } = await supabase
          .from('contas_receber')
          .update({
            status: 'pago',
            data_recebimento: data.paymentDate,
            valor_pago: data.finalValue,
            forma_pagamento: data.paymentMethod,
            juros_multa: data.jurosMulta,
            desconto: data.desconto,
            observacoes: data.notes || (item as AccountsReceivable).observacoes || null
          })
          .eq('id', item.id);

        if (error) throw error;
        showNotification('success', `Conta "${item.descricao}" baixada com sucesso como RECEBIDA!`);
      }

      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao liquidar conta: ' + err.message);
    } finally {
      setActiveLiquidation(null);
    }
  };

  // Reopen / Estornar Title
  const handleReopenBill = async (id: string, type: 'payable' | 'receivable') => {
    if (!confirm('Deseja estornar esta baixa e reabrir o título como PENDENTE?')) return;
    try {
      if (type === 'payable') {
        const { error } = await supabase
          .from('contas_pagar')
          .update({
            status: 'pendente',
            data_pagamento: null,
            valor_pago: null
          })
          .eq('id', id);
        if (error) throw error;
        showNotification('success', 'Conta a Pagar reaberta como PENDENTE!');
      } else {
        const { error } = await supabase
          .from('contas_receber')
          .update({
            status: 'pendente',
            data_recebimento: null,
            valor_pago: null
          })
          .eq('id', id);
        if (error) throw error;
        showNotification('success', 'Conta a Receber reaberta como PENDENTE!');
      }
      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao reabrir conta: ' + err.message);
    }
  };

  // Delete Bill
  const handleDeleteBill = async (id: string, type: 'payable' | 'receivable') => {
    if (!confirm('Deseja realmente excluir este lançamento financeiro?')) return;
    try {
      const table = type === 'payable' ? 'contas_pagar' : 'contas_receber';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
      showNotification('success', 'Lançamento excluído com sucesso.');
      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao excluir lançamento: ' + err.message);
    }
  };

  // Save Manual Payable
  const handleSavePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayable.descricao || !newPayable.valor || !newPayable.empresa_id) return;

    setIsSavingPayable(true);
    try {
      const { error } = await supabase
        .from('contas_pagar')
        .insert([{
          descricao: newPayable.descricao,
          categoria: newPayable.categoria,
          valor: Number(newPayable.valor),
          vencimento: newPayable.vencimento,
          empresa_id: newPayable.empresa_id,
          fornecedor_id: newPayable.fornecedor_id || null,
          status: 'pendente'
        }]);

      if (error) throw error;
      
      showNotification('success', 'Conta a Pagar cadastrada com sucesso!');
      setIsPayableModalOpen(false);
      setNewPayable(prev => ({
        ...prev,
        descricao: '',
        valor: '',
        fornecedor_id: ''
      }));

      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao cadastrar: ' + err.message);
    } finally {
      setIsSavingPayable(false);
    }
  };

  // Save Manual Receivable
  const handleSaveReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceivable.descricao || !newReceivable.valor || !newReceivable.empresa_id) return;

    setIsSavingReceivable(true);
    try {
      const { error } = await supabase
        .from('contas_receber')
        .insert([{
          descricao: newReceivable.descricao,
          categoria: newReceivable.categoria,
          valor: Number(newReceivable.valor),
          vencimento: newReceivable.vencimento,
          empresa_id: newReceivable.empresa_id,
          cliente_nome: newReceivable.cliente_nome || 'Cliente Geral',
          status: 'pendente'
        }]);

      if (error) throw error;
      
      showNotification('success', 'Conta a Receber cadastrada com sucesso!');
      setIsReceivableModalOpen(false);
      setNewReceivable(prev => ({
        ...prev,
        descricao: '',
        valor: '',
        cliente_nome: ''
      }));

      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao cadastrar: ' + err.message);
    } finally {
      setIsSavingReceivable(false);
    }
  };

  // Advanced Date Filter Utility
  const filterByPeriod = (recordDateStr?: string) => {
    if (filterPeriod === 'all') return true;
    if (!recordDateStr) return false;
    const dateStr = recordDateStr.substring(0, 10);
    const now = new Date();
    
    if (filterPeriod === 'today') {
      return dateStr === todayStr;
    }
    if (filterPeriod === 'this_week') {
      const curr = new Date();
      const firstDay = new Date(curr.setDate(curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1))); // monday
      const lastDay = new Date(firstDay);
      lastDay.setDate(lastDay.getDate() + 6); // sunday
      const fStr = firstDay.toISOString().split('T')[0];
      const lStr = lastDay.toISOString().split('T')[0];
      return dateStr >= fStr && dateStr <= lStr;
    }
    if (filterPeriod === 'this_month') {
      const curYear = now.getFullYear();
      const curMonth = String(now.getMonth() + 1).padStart(2, '0');
      return dateStr.startsWith(`${curYear}-${curMonth}`);
    }
    if (filterPeriod === 'next_month') {
      let nextMonth = now.getMonth() + 2;
      let nextYear = now.getFullYear();
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      return dateStr.startsWith(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
    }
    if (filterPeriod === 'custom') {
      if (customStartDate && dateStr < customStartDate) return false;
      if (customEndDate && dateStr > customEndDate) return false;
      return true;
    }
    return true;
  };

  // Status Filter Helpers
  const matchesPayableStatus = (p: AccountsPayable) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pago') return p.status === 'pago';
    
    // Non-paid accounts
    if (p.status !== 'pago' && p.status !== 'cancelado') {
      const venc = p.vencimento.substring(0, 10);
      if (filterStatus === 'vencidas') return venc < todayStr;
      if (filterStatus === 'vence_hoje') return venc === todayStr;
      if (filterStatus === 'a_vencer') return venc > todayStr;
    }
    return false;
  };

  const matchesReceivableStatus = (r: AccountsReceivable) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pago') return r.status === 'pago';
    
    if (r.status !== 'pago' && r.status !== 'cancelado') {
      const venc = r.vencimento.substring(0, 10);
      if (filterStatus === 'vencidas') return venc < todayStr;
      if (filterStatus === 'vence_hoje') return venc === todayStr;
      if (filterStatus === 'a_vencer') return venc > todayStr;
    }
    return false;
  };

  // Filtered Payables
  const getFilteredPayables = () => {
    return payables.filter(p => {
      const matchesCompany = filterCompany === 'all' || p.empresa_id === filterCompany;
      const matchesStat = matchesPayableStatus(p);
      const matchesPer = filterByPeriod(p.status === 'pago' && p.data_pagamento ? p.data_pagamento : p.vencimento);
      
      const supName = p.fornecedores?.nome_fantasia || p.fornecedores?.razao_social || '';
      const matchesSearch = !searchQuery || 
        p.descricao.toLowerCase().includes(searchQuery.toLowerCase()) || 
        supName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoria.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCompany && matchesStat && matchesPer && matchesSearch;
    });
  };

  // Filtered Receivables
  const getFilteredReceivables = () => {
    return receivables.filter(r => {
      const matchesCompany = filterCompany === 'all' || r.empresa_id === filterCompany;
      const matchesStat = matchesReceivableStatus(r);
      const matchesPer = filterByPeriod(r.status === 'pago' && r.data_recebimento ? r.data_recebimento : r.vencimento);
      
      const clientName = r.cliente_nome || '';
      const matchesSearch = !searchQuery || 
        r.descricao.toLowerCase().includes(searchQuery.toLowerCase()) || 
        clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.categoria.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCompany && matchesStat && matchesPer && matchesSearch;
    });
  };

  // Compile Cash Flow Ledger (Paid expenses & Received revenues)
  const getLedgerItems = () => {
    const items: {
      id: string;
      data: string;
      tipo: 'receita' | 'despesa';
      descricao: string;
      categoria: string;
      valor: number;
      entidade: string;
      empresa: string;
      forma_pagamento?: string;
    }[] = [];

    // Add paid expenses
    payables.forEach(p => {
      if (p.status === 'pago' && p.data_pagamento) {
        items.push({
          id: p.id,
          data: p.data_pagamento,
          tipo: 'despesa',
          descricao: p.descricao,
          categoria: p.categoria,
          valor: p.valor_pago || p.valor,
          entidade: p.fornecedores?.nome_fantasia || p.fornecedores?.razao_social || 'Fornecedor',
          empresa: p.empresas?.nome_fantasia || 'Loja',
          forma_pagamento: p.forma_pagamento
        });
      }
    });

    // Add received revenues
    receivables.forEach(r => {
      if (r.status === 'pago' && r.data_recebimento) {
        items.push({
          id: r.id,
          data: r.data_recebimento,
          tipo: 'receita',
          descricao: r.descricao,
          categoria: r.categoria,
          valor: r.valor_pago || r.valor,
          entidade: r.cliente_nome || 'Cliente Geral',
          empresa: r.empresas?.nome_fantasia || 'Loja',
          forma_pagamento: r.forma_pagamento
        });
      }
    });

    return items
      .filter(item => {
        const matchesCompany = filterCompany === 'all' || 
          payables.find(p => p.id === item.id)?.empresa_id === filterCompany || 
          receivables.find(r => r.id === item.id)?.empresa_id === filterCompany;
        const matchesSearch = !searchQuery ||
          item.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.entidade.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCompany && filterByPeriod(item.data) && matchesSearch;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  };

  const ledgerItems = getLedgerItems();
  const filteredPay = getFilteredPayables();
  const filteredRec = getFilteredReceivables();

  // Conta Azul Executive KPI Calculations
  const companyPayables = payables.filter(p => filterCompany === 'all' || p.empresa_id === filterCompany);
  const companyReceivables = receivables.filter(r => filterCompany === 'all' || r.empresa_id === filterCompany);

  // Status Metrics for Payables (Global or Company)
  const pendingPayables = companyPayables.filter(p => p.status !== 'pago' && p.status !== 'cancelado');
  const overduePayables = pendingPayables.filter(p => p.vencimento.substring(0, 10) < todayStr);
  const dueTodayPayables = pendingPayables.filter(p => p.vencimento.substring(0, 10) === todayStr);
  const futurePayables = pendingPayables.filter(p => p.vencimento.substring(0, 10) > todayStr && filterByPeriod(p.vencimento));
  const paidInPeriodPayables = companyPayables.filter(p => p.status === 'pago' && p.data_pagamento && filterByPeriod(p.data_pagamento));

  const totalOverdueVal = overduePayables.reduce((sum, p) => sum + p.valor, 0);
  const totalDueTodayVal = dueTodayPayables.reduce((sum, p) => sum + p.valor, 0);
  const totalFutureVal = futurePayables.reduce((sum, p) => sum + p.valor, 0);
  const totalPaidVal = paidInPeriodPayables.reduce((sum, p) => sum + (p.valor_pago || p.valor), 0);
  const totalPendingInPeriod = filteredPay.filter(p => p.status !== 'pago' && p.status !== 'cancelado').reduce((sum, p) => sum + p.valor, 0);

  // Status Metrics for Receivables
  const pendingReceivables = companyReceivables.filter(r => r.status !== 'pago' && r.status !== 'cancelado');
  const overdueReceivables = pendingReceivables.filter(r => r.vencimento.substring(0, 10) < todayStr);
  const dueTodayReceivables = pendingReceivables.filter(r => r.vencimento.substring(0, 10) === todayStr);
  const futureReceivables = pendingReceivables.filter(r => r.vencimento.substring(0, 10) > todayStr && filterByPeriod(r.vencimento));
  const receivedInPeriod = companyReceivables.filter(r => r.status === 'pago' && r.data_recebimento && filterByPeriod(r.data_recebimento));

  const totalRecOverdueVal = overdueReceivables.reduce((sum, r) => sum + r.valor, 0);
  const totalRecDueTodayVal = dueTodayReceivables.reduce((sum, r) => sum + r.valor, 0);
  const totalRecFutureVal = futureReceivables.reduce((sum, r) => sum + r.valor, 0);
  const totalReceivedVal = receivedInPeriod.reduce((sum, r) => sum + (r.valor_pago || r.valor), 0);

  // Cash Flow Ledger totals
  const totalRevenuesReceived = ledgerItems.filter(i => i.tipo === 'receita').reduce((sum, i) => sum + i.valor, 0);
  const totalExpensesPaid = ledgerItems.filter(i => i.tipo === 'despesa').reduce((sum, i) => sum + i.valor, 0);
  const netLedgerCash = totalRevenuesReceived - totalExpensesPaid;
  const projectedBalance = netLedgerCash + totalRecFutureVal - totalFutureVal;

  // Print Financial Report
  const handlePrintFinancialReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const periodLabel = 
      filterPeriod === 'today' ? 'Hoje' :
      filterPeriod === 'this_week' ? 'Esta Semana' :
      filterPeriod === 'this_month' ? 'Este Mês' :
      filterPeriod === 'next_month' ? 'Próximo Mês' :
      filterPeriod === 'custom' ? `${customStartDate} até ${customEndDate}` : 'Todo o Histórico';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Financeiro - Fish House</title>
          <style>
            body { font-family: sans-serif; margin: 30px; color: #111; font-size: 12px; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #cf9e46; }
            .header-info { display: flex; justify-content: space-between; border-bottom: 2px solid #cf9e46; padding-bottom: 12px; margin-bottom: 20px; }
            .kpi-row { display: flex; gap: 15px; margin-bottom: 25px; }
            .kpi-box { flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 8px; background: #f9f9f9; }
            .kpi-title { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; }
            .kpi-val { font-size: 16px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th { background: #f0f0f0; text-align: left; padding: 8px; border-bottom: 1px solid #ccc; text-transform: uppercase; font-size: 9px; }
            td { padding: 8px; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .danger { color: #dc2626; font-weight: bold; }
            .success { color: #16a34a; font-weight: bold; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header-info">
            <div>
              <h1>FISH HOUSE - PEIXARIA PREMIUM</h1>
              <p>Extrato & Posição Financeira • Período: <strong>${periodLabel}</strong></p>
            </div>
            <div style="text-align: right;">
              <p>Emissão: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi-box">
              <div class="kpi-title">Vencidas (Em Atraso)</div>
              <div class="kpi-val danger">R$ ${totalOverdueVal.toFixed(2)} (${overduePayables.length})</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Vencendo Hoje</div>
              <div class="kpi-val" style="color: #d97706;">R$ ${totalDueTodayVal.toFixed(2)} (${dueTodayPayables.length})</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">A Vencer no Período</div>
              <div class="kpi-val" style="color: #2563eb;">R$ ${totalFutureVal.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Total Pago no Período</div>
              <div class="kpi-val danger">- R$ ${totalPaidVal.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Total Recebido no Período</div>
              <div class="kpi-val success">+ R$ ${totalReceivedVal.toFixed(2)}</div>
            </div>
          </div>

          <h3>Títulos Filtrados (${activeTab === 'payables' ? 'Contas a Pagar' : activeTab === 'receivables' ? 'Contas a Receber' : 'Fluxo de Caixa'})</h3>
          <table>
            <thead>
              <tr>
                <th>Vencimento / Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Fornecedor / Cliente</th>
                <th>Status</th>
                <th class="text-right">Valor R$</th>
              </tr>
            </thead>
            <tbody>
              ${(activeTab === 'payables' ? filteredPay : filteredRec).map((i: any) => `
                <tr>
                  <td>${new Date(i.vencimento || i.data).toLocaleDateString('pt-BR')}</td>
                  <td>${i.descricao}</td>
                  <td>${i.categoria}</td>
                  <td>${i.fornecedores?.nome_fantasia || i.cliente_nome || '-'}</td>
                  <td>${i.status}</td>
                  <td class="text-right">R$ ${Number(i.valor).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-ink-950 text-white">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <DollarSign className="text-gold-500 w-8 h-8" /> Gestão Financeira
          </h1>
          <p className="text-gray-400 mt-1">Fluxo de caixa integrado, centro de custos, caixas e contas a pagar/receber.</p>
        </div>

        {/* Tab Buttons & Print Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap bg-white/5 p-1 rounded-2xl border border-white/5">
            {[
              { id: 'payables', label: 'A Pagar', icon: ArrowDownRight, badge: overduePayables.length > 0 ? `${overduePayables.length} vencidas` : undefined, badgeColor: 'bg-red-500 text-white' },
              { id: 'receivables', label: 'A Receber', icon: ArrowUpRight },
              { id: 'recorrentes', label: 'Despesas Recorrentes', icon: Repeat, badge: 'Fixas', badgeColor: 'bg-gold-500/20 text-gold-400' },
              { id: 'ledger', label: 'Fluxo de Caixa', icon: TrendingUp },
              { id: 'caixas', label: 'Turnos de Caixa', icon: Calculator },
              { id: 'fiscal', label: 'Painel Fiscal', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 font-bold rounded-xl text-xs md:text-sm transition-all flex items-center gap-2 ${
                  activeTab === tab.id 
                  ? 'bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/10' 
                  : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
                {tab.badge && (
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrintFinancialReport}
            className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0"
            title="Imprimir Extrato / Relatório Financeiro"
          >
            <Printer className="w-4 h-4 text-gold-500" /> Imprimir Relatório
          </button>
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

      {/* ADVANCED CONTA AZUL CONTROLS BAR */}
      <div className="bg-ink-900 border border-white/10 p-5 rounded-3xl space-y-4 shadow-xl">
        {/* Row 1: Quick Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-gold-500" /> Situação dos Títulos:
          </span>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todas', count: activeTab === 'receivables' ? companyReceivables.length : companyPayables.length, color: 'hover:border-white/30' },
              { 
                id: 'vencidas', 
                label: 'Vencidas (Em Atraso)', 
                count: activeTab === 'receivables' ? overdueReceivables.length : overduePayables.length, 
                amount: activeTab === 'receivables' ? totalRecOverdueVal : totalOverdueVal,
                badgeBg: 'bg-red-500/20 text-red-400 border border-red-500/30' 
              },
              { 
                id: 'vence_hoje', 
                label: 'Vence Hoje', 
                count: activeTab === 'receivables' ? dueTodayReceivables.length : dueTodayPayables.length,
                amount: activeTab === 'receivables' ? totalRecDueTodayVal : totalDueTodayVal,
                badgeBg: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
              },
              { 
                id: 'a_vencer', 
                label: 'A Vencer', 
                count: activeTab === 'receivables' ? futureReceivables.length : futurePayables.length,
                badgeBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              },
              { 
                id: 'pago', 
                label: activeTab === 'receivables' ? 'Recebidas' : 'Pagas', 
                count: activeTab === 'receivables' ? receivedInPeriod.length : paidInPeriodPayables.length,
                badgeBg: 'bg-green-500/20 text-green-400 border border-green-500/30' 
              }
            ].map(p => {
              const isSelected = filterStatus === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setFilterStatus(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    isSelected 
                      ? 'bg-white/15 border-gold-500 text-white shadow-sm' 
                      : 'bg-ink-950 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>{p.label}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${p.badgeBg || 'bg-white/10 text-gray-300'}`}>
                    {p.count}
                  </span>
                  {p.amount && p.amount > 0 && isSelected && (
                    <span className="text-[10px] font-mono font-bold text-gold-400 ml-1">
                      (R$ {p.amount.toFixed(2)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Period Filter Pills + Search & Company */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Period Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest mr-1">
              Período:
            </span>
            {[
              { id: 'today', label: 'Hoje' },
              { id: 'this_week', label: 'Esta Semana' },
              { id: 'this_month', label: 'Este Mês' },
              { id: 'next_month', label: 'Próximo Mês' },
              { id: 'all', label: 'Tudo' },
              { id: 'custom', label: 'Personalizado' }
            ].map(period => (
              <button
                key={period.id}
                onClick={() => setFilterPeriod(period.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === period.id 
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' 
                    : 'bg-ink-950 border border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if Custom is selected */}
          {filterPeriod === 'custom' && (
            <div className="flex items-center gap-2 bg-ink-950 p-1.5 rounded-2xl border border-white/10">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white px-2 py-1 focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-gray-500 text-xs font-bold">até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white px-2 py-1 focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          )}

          {/* Search and Company Selector */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar descrição, fornecedor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-ink-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-gold-500"
              />
            </div>

            {/* Company Select */}
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="bg-ink-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all">Todas as Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* CONTA AZUL EXECUTIVE KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Card 1: Total Pendente no Período */}
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">
                  {activeTab === 'receivables' ? 'A Receber no Período' : 'A Pagar no Período'}
                </span>
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xl font-black text-white font-mono mt-1">
                R$ {(activeTab === 'receivables' ? totalRecFutureVal + totalRecDueTodayVal : totalPendingInPeriod).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-400 font-bold mt-1.5">
                {activeTab === 'receivables' ? pendingReceivables.length : filteredPay.filter(p=>p.status==='pendente').length} título(s) pendente(s)
              </p>
            </div>

            {/* Card 2: Vencidas (Alerta Crítico) */}
            <div className={`border rounded-3xl p-5 shadow-xl relative overflow-hidden transition-all ${
              (activeTab === 'receivables' ? overdueReceivables.length : overduePayables.length) > 0
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-ink-900 border-white/10'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-red-400 uppercase font-black tracking-widest">
                  Vencidas (Em Atraso)
                </span>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-xl font-black text-red-400 font-mono mt-1">
                R$ {(activeTab === 'receivables' ? totalRecOverdueVal : totalOverdueVal).toFixed(2)}
              </p>
              <p className="text-[10px] text-red-300 font-bold mt-1.5">
                {activeTab === 'receivables' ? overdueReceivables.length : overduePayables.length} título(s) atrasado(s)
              </p>
            </div>

            {/* Card 3: Vencendo Hoje */}
            <div className={`border rounded-3xl p-5 shadow-xl relative overflow-hidden transition-all ${
              (activeTab === 'receivables' ? dueTodayReceivables.length : dueTodayPayables.length) > 0
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-ink-900 border-white/10'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-yellow-400 uppercase font-black tracking-widest">
                  Vence Hoje
                </span>
                <Bell className="w-4 h-4 text-yellow-400" />
              </div>
              <p className="text-xl font-black text-yellow-400 font-mono mt-1">
                R$ {(activeTab === 'receivables' ? totalRecDueTodayVal : totalDueTodayVal).toFixed(2)}
              </p>
              <p className="text-[10px] text-yellow-300 font-bold mt-1.5">
                {activeTab === 'receivables' ? dueTodayReceivables.length : dueTodayPayables.length} título(s) hoje
              </p>
            </div>

            {/* Card 4: A Vencer Futuro */}
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-blue-400 uppercase font-black tracking-widest">
                  A Vencer Futuro
                </span>
                <CalendarDays className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xl font-black text-blue-400 font-mono mt-1">
                R$ {(activeTab === 'receivables' ? totalRecFutureVal : totalFutureVal).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-400 font-bold mt-1.5">
                {activeTab === 'receivables' ? futureReceivables.length : futurePayables.length} título(s) programado(s)
              </p>
            </div>

            {/* Card 5: Realizado no Período */}
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-green-400 uppercase font-black tracking-widest">
                  {activeTab === 'receivables' ? 'Recebido no Período' : 'Pago no Período'}
                </span>
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-xl font-black text-green-400 font-mono mt-1">
                R$ {(activeTab === 'receivables' ? totalReceivedVal : totalPaidVal).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-400 font-bold mt-1.5">
                {activeTab === 'receivables' ? receivedInPeriod.length : paidInPeriodPayables.length} baixado(s)
              </p>
            </div>

            {/* Card 6: Saldo Líquido Previsto */}
            <div className="bg-ink-900 border border-gold-500/20 rounded-3xl p-5 shadow-xl relative overflow-hidden bg-gold-500/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-gold-400 uppercase font-black tracking-widest">
                  Saldo Líquido Previsto
                </span>
                <DollarSign className="w-4 h-4 text-gold-500" />
              </div>
              <p className={`text-xl font-black font-mono mt-1 ${projectedBalance >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                R$ {projectedBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-400 font-bold mt-1.5">
                Fluxo realizado: R$ {netLedgerCash.toFixed(2)}
              </p>
            </div>
          </div>

          {/* TAB 1: LEDGER */}
          {activeTab === 'ledger' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4 flex items-center gap-2">
                <FileText className="text-gold-500 w-5 h-5" /> Razão Financeiro (Fluxo Consolidado)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Data Pagamento/Rec</th>
                      <th className="py-3.5 px-4">Empresa</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Descrição</th>
                      <th className="py-3.5 px-4">Categoria</th>
                      <th className="py-3.5 px-4">Cliente/Fornecedor</th>
                      <th className="py-3.5 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {ledgerItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500 italic">
                          Nenhum lançamento liquidado no período filtrado.
                        </td>
                      </tr>
                    ) : (
                      ledgerItems.map(item => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-500">
                            {new Date(item.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{item.empresa}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                              item.tipo === 'receita' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {item.tipo}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{item.descricao}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-gray-400 rounded-full text-[10px] font-bold">
                              {item.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-400">{item.entidade}</td>
                          <td className={`py-3 px-4 text-right font-black text-sm ${
                            item.tipo === 'receita' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {item.tipo === 'receita' ? '+' : '-'} R$ {item.valor.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: RECEIVABLES */}
          {activeTab === 'receivables' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    <ArrowUpRight className="text-gold-500 w-5 h-5" /> Contas a Receber
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Receitas a prazo, duplicatas de clientes e recebíveis previstos</p>
                </div>
                <button
                  onClick={() => setIsReceivableModalOpen(true)}
                  className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-gold-500/10"
                >
                  <Plus className="w-4 h-4 text-ink-950" /> Lançar Receita
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Vencimento</th>
                      <th className="py-3.5 px-4">Empresa</th>
                      <th className="py-3.5 px-4">Descrição</th>
                      <th className="py-3.5 px-4">Categoria</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Situação</th>
                      <th className="py-3.5 px-4 text-right">Valor</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {filteredRec.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500 italic">
                          Nenhum lançamento a receber encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredRec.map(r => {
                        const isOverdue = r.status !== 'pago' && r.vencimento.substring(0, 10) < todayStr;
                        const isDueToday = r.status !== 'pago' && r.vencimento.substring(0, 10) === todayStr;

                        return (
                          <tr key={r.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className={`font-bold block ${isOverdue ? 'text-red-400' : isDueToday ? 'text-yellow-400' : 'text-gray-300'}`}>
                                {new Date(r.vencimento).toLocaleDateString('pt-BR')}
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">
                                  ⚠️ Em atraso
                                </span>
                              )}
                              {isDueToday && (
                                <span className="text-[9px] text-yellow-400 font-bold uppercase tracking-wider">
                                  🚨 Vence Hoje!
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white">{r.empresas?.nome_fantasia || 'Loja'}</td>
                            <td className="py-3.5 px-4 font-bold text-white">{r.descricao}</td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-gray-400 rounded-full text-[10px] font-bold uppercase">
                                {r.categoria.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-gray-300">{r.cliente_nome || 'Cliente Geral'}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-wider ${
                                r.status === 'pago' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : isOverdue
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : isDueToday
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {r.status === 'pago' ? 'Recebido' : isOverdue ? 'Atrasado' : isDueToday ? 'Vence Hoje' : 'A Vencer'}
                              </span>
                              {r.status === 'pago' && r.data_recebimento && (
                                <p className="text-[9px] text-gray-500 mt-0.5">
                                  Rec: {new Date(r.data_recebimento).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-sm text-green-400 font-mono">
                              R$ {(r.valor_pago || r.valor).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {r.status === 'pendente' ? (
                                  <button
                                    onClick={() => setActiveLiquidation({ item: r, type: 'receivable' })}
                                    className="bg-green-500 hover:bg-green-600 text-ink-950 font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-md shadow-green-500/10 flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Receber
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReopenBill(r.id, 'receivable')}
                                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                                    title="Estornar recebimento (Reabrir como pendente)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteBill(r.id, 'receivable')}
                                  className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                  title="Excluir Lançamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* TAB 3: PAYABLES */}
          {activeTab === 'payables' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    <ArrowDownRight className="text-gold-500 w-5 h-5" /> Contas a Pagar
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Despesas operacionais, boletos de fornecedores e contas fixas</p>
                </div>
                <button
                  onClick={() => setIsPayableModalOpen(true)}
                  className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-gold-500/10"
                >
                  <Plus className="w-4 h-4 text-ink-950" /> Lançar Despesa
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Vencimento</th>
                      <th className="py-3.5 px-4">Empresa</th>
                      <th className="py-3.5 px-4">Descrição</th>
                      <th className="py-3.5 px-4">Categoria</th>
                      <th className="py-3.5 px-4">Fornecedor</th>
                      <th className="py-3.5 px-4">Situação</th>
                      <th className="py-3.5 px-4 text-right">Valor</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {filteredPay.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500 italic">
                          Nenhuma conta a pagar encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredPay.map(p => {
                        const isOverdue = p.status !== 'pago' && p.vencimento.substring(0, 10) < todayStr;
                        const isDueToday = p.status !== 'pago' && p.vencimento.substring(0, 10) === todayStr;

                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className={`font-bold block ${isOverdue ? 'text-red-400 font-black' : isDueToday ? 'text-yellow-400 font-black' : 'text-gray-300'}`}>
                                {new Date(p.vencimento).toLocaleDateString('pt-BR')}
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">
                                  ⚠️ Em atraso
                                </span>
                              )}
                              {isDueToday && (
                                <span className="text-[9px] text-yellow-400 font-bold uppercase tracking-wider">
                                  🚨 Vence Hoje!
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white">{p.empresas?.nome_fantasia || 'Loja'}</td>
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-white">{p.descricao}</p>
                              {p.documento_numero && (
                                <span className="text-[9px] text-gray-500 font-mono">Doc #{p.documento_numero}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-gray-400 rounded-full text-[10px] font-bold uppercase">
                                {p.categoria.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-gray-300">
                              {p.fornecedores?.nome_fantasia || p.fornecedores?.razao_social || '-'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-wider ${
                                p.status === 'pago' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : isOverdue
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : isDueToday
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {p.status === 'pago' ? 'Pago' : isOverdue ? 'Atrasado' : isDueToday ? 'Vence Hoje' : 'A Vencer'}
                              </span>
                              {p.status === 'pago' && p.data_pagamento && (
                                <p className="text-[9px] text-gray-500 mt-0.5">
                                  Pago em: {new Date(p.data_pagamento).toLocaleDateString('pt-BR')} {p.forma_pagamento ? `(${p.forma_pagamento})` : ''}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-sm text-red-400 font-mono">
                              R$ {(p.valor_pago || p.valor).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {p.status === 'pendente' ? (
                                  <button
                                    onClick={() => setActiveLiquidation({ item: p, type: 'payable' })}
                                    className="bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-red-600/20 flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Liquidar
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReopenBill(p.id, 'payable')}
                                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                                    title="Estornar pagamento (Reabrir como pendente)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteBill(p.id, 'payable')}
                                  className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                  title="Excluir Lançamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* TAB 4: RECURRING EXPENSES (CONTA AZUL STYLE) */}
          {activeTab === 'recorrentes' && (
            <RecurringExpensesManager
              companies={companies}
              suppliers={suppliers}
              onBillsGenerated={fetchFinancialRecords}
              showNotification={showNotification}
            />
          )}

          {/* TAB 4: CAIXAS LOGS */}
          {activeTab === 'caixas' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-lg font-display font-bold text-white border-b border-white/5 pb-4 flex items-center gap-2">
                <Calculator className="text-gold-500 w-5 h-5" /> Controle de Turnos (Abertura/Fechamento de Caixa)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Abertura</th>
                      <th className="py-3.5 px-4">Fechamento</th>
                      <th className="py-3.5 px-4">Empresa</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Fundo de Troco</th>
                      <th className="py-3.5 px-4 text-right">Vendas PDV</th>
                      <th className="py-3.5 px-4 text-right">Saldo Esperado</th>
                      <th className="py-3.5 px-4 text-right">Saldo Fechamento</th>
                      <th className="py-3.5 px-4 text-right">Diferença (Quebra)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {caixas.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-500 italic">
                          Nenhum turno de caixa aberto ainda.
                        </td>
                      </tr>
                    ) : (
                      caixas.map(c => {
                        const expected = c.saldo_inicial + (c.total_vendas || 0);
                        const diff = c.saldo_final !== undefined ? c.saldo_final - expected : 0;
                        
                        return (
                          <tr key={c.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-500">
                              {new Date(c.data_abertura).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-500">
                              {c.data_fechamento ? new Date(c.data_fechamento).toLocaleString('pt-BR') : <span className="text-gray-700">-</span>}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">{c.empresas?.nome_fantasia}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                c.status === 'aberto' 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-gray-500/10 text-gray-400 border border-white/5'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-white">
                              R$ {c.saldo_inicial.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-white">
                              R$ {(c.total_vendas || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-white">
                              R$ {expected.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-gold-500">
                              {c.saldo_final !== undefined ? `R$ ${c.saldo_final.toFixed(2)}` : '-'}
                            </td>
                            <td className={`py-3 px-4 text-right font-black ${
                              c.saldo_final === undefined
                              ? 'text-gray-500'
                              : diff === 0
                              ? 'text-green-500'
                              : diff > 0
                              ? 'text-blue-400'
                              : 'text-red-400'
                            }`}>
                              {c.saldo_final !== undefined 
                                ? `${diff > 0 ? '+' : ''} R$ ${diff.toFixed(2)}` 
                                : '-'
                              }
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: FISCAL PANEL */}
          {activeTab === 'fiscal' && (
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <FileText className="text-gold-500 w-5 h-5" /> Painel Fiscal (NFC-e / Cupom Fiscal)
                </h3>
                <button
                  onClick={fetchFiscalData}
                  disabled={loadingFiscal}
                  className="bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCcw className={`w-4 h-4 text-white ${loadingFiscal ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Data da Venda</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4 text-right">Valor Final</th>
                      <th className="py-3.5 px-4 text-center">Status Fiscal</th>
                      <th className="py-3.5 px-4 text-center">Links da Nota</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {loadingFiscal ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <RefreshCcw className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-2" />
                          Buscando dados fiscais...
                        </td>
                      </tr>
                    ) : vendasFiscal.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500 italic">
                          Nenhuma venda registrada no PDV.
                        </td>
                      </tr>
                    ) : (
                      vendasFiscal.map(venda => {
                        const doc = docsFiscal.find(d => d.referencia_id === venda.id && d.referencia_tipo === 'venda');
                        const tefTransac = tefTransactions.find(t => t.venda_id === venda.id && t.status === 'aprovado');
                        const isEmitting = emittingSaleId === venda.id;

                        return (
                          <tr key={venda.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-500">
                              {new Date(venda.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {venda.customers?.name || 'Consumidor Final'}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-sm text-gold-400">
                              R$ {Number(venda.valor_final).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {(() => {
                                if (!doc) {
                                  return (
                                    <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-gray-500/10 text-gray-400 border border-white/5">
                                      Não Emitido
                                    </span>
                                  );
                                }
                                if (doc.status === 'emitido') {
                                  return (
                                    <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                                      Emitido
                                    </span>
                                  );
                                }
                                if (doc.status === 'pendente') {
                                  return (
                                    <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse">
                                      Processando
                                    </span>
                                  );
                                }
                                if (doc.status === 'erro') {
                                  return (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                                        Erro
                                      </span>
                                      <span className="text-[9px] text-red-500/80 max-w-[180px] break-words text-center">
                                        {doc.erro_retorno || 'Erro desconhecido'}
                                      </span>
                                    </div>
                                  );
                                }
                                return (
                                  <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-gray-500/10 text-gray-400 border border-white/5">
                                    {doc.status}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {doc?.status === 'emitido' ? (
                                <div className="flex justify-center gap-3">
                                  <button
                                    onClick={() => handleDownloadFiscalDoc(doc.chave || doc.id, 'pdf', doc.pdf_url, venda)}
                                    disabled={loadingDocId === `${doc.chave || doc.id}_pdf`}
                                    className="text-gold-400 hover:text-gold-500 disabled:opacity-50 font-bold flex items-center gap-1 text-[11px]"
                                  >
                                    {loadingDocId === `${doc.chave || doc.id}_pdf` ? (
                                      <RefreshCcw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ExternalLink className="w-3 h-3" />
                                    )}
                                    PDF
                                  </button>

                                  <button
                                    onClick={() => handleDownloadFiscalDoc(doc.chave || doc.id, 'xml', doc.xml_url)}
                                    disabled={loadingDocId === `${doc.chave || doc.id}_xml`}
                                    className="text-gray-400 hover:text-gray-300 disabled:opacity-50 font-bold flex items-center gap-1 text-[11px]"
                                  >
                                    {loadingDocId === `${doc.chave || doc.id}_xml` ? (
                                      <RefreshCcw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ExternalLink className="w-3 h-3" />
                                    )}
                                    XML
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                {(!doc || doc.status === 'erro' || doc.status === 'emitido') && (
                                  <button
                                    onClick={() => handleEmitInvoice(venda.id)}
                                    disabled={isEmitting || emittingSaleId !== null}
                                    className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-ink-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 shrink-0"
                                  >
                                    {isEmitting ? (
                                      <RefreshCcw className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    {doc?.status === 'emitido' ? 'Reemitir / Atualizar' : doc ? 'Reemitir' : 'Emitir NFC-e'}
                                  </button>
                                )}
                                
                                {tefTransac && (
                                  <button
                                    onClick={() => {
                                      if (tefTransac.comprovante_cliente) {
                                        handlePrintTefReceipt(tefTransac.comprovante_cliente);
                                      }
                                      if (tefTransac.comprovante_estabelecimento) {
                                        setTimeout(() => handlePrintTefReceipt(tefTransac.comprovante_estabelecimento), 500);
                                      }
                                    }}
                                    className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 shrink-0"
                                  >
                                    <Printer className="w-3.5 h-3.5" /> Reimprimir TEF
                                  </button>
                                )}

                                {!(!doc || doc.status === 'erro') && !tefTransac && (
                                  <span className="text-gray-600">-</span>
                                )}
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
          )}

        </div>
      )}

      {/* MANUAL PAYABLE MODAL */}
      <AnimatePresence>
        {isPayableModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setIsPayableModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-ink-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight mb-6">Lançar Nova Despesa (Contas a Pagar)</h3>

              <form onSubmit={handleSavePayable} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Conta de Energia Elétrica - Maio/2026"
                    value={newPayable.descricao}
                    onChange={e => setNewPayable({ ...newPayable, descricao: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Categoria</label>
                    <select
                      value={newPayable.categoria}
                      onChange={e => setNewPayable({ ...newPayable, categoria: e.target.value })}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="aluguel">Aluguel</option>
                      <option value="energia">Energia Elétrica</option>
                      <option value="agua">Água / Saneamento</option>
                      <option value="folha">Folha de Pagamento</option>
                      <option value="impostos">Impostos / Taxas</option>
                      <option value="compra_mercadoria">Compra Mercadoria</option>
                      <option value="outros">Outros Custos</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newPayable.valor}
                      onChange={e => setNewPayable({ ...newPayable, valor: e.target.value })}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={newPayable.vencimento}
                    onChange={e => setNewPayable({ ...newPayable, vencimento: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Unidade pagadora (Empresa)</label>
                  <select
                    value={newPayable.empresa_id}
                    onChange={e => setNewPayable({ ...newPayable, empresa_id: e.target.value })}
                    required
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Fornecedor (Opcional)</label>
                  <select
                    value={newPayable.fornecedor_id}
                    onChange={e => setNewPayable({ ...newPayable, fornecedor_id: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  >
                    <option value="">Nenhum fornecedor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.nome_fantasia || s.razao_social}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPayableModalOpen(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-3 rounded-xl uppercase tracking-wider text-xs border border-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPayable}
                    className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-3 rounded-xl uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSavingPayable ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : 'Lançar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL RECEIVABLE MODAL */}
      <AnimatePresence>
        {isReceivableModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div onClick={() => setIsReceivableModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-ink-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight mb-6">Lançar Nova Receita (Contas a Receber)</h3>

              <form onSubmit={handleSaveReceivable} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Convênio Mensalidade Restaurante X"
                    value={newReceivable.descricao}
                    onChange={e => setNewReceivable({ ...newReceivable, descricao: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Categoria</label>
                    <select
                      value={newReceivable.categoria}
                      onChange={e => setNewReceivable({ ...newReceivable, categoria: e.target.value })}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="venda_balcao">Venda Balcão / PDV</option>
                      <option value="venda_online">Venda Online</option>
                      <option value="convenio">Convênio Empresa</option>
                      <option value="outros">Outras Receitas</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newReceivable.valor}
                      onChange={e => setNewReceivable({ ...newReceivable, valor: e.target.value })}
                      className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={newReceivable.vencimento}
                    onChange={e => setNewReceivable({ ...newReceivable, vencimento: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Unidade Receptora (Empresa)</label>
                  <select
                    value={newReceivable.empresa_id}
                    onChange={e => setNewReceivable({ ...newReceivable, empresa_id: e.target.value })}
                    required
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Nome do Cliente (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Maria de Souza"
                    value={newReceivable.cliente_nome}
                    onChange={e => setNewReceivable({ ...newReceivable, cliente_nome: e.target.value })}
                    className="w-full bg-ink-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsReceivableModalOpen(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-3 rounded-xl uppercase tracking-wider text-xs border border-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingReceivable}
                    className="flex-1 bg-gold-500 hover:bg-gold-600 text-ink-950 font-black py-3 rounded-xl uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSavingReceivable ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : 'Lançar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIQUIDATION / SETTLEMENT MODAL */}
      {activeLiquidation && (
        <LiquidationModal
          isOpen={!!activeLiquidation}
          onClose={() => setActiveLiquidation(null)}
          title={activeLiquidation.item.descricao}
          originalValue={Number(activeLiquidation.item.valor)}
          dueDate={activeLiquidation.item.vencimento}
          entityName={
            activeLiquidation.type === 'payable'
              ? (activeLiquidation.item as AccountsPayable).fornecedores?.nome_fantasia || (activeLiquidation.item as AccountsPayable).fornecedores?.razao_social
              : (activeLiquidation.item as AccountsReceivable).cliente_nome
          }
          type={activeLiquidation.type}
          onConfirm={handleConfirmLiquidation}
        />
      )}

    </div>
  );
}

