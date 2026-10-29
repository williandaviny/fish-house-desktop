use std::fs::File;
use std::io::{Read, Write};
use std::process::Command;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Sistema operacional não suportado".to_string())
    }
}

#[tauri::command]
async fn download_and_install_update(app: AppHandle, url: String) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join("fishhouse_update_setup.exe");
    let script_path = temp_dir.join("fishhouse_update_relaunch.bat");

    let client = reqwest::Client::builder()
        .user_agent("FishHouse-Desktop-Updater/1.2")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    if !res.status().is_success() {
        return Err(format!("Falha no download da release: HTTP {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    let mut file = File::create(&installer_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percentage = ((downloaded as f64 / total_size as f64) * 100.0) as u32;
            let _ = app.emit("update-progress", percentage);
        }
    }

    let _ = app.emit("update-progress", 100);

    // Executa o instalador da nova versão e encerra o app atual para permitir a substituição
    #[cfg(target_os = "windows")]
    {
        let installer_str = installer_path.to_string_lossy().to_string();

        let bat_content = format!(
            "@echo off\r\n\
            ping 127.0.0.1 -n 3 > nul\r\n\
            taskkill /F /IM \"Fish House Desktop.exe\" > nul 2>&1\r\n\
            start \"\" \"{installer}\"\r\n\
            (goto) 2>nul & del \"%~f0\"\r\n",
            installer = installer_str
        );

        let mut bat_file = File::create(&script_path).map_err(|e| e.to_string())?;
        bat_file.write_all(bat_content.as_bytes()).map_err(|e| e.to_string())?;

        let script_str = script_path.to_string_lossy().to_string();
        Command::new("cmd")
            .args(["/C", &script_str])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;

        std::thread::sleep(std::time::Duration::from_millis(500));
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
async fn fetch_sefaz_xml_by_key(
    access_key: String,
    pfx_base64: Option<String>,
    pfx_password: Option<String>,
) -> Result<String, String> {
    let clean_key: String = access_key.chars().filter(|c| c.is_ascii_digit()).collect();
    if clean_key.len() != 44 {
        return Err("A chave de acesso da NF-e deve possuir exatamente 44 dígitos numéricos.".to_string());
    }

    // 1. Obtém os bytes do certificado PFX e a senha
    let (pfx_bytes, password) = if let Some(b64) = pfx_base64.filter(|s| !s.trim().is_empty()) {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .map_err(|e| format!("Erro ao decodificar base64 do certificado: {}", e))?;
        (bytes, pfx_password.unwrap_or_else(|| "12345".to_string()))
    } else {
        // Tenta buscar o certificado A1 local na máquina do usuário
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let desktop_cert = std::path::Path::new(&user_profile)
            .join("Desktop")
            .join("PEIXARIA FISH HOUSE SC LTDA - 12345.pfx");
        let docs_cert = std::path::Path::new(&user_profile)
            .join("Documents")
            .join("CLIENTES")
            .join("PEIXARIA FISH HOUSE SC LTDA - 12345.pfx");

        let cert_path = if desktop_cert.exists() {
            Some(desktop_cert)
        } else if docs_cert.exists() {
            Some(docs_cert)
        } else {
            None
        };

        if let Some(path) = cert_path {
            let bytes = std::fs::read(&path)
                .map_err(|e| format!("Erro ao ler arquivo de certificado {:?}: {}", path, e))?;
            (bytes, "12345".to_string())
        } else {
            return Err("Certificado Digital A1 (.pfx) não localizado. Configure em Configurações > Fiscal.".to_string());
        }
    };

    // 2. Constrói a identidade PKCS#12 e o cliente HTTP com mTLS
    let identity = reqwest::Identity::from_pkcs12_der(&pfx_bytes, &password)
        .map_err(|e| format!("Falha ao carregar Certificado Digital A1 (senha incorreta?): {}", e))?;

    let client = reqwest::Client::builder()
        .identity(identity)
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Erro ao inicializar cliente SEFAZ: {}", e))?;

    // 3. Monta o envelope SOAP 1.2 com consChNFe da SEFAZ Distribuição DF-e
    let soap_body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUFAutor>42</cUFAutor>
          <CNPJ>63265618000101</CNPJ>
          <consChNFe>
            <chNFe>{key}</chNFe>
          </consChNFe>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>"#,
        key = clean_key
    );

    let res = client
        .post("https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx")
        .header("Content-Type", "application/soap+xml; charset=utf-8")
        .body(soap_body)
        .send()
        .await
        .map_err(|e| format!("Erro ao conectar com a SEFAZ: {}", e))?;

    let res_text = res
        .text()
        .await
        .map_err(|e| format!("Erro ao ler resposta da SEFAZ: {}", e))?;

    // 4. Procura pela tag <docZip> com o XML compactado em GZIP
    if let Some(start_tag) = res_text.find("<docZip") {
        if let Some(content_start_rel) = res_text[start_tag..].find('>') {
            let content_start = start_tag + content_start_rel + 1;
            if let Some(content_end_rel) = res_text[content_start..].find("</docZip>") {
                let b64_str = res_text[content_start..content_start + content_end_rel].trim();

                use base64::Engine;
                let gzipped_bytes = base64::engine::general_purpose::STANDARD
                    .decode(b64_str)
                    .map_err(|e| format!("Erro ao decodificar docZip da SEFAZ: {}", e))?;

                use flate2::read::GzDecoder;
                let mut decoder = GzDecoder::new(&gzipped_bytes[..]);
                let mut xml_string = String::new();
                decoder
                    .read_to_string(&mut xml_string)
                    .map_err(|e| format!("Erro ao descompactar XML da SEFAZ: {}", e))?;

                return Ok(xml_string);
            }
        }
    }

    // Se a SEFAZ retornou rejeição ou motivo:
    if let Some(motivo_start) = res_text.find("<xMotivo>") {
        if let Some(motivo_end) = res_text.find("</xMotivo>") {
            let motivo = &res_text[motivo_start + 9..motivo_end];
            return Err(format!("SEFAZ: {}", motivo));
        }
    }

    Err("A SEFAZ não retornou o XML para esta chave.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_url,
            download_and_install_update,
            fetch_sefaz_xml_by_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
