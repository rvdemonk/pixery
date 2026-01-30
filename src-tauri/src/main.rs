#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use pixery_lib::cli;

#[derive(Parser)]
#[command(name = "pixery")]
#[command(about = "Unified image generation tool")]
struct Args {
    #[command(subcommand)]
    command: Option<cli::Commands>,
}

fn main() {
    let args = Args::parse();

    match args.command {
        Some(cmd) => {
            // CLI mode
            if let Err(e) = cli::run(cmd) {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
        None => {
            // GUI mode
            pixery_lib::run()
        }
    }
}
