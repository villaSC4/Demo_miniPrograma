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

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
GRUPOS_FILE = os.path.join(DATA_DIR, 'grupos.json')
BASE_FILE = os.path.join(DATA_DIR, 'grupos_base.json')

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

if __name__ == '__main__':
    with ThreadedTCPServer(("0.0.0.0", PORT), AcademicDataHandler) as httpd:
        print(f"Servidor Minisistema corriendo en http://localhost:{PORT}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")
