use std::fs;
use std::path::Path;

fn main() {
    // Sync sprites from root to frontend public folder
    let src_dir = "../sprites";
    let dest_dir = "../frontend/public/sprites";

    if Path::new(src_dir).exists() {
        // Ensure destination exists
        let _ = fs::create_dir_all(dest_dir);

        // Copy all pngs
        if let Ok(entries) = fs::read_dir(src_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("png") {
                    let file_name = path.file_name().unwrap();
                    let dest_path = Path::new(dest_dir).join(file_name);
                    let _ = fs::copy(&path, &dest_path);
                }
            }
        }
    }

    tauri_build::build()
}
