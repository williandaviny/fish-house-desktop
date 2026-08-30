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
  Printer
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

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
  const [activeTab, setActiveTab] = useState<'ledger' | 'receivables' | 'payables' | 'caixas' | 'fiscal'>('ledger');
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

  // Filter States
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | '30d' | 'this_month' | 'today'>('this_month');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendente' | 'pago'>('all');

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

  const handleDownloadFiscalDoc = async (invoiceId: string, format: 'pdf' | 'xml', directUrl?: string, vendaObj?: any) => {
    if (directUrl && directUrl.startsWith('http') && !directUrl.includes('api.nfse.io')) {
      window.open(directUrl, '_blank');
      return;
    }
    if (!invoiceId) {
      showNotification('error', 'Identificador da nota não encontrado.');
      return;
    }
    const docKey = `${invoiceId}_${format}`;
    setLoadingDocId(docKey);

    try {
      // Step 1: Try fetching via Edge Function (passing referencia_tipo/id to satisfy legacy Edge Function checks if any)
      let fileData: string | null = null;
      let fileUrl: string | null = null;

      try {
        const { data, error } = await supabase.functions.invoke('nfe-io-invoice', {
          body: { 
            action: 'get_file', 
            invoice_id: invoiceId, 
            format,
            referencia_tipo: 'venda',
            referencia_id: vendaObj?.id || invoiceId
          }
        });

        if (!error && data && data.success) {
          fileData = data.data || null;
          fileUrl = data.url || null;
        }
      } catch (edgeErr) {
        console.warn('Edge function invoke error, trying direct fallback...', edgeErr);
      }

      // Step 2: Fallback to direct NFe.io API if Edge Function didn't return data
      if (!fileData && !fileUrl) {
        const { data: settings } = await supabase
          .from('site_settings')
          .select('nfe_io_api_key, nfe_io_company_id, nfe_io_service_code')
          .limit(1)
          .single();

        const apiKey = settings?.nfe_io_api_key;
        const companyId = settings?.nfe_io_company_id;
        const isService = !!settings?.nfe_io_service_code;

        if (apiKey && companyId) {
          const endpoint = isService ? 'serviceinvoices' : 'consumerinvoices';
          const apiUrl = `https://api.nfse.io/v2/companies/${companyId}/${endpoint}/${invoiceId}/${format}`;

          console.log(`Direct NFe.io fetch: ${apiUrl}`);
          let nfeRes = await fetch(apiUrl, {
            headers: { 'Authorization': `ApiKey ${apiKey}` }
          });

          if (!nfeRes.ok) {
            const v1Url = `https://nfe.io/v1/companies/${companyId}/${endpoint}/${invoiceId}/${format}`;
            nfeRes = await fetch(v1Url, {
              headers: { 'Authorization': `ApiKey ${apiKey}` }
            });
          }

          if (nfeRes.ok) {
            const rawText = await nfeRes.text();
            let fileTargetUrl = apiUrl;
            try {
              const metaJson = JSON.parse(rawText);
              if (metaJson.uri) {
                fileTargetUrl = metaJson.uri;
              }
            } catch (_) {}

            if (fileTargetUrl.startsWith('http')) {
              if (format === 'xml') {
                const xmlRes = await fetch(fileTargetUrl);
                const xmlText = await xmlRes.text();
                const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `CupomFiscal_${invoiceId.slice(0, 8)}.xml`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showNotification('success', 'Arquivo XML baixado com sucesso!');
                return;
              } else {
                fileUrl = fileTargetUrl;
              }
            }
          }
        }
      }

      // Process fetched PDF or URL
      if (fileData) {
        if (format === 'pdf') {
          const byteCharacters = atob(fileData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
      } else if (fileUrl) {
        window.open(fileUrl, '_blank');
      } else {
        throw new Error('Nota Fiscal / PDF não disponível. A nota pode estar com erro na SEFAZ.');
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

  // Quick Action: Pay a Bill
  const handlePayBill = async (id: string) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          data_pagamento: todayStr
        })
        .eq('id', id);

      if (error) throw error;
      showNotification('success', 'Conta a Pagar baixada como PAGO!');
      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao baixar conta: ' + err.message);
    }
  };

  // Quick Action: Receive an Account
  const handleReceiveAccount = async (id: string) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('contas_receber')
        .update({
          status: 'pago',
          data_recebimento: todayStr
        })
        .eq('id', id);

      if (error) throw error;
      showNotification('success', 'Conta a Receber baixada como RECEBIDO!');
      await fetchFinancialRecords();
    } catch (err: any) {
      showNotification('error', 'Falha ao receber conta: ' + err.message);
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

  // Filter Utilities
  const filterByPeriod = (recordDateStr: string) => {
    if (filterPeriod === 'all') return true;
    const date = new Date(recordDateStr);
    const now = new Date();
    
    if (filterPeriod === 'today') {
      return date.toDateString() === now.toDateString();
    }
    if (filterPeriod === 'this_month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (filterPeriod === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= thirtyDaysAgo;
    }
    return true;
  };

  const getFilteredPayables = () => {
    return payables.filter(p => {
      const matchesCompany = filterCompany === 'all' || p.empresa_id === filterCompany;
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchesPeriod = filterByPeriod(p.vencimento);
      return matchesCompany && matchesStatus && matchesPeriod;
    });
  };

  const getFilteredReceivables = () => {
    return receivables.filter(r => {
      const matchesCompany = filterCompany === 'all' || r.empresa_id === filterCompany;
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchesPeriod = filterByPeriod(r.vencimento);
      return matchesCompany && matchesStatus && matchesPeriod;
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
          valor: p.valor,
          entidade: p.fornecedores?.nome_fantasia || p.fornecedores?.razao_social || 'Fornecedor',
          empresa: p.empresas?.nome_fantasia || 'Loja'
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
          valor: r.valor,
          entidade: r.cliente_nome || 'Cliente Geral',
          empresa: r.empresas?.nome_fantasia || 'Loja'
        });
      }
    });

    // Sort chronologically (newest first)
    return items
      .filter(item => {
        const matchesCompany = filterCompany === 'all' || payables.find(p=>p.id===item.id)?.empresa_id === filterCompany || receivables.find(r=>r.id===item.id)?.empresa_id === filterCompany;
        return matchesCompany && filterByPeriod(item.data);
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  };

  const ledgerItems = getLedgerItems();
  const filteredPay = getFilteredPayables();
  const filteredRec = getFilteredReceivables();

  // Summary Card Calculations (based on filters)
  const totalRevenuesReceived = ledgerItems.filter(i => i.tipo === 'receita').reduce((sum, i) => sum + i.valor, 0);
  const totalExpensesPaid = ledgerItems.filter(i => i.tipo === 'despesa').reduce((sum, i) => sum + i.valor, 0);
  const netLedgerCash = totalRevenuesReceived - totalExpensesPaid;

  const totalPayablesPending = filteredPay.filter(p => p.status === 'pendente').reduce((sum, p) => sum + p.valor, 0);
  const totalReceivablesPending = filteredRec.filter(r => r.status === 'pendente').reduce((sum, r) => sum + r.valor, 0);

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

        {/* Tab Buttons */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start md:self-center">
          {[
            { id: 'ledger', label: 'Fluxo de Caixa', icon: TrendingUp },
            { id: 'receivables', label: 'A Receber', icon: ArrowUpRight },
            { id: 'payables', label: 'A Pagar', icon: ArrowDownRight },
            { id: 'caixas', label: 'Turnos de Caixa', icon: Calculator },
            { id: 'fiscal', label: 'Painel Fiscal', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-bold rounded-lg text-xs md:text-sm transition-all flex items-center gap-2 ${
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

      {/* Global Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-ink-900 border border-white/10 p-4 rounded-3xl shrink-0">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
              Filtrar Empresa
            </span>
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="w-full bg-ink-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
            >
              <option value="all">Todas as Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
              Período de Vencimento/Lançamento
            </span>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as any)}
              className="w-full bg-ink-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
            >
              <option value="today">Hoje</option>
              <option value="this_month">Este Mês</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="all">Todo Histórico</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
              Filtrar Status
            </span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full bg-ink-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">Somente Pendentes</option>
              <option value="pago">Somente Pagos/Recebidos</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* STATS WIDGETS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <div className="p-2.5 rounded-xl bg-green-500/10 text-green-500">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Realizado</span>
              </div>
              <p className="text-gray-400 text-xs">Entradas (Receitas Liquidadas)</p>
              <p className="text-2xl font-black text-green-500 mt-1">R$ {totalRevenuesReceived.toFixed(2)}</p>
              {totalReceivablesPending > 0 && (
                <p className="text-[10px] text-gray-500 font-bold mt-2">
                  + R$ {totalReceivablesPending.toFixed(2)} pendente a receber
                </p>
              )}
            </div>

            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Realizado</span>
              </div>
              <p className="text-gray-400 text-xs">Saídas (Despesas Pagas)</p>
              <p className="text-2xl font-black text-red-500 mt-1">R$ {totalExpensesPaid.toFixed(2)}</p>
              {totalPayablesPending > 0 && (
                <p className="text-[10px] text-gray-500 font-bold mt-2">
                  + R$ {totalPayablesPending.toFixed(2)} pendente a pagar
                </p>
              )}
            </div>

            <div className="bg-ink-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden bg-gold-500/5">
              <div className="flex justify-between items-center mb-4">
                <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-500">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Saldo Líquido</span>
              </div>
              <p className="text-gray-400 text-xs">Fluxo Caixa Líquido Realizado</p>
              <p className={`text-2xl font-black mt-1 ${netLedgerCash >= 0 ? 'text-gold-500' : 'text-red-400'}`}>
                R$ {netLedgerCash.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-500 font-bold mt-2">
                Saldo previsto: R$ {(netLedgerCash + totalReceivablesPending - totalPayablesPending).toFixed(2)}
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
                <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="text-gold-500 w-5 h-5" /> Contas a Receber
                </h3>
                <button
                  onClick={() => setIsReceivableModalOpen(true)}
                  className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
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
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Valor</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {filteredRec.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500 italic">
                          Nenhuma conta a receber pendente.
                        </td>
                      </tr>
                    ) : (
                      filteredRec.map(r => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-500">
                            {new Date(r.vencimento).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{r.empresas?.nome_fantasia}</td>
                          <td className="py-3 px-4 font-bold text-white">{r.descricao}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-gray-400 rounded-full text-[10px] font-bold">
                              {r.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-400">{r.cliente_nome || 'Cliente Geral'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                              r.status === 'pago' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                            }`}>
                              {r.status === 'pago' ? 'recebido' : 'pendente'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-sm text-green-400">
                            R$ {r.valor.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {r.status === 'pendente' && (
                              <button
                                onClick={() => handleReceiveAccount(r.id)}
                                className="bg-green-500 hover:bg-green-600 text-ink-950 font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all"
                              >
                                Receber
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
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
                <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <ArrowDownRight className="text-gold-500 w-5 h-5" /> Contas a Pagar
                </h3>
                <button
                  onClick={() => setIsPayableModalOpen(true)}
                  className="bg-gold-500 hover:bg-gold-600 text-ink-950 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
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
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Valor</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {filteredPay.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500 italic">
                          Nenhuma conta a pagar pendente.
                        </td>
                      </tr>
                    ) : (
                      filteredPay.map(p => (
                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-500">
                            {new Date(p.vencimento).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{p.empresas?.nome_fantasia}</td>
                          <td className="py-3 px-4 font-bold text-white">{p.descricao}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-gray-400 rounded-full text-[10px] font-bold">
                              {p.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-400">
                            {p.fornecedores?.nome_fantasia || p.fornecedores?.razao_social || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                              p.status === 'pago' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-sm text-red-400">
                            R$ {p.valor.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {p.status === 'pendente' && (
                              <button
                                onClick={() => handlePayBill(p.id)}
                                className="bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all"
                              >
                                Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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

    </div>
  );
}
