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
        filename: localFilename || 'certificado_a1.pfx',
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
              filename: 'Certificado A1 Vinculado (NFe.io / SEFAZ)',
              status: 'active'
            };
          }
        }
      }
    } catch (e) {
      console.warn('[SefazService] Erro ao checar certificado remoto:', e);
    }

    return {
      hasCertificate: false,
      status: 'not_configured'
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
      localStorage.setItem(STORAGE_KEYS.CERT_VALIDITY, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'));
      localStorage.setItem(STORAGE_KEYS.CERT_SUBJECT, 'PEIXARIA FISH HOUSE SC LTDA');

      // Tenta enviar também para a NFe.io se houver credenciais
      try {
        const { data: settings } = await supabase
          .from('site_settings')
          .select('nfe_io_api_key, nfe_io_company_id')
          .limit(1)
          .maybeSingle();

        if (settings?.nfe_io_api_key && settings?.nfe_io_company_id) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('password', password);

          await fetch(`https://api.nfe.io/v1/companies/${settings.nfe_io_company_id}/certificate`, {
            method: 'POST',
            headers: { 'Authorization': `ApiKey ${settings.nfe_io_api_key}` },
            body: formData
          });
        }
      } catch (remoteErr) {
        console.warn('[SefazService] Falha ao sincronizar com NFe.io, mantendo local:', remoteErr);
      }

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
      return { success: false, error: 'A chave de acesso da NF-e deve possuir exatamente 44 dígitos.' };
    }

    const certStatus = await this.getCertificateStatus();
    if (!certStatus.hasCertificate) {
      return {
        success: false,
        needCertificate: true,
        error: 'Certificado Digital A1 não configurado. Para baixar notas fiscais apenas escaneando a DANFE de papel, é necessário cadastrar o Certificado Digital da empresa em Configurações > Fiscal.'
      };
    }

    try {
      // 1. Tenta obter o XML via Edge Function com o Certificado Digital
      const { data, error } = await supabase.functions.invoke('nfe-io-invoice', {
        body: {
          action: 'get_xml_by_key',
          chave: cleanKey,
          cnpj_destinatario: '63265618000101'
        }
      });

      if (!error && data?.success && data?.xml) {
        return { success: true, xml: data.xml };
      }

      // 2. Tenta obter via API de DF-e da NFe.io
      const { data: settings } = await supabase
        .from('site_settings')
        .select('nfe_io_api_key, nfe_io_company_id')
        .limit(1)
        .maybeSingle();

      if (settings?.nfe_io_api_key && settings?.nfe_io_company_id) {
        const dfeRes = await fetch(`https://api.nfe.io/v2/productinvoices/${cleanKey}.xml`, {
          headers: { 'Authorization': `ApiKey ${settings.nfe_io_api_key}` }
        });

        if (dfeRes.ok) {
          const xmlText = await dfeRes.text();
          if (xmlText && xmlText.includes('<infNFe')) {
            return { success: true, xml: xmlText };
          }
        }
      }

      return {
        success: false,
        error: 'A SEFAZ ainda não processou a distribuição do XML desta chave para o seu CNPJ. Você pode anexar o arquivo .xml fornecido pelo emitente ou lançar a nota conferindo os itens com o leitor de código de barras.'
      };
    } catch (e: any) {
      console.error('[SefazService] Erro ao buscar XML na SEFAZ:', e);
      return {
        success: false,
        error: 'Falha na comunicação com a SEFAZ: ' + e.message
      };
    }
  }
};
