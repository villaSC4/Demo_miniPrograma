import os
import zipfile

def build_packages():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # =========================================================================
    # PAQUETE 1: deploy_1_minisistema_actualizacion.zip
    # Destino: Dominio principal donde está alojado el Minisistema
    # =========================================================================
    p1_name = "deploy_1_minisistema_actualizacion.zip"
    p1_files = [
        "index.html",
        "login.html",
        "selector.html",
        "rendimiento_industrial.html",
        "optimizacion_academica.html",
        "docentes_delegados.html",
        "procedimiento.html",
        "pau_whatsapp.html",
        "js/pau.js",
        "js/rendimiento_industrial.js",
        "js/sistemas_coordinacion.js",
        "api/login.php",
        "api/login.js",
        "api/atenciones_dac.php",
        "api/config_dac.php",
        "api/pau.php",
        "api/pau.js",
        "api/rendimiento_industrial.php",
        "database_usuarios.sql",
        "whatsapp_service.js",
        "data/atenciones.json",
        "data/pau_correos.json",
        "data/rendimiento_industrial.json",
        "data/rendimiento_industrial_base.json",
        ".htaccess",
        "INSTRUCCIONES_ACTUALIZACION_MINISISTEMA.md",
        "README_CPANEL.md"
    ]

    print("Empaquetando Paquete 1: " + p1_name)
    with zipfile.ZipFile(os.path.join(base_dir, p1_name), 'w', zipfile.ZIP_DEFLATED) as z:
        for f in p1_files:
            abs_p = os.path.join(base_dir, f)
            if os.path.exists(abs_p):
                arc = f.replace("\\", "/")
                z.write(abs_p, arc)
                print(f"  + {arc}")
            else:
                print(f"  ! No encontrado: {f}")

    p1_size = os.path.getsize(os.path.join(base_dir, p1_name)) / 1024
    print(f"  -> Total: {p1_size:.1f} KB\n")

    # =========================================================================
    # PAQUETE 2: deploy_2_subdominio_dac_atiende.zip
    # Destino: Subdominio dac-atiende.class-it.edu.pe
    # =========================================================================
    p2_name = "deploy_2_subdominio_dac_atiende.zip"
    form_dir = os.path.join(base_dir, "formulario_estudiantes")

    print("Empaquetando Paquete 2: " + p2_name)
    with zipfile.ZipFile(os.path.join(base_dir, p2_name), 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(form_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                if file.endswith('.zip') or (file.startswith('.') and file != '.htaccess'):
                    continue
                file_p = os.path.join(root, file)
                rel_p = os.path.relpath(file_p, form_dir).replace("\\", "/")
                z.write(file_p, rel_p)
                print(f"  + {rel_p}")

    p2_size = os.path.getsize(os.path.join(base_dir, p2_name)) / 1024
    print(f"  -> Total: {p2_size:.1f} KB\n")

    # Duplicar copias espejo para cpanel_update_minisistema y formulario_estudiantes_cpanel
    import shutil
    shutil.copyfile(os.path.join(base_dir, p1_name), os.path.join(base_dir, "cpanel_update_minisistema.zip"))
    shutil.copyfile(os.path.join(base_dir, p2_name), os.path.join(base_dir, "formulario_estudiantes_cpanel.zip"))
    print("Copias espejo actualizadas: cpanel_update_minisistema.zip y formulario_estudiantes_cpanel.zip")

if __name__ == "__main__":
    build_packages()
