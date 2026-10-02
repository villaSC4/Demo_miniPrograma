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
        "pau_whatsapp.html",
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
        "api/whatsapp.php",
        "api/supervisiones.php",
        "data/delegados.json",
        "data/delegados_base.json",
        "data/grupos_base.json",
        "data/docentes_base.json"
    ]

    print(f"\n[2/3] Empaquetando Actualizacion Rapida: {update_zip_name}...")
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

    # ---------------------------------------------------------
    # C. Generar formulario_delegados_cpanel_DEPLOY.zip (Subdominio)
    # ---------------------------------------------------------
    delegados_zip_name = "formulario_delegados_cpanel_DEPLOY.zip"
    delegados_dir = "formulario_delegados"
    if os.path.exists(delegados_dir):
        print(f"\n[3/3] Empaquetando Portal Asistencia Delegados: {delegados_zip_name}...")
        del_count = 0
        with zipfile.ZipFile(delegados_zip_name, 'w', zipfile.ZIP_DEFLATED) as zip_del:
            for root, dirs, files in os.walk(delegados_dir):
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                for file in files:
                    if file.endswith('.zip') or file.startswith('.'):
                        continue
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, delegados_dir).replace("\\", "/")
                    zip_del.write(file_path, rel_path)
                    del_count += 1

        size_del_kb = os.path.getsize(delegados_zip_name) / 1024
        print(f" -> {delegados_zip_name} generado con {del_count} archivos ({size_del_kb:.1f} KB)")

    print("\n==========================================================")
    print("[OK] PAQUETES LISTOS PARA SUBIR A CPANEL")
    print("==========================================================")
    print(f"1. MINISISTEMA - INSTALACION COMPLETA:")
    print(f"   -> Sube: {full_zip_name} (a public_html/ o subdirectorio)")
    print(f"2. MINISISTEMA - ACTUALIZACION RAPIDA:")
    print(f"   -> Sube: {update_zip_name}")
    print(f"3. PORTAL FORMULARIO DELEGADOS (Subdominio):")
    print(f"   -> Sube: {delegados_zip_name} (a reg-asistencia-1.class-it.edu.pe)")
    print("==========================================================")

if __name__ == "__main__":
    create_cpanel_packages()
