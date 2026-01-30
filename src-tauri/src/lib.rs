use std::sync::Mutex;

pub mod archive;
mod commands;
pub mod db;
pub mod models;
pub mod providers;

pub mod cli;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ensure directories exist
    archive::ensure_dirs().expect("Failed to create archive directories");

    // Open database
    let db = db::Database::open(&archive::db_path()).expect("Failed to open database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            commands::generate_image,
            commands::list_generations,
            commands::search_generations,
            commands::get_generation,
            commands::toggle_starred,
            commands::trash_generation,
            commands::restore_generation,
            commands::permanently_delete_generation,
            commands::update_prompt,
            commands::update_title,
            commands::add_tags,
            commands::remove_tag,
            commands::list_tags,
            commands::list_models,
            commands::get_cost_summary,
            commands::get_image_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
