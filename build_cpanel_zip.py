import os
import zipfile

def create_cpanel_zip():
    output_filename = "cpanel_deploy_minisistema.zip"
    
    # Lista de archivos y directorios a incluir en el zip para cPanel
    include_items = [
        ".htaccess",
        "index.html",
        "selector.html",
        "login.html",
        "README_CPANEL.md",
        "api",
        "css",
        "js",
        "img",
        "lib",
        "data",
        "formulario_delegados"
    ]
    
    # Exclusiones específicas
    exclude_exts = {".pyc", ".pyo", ".log"}
    exclude_dirs = {"__pycache__", ".git", ".vercel"}
    exclude_files = {"usuarios.db"} # No empaquetar db con datos locales sensibles
    
    print(f"Empaquetando {output_filename} para cPanel...")
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for item in include_items:
            if not os.path.exists(item):
                print(f"Advertencia: {item} no encontrado.")
                continue
                
            if os.path.isfile(item):
                zipf.write(item, item)
                print(f" + {item}")
            elif os.path.isdir(item):
                for root, dirs, files in os.walk(item):
                    # Filtrar directorios excluidos
                    dirs[:] = [d for d in dirs if d not in exclude_dirs]
                    
                    for f in files:
                        ext = os.path.splitext(f)[1].lower()
                        if ext in exclude_exts or f in exclude_files:
                            continue
                            
                        file_path = os.path.join(root, f)
                        arcname = os.path.relpath(file_path, ".")
                        zipf.write(file_path, arcname)
                        
    file_size = os.path.getsize(output_filename) / (1024 * 1024)
    print(f"\n[OK] ZIP creado exitosamente: {output_filename} ({file_size:.2f} MB)")

if __name__ == "__main__":
    create_cpanel_zip()
