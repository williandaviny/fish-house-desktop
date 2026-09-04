use std::fs::File;
use std::io::Write;
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
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

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
        let current_exe_str = current_exe.to_string_lossy().to_string();

        let bat_content = format!(
            "@echo off\r\n\
            timeout /t 2 /nobreak > nul\r\n\
            start /wait \"\" \"{installer}\" /S\r\n\
            start \"\" \"{app}\"\r\n\
            (goto) 2>nul & del \"%~f0\"\r\n",
            installer = installer_str,
            app = current_exe_str
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
            download_and_install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
