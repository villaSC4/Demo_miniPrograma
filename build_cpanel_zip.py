import os
import zipfile

def create_update_zip():
    output_filename = "cpanel_update_nuevos_cambios.zip"
    
    # Únicamente los archivos modificados y nuevos de esta sesión (SIN formulario_delegados)
    files_to_pack = [
        "index.html",
        "selector.html",
        ".htaccess",
        os.path.join("css", "custom.css"),
        os.path.join("js", "sistemas_coordinacion.js"),
        os.path.join("data", ".htaccess")
    ]
    
    print(f"Generando paquete exclusivo de actualización: {output_filename}")
    print("Excluyendo completamente formulario_delegados y archivos no modificados...\n")
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in files_to_pack:
            if os.path.exists(file_path):
                # Normalizar ruta interna con barras inclinadas estándar para zip
                arcname = file_path.replace("\\", "/")
                zipf.write(file_path, arcname)
                size_kb = os.path.getsize(file_path) / 1024
                print(f" + {arcname} ({size_kb:.1f} KB)")
            else:
                print(f" [!] Archivo no encontrado: {file_path}")
                
    total_size_kb = os.path.getsize(output_filename) / 1024
    print(f"\n[OK] Paquete de actualización generado con éxito: {output_filename} ({total_size_kb:.1f} KB)")

if __name__ == "__main__":
    create_update_zip()
