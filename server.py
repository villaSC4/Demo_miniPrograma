"""
=============================================================================
SERVER.PY - Servidor Local de Persistencia Física para Minisistema Académico
=============================================================================
"""

import http.server
import socketserver
import json
import os
import shutil

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
GRUPOS_FILE = os.path.join(DATA_DIR, 'grupos.json')
BASE_FILE = os.path.join(DATA_DIR, 'grupos_base.json')

DOCENTES_FILE = os.path.join(DATA_DIR, 'docentes.json')
DIRECTORIOS_FILE = os.path.join(DATA_DIR, 'directorios.json')
CARPETAS_FILE = os.path.join(DATA_DIR, 'carpetas.json')
SUPERVISIONES_FILE = os.path.join(DATA_DIR, 'supervisiones.json')

class AcademicDataHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_json(self, status_code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        parsed_path = self.path.split('?')[0]

        if parsed_path == '/api/grupos':
            try:
                if not os.path.exists(GRUPOS_FILE):
                    if os.path.exists(BASE_FILE):
                        shutil.copyfile(BASE_FILE, GRUPOS_FILE)
                with open(GRUPOS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return self._send_json(200, data)
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/docentes':
            try:
                if os.path.exists(DOCENTES_FILE):
                    with open(DOCENTES_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, [])
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/directorios':
            try:
                if os.path.exists(DIRECTORIOS_FILE):
                    with open(DIRECTORIOS_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, [])
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/carpetas':
            try:
                if os.path.exists(CARPETAS_FILE):
                    with open(CARPETAS_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, [])
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/supervisiones':
            try:
                if os.path.exists(SUPERVISIONES_FILE):
                    with open(SUPERVISIONES_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, [])
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        return super().do_GET()

    def do_POST(self):
        parsed_path = self.path.split('?')[0]

        if parsed_path == '/api/grupos':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de grupos"})

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(GRUPOS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Se guardaron exitosamente {len(data)} grupos en archivo físico"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/docentes':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de docentes"})

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(DOCENTES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Directorio actualizado con {len(data)} docentes"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/directorios':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de directorios"})

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(DIRECTORIOS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Catálogo de directorios guardado ({len(data)} directorios)"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/carpetas':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de carpetas"})

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(CARPETAS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Supervisión de carpetas docentes actualizada ({len(data)} carpetas)"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/supervisiones':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de supervisiones"})

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(SUPERVISIONES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Registro de supervisiones actualizado ({len(data)} evaluaciones)"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/reset':
            try:
                if os.path.exists(BASE_FILE):
                    shutil.copyfile(BASE_FILE, GRUPOS_FILE)
                with open(GRUPOS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": "Datos restablecidos a la versión base oficial (128 grupos)"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        return self._send_json(404, {"error": "Ruta no encontrada"})

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    ports_to_try = [int(os.environ.get('PORT', PORT)), 8000, 8081, 8082, 3000]
    httpd = None
    selected_port = None
    for p in ports_to_try:
        try:
            httpd = ThreadedTCPServer(("0.0.0.0", p), AcademicDataHandler)
            selected_port = p
            break
        except OSError:
            continue

    if not httpd:
        print("Error: No se pudo iniciar el servidor en ningún puerto disponible.")
        exit(1)

    with httpd:
        print(f"Servidor Minisistema corriendo en http://localhost:{selected_port}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")
