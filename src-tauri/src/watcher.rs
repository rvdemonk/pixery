use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebouncedEventKind};
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Starts watching the generations directory for new images.
/// Emits "generation-added" event when new .png files are detected.
pub fn start_watcher(app: AppHandle, generations_dir: &Path) {
    let dir = generations_dir.to_path_buf();

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        // 500ms debounce - coalesces rapid file events
        let mut debouncer = match new_debouncer(Duration::from_millis(500), tx) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Failed to create file watcher: {}", e);
                return;
            }
        };

        // Watch the generations directory recursively (catches new date subdirs)
        if let Err(e) = debouncer.watcher().watch(&dir, RecursiveMode::Recursive) {
            eprintln!("Failed to watch directory {:?}: {}", dir, e);
            return;
        }

        println!("Watching for new generations: {:?}", dir);

        // Process events
        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    // Check if any event is a new .png file (not a thumbnail)
                    let has_new_image = events.iter().any(|event| {
                        if event.kind != DebouncedEventKind::Any {
                            return false;
                        }
                        let path = &event.path;
                        let is_png = path
                            .extension()
                            .map(|ext| ext.eq_ignore_ascii_case("png"))
                            .unwrap_or(false);
                        let is_thumb = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n.contains(".thumb."))
                            .unwrap_or(false);
                        is_png && !is_thumb
                    });

                    if has_new_image {
                        if let Err(e) = app.emit("generation-added", ()) {
                            eprintln!("Failed to emit generation-added event: {}", e);
                        }
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Watch error: {:?}", e);
                }
                Err(e) => {
                    eprintln!("Channel error: {:?}", e);
                    break;
                }
            }
        }
    });
}
