use tauri::Manager;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::sync::Arc;
use tokio::sync::Mutex;

struct BackendPort(Mutex<u16>);

#[tauri::command]
async fn get_backend_port(state: tauri::State<'_, Arc<BackendPort>>) -> Result<u16, String> {
    let port = state.0.lock().await;
    Ok(*port)
}

#[tauri::command]
async fn ping_backend(state: tauri::State<'_, Arc<BackendPort>>) -> Result<String, String> {
    let port = *state.0.lock().await;
    if port == 0 {
        return Err("Backend not ready".to_string());
    }
    let client = reqwest::Client::new();
    let res = client
        .get(format!("http://127.0.0.1:{}/ping", port))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let port_state = Arc::new(BackendPort(Mutex::new(0)));

  tauri::Builder::default()
    .manage(port_state.clone())
    .setup(move |app| {
      app.handle().plugin(tauri_plugin_dialog::init())?;
      app.handle().plugin(tauri_plugin_fs::init())?;

      // Explicitly set the window icon
      let main_window = app.get_webview_window("main").unwrap();
      let icon_bytes = include_bytes!("../icons/32x32.png");
      if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
          let _ = main_window.set_icon(icon);
      }

      #[cfg(debug_assertions)]
      {
        let _ = app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        );
      }

      tauri::async_runtime::spawn(async move {
          let current_dir = std::env::current_dir().unwrap_or_default();
          let project_root = current_dir.parent().unwrap_or(&current_dir);
          
          let python_path = project_root.join("backend/venv/bin/python");
          let main_path = project_root.join("backend/main.py");
          let pythonpath = project_root;

          let mut cmd = Command::new(python_path);
          cmd.arg(main_path);
          cmd.env("PYTHONPATH", pythonpath);
          
          cmd.stdout(std::process::Stdio::piped());
          cmd.stderr(std::process::Stdio::piped());

          match cmd.spawn() {
              Ok(mut child) => {
                  let stdout = child.stdout.take().unwrap();
                  let stderr = child.stderr.take().unwrap();
                  
                  let port_state_clone = port_state.clone();
                  
                  // Read stdout
                  tauri::async_runtime::spawn(async move {
                      let mut reader = BufReader::new(stdout).lines();
                      while let Ok(Some(line)) = reader.next_line().await {
                          println!("Backend STDOUT: {}", line);
                          if line.starts_with("BACKEND_PORT=") {
                              if let Ok(p) = line["BACKEND_PORT=".len()..].parse::<u16>() {
                                  let mut port = port_state_clone.0.lock().await;
                                  *port = p;
                                  println!("Backend port set to: {}", p);
                              }
                          }
                      }
                  });

                  // Read stderr
                  tauri::async_runtime::spawn(async move {
                      let mut reader = BufReader::new(stderr).lines();
                      while let Ok(Some(line)) = reader.next_line().await {
                          eprintln!("Backend STDERR: {}", line);
                      }
                  });

                  let status = child.wait().await;
                  println!("Backend process exited with status: {:?}", status);
              }
              Err(e) => {
                  eprintln!("Failed to spawn backend: {}", e);
              }
          }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![ping_backend, get_backend_port])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
