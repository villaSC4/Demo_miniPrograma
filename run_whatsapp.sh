#!/bin/bash
# ====================================================================
# CONTROL AUTOMATICO DE WHATSAPP PARA CPANEL (CRON RUNNER)
# ====================================================================
# Este script es ejecutado por las "Tareas Cron" de cPanel cada 1 o 5 min.
# Si el servicio ya está corriendo, termina en silencio de inmediato.
# Si no está corriendo, detecta el Node.js de cPanel y lo levanta 24/7.
# ====================================================================

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR" || exit 1

# 1. Asegurar carpeta de datos
mkdir -p "$PROJECT_DIR/data"
LOG_FILE="$PROJECT_DIR/data/whatsapp_service.log"

# 2. Verificar si el servicio ya está en ejecución (por proceso o puerto 3001)
if pgrep -f "whatsapp_service.js" > /dev/null 2>&1; then
    exit 0
fi

# 3. Detectar el binario de Node.js en las rutas de cPanel (EasyApache 4, CloudLinux o Sistema)
NODE_BIN=""
POSSIBLE_NODES=(
    "/usr/bin/node"
    "/usr/local/bin/node"
    "/opt/cpanel/ea-nodejs22/bin/node"
    "/opt/cpanel/ea-nodejs20/bin/node"
    "/opt/cpanel/ea-nodejs18/bin/node"
    "/opt/cpanel/ea-nodejs16/bin/node"
    "/opt/cpanel/ea-nodejs14/bin/node"
    "/bin/node"
    "$(which node 2>/dev/null)"
)

for p in "${POSSIBLE_NODES[@]}"; do
    if [ -n "$p" ] && [ -x "$p" ]; then
        NODE_BIN="$p"
        break
    fi
done

if [ -z "$NODE_BIN" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] No se encontró el binario de Node.js en las rutas habituales de cPanel." >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] Por favor verifique si EasyApache 4 tiene ea-nodejs instalado o consulte a su proveedor de hosting." >> "$LOG_FILE"
    exit 1
fi

# 4. Lanzar el servicio en segundo plano desacoplado
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CRON] Microservicio WhatsApp no detectado. Levantando con $NODE_BIN..." >> "$LOG_FILE"
nohup "$NODE_BIN" "$PROJECT_DIR/whatsapp_service.js" >> "$LOG_FILE" 2>&1 &

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CRON] Proceso iniciado con PID: $!" >> "$LOG_FILE"
exit 0
