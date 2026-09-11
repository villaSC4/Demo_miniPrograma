# Guía de Despliegue en cPanel (Hosting Apache / PHP)

Este proyecto está 100% optimizado y listo para ser desplegado en cualquier hosting con **cPanel** en menos de 2 minutos.

---

## 📦 Archivo para subir
Utiliza el archivo generado:
📁 **`cpanel_deploy_minisistema.zip`**

---

## 🚀 Pasos de Instalación en cPanel

### Paso 1: Ingresar a cPanel
1. Inicia sesión en tu panel de control **cPanel**.
2. En la sección **Archivos**, haz clic en **Administrador de archivos** (*File Manager*).

### Paso 2: Ubicar el Directorio de Destino
* **Si es tu dominio principal:** Entra en la carpeta `public_html`.
* **Si es un subdominio o subcarpeta:** Entra en la carpeta correspondiente (por ejemplo: `public_html/sistema/` o `subdominio.tudominio.com`).

> **Tip:** Si la carpeta ya contiene archivos antiguos que no necesitas, puedes borrarlos o moverlos a una carpeta de respaldo.

### Paso 3: Cargar el Archivo ZIP
1. En la barra superior de cPanel, haz clic en el botón **Cargar** (*Upload*).
2. Selecciona o arrastra el archivo **`cpanel_deploy_minisistema.zip`**.
3. Espera a que la barra de progreso llegue al 100% (se pondrá en color verde).
4. Vuelve al Administrador de Archivos.

### Paso 4: Extraer los Archivos
1. Haz clic derecho sobre el archivo `cpanel_deploy_minisistema.zip` que acabas de subir.
2. Selecciona la opción **Extract** (*Extraer*).
3. Confirma la ruta de extracción y pulsa **Extract File(s)**.
4. (Opcional) Puedes eliminar el archivo `.zip` tras la extracción para ahorrar espacio.

### Paso 5: Permisos de Escritura (Persistencia Física)
El sistema guarda físicamente las adiciones y modificaciones en el archivo `data/grupos.json`:
1. Ubica la carpeta `data/` dentro del Administrador de Archivos.
2. Verifica que tenga permisos **`755`** (o `775`). En cPanel esto viene configurado así por defecto, por lo que suele funcionar de inmediato sin tocar nada.

---

## 🌐 Comprobación en el Navegador
Abre en tu navegador la URL donde lo instalaste:
* `https://tudominio.com/` (si lo subiste a `public_html`)
* `https://tudominio.com/sistema/` (si lo subiste en una subcarpeta)

### Verificaciones inmediatas:
* Verás el indicador verde **"Archivo Guardado"** en la barra superior.
* La **Matriz Modular Docente** mostrará las materias separadas de forma independiente por docente (`Set`, `Oct`, `Nov`, `Dic`).
* El botón **"Subir Excel"** permite seleccionar uno o varios archivos simultáneamente con opción de Combinar o Reemplazar.
* Puedes descargar la **Plantilla Excel** oficial con un clic.
