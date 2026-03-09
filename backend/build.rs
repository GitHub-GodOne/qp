use std::process::Command;

fn main() {
    // 告诉 Cargo 当前端文件变化时重新构建
    println!("cargo:rerun-if-changed=frontend/src");
    println!("cargo:rerun-if-changed=frontend/package.json");
    println!("cargo:rerun-if-changed=frontend/rsbuild.config.ts");

    // 检查 frontend/dist 目录是否存在
    let dist_path = std::path::Path::new("frontend/dist");
    if !dist_path.exists() {
        eprintln!("Warning: frontend/dist directory not found.");
        eprintln!("Please build the frontend first:");
        eprintln!("  cd frontend && npm install && npm run build");
        eprintln!();
        eprintln!("Attempting to build frontend automatically...");

        // 尝试自动构建前端
        let status = Command::new("sh")
            .arg("-c")
            .arg("cd frontend && npm install && npm run build")
            .status();

        match status {
            Ok(status) if status.success() => {
                println!("Frontend built successfully!");
            }
            Ok(status) => {
                eprintln!("Frontend build failed with status: {status}");
                std::process::exit(1);
            }
            Err(e) => {
                eprintln!("Failed to execute frontend build: {e}");
                eprintln!("Please build the frontend manually:");
                eprintln!("  cd frontend && npm install && npm run build");
                std::process::exit(1);
            }
        }
    }
}
