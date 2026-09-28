import os
import zipfile
from datetime import datetime

def create_update_zip():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    output_filename = f"cpanel_update_diseno_completo_{timestamp}.zip"

    # Archivos necesarios para corregir el diseño y estilos en cPanel
    files_to_pack = [
        "index.html",
        "css/custom.css",
        "js/sistemas_coordinacion.js",
        "js/app.js",
    ]

    print(f"Generando paquete de actualización: {output_filename}")
    print("Incluye: index.html (cache-busting v3.5 y CDN iconos), css/custom.css (33.5 KB estilos), y scripts JS\n")

    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in files_to_pack:
            if os.path.exists(file_path):
                arcname = file_path.replace("\\", "/")
                zipf.write(file_path, arcname)
                size_kb = os.path.getsize(file_path) / 1024
                print(f" + {arcname} ({size_kb:.1f} KB)")
            else:
                print(f" [!] Archivo no encontrado: {file_path}")

    total_size_kb = os.path.getsize(output_filename) / 1024
    print(f"\n[OK] Paquete generado: {output_filename} ({total_size_kb:.1f} KB)")
    print("\n=== INSTRUCCIONES DE DEPLOY EN CPANEL ===")
    print("1. Entrar a cPanel -> Administrador de Archivos")
    print("2. Navegar a public_html/ (o la carpeta raíz del sistema)")
    print("3. Subir el ZIP y extraerlo")
    print("4. Verificar que index.html fue reemplazado")
    print("5. Refrescar el navegador con Ctrl+F5 para limpiar caché")
    print("=========================================")

if __name__ == "__main__":
    create_update_zip()
