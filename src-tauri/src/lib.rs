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

fn resolve_python_path(backend_dir: &std::path::Path) -> std::path::PathBuf {
    let venv_python = backend_dir.join("venv/bin/python");
    if venv_python.exists() {
        return venv_python;
    }
    
    let venv_python3 = backend_dir.join("venv/bin/python3");
    if venv_python3.exists() {
        return venv_python3;
    }

    #[cfg(target_os = "macos")]
    let candidate_paths = [
        "/usr/bin/python3",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/bin/python3",
    ];

    #[cfg(not(target_os = "macos"))]
    let candidate_paths = [
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
        "/bin/python3",
    ];

    #[cfg(target_os = "macos")]
    if let Ok(required_version) = std::fs::read_to_string(backend_dir.join("runtime-python-macos")) {
        let required_version = required_version.trim();
        for path in &candidate_paths {
            let candidate = std::path::Path::new(path);
            if !candidate.exists() {
                continue;
            }
            let version = std::process::Command::new(candidate)
                .args(["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"])
                .output()
                .ok()
                .filter(|output| output.status.success())
                .and_then(|output| String::from_utf8(output.stdout).ok());
            if version.as_deref().map(str::trim) == Some(required_version) {
                return candidate.to_path_buf();
            }
        }
    }

    for path in &candidate_paths {
        let p = std::path::PathBuf::from(path);
        if p.exists() {
            return p;
        }
    }

    if let Some(home_dir) = std::env::var_os("HOME") {
        let pyenv_path = std::path::Path::new(&home_dir)
            .join(".pyenv/shims/python3");
        if pyenv_path.exists() {
            return pyenv_path;
        }
    }

    std::path::PathBuf::from("python3")
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

      // `cargo tauri dev` runs from target/debug, whereas production bundles
      // the complete backend directory in the app resource directory.
      #[cfg(debug_assertions)]
      let backend_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../backend");

      #[cfg(not(debug_assertions))]
      let backend_dir = {
          let executable = std::env::current_exe()?;
          let executable_dir = executable.parent().ok_or_else(|| {
              std::io::Error::new(std::io::ErrorKind::NotFound, "Application executable has no parent directory")
          })?;
          let executable_backend = executable_dir.join("backend");

          // Tauri's resource_dir resolver can return `unknown path` during
          // macOS setup. Use the stable .app layout instead:
          // Contents/MacOS/k8sune -> Contents/Resources/backend.
          #[cfg(target_os = "macos")]
          let bundled_backend = executable_dir
              .parent()
              .map(|contents| contents.join("Resources/backend"))
              .ok_or_else(|| std::io::Error::new(
                  std::io::ErrorKind::NotFound,
                  "macOS application bundle has no Contents directory",
              ))?;

          #[cfg(not(target_os = "macos"))]
          let bundled_backend = app.path().resource_dir()?.join("backend");

          // The Homebrew formula ships `backend` beside the binary. Native macOS
          // bundles ship it in `Contents/Resources/backend`.
          if executable_backend.join("main.py").is_file() {
              executable_backend
          } else if bundled_backend.join("main.py").is_file() {
              bundled_backend
          } else {
              return Err(std::io::Error::new(
                  std::io::ErrorKind::NotFound,
                  format!(
                      "Backend was not found beside the executable or at {}. Rebuild the application so the backend directory is included in Resources.",
                      bundled_backend.display(),
                  ),
              ).into());
          }
      };

      if !backend_dir.join("main.py").is_file() {
          return Err(std::io::Error::new(
              std::io::ErrorKind::NotFound,
              format!("Backend entrypoint was not found at {}", backend_dir.join("main.py").display()),
          ).into());
      }
      let project_root = backend_dir.parent().unwrap_or(&backend_dir).to_path_buf();

      tauri::async_runtime::spawn(async move {
          let python_path = resolve_python_path(&backend_dir);
          let main_path = backend_dir.join("main.py");
          let pythonpath = project_root.clone();

          let mut cmd = Command::new(python_path);
          cmd.arg(&main_path);
          // Never inherit Finder's or the shell's current directory. Python imports
          // and any relative backend assets must resolve from the bundled resources.
          cmd.current_dir(&project_root);
          cmd.env("PYTHONPATH", pythonpath);
          
          // Augment PATH for the backend subprocess so that it can find kubectl, python, etc.
          let current_path = std::env::var_os("PATH").unwrap_or_default();
          let mut new_paths = vec![];
          
          #[cfg(target_os = "macos")]
          {
              new_paths.push("/opt/homebrew/bin");
              new_paths.push("/usr/local/bin");
          }
          #[cfg(target_os = "linux")]
          {
              new_paths.push("/home/linuxbrew/.linuxbrew/bin");
              new_paths.push("/usr/local/bin");
          }
          
          if !current_path.is_empty() {
              if let Some(path_str) = current_path.to_str() {
                  new_paths.push(path_str);
              }
          }
          
          let augmented_path = new_paths.join(":");
          cmd.env("PATH", augmented_path);
          
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
