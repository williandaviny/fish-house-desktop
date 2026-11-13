function getTauriInvoke() {
  const tauri = (window as any).__TAURI__;
  const internals = (window as any).__TAURI_INTERNALS__;
  return (
    tauri?.core?.invoke ||
    tauri?.invoke ||
    (internals?.invoke ? internals.invoke.bind(internals) : null)
  );
}

export interface PrintSettings {
  autoPrintSale: boolean;
  silentPrint: boolean;
  selectedPrinter?: string;
  printInternalOrder: boolean;
  printFiscalNfce: boolean;
}

const DEFAULT_SETTINGS_KEY = 'fishhouse_printer_config';

export function getLocalPrinterSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(DEFAULT_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    autoPrintSale: true,
    silentPrint: true,
    selectedPrinter: '',
    printInternalOrder: true,
    printFiscalNfce: true
  };
}

export function saveLocalPrinterSettings(settings: Partial<PrintSettings>) {
  try {
    const current = getLocalPrinterSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(DEFAULT_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return getLocalPrinterSettings();
  }
}

/**
 * Consulta impressoras instaladas no Windows via Tauri
 */
export async function getInstalledPrinters(): Promise<string[]> {
  try {
    const invoke = getTauriInvoke();
    if (invoke) {
      return await invoke('get_printers');
    }
  } catch (e) {
    console.warn('[PrinterService] Não foi possível listar impressoras via Tauri:', e);
  }
  return [];
}

/**
 * Envia texto bruto formatado diretamente para a impressora térmica
 */
export async function printThermalText(
  text: string, 
  options?: { printerName?: string; forceWebDialog?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const settings = getLocalPrinterSettings();
  const printer = options?.printerName || settings.selectedPrinter || undefined;
  const invoke = getTauriInvoke();

  // Se estiver no Desktop e o modo silencioso estiver ativo (e não forçado diálogo web)
  if (invoke && settings.silentPrint && !options?.forceWebDialog) {
    try {
      const ok = await invoke('print_thermal_raw', {
        text,
        printerName: printer || null
      });
      return { success: !!ok };
    } catch (err: any) {
      console.warn('[PrinterService] Falha na impressão silenciosa nativa, tentando fallback:', err);
    }
  }

  // Fallback: Diálogo padrão do navegador/WebView
  try {
    printViaIframeText(text);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function printViaIframeText(text: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Impressão Térmica</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.25;
            padding: 10px;
            width: 76mm;
            margin: 0 auto;
            color: #000;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body onload="window.print();">
        <pre style="margin: 0; font-family: inherit;">${text}</pre>
      </body>
    </html>
  `;

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, 250);
  }
}

/**
 * Formata o comprovante de venda para bobina térmica (80mm / 42 colunas)
 */
export function formatSaleReceiptText(params: {
  saleId: string;
  date: Date | string;
  customerName?: string;
  customerDoc?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  payments: Array<{
    methodName: string;
    amount: number;
    installments?: number;
    dueDate?: string;
  }>;
  accessKey?: string;
  isFiscal?: boolean;
}): string {
  const sep = '==========================================';
  const dash = '------------------------------------------';
  const dateStr = new Date(params.date).toLocaleString('pt-BR');
  const shortId = params.saleId.slice(0, 8).toUpperCase();

  let out = '';
  out += `${sep}\r\n`;
  out += `          FISH HOUSE SC LTDA\r\n`;
  out += ` CNPJ: 63.265.618/0001-01 - IE: 263906078\r\n`;
  out += ` Rua Pref. Juvenal Mafra, 42 - Centro\r\n`;
  out += ` Navegantes/SC - Fone: (47) 3011-4981\r\n`;
  out += `${sep}\r\n`;

  if (params.isFiscal) {
    out += `        DANFE NFC-e - CONSUMIDOR\r\n`;
    out += `  Não permite aproveitamento de ICMS\r\n`;
  } else {
    out += `    *** COMPROVANTE NÃO FISCAL ***\r\n`;
  }
  out += `Venda #${shortId} - ${dateStr}\r\n`;
  out += `CONSUMIDOR: ${params.customerName || 'Consumidor Final'}\r\n`;
  if (params.customerDoc) {
    out += `CPF/CNPJ  : ${params.customerDoc}\r\n`;
  }
  out += `${dash}\r\n`;
  out += `ITEM  DESCRICAO          QTD UN   VL.TOT\r\n`;
  out += `${dash}\r\n`;

  params.items.forEach((item, idx) => {
    const num = String(idx + 1).padStart(3, '0');
    const name = item.name.length > 18 ? item.name.slice(0, 18) : item.name.padEnd(18, ' ');
    const qtyUnit = `${item.quantity.toFixed(item.unit === 'kg' ? 3 : 0)} ${item.unit}`.padStart(7, ' ');
    const tot = item.subtotal.toFixed(2).padStart(8, ' ');
    out += `${num} ${name} ${qtyUnit} ${tot}\r\n`;
  });

  out += `${dash}\r\n`;
  out += `SUBTOTAL               : R$ ${params.subtotal.toFixed(2).padStart(8, ' ')}\r\n`;
  if (params.discount > 0) {
    out += `DESCONTO (-)           : R$ ${params.discount.toFixed(2).padStart(8, ' ')}\r\n`;
  }
  if (params.surcharge > 0) {
    out += `ACRÉSCIMO (+)          : R$ ${params.surcharge.toFixed(2).padStart(8, ' ')}\r\n`;
  }
  out += `TOTAL LIQUIDO          : R$ ${params.total.toFixed(2).padStart(8, ' ')}\r\n`;
  out += `${dash}\r\n`;
  out += `FORMA(S) DE PAGAMENTO:\r\n`;

  params.payments.forEach(p => {
    const pName = (p.methodName || 'PAGAMENTO').padEnd(20, ' ');
    const pVal = `R$ ${p.amount.toFixed(2)}`.padStart(12, ' ');
    out += `  ${pName} ${pVal}\r\n`;
    if (p.installments && p.installments > 1) {
      out += `  -> Parcelamento: ${p.installments}x\r\n`;
    }
    if (p.dueDate) {
      out += `  -> Vencimento: ${new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}\r\n`;
    }
  });

  if (params.accessKey) {
    out += `${dash}\r\n`;
    out += `CHAVE DE ACESSO NFC-e:\r\n`;
    out += `${params.accessKey.replace(/(\d{4})/g, '$1 ').trim()}\r\n`;
    out += `Consulte em: http://sat.sef.sc.gov.br/nfce\r\n`;
  }

  out += `${sep}\r\n`;
  out += `    Obrigado pela preferência!\r\n`;
  out += `\r\n\r\n\r\n\r\n`; // Espaço para corte da bobina

  return out;
}

/**
 * Formata o relatório financeiro do Caixa para bobina térmica (Leitura X ou Fechamento)
 */
export function formatCaixaReportText(params: {
  isClosing: boolean;
  caixaId: string;
  dataAbertura: Date | string;
  dataFechamento?: Date | string;
  operadorAberturaNome?: string;
  operadorFechamentoNome?: string;
  saldoInicial: number;
  totalVendas: number;
  totalDescontos: number;
  totalLiquido: number;
  vendasCount: number;
  paymentsSummary: Array<{
    nome: string;
    tipo: string;
    total: number;
    count: number;
  }>;
  saldoFinalContado?: number;
}): string {
  const sep = '==========================================';
  const dash = '------------------------------------------';
  const title = params.isClosing 
    ? 'FECHAMENTO DE CAIXA (REDUÇÃO Z)' 
    : 'RELATÓRIO DO DIA (LEITURA X)';
  const now = new Date().toLocaleString('pt-BR');
  const abertStr = new Date(params.dataAbertura).toLocaleString('pt-BR');

  let out = '';
  out += `${sep}\r\n`;
  out += `          FISH HOUSE SC LTDA\r\n`;
  out += ` CNPJ: 63.265.618/0001-01 - IE: 263906078\r\n`;
  out += ` Rua Pref. Juvenal Mafra, 42 - Centro\r\n`;
  out += ` Navegantes/SC - Fone: (47) 3011-4981\r\n`;
  out += `${sep}\r\n`;
  out += `      ${title}\r\n`;
  out += `Emissão: ${now}\r\n`;
  out += `Caixa ID: #${params.caixaId.slice(0, 8).toUpperCase()}\r\n`;
  out += `Abertura: ${abertStr}\r\n`;
  if (params.isClosing && params.dataFechamento) {
    out += `Fechamento: ${new Date(params.dataFechamento).toLocaleString('pt-BR')}\r\n`;
  }
  if (params.operadorAberturaNome) {
    out += `Operador: ${params.operadorAberturaNome}\r\n`;
  }
  out += `${dash}\r\n`;
  out += `RESUMO FINANCEIRO:\r\n`;
  out += `Fundo de Troco (Inicial): R$ ${params.saldoInicial.toFixed(2).padStart(9, ' ')}\r\n`;
  out += `Qtd Vendas Realizadas   : ${String(params.vendasCount).padStart(12, ' ')}\r\n`;
  out += `Total Bruto Vendas      : R$ ${params.totalVendas.toFixed(2).padStart(9, ' ')}\r\n`;
  if (params.totalDescontos > 0) {
    out += `Total de Descontos      : R$ ${params.totalDescontos.toFixed(2).padStart(9, ' ')}\r\n`;
  }
  out += `TOTAL LIQUIDO DO TURNO  : R$ ${params.totalLiquido.toFixed(2).padStart(9, ' ')}\r\n`;
  out += `${dash}\r\n`;
  out += `VENDAS POR FORMA DE PAGAMENTO:\r\n`;

  let totalEmDinheiro = 0;

  params.paymentsSummary.forEach(p => {
    const nome = p.nome.length > 20 ? p.nome.slice(0, 20) : p.nome.padEnd(20, ' ');
    const tot = `R$ ${p.total.toFixed(2)}`.padStart(11, ' ');
    out += `  ${nome} (${p.count}) ${tot}\r\n`;
    if (p.tipo === 'dinheiro') {
      totalEmDinheiro += p.total;
    }
  });

  out += `${dash}\r\n`;
  const esperadoDinheiro = params.saldoInicial + totalEmDinheiro;
  out += `CONFERÊNCIA DA GAVETA (ESPÉCIE):\r\n`;
  out += `  Fundo de Troco Inicial: R$ ${params.saldoInicial.toFixed(2).padStart(9, ' ')}\r\n`;
  out += `  Vendas em Dinheiro    : R$ ${totalEmDinheiro.toFixed(2).padStart(9, ' ')}\r\n`;
  out += `  ESPERADO EM DINHEIRO  : R$ ${esperadoDinheiro.toFixed(2).padStart(9, ' ')}\r\n`;

  if (params.isClosing && params.saldoFinalContado !== undefined) {
    const diferenca = params.saldoFinalContado - esperadoDinheiro;
    out += `  DINHEIRO CONTADO FIS. : R$ ${params.saldoFinalContado.toFixed(2).padStart(9, ' ')}\r\n`;
    if (Math.abs(diferenca) < 0.01) {
      out += `  STATUS DA GAVETA      : [OK] CAIXA EXATO\r\n`;
    } else if (diferenca > 0) {
      out += `  SOBRA DE CAIXA        : +R$ ${diferenca.toFixed(2).padStart(8, ' ')}\r\n`;
    } else {
      out += `  FALTA / QUEBRA CAIXA  : -R$ ${Math.abs(diferenca).toFixed(2).padStart(8, ' ')}\r\n`;
    }
  }

  out += `${sep}\r\n`;
  out += `Assinatura do Operador:\r\n\r\n\r\n`;
  out += `__________________________________________\r\n`;
  out += `\r\n\r\n\r\n\r\n`;

  return out;
}
