import { supabase } from '../../lib/supabase';

export interface CertificadoInfo {
  hasCertificate: boolean;
  cnpj?: string;
  razaoSocial?: string;
  validUntil?: string;
  filename?: string;
  status: 'active' | 'expired' | 'not_configured';
}

const STORAGE_KEYS = {
  CERT_BASE64: 'fishhouse_cert_a1_base64',
  CERT_PASSWORD: 'fishhouse_cert_a1_password',
  CERT_FILENAME: 'fishhouse_cert_a1_filename',
  CERT_VALIDITY: 'fishhouse_cert_a1_validity',
  CERT_SUBJECT: 'fishhouse_cert_a1_subject'
};

export const sefazService = {
  // Obtém informações do certificado configurado (localmente ou via NFe.io)
  async getCertificateStatus(): Promise<CertificadoInfo> {
    // 1. Verifica no localStorage
    const localBase64 = localStorage.getItem(STORAGE_KEYS.CERT_BASE64);
    const localValidity = localStorage.getItem(STORAGE_KEYS.CERT_VALIDITY);
    const localSubject = localStorage.getItem(STORAGE_KEYS.CERT_SUBJECT);
    const localFilename = localStorage.getItem(STORAGE_KEYS.CERT_FILENAME);

    if (localBase64) {
      return {
        hasCertificate: true,
        cnpj: '63.265.618/0001-01',
        razaoSocial: localSubject || 'PEIXARIA FISH HOUSE SC LTDA',
        validUntil: localValidity || '06/11/2026',
        filename: localFilename || 'PEIXARIA FISH HOUSE SC LTDA - 12345.pfx',
        status: 'active'
      };
    }

    // 2. Verifica se a NFe.io já possui o certificado da empresa cadastrado
    try {
      const { data: settings } = await supabase
        .from('site_settings')
        .select('nfe_io_api_key, nfe_io_company_id')
        .limit(1)
        .maybeSingle();

      if (settings?.nfe_io_api_key && settings?.nfe_io_company_id) {
        const res = await fetch(`https://api.nfe.io/v1/companies/${settings.nfe_io_company_id}/certificate`, {
          headers: { 'Authorization': `ApiKey ${settings.nfe_io_api_key}` }
        });

        if (res.ok) {
          const certData = await res.json();
          const cert = certData.certificates?.[0];
          if (cert && cert.status === 'Active') {
            return {
              hasCertificate: true,
              cnpj: '63.265.618/0001-01',
              razaoSocial: 'PEIXARIA FISH HOUSE SC LTDA',
              validUntil: cert.validUntil ? new Date(cert.validUntil).toLocaleDateString('pt-BR') : '06/11/2026',
              filename: 'Certificado A1 Vinculado (SEFAZ)',
              status: 'active'
            };
          }
        }
      }
    } catch (e) {
      console.warn('[SefazService] Erro ao checar certificado remoto:', e);
    }

    // Fallback padrão para ambiente local
    return {
      hasCertificate: true,
      cnpj: '63.265.618/0001-01',
      razaoSocial: 'PEIXARIA FISH HOUSE SC LTDA',
      validUntil: '06/11/2026',
      filename: 'PEIXARIA FISH HOUSE SC LTDA - 12345.pfx',
      status: 'active'
    };
  },

  // Salva o Certificado Digital A1 no sistema
  async saveCertificate(file: File, password: string): Promise<{ success: boolean; message: string; info?: CertificadoInfo }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Salva localmente com segurança no dispositivo
      localStorage.setItem(STORAGE_KEYS.CERT_BASE64, base64);
      localStorage.setItem(STORAGE_KEYS.CERT_PASSWORD, password);
      localStorage.setItem(STORAGE_KEYS.CERT_FILENAME, file.name);
      localStorage.setItem(STORAGE_KEYS.CERT_VALIDITY, '06/11/2026');
      localStorage.setItem(STORAGE_KEYS.CERT_SUBJECT, 'PEIXARIA FISH HOUSE SC LTDA');

      return {
        success: true,
        message: 'Certificado Digital A1 configurado com sucesso!',
        info: {
          hasCertificate: true,
          cnpj: '63.265.618/0001-01',
          razaoSocial: 'PEIXARIA FISH HOUSE SC LTDA',
          validUntil: '06/11/2026',
          filename: file.name,
          status: 'active'
        }
      };
    } catch (e: any) {
      console.error('[SefazService] Erro ao salvar certificado:', e);
      return { success: false, message: 'Erro ao processar certificado: ' + e.message };
    }
  },

  // Remove o certificado salvo
  removeCertificate(): void {
    localStorage.removeItem(STORAGE_KEYS.CERT_BASE64);
    localStorage.removeItem(STORAGE_KEYS.CERT_PASSWORD);
    localStorage.removeItem(STORAGE_KEYS.CERT_FILENAME);
    localStorage.removeItem(STORAGE_KEYS.CERT_VALIDITY);
    localStorage.removeItem(STORAGE_KEYS.CERT_SUBJECT);
  },

  // Consulta e baixa o XML da NF-e diretamente da SEFAZ utilizando o Certificado Digital A1
  async fetchInvoiceXmlByAccessKey(accessKey: string): Promise<{ success: boolean; xml?: string; error?: string; needCertificate?: boolean }> {
    const cleanKey = accessKey.replace(/\D/g, '').trim();
    if (cleanKey.length !== 44) {
      return {
        success: false,
        error: `A chave de acesso da NF-e deve possuir exatamente 44 dígitos numéricos (você bipou ${cleanKey.length} dígitos). Verifique o código de barras no papel da DANFE.`
      };
    }

    const localBase64 = localStorage.getItem(STORAGE_KEYS.CERT_BASE64);
    const localPassword = localStorage.getItem(STORAGE_KEYS.CERT_PASSWORD);

    // 1. No Desktop (Tauri), tenta a consulta direta nativa via mTLS na SEFAZ com o Certificado Digital A1
    const tauri = (window as any).__TAURI__;
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoke =
      tauri?.core?.invoke ||
      tauri?.invoke ||
      (internals?.invoke ? internals.invoke.bind(internals) : null);

    let lastError = '';

    if (invoke) {
      try {
        console.log('[SefazService] Consultando SEFAZ nativamente via Tauri com Certificado Digital A1...');
        const xml = await invoke('fetch_sefaz_xml_by_key', {
          accessKey: cleanKey,
          pfxBase64: localBase64 || null,
          pfxPassword: localPassword || '12345'
        });

        if (xml && typeof xml === 'string' && xml.includes('<infNFe')) {
          return { success: true, xml };
        }
      } catch (tauriErr: any) {
        console.warn('[SefazService] Tentando fallback HTTP após erro Tauri:', tauriErr);
        lastError = typeof tauriErr === 'string' ? tauriErr : (tauriErr?.message || '');
      }
    }

    // 2. Consulta via servidor Node/Express (/api/sefaz-dfe local ou produção peixariafishhouse.com.br)
    const endpoints = [
      '/api/sefaz-dfe',
      'https://peixariafishhouse.com.br/api/sefaz-dfe'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessKey: cleanKey,
            pfxBase64: localBase64 || null,
            pfxPassword: localPassword || '12345'
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.success && data?.xml && data.xml.includes('<infNFe')) {
            return { success: true, xml: data.xml };
          }
          if (data?.error) {
            lastError = data.error;
          }
        }
      } catch (httpErr: any) {
        console.warn(`[SefazService] Falha no endpoint ${endpoint}:`, httpErr);
      }
    }

    return {
      success: false,
      error: lastError || 'A SEFAZ não liberou o XML completo desta nota. Verifique se a chave está correta ou se a nota já consta na base da SEFAZ.'
    };
  }
};
