import 'dotenv/config';
import express from 'express';
import path from 'path';
import https from 'https';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Helper para enviar requisição SOAP com mTLS PFX
const sendSefazSoap = (url, soap, pfxBuffer, passphrase) => {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'POST',
        pfx: pfxBuffer,
        passphrase,
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(soap)
        }
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ statusCode: response.statusCode, body }));
      }
    );
    request.on('error', (err) => reject(err));
    request.write(soap);
    request.end();
  });
};

// Monta o SOAP assinado de Manifestação do Destinatário (210210 - Ciencia da Operacao)
const buildManifestacaoSoap = async (chNFe) => {
  const keyPemPath = path.join(__dirname, 'certs', 'fishhouse-key.pem');
  const certB64Path = path.join(__dirname, 'certs', 'fishhouse-cert.b64');
  const privateKeyPem = await fsPromises.readFile(keyPemPath, 'utf8');
  const certBase64 = (await fsPromises.readFile(certB64Path, 'utf8')).trim();

  const cnpj = '63265618000101';
  const tpEvento = '210210';
  const descEvento = 'Ciencia da Operacao';
  const eventId = `ID${tpEvento}${chNFe}01`;
  const now = new Date(Date.now() - 3 * 3600 * 1000);
  const dhEvento = now.toISOString().slice(0, 19) + '-03:00';

  const infEventoXml = `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${eventId}"><cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chNFe}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${tpEvento}</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>${descEvento}</descEvento></detEvento></infEvento>`;
  const digestValue = crypto.createHash('sha1').update(infEventoXml, 'utf8').digest('base64');

  const signedInfoXml = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${eventId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  const signer = crypto.createSign('RSA-SHA1');
  signer.update(signedInfoXml, 'utf8');
  const signatureValue = signer.sign(privateKeyPem, 'base64');

  const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${eventId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo><SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;
  const infEventoNoNs = infEventoXml.replace(' xmlns="http://www.portalfiscal.inf.br/nfe"', '');

  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote><evento versao="1.00">${infEventoNoNs}${signatureXml}</evento></envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
};

// Endpoint oficial SEFAZ Distribuição DF-e via mTLS com Certificado Digital A1
const handleSefazDfe = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawKey = (req.body && req.body.accessKey) || req.query.accessKey || '';
    const cleanKey = String(rawKey).replace(/\D/g, '').trim();
    if (cleanKey.length !== 44) {
      return res.status(400).json({
        success: false,
        error: `A chave de acesso deve possuir 44 dígitos (informado: ${cleanKey.length}).`
      });
    }

    let pfxBuffer;
    let passphrase = (req.body && req.body.pfxPassword) || '12345';

    if (req.body && req.body.pfxBase64 && String(req.body.pfxBase64).trim().length > 0) {
      pfxBuffer = Buffer.from(String(req.body.pfxBase64).trim(), 'base64');
    } else {
      const defaultPfxPath = path.join(__dirname, 'certs', 'fishhouse.pfx');
      pfxBuffer = await fsPromises.readFile(defaultPfxPath);
      passphrase = '12345';
    }

    const distSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUFAutor>42</cUFAutor>
          <CNPJ>63265618000101</CNPJ>
          <consChNFe>
            <chNFe>${cleanKey}</chNFe>
          </consChNFe>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    const distUrl = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
    const sefazResponse = await sendSefazSoap(distUrl, distSoap, pfxBuffer, passphrase);
    const bodyText = sefazResponse.body || '';
    const docZipMatch = bodyText.match(/<docZip[^>]*>([A-Za-z0-9+/=]+)<\/docZip>/);

    if (docZipMatch && docZipMatch[1]) {
      const xml = zlib.gunzipSync(Buffer.from(docZipMatch[1], 'base64')).toString('utf8');
      if (xml.includes('<infNFe')) {
        return res.json({ success: true, xml });
      }
    }

    // Se retornou apenas <resNFe> ou ainda não liberou o XML completo, realiza automaticamente a Manifestação do Destinatário (Ciência da Operação - 210210)
    try {
      const manifestSoap = await buildManifestacaoSoap(cleanKey);
      await sendSefazSoap('https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx', manifestSoap, pfxBuffer, passphrase);

      // Reconsulta o XML completo imediatamente após a manifestação
      const retryResponse = await sendSefazSoap(distUrl, distSoap, pfxBuffer, passphrase);
      const retryBody = retryResponse.body || '';
      const retryZipMatch = retryBody.match(/<docZip[^>]*>([A-Za-z0-9+/=]+)<\/docZip>/);
      if (retryZipMatch && retryZipMatch[1]) {
        const retryXml = zlib.gunzipSync(Buffer.from(retryZipMatch[1], 'base64')).toString('utf8');
        if (retryXml.includes('<infNFe')) {
          return res.json({ success: true, xml: retryXml });
        }
      }
    } catch (manifErr) {
      console.warn('[SEFAZ Manifestação Automática]:', manifErr.message);
    }

    if (docZipMatch && docZipMatch[1]) {
      return res.json({
        success: false,
        error: 'A Manifestação da Nota foi registrada na SEFAZ. Aguarde alguns instantes e clique novamente em Buscar e Importar para baixar os itens.'
      });
    }

    const motivoMatch = bodyText.match(/<xMotivo>([^<]+)<\/xMotivo>/);
    if (motivoMatch && motivoMatch[1]) {
      return res.json({
        success: false,
        error: `SEFAZ: ${motivoMatch[1]}`
      });
    }

    return res.json({
      success: false,
      error: 'A SEFAZ não retornou o XML para esta chave de acesso.'
    });
  } catch (error) {
    console.error('[SEFAZ DFe Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao consultar SEFAZ: ' + (error.message || String(error))
    });
  }
};

app.options('/api/sefaz-dfe', handleSefazDfe);
app.post('/api/sefaz-dfe', handleSefazDfe);
app.get('/api/sefaz-dfe', handleSefazDfe);

// Servir imagens já cacheadas em disco com maxAge de 1 ano
app.use('/storage', express.static(path.join(__dirname, 'storage_cache'), {
  maxAge: '31536000',
  immutable: true
}));

// Servir arquivos estáticos da pasta dist (gerada pelo build do Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// Rota de proxy para download e cache on-demand de imagens do Supabase Storage
app.get('/storage/*', async (req, res) => {
  try {
    const relativePath = req.params[0] || req.path.substring(9);
    if (!relativePath) {
      return res.status(400).send('Missing file path');
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return res.status(500).send('Supabase URL not configured on server');
    }

    const remoteUrl = `${supabaseUrl}/storage/v1/object/public/${relativePath}`;
    const cacheDir = path.join(__dirname, 'storage_cache');
    const localFilePath = path.join(cacheDir, relativePath);

    // Verifica novamente se o arquivo existe (segurança redundante)
    try {
      await fsPromises.access(localFilePath);
      return res.sendFile(localFilePath);
    } catch {
      // Arquivo não cacheado, segue para o download
    }

    const response = await fetch(remoteUrl);
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch from storage: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Salva no cache local em disco de forma assíncrona
    try {
      await fsPromises.mkdir(path.dirname(localFilePath), { recursive: true });
      await fsPromises.writeFile(localFilePath, buffer);
    } catch (writeErr) {
      console.error('Failed to write image to disk cache:', writeErr);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  } catch (error) {
    console.error('Storage proxy error:', error);
    return res.status(500).send('Internal server error in storage proxy');
  }
});

// Fallback de rotas para Single Page Application (SPA)
// Redireciona todas as requisições que não sejam de arquivos para o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production server running on port ${PORT}`);
});
