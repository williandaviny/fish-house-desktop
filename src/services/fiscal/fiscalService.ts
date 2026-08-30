import { supabase } from '../../lib/supabase';
import { localDb } from '../local/localDb';

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

    // 1. Obtém as credenciais da NFe.io (do banco local ou Supabase)
    let settings = localDb.getSettings();
    if (!settings?.nfe_io_api_key || !settings?.nfe_io_company_id) {
      const { data } = await supabase
        .from('site_settings')
        .select('nfe_io_api_key, nfe_io_company_id, nfe_io_service_code')
        .limit(1)
        .single();
      if (data) settings = data;
    }

    const apiKey = settings?.nfe_io_api_key;
    const companyId = settings?.nfe_io_company_id;
    const isService = !!settings?.nfe_io_service_code;

    let rawBuffer: ArrayBuffer | null = null;
    let mimeType = format === 'pdf' ? 'application/pdf' : 'application/xml;charset=utf-8;';

    // 2. Tenta obter diretamente da API NFe.io v2 com autenticação
    if (apiKey && companyId) {
      const endpoint = isService ? 'serviceinvoices' : 'consumerinvoices';
      const apiUrl = `https://api.nfse.io/v2/companies/${companyId}/${endpoint}/${invoiceIdOrChave}/${format}`;

      console.log(`[FiscalService] Buscando ${format.toUpperCase()} em: ${apiUrl}`);

      try {
        let nfeRes = await fetch(apiUrl, {
          headers: { 'Authorization': `ApiKey ${apiKey}` }
        });

        if (!nfeRes.ok) {
          const v1Url = `https://nfe.io/v1/companies/${companyId}/${endpoint}/${invoiceIdOrChave}/${format}`;
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
                console.log(`[FiscalService] Baixando do URI assinado: ${metaJson.uri}`);
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
        }
      } catch (directErr) {
        console.warn('[FiscalService] Erro na busca direta NFe.io:', directErr);
      }
    }

    // 3. Fallback: Tenta via Edge Function se a requisição direta falhou
    if (!rawBuffer) {
      try {
        const { data: edgeRes } = await supabase.functions.invoke('nfe-io-invoice', {
          body: {
            action: 'get_file',
            invoice_id: invoiceIdOrChave,
            format,
            referencia_tipo: 'venda',
            referencia_id: saleId || invoiceIdOrChave
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
        console.warn('[FiscalService] Fallback Edge function falhou:', edgeErr);
      }
    }

    if (!rawBuffer || rawBuffer.byteLength === 0) {
      return null;
    }

    const blob = new Blob([rawBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const shortId = invoiceIdOrChave.slice(0, 8);
    const filename = format === 'pdf' ? `NFCe_${shortId}.pdf` : `CupomFiscal_${shortId}.xml`;

    return { blobUrl, filename };
  } catch (e) {
    console.error('[FiscalService] Erro fatal ao obter documento:', e);
    return null;
  }
}

/**
 * Dispara o download do arquivo e abre o diálogo de impressão
 */
export function triggerPrintAndDownload(blobUrl: string, filename: string, autoPrint = true) {
  // 1. Download do arquivo
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 2. Diálogo de impressão térmica/A4 via iframe
  if (autoPrint) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 4000);
      } catch (_) {}
    };
  }
}
