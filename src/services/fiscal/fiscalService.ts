import { supabase } from '../../lib/supabase';

/**
 * Baixa e prepara o Blob do PDF ou XML da NFC-e/NF-e diretamente da NFe.io / SEFAZ
 * sem depender de servidores intermediários, com fallback completo.
 */
export async function downloadFiscalDocumentBlob(
  invoiceIdOrChave: string,
  format: 'pdf' | 'xml',
  saleId?: string
): Promise<{ blobUrl: string; filename: string } | null> {
  try {
    if (!invoiceIdOrChave) return null;

    // 1. Obtém as credenciais da NFe.io do Supabase
    const { data: settings } = await supabase
      .from('site_settings')
      .select('nfe_io_api_key, nfe_io_company_id, nfe_io_service_code')
      .limit(1)
      .single();

    const apiKey = settings?.nfe_io_api_key;
    const companyId = settings?.nfe_io_company_id;
    const isService = !!settings?.nfe_io_service_code;

    // Se invoiceIdOrChave for uma URL completa da NFe.io, extrai o ID
    let cleanInvoiceId = invoiceIdOrChave;
    if (cleanInvoiceId.includes('consumerinvoices/')) {
      cleanInvoiceId = cleanInvoiceId.split('consumerinvoices/')[1].split('/')[0];
    } else if (cleanInvoiceId.includes('serviceinvoices/')) {
      cleanInvoiceId = cleanInvoiceId.split('serviceinvoices/')[1].split('/')[0];
    }

    // Se tivermos apenas o saleId, tenta buscar a chave/id no banco se o cleanInvoiceId parecer UUID de venda
    if (saleId && cleanInvoiceId.length === 36 && cleanInvoiceId.includes('-')) {
      const { data: doc } = await supabase
        .from('documentos_fiscais')
        .select('chave, id, pdf_url')
        .eq('referencia_id', saleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (doc?.chave && doc.chave.length !== 44) {
        cleanInvoiceId = doc.chave;
      } else if (doc?.pdf_url && doc.pdf_url.includes('consumerinvoices/')) {
        cleanInvoiceId = doc.pdf_url.split('consumerinvoices/')[1].split('/')[0];
      }
    }

    let rawBuffer: ArrayBuffer | null = null;
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/xml;charset=utf-8;';

    // 2. Tenta obter diretamente da API NFe.io v2 com autenticação
    if (apiKey && companyId) {
      const endpoint = isService ? 'serviceinvoices' : 'consumerinvoices';
      const apiUrl = `https://api.nfse.io/v2/companies/${companyId}/${endpoint}/${cleanInvoiceId}/${format}`;

      console.log(`[FiscalService] Buscando ${format.toUpperCase()} da NFe.io em: ${apiUrl}`);

      try {
        let nfeRes = await fetch(apiUrl, {
          headers: { 'Authorization': `ApiKey ${apiKey}` }
        });

        if (!nfeRes.ok) {
          const v1Url = `https://nfe.io/v1/companies/${companyId}/${endpoint}/${cleanInvoiceId}/${format}`;
          nfeRes = await fetch(v1Url, {
            headers: { 'Authorization': `ApiKey ${apiKey}` }
          });
        }

        if (nfeRes.ok) {
          const tempBuffer = await nfeRes.arrayBuffer();
          // Verifica se retornou JSON com URL assinada ({ uri: 'https://...' })
          try {
            const textDecoder = new TextDecoder();
            const sampleText = textDecoder.decode(tempBuffer.slice(0, 512));
            if (sampleText.trim().startsWith('{')) {
              const metaJson = JSON.parse(textDecoder.decode(tempBuffer));
              if (metaJson.uri) {
                console.log(`[FiscalService] Baixando do URI assinado da NFe.io: ${metaJson.uri}`);
                const storageRes = await fetch(metaJson.uri);
                if (storageRes.ok) {
                  rawBuffer = await storageRes.arrayBuffer();
                }
              }
            } else {
              rawBuffer = tempBuffer;
            }
          } catch (_) {
            rawBuffer = tempBuffer;
          }
        } else {
          console.warn(`[FiscalService] NFe.io retornou status ${nfeRes.status}`);
        }
      } catch (directErr) {
        console.warn('[FiscalService] Erro na requisição direta NFe.io:', directErr);
      }
    }

    // 3. Fallback: Se a requisição direta não obteve os bytes, tenta pela Edge Function
    if (!rawBuffer) {
      try {
        const { data: edgeRes } = await supabase.functions.invoke('nfe-io-invoice', {
          body: {
            action: 'get_file',
            invoice_id: cleanInvoiceId,
            format,
            referencia_tipo: 'venda',
            referencia_id: saleId || cleanInvoiceId
          }
        });

        if (edgeRes?.data) {
          const byteCharacters = atob(edgeRes.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          rawBuffer = new Uint8Array(byteNumbers).buffer;
        } else if (edgeRes?.url && !edgeRes.url.includes('api.nfse.io')) {
          const urlRes = await fetch(edgeRes.url);
          if (urlRes.ok) {
            rawBuffer = await urlRes.arrayBuffer();
          }
        }
      } catch (edgeErr) {
        console.warn('[FiscalService] Fallback Edge Function falhou:', edgeErr);
      }
    }

    if (!rawBuffer || rawBuffer.byteLength === 0) {
      console.warn('[FiscalService] Buffer de arquivo vazio.');
      return null;
    }

    const blob = new Blob([rawBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const shortId = cleanInvoiceId.slice(0, 8);
    const filename = format === 'pdf' ? `NFCe_${shortId}.pdf` : `CupomFiscal_${shortId}.xml`;

    return { blobUrl, filename, directUrl: (rawBuffer as any).directUrl || null };
  } catch (e) {
    console.error('[FiscalService] Erro fatal ao obter documento:', e);
    return null;
  }
}

/**
 * Abre o PDF fiscal em uma janela dedicada e dispara o diálogo de impressão automaticamente.
 */
export function triggerPrintAndDownload(blobUrl: string, filename: string, directUrl?: string | null) {
  try {
    const targetUrl = directUrl || blobUrl;
    
    // Tenta abrir pelo Tauri nativo se disponivel
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri) {
      tauri.invoke('open_url', { url: targetUrl }).catch(() => {});
    }

    // Abre em nova janela/aba do navegador
    const printWin = window.open(targetUrl, '_blank');
    if (printWin) {
      printWin.focus();
    }
  } catch (err) {
    console.error('[FiscalService] Erro ao abrir janela de impressão:', err);
    window.open(blobUrl, '_blank');
  }
}
