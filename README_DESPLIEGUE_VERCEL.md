# Guía de Despliegue en Vercel - Minisistema Académico Modular

El minisistema está 100% configurado y listo para desplegarse en **Vercel** de manera gratuita y en solo 2 minutos.

---

## Estructura de Despliegue Incluida
* `vercel.json`: Configuración oficial de rutas y clean URLs.
* `api/grupos.js`: Función Serverless que gestiona la API `/api/grupos` (lectura, adición, edición y restablecimiento).
* `package.json`: Configuración del proyecto para detección automática en Vercel.
* `data/grupos.json` y `data/grupos_base.json`: Base de datos inicial con los 128 grupos oficiales.
* Sincronización híbrida: Si el usuario borra la caché o se recicla una instancia, los datos se sincronizan automáticamente entre la API y el almacenamiento local (`localStorage`), con opción de descargar la copia oficial en Excel (.xlsx).

---

## Opción 1: Despliegue Directo con Vercel CLI (La más rápida)

1. Abre tu terminal (PowerShell o CMD) en esta carpeta (`demo minisistema`):
   ```bash
   npx vercel
   ```
2. Inicia sesión con tu cuenta de GitHub o correo si te lo solicita.
3. Responde a las preguntas por defecto presionando **Enter**:
   - `Set up and deploy?` -> `Y`
   - `Which scope?` -> (selecciona tu cuenta)
   - `Link to existing project?` -> `N`
   - `Project name?` -> `minisistema-academico` (o el que gustes)
   - `Directory?` -> `./`
   - `Auto-detected Project Settings?` -> Presiona `Enter`.
4. ¡Listo! Vercel te entregará una URL pública (ejemplo: `https://minisistema-academico.vercel.app`).

Para pasar a producción permanente:
```bash
npx vercel --prod
```

---

## Opción 2: Despliegue Conectando con GitHub (Recomendado para actualizaciones continuas)

1. **Inicializa tu repositorio Git local:**
   ```bash
   git init
   git add .
   git commit -m "Minisistema Académico Modular listo para Vercel"
   ```
2. **Sube el proyecto a tu cuenta de GitHub:**
   - Crea un repositorio en [GitHub.com/new](https://github.com/new) (por ejemplo: `minisistema-academico`).
   - Vincula y sube tu código:
     ```bash
     git remote add origin https://github.com/TU_USUARIO/minisistema-academico.git
     git branch -M main
     git push -u origin main
     ```
3. **Importa en Vercel:**
   - Ingresa a [vercel.com](https://vercel.com) y pulsa **"Add New..." -> "Project"**.
   - Selecciona el repositorio `minisistema-academico`.
   - Vercel detectará automáticamente `vercel.json` y los archivos estáticos.
   - Haz clic en **"Deploy"**.
4. En menos de 30 segundos tu sistema estará en línea y se actualizará automáticamente cada vez que hagas `git push`.

---

## Ejecución Local en tu Computadora (Sin conexión a internet)

Para trabajar localmente en tu computadora:
```bash
python server.py
```
Abre en tu navegador: [http://localhost:8080](http://localhost:8080)
* En local, todos los cambios se guardan físicamente en el archivo `data/grupos.json` en tu disco duro, inmune al borrado de caché.
