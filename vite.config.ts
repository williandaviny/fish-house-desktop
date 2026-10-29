import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import https from 'https';
import zlib from 'zlib';
import {defineConfig, loadEnv} from 'vite';
import pkg from './package.json';

function sefazDfePlugin() {
  return {
    name: 'sefaz-dfe-middleware',
    configureServer(server: any) {
      server.middlewares.use('/api/sefaz-dfe', (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        let rawBody = '';
        req.on('data', (chunk: any) => { rawBody += chunk; });
        req.on('end', () => {
          try {
            const bodyObj = rawBody ? JSON.parse(rawBody) : {};
            const urlObj = new URL(req.url || '', 'http://localhost');
            const rawKey = bodyObj.accessKey || urlObj.searchParams.get('accessKey') || '';
            const cleanKey = String(rawKey).replace(/\D/g, '').trim();

            if (cleanKey.length !== 44) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'Chave inválida.' }));
            }

            let pfxBuffer: Buffer;
            let passphrase = bodyObj.pfxPassword || '12345';
            if (bodyObj.pfxBase64 && String(bodyObj.pfxBase64).trim()) {
              pfxBuffer = Buffer.from(String(bodyObj.pfxBase64).trim(), 'base64');
            } else {
              pfxBuffer = fs.readFileSync(path.resolve(__dirname, 'certs', 'fishhouse.pfx'));
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

            const sReq = https.request(
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
              (sRes) => {
                let sBody = '';
                sRes.on('data', (c) => { sBody += c; });
                sRes.on('end', () => {
                  res.setHeader('Content-Type', 'application/json');
                  const match = sBody.match(/<docZip[^>]*>([A-Za-z0-9+/=]+)<\/docZip>/);
                  if (match && match[1]) {
                    const xml = zlib.gunzipSync(Buffer.from(match[1], 'base64')).toString('utf8');
                    if (xml.includes('<infNFe')) {
                      return res.end(JSON.stringify({ success: true, xml }));
                    }
                  }
                  const motivo = sBody.match(/<xMotivo>([^<]+)<\/xMotivo>/);
                  return res.end(JSON.stringify({
                    success: false,
                    error: motivo ? `SEFAZ: ${motivo[1]}` : 'A SEFAZ não retornou o XML para esta chave.'
                  }));
                });
              }
            );
            sReq.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });
            sReq.write(soap);
            sReq.end();
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react(), tailwindcss(), sefazDfePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // true quando compilado pelo Tauri CLI (TAURI_ENV_TARGET_TRIPLE é sempre setado)
      '__TAURI_BUILD__': JSON.stringify(!!process.env.TAURI_ENV_TARGET_TRIPLE),
      '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
