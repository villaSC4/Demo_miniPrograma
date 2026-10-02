import os
import zipfile
from datetime import datetime

def create_cpanel_packages():
    # 1. PAQUETE COMPLETO: minisistema_cpanel_DEPLOY.zip
    full_zip_name = "minisistema_cpanel_DEPLOY.zip"
    
    # 2. PAQUETE LIGERO DE ACTUALIZACION: cpanel_update_minisistema.zip
    update_zip_name = "cpanel_update_minisistema.zip"

    # Extensiones y directorios a omitir en el paquete completo
    EXCLUDE_DIRS = {
        '.git', '.vercel', 'node_modules', '__pycache__', 
        'formulario_delegados', 'Notas', 'notas', 'pdfs'
    }
    EXCLUDE_FILES = {
        full_zip_name, update_zip_name, 'server.py', 'build_cpanel_zip.py',
        'package-lock.json'
    }
    EXCLUDE_EXTENSIONS = {'.zip', '.log'}

    print("==========================================================")
    print("[INFO] GENERANDO PAQUETES DE DESPLIEGUE PARA CPANEL")
    print("==========================================================")

    # ---------------------------------------------------------
    # A. Generar minisistema_cpanel_DEPLOY.zip (Instalacion completa)
    # ---------------------------------------------------------
    print(f"\n[1/2] Empaquetando Instalacion Completa: {full_zip_name}...")
    full_count = 0
    with zipfile.ZipFile(full_zip_name, 'w', zipfile.ZIP_DEFLATED) as zip_full:
        for root, dirs, files in os.walk("."):
            # Filtrar carpetas excluidas
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if file in EXCLUDE_FILES or ext in EXCLUDE_EXTENSIONS:
                    continue
                if ext == '.zip':
                    continue

                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, ".").replace("\\", "/")
                
                # Omitir si pertenece a Notas o formulario_delegados
                if rel_path.startswith("Notas/") or rel_path.startswith("formulario_delegados/"):
                    continue

                zip_full.write(file_path, rel_path)
                full_count += 1

    size_full_mb = os.path.getsize(full_zip_name) / (1024 * 1024)
    print(f" -> {full_zip_name} generado con {full_count} archivos ({size_full_mb:.2f} MB)")

    # ---------------------------------------------------------
    # B. Generar cpanel_update_minisistema.zip (Actualizacion rapida)
    # ---------------------------------------------------------
    update_files = [
        "index.html",
        "selector.html",
        "login.html",
        "procedimiento.html",
        "docentes_delegados.html",
        ".htaccess",
        "css/custom.css",
        "js/app.js",
        "js/sistemas_coordinacion.js",
        "js/pau.js",
        "js/analytics.js",
        "js/data.js",
        "js/parser.js",
        "api/login.php",
        "api/grupos.php",
        "api/pau.php",
        "api/reset.php",
        "api/carpetas.php",
        "api/directorios.php",
        "api/docentes.php",
        "api/delegados.php",
        "api/supervisiones.php",
        "data/delegados.json",
        "data/grupos_base.json"
    ]

    print(f"\n[2/2] Empaquetando Actualizacion Rapida: {update_zip_name}...")
    update_count = 0
    with zipfile.ZipFile(update_zip_name, 'w', zipfile.ZIP_DEFLATED) as zip_update:
        for f in update_files:
            if os.path.exists(f):
                arc = f.replace("\\", "/")
                zip_update.write(f, arc)
                update_count += 1
            else:
                print(f" [!] Archivo no encontrado para update: {f}")

    size_update_kb = os.path.getsize(update_zip_name) / 1024
    print(f" -> {update_zip_name} generado con {update_count} archivos ({size_update_kb:.1f} KB)")

    print("\n==========================================================")
    print("[OK] LISTOS PARA SUBIR A CPANEL")
    print("==========================================================")
    print(f"1. Si es INSTALACION DESDE CERO o deseas renovar todo:")
    print(f"   -> Sube: {full_zip_name}")
    print(f"2. Si ya tienes la carpeta instalada y solo deseas ACTUALIZAR:")
    print(f"   -> Sube: {update_zip_name}")
    print("==========================================================")

if __name__ == "__main__":
    create_cpanel_packages()
