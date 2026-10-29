import 'dotenv/config';
import express from 'express';
import path from 'path';
import https from 'https';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

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

    const soap = `<?xml version="1.0" encoding="utf-8"?>
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

    const sefazResponse = await new Promise((resolve, reject) => {
      const request = https.request(
        'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
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

    const bodyText = sefazResponse.body || '';
    const docZipMatch = bodyText.match(/<docZip[^>]*>([A-Za-z0-9+/=]+)<\/docZip>/);
    if (docZipMatch && docZipMatch[1]) {
      const xml = zlib.gunzipSync(Buffer.from(docZipMatch[1], 'base64')).toString('utf8');
      if (xml.includes('<infNFe')) {
        return res.json({ success: true, xml });
      }
      return res.json({
        success: false,
        error: 'A SEFAZ retornou apenas o resumo da nota (resNFe). A nota ainda aguarda liberação do XML completo pela SEFAZ.'
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
