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
import sqlite3
import hashlib
import hmac
import datetime
import re

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
GRUPOS_FILE = os.path.join(DATA_DIR, 'grupos.json')
BASE_FILE = os.path.join(DATA_DIR, 'grupos_base.json')

DOCENTES_FILE = os.path.join(DATA_DIR, 'docentes.json')
DELEGADOS_FILE = os.path.join(DATA_DIR, 'delegados.json')
DIRECTORIOS_FILE = os.path.join(DATA_DIR, 'directorios.json')
CARPETAS_FILE = os.path.join(DATA_DIR, 'carpetas.json')
SUPERVISIONES_FILE = os.path.join(DATA_DIR, 'supervisiones.json')
PAU_FILE = os.path.join(DATA_DIR, 'pau_correos.json')
AUTH_DB_FILE = os.path.join(DATA_DIR, 'usuarios.db')
RENDIMIENTO_IND_FILE = os.path.join(DATA_DIR, 'rendimiento_industrial.json')
RENDIMIENTO_IND_BASE = os.path.join(DATA_DIR, 'rendimiento_industrial_base.json')

def ensure_data_files():
    """Asegura que los archivos JSON de datos existan a partir de sus plantillas base."""
    data_mappings = [
        ('grupos.json', 'grupos_base.json'),
        ('docentes.json', 'docentes_base.json'),
        ('directorios.json', 'directorios_base.json'),
        ('carpetas.json', 'carpetas_base.json'),
        ('supervisiones.json', 'supervisiones_base.json'),
        ('delegados.json', 'delegados_base.json'),
        ('rendimiento_industrial.json', 'rendimiento_industrial_base.json')
    ]
    for target, base in data_mappings:
        target_path = os.path.join(DATA_DIR, target)
        base_path = os.path.join(DATA_DIR, base)
        if not os.path.exists(target_path) and os.path.exists(base_path):
            try:
                shutil.copyfile(base_path, target_path)
                print(f"[DATA] Inicializado {target} desde {base}")
            except Exception as e:
                print(f"[DATA] Error al inicializar {target}: {e}")

def init_auth_db():
    """Inicializa la base de datos SQLite de usuarios si no existe y asegura la cuenta institucional."""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        conn = sqlite3.connect(AUTH_DB_FILE)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                nombre TEXT NOT NULL,
                rol TEXT NOT NULL DEFAULT 'Coordinador',
                escuela TEXT DEFAULT 'Facultad de Ingeniería y Arquitectura',
                estado INTEGER DEFAULT 1,
                ultimo_acceso TEXT,
                fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Hash SHA-256 con salt de las contraseñas oficiales institucionales
        salt = "ucvfia2026"
        expected_hash_fia = f"sha256${salt}$" + hashlib.sha256((salt + "DelegadosFIA2026").encode('utf-8')).hexdigest()
        expected_hash_ind = f"sha256${salt}$" + hashlib.sha256((salt + "DelegadosFIA2727").encode('utf-8')).hexdigest()

        # 1. Cuenta Coordinación General FIA (Acceso a ambas escuelas)
        cur.execute("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)", ('coordinacion.fia@ucvvirtual.edu.pe',))
        row = cur.fetchone()
        if not row:
            cur.execute("""
                INSERT INTO usuarios (email, username, password_hash, nombre, rol, escuela, estado)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (
                'coordinacion.fia@ucvvirtual.edu.pe',
                'coordinacion.fia',
                expected_hash_fia,
                'Coordinación Académica FIA',
                'Coordinador',
                'Facultad de Ingeniería y Arquitectura'
            ))
        else:
            cur.execute("""
                UPDATE usuarios SET password_hash = ?, estado = 1 WHERE id = ?
            """, (expected_hash_fia, row[0]))

        # 2. Cuenta Coordinación Industrial (Exclusiva Industrial, bloqueada para Sistemas)
        cur.execute("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)", ('coordinacion.fia.industrial@ucvvirtual.edu.pe',))
        row_ind = cur.fetchone()
        if not row_ind:
            cur.execute("""
                INSERT INTO usuarios (email, username, password_hash, nombre, rol, escuela, estado)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (
                'coordinacion.fia.industrial@ucvvirtual.edu.pe',
                'coordinacion.fia.industrial',
                expected_hash_ind,
                'Coordinación Académica Industrial',
                'Coordinador Industrial',
                'Escuela de Ingeniería Industrial'
            ))
        else:
            cur.execute("""
                UPDATE usuarios SET password_hash = ?, estado = 1 WHERE id = ?
            """, (expected_hash_ind, row_ind[0]))

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[AUTH BD] Error al inicializar base de datos de usuarios: {e}")

def verify_auth_credentials(user_input, password_input):
    """Valida las credenciales contra la base de datos SQLite."""
    try:
        init_auth_db()
        conn = sqlite3.connect(AUTH_DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM usuarios 
            WHERE (LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)) 
              AND estado = 1 
            LIMIT 1
        """, (user_input, user_input))
        row = cur.fetchone()

        if not row:
            conn.close()
            return None

        stored_hash = row['password_hash']
        is_valid = False

        if stored_hash.startswith("sha256$"):
            parts = stored_hash.split("$")
            if len(parts) == 3:
                salt = parts[1]
                expected = parts[2]
                computed = hashlib.sha256((salt + password_input).encode('utf-8')).hexdigest()
                if hmac.compare_digest(computed, expected):
                    is_valid = True
        elif stored_hash == password_input:
            is_valid = True

        if is_valid:
            is_industrial = (
                str(row['email']).lower() == 'coordinacion.fia.industrial@ucvvirtual.edu.pe' or
                'industrial' in str(row['escuela'] or '').lower() or
                'industrial' in str(row['rol'] or '').lower()
            )
            user_data = {
                "id": row['id'],
                "email": row['email'],
                "username": row['username'],
                "nombre": row['nombre'],
                "rol": row['rol'],
                "escuela": row['escuela'],
                "dac_restriction": "industrial" if is_industrial else None
            }
            now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cur.execute("UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?", (now_str, row['id']))
            conn.commit()
            conn.close()
            return user_data

        conn.close()
        return None
    except Exception as e:
        print(f"[AUTH BD] Error de verificación: {e}")
        return None


import mimetypes
mimetypes.init()
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('font/woff', '.woff')

class AcademicDataHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.js': 'application/javascript',
        '.css': 'text/css'
    })

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

        if parsed_path in ['/formulario_delegados/api_delegados', '/api/delegados']:
            try:
                if os.path.exists(DELEGADOS_FILE):
                    with open(DELEGADOS_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                del_file = os.path.join(BASE_DIR, 'formulario_delegados', 'data', 'delegados.json')
                if os.path.exists(del_file):
                    with open(del_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, [])
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/login':
            return self._send_json(200, {
                "status": "online",
                "service": "UCV Virtual SGA Auth API (Python/SQLite)",
                "database": "data/usuarios.db"
            })

        if parsed_path == '/api/pau':
            try:
                if os.path.exists(PAU_FILE):
                    with open(PAU_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, [])
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path in ['/api/atenciones', '/api/atenciones_dac', '/api/atenciones_dac.php', '/formulario_estudiantes/api_atenciones', '/formulario_estudiantes/api_atenciones.php']:
            try:
                atn_file = os.path.join(DATA_DIR, 'atenciones.json')
                if not os.path.exists(atn_file):
                    atn_file = os.path.join(BASE_DIR, 'formulario_estudiantes', 'data', 'atenciones.json')
                if os.path.exists(atn_file):
                    with open(atn_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, {"success": True, "data": data})
                return self._send_json(200, {"success": True, "data": []})
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path in ['/api/dashboard_optimizacion', '/api/dashboard_optimizacion.php']:
            try:
                dash_file = os.path.join(DATA_DIR, 'dashboard_optimizacion_data.json')
                if os.path.exists(dash_file):
                    with open(dash_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(404, {"error": "Dashboard data not found"})
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path in ['/api/rendimiento_industrial', '/api/rendimiento_industrial.php']:
            try:
                if os.path.exists(RENDIMIENTO_IND_FILE):
                    with open(RENDIMIENTO_IND_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                elif os.path.exists(RENDIMIENTO_IND_BASE):
                    with open(RENDIMIENTO_IND_BASE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(404, {"error": "Rendimiento Industrial data not found"})
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path in ['/formulario_delegados/config_membrete.php', '/formulario_delegados/api_membrete', '/api/delegados/membrete']:
            try:
                cfg_file = os.path.join(BASE_DIR, 'formulario_delegados', 'data', 'config_membrete.json')
                if os.path.exists(cfg_file):
                    with open(cfg_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._send_json(200, data)
                return self._send_json(200, {
                    "titulo_reunion": "REUNIÓN DE DELEGADOS 2026-2",
                    "semestre": "2026-II",
                    "fecha_evento": "24 de Septiembre de 2026",
                    "programa": "SUBE A Distancia",
                    "facultad": "Facultad de Ingeniería y Arquitectura",
                    "subtitulo": "Facultad de Ingeniería y Arquitectura • Programa SUBE",
                    "mensaje_bienvenida": "Estimados(as) delegados(as): Por encargo de la Dirección de Escuela y la Coordinación Académica, les damos la cordial bienvenida a la reunión de delegados del semestre."
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path.startswith('/api/whatsapp'):
            try:
                import urllib.request
                target_url = f"http://127.0.0.1:3001{self.path}"
                req = urllib.request.Request(target_url, headers={'User-Agent': 'MinisistemaProxy/1.0'})
                with urllib.request.urlopen(req, timeout=4) as response:
                    content = response.read()
                    status = response.status
                    content_type = response.headers.get('Content-Type', 'application/json')
                    self.send_response(status)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(content)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(content)
                    return
            except Exception as e:
                return self._send_json(503, {
                    "status": "OFFLINE_NODE",
                    "error": "Microservicio WhatsApp no conectado en puerto 3001. Inicie con `npm run whatsapp`.",
                    "details": str(e)
                })

        return super().do_GET()

    def do_POST(self):
        parsed_path = self.path.split('?')[0]

        if parsed_path == '/api/login':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                payload = json.loads(body) if body else {}
                user_val = str(payload.get('user', '')).strip()
                pass_val = str(payload.get('password', '')).strip()

                if not user_val or not pass_val:
                    return self._send_json(400, {
                        "success": False,
                        "error": "Debe ingresar su usuario institucional y contraseña."
                    })

                user_data = verify_auth_credentials(user_val, pass_val)
                if user_data:
                    return self._send_json(200, {
                        "success": True,
                        "message": "Autenticación exitosa",
                        "user": user_data
                    })
                else:
                    return self._send_json(401, {
                        "success": False,
                        "error": "Credenciales inválidas. Verifique su usuario y contraseña institucional."
                    })
            except Exception as e:
                return self._send_json(500, {
                    "success": False,
                    "error": f"Error interno en autenticación: {str(e)}"
                })

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

        if parsed_path == '/api/delegados':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de delegados"})

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(DELEGADOS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                # También sincronizar con formulario_delegados si existe la carpeta
                form_del_dir = os.path.join(BASE_DIR, 'formulario_delegados', 'data')
                if os.path.exists(form_del_dir):
                    with open(os.path.join(form_del_dir, 'delegados.json'), 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Registro de delegados actualizado ({len(data)} delegados)"
                })
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path in ['/api/rendimiento_industrial', '/api/rendimiento_industrial.php']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                if isinstance(data, dict) and data.get('action') == 'reset':
                    if os.path.exists(RENDIMIENTO_IND_BASE):
                        shutil.copyfile(RENDIMIENTO_IND_BASE, RENDIMIENTO_IND_FILE)
                        with open(RENDIMIENTO_IND_FILE, 'r', encoding='utf-8') as f:
                            restored = json.load(f)
                        return self._send_json(200, {"status": "success", "message": "Datos restablecidos a la versión base oficial", "data": restored})
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(RENDIMIENTO_IND_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                return self._send_json(200, {"status": "success", "message": "Rendimiento Industrial guardado exitosamente"})
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path == '/api/pau':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)

                os.makedirs(DATA_DIR, exist_ok=True)

                # Persistencia manual: Lista completa de tickets
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de solicitudes PAE"})

                with open(PAU_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Registro PAE actualizado ({len(data)} solicitudes)"
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

        if parsed_path in ['/formulario_delegados/config_membrete.php', '/formulario_delegados/api_membrete', '/api/delegados/membrete']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                action = data.get("action", "update")

                if action == "login":
                    email = str(data.get("email", "")).strip().lower()
                    pwd = str(data.get("password", "")).strip()
                    valid_creds = (
                        (email in ["coordinacion.fia@ucvvirtual.edu.pe", "coordinacion.fia"] and pwd in ["DelegadosFIA2026", "ucv2026"]) or
                        (email in ["coordinacion.fia.industrial@ucvvirtual.edu.pe", "coordinacion.fia.industrial"] and pwd in ["DelegadosFIA2727", "ucv2026"])
                    )
                    if valid_creds:
                        return self._send_json(200, {
                            "success": True,
                            "message": "Credenciales validadas exitosamente.",
                            "email": email
                        })
                    return self._send_json(401, {
                        "success": False,
                        "message": "Credenciales incorrectas. Verifique el correo institucional y la contraseña."
                    })

                pwd = data.get("password", "").strip()
                if pwd not in ['DelegadosFIA2026', 'DelegadosFIA2727', 'ucv2026']:
                    return self._send_json(401, {
                        "success": False,
                        "message": "Contraseña de Coordinación incorrecta. No tiene permisos para modificar el membrete."
                    })

                cfg_dir = os.path.join(BASE_DIR, 'formulario_delegados', 'data')
                os.makedirs(cfg_dir, exist_ok=True)
                cfg_file = os.path.join(cfg_dir, 'config_membrete.json')

                if action == "reset":
                    new_config = {
                        "titulo_reunion": "REUNIÓN DE DELEGADOS 2026-2",
                        "semestre": "2026-II",
                        "fecha_evento": "24 de Septiembre de 2026",
                        "programa": "SUBE A Distancia",
                        "facultad": "Facultad de Ingeniería y Arquitectura",
                        "subtitulo": "Facultad de Ingeniería y Arquitectura • Programa SUBE",
                        "mensaje_bienvenida": "Estimados(as) delegados(as): Por encargo de la Dirección de Escuela y la Coordinación Académica, les damos la cordial bienvenida a la reunión de delegados del semestre. Por favor, registren sus datos de filiación y asignatura como evidencia formal de participación y representatividad estudiantil.",
                        "fecha_actualizacion": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                else:
                    new_config = {
                        "titulo_reunion": data.get("titulo_reunion", "REUNIÓN DE DELEGADOS 2026-2").strip(),
                        "semestre": data.get("semestre", "2026-II").strip(),
                        "fecha_evento": data.get("fecha_evento", datetime.datetime.now().strftime("%d/%m/%Y")).strip(),
                        "programa": data.get("programa", "SUBE A Distancia").strip(),
                        "facultad": data.get("facultad", "Facultad de Ingeniería y Arquitectura").strip(),
                        "subtitulo": data.get("subtitulo", "Facultad de Ingeniería y Arquitectura • Programa SUBE").strip(),
                        "mensaje_bienvenida": data.get("mensaje_bienvenida", "").strip(),
                        "fecha_actualizacion": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }

                with open(cfg_file, 'w', encoding='utf-8') as f:
                    json.dump(new_config, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "success": True,
                    "message": "Membrete oficial actualizado correctamente.",
                    "config": new_config
                })
            except Exception as e:
                return self._send_json(500, {"success": False, "error": str(e)})

        if parsed_path in ['/formulario_delegados/submit.php', '/submit.php']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                
                cod = str(data.get("codigo_alumno", "")).strip()
                if not re.match(r'^\d{10}$', cod):
                    return self._send_json(400, {
                        "success": False,
                        "message": "El Código de Estudiante debe contener exactamente 10 dígitos numéricos (ej. 6500018511)."
                    })

                asig = str(data.get("asignatura", "")).strip()
                if not asig or len(asig) < 2:
                    return self._send_json(400, {
                        "success": False,
                        "message": "La Asignatura es obligatoria."
                    })

                sec = str(data.get("seccion", "")).strip()
                if not sec or len(sec) < 1:
                    return self._send_json(400, {
                        "success": False,
                        "message": "La Sección o Grupo de Aula es obligatoria."
                    })

                del_dir = os.path.join(BASE_DIR, 'formulario_delegados', 'data')
                os.makedirs(del_dir, exist_ok=True)
                del_file = os.path.join(del_dir, 'delegados.json')

                items = []
                if os.path.exists(del_file):
                    try:
                        with open(del_file, 'r', encoding='utf-8') as f:
                            items = json.load(f)
                    except Exception:
                        items = []

                fecha_now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                new_entry = {
                    "id": len(items) + 1,
                    "apellidos_nombres": data.get("apellidos_nombres", "").strip(),
                    "codigo_alumno": cod,
                    "correo": data.get("correo", "").strip(),
                    "escuela_profesional": data.get("escuela_profesional", "").strip(),
                    "asignatura": asig,
                    "seccion": sec,
                    "ciclo": data.get("ciclo", "").strip(),
                    "declaracion_aceptada": 1,
                    "ip_registro": self.client_address[0],
                    "fecha_registro": fecha_now
                }
                items.insert(0, new_entry)

                with open(del_file, 'w', encoding='utf-8') as f:
                    json.dump(items, f, indent=2, ensure_ascii=False)

                # Mantener sincronizado en data/delegados.json
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(DELEGADOS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(items, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "success": True,
                    "message": "¡Asistencia registrada con éxito!",
                    "id": new_entry["id"],
                    "engine": "local_dev",
                    "fecha": fecha_now
                })
            except Exception as e:
                return self._send_json(500, {"success": False, "error": str(e)})

        if parsed_path in ['/formulario_delegados/descargar.php', '/descargar.php']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)

                valid_dl = (
                    (email_in == "coordinacion.fia@ucvvirtual.edu.pe" and pass_in == "DelegadosFIA2026") or
                    (email_in == "coordinacion.fia.industrial@ucvvirtual.edu.pe" and pass_in == "DelegadosFIA2727")
                )
                if not valid_dl:
                    return self._send_json(401, {
                        "success": False,
                        "message": "Credenciales incorrectas. Verifique el correo y la contraseña institucional."
                    })

                del_file = os.path.join(BASE_DIR, 'formulario_delegados', 'data', 'delegados.json')
                items = []
                if os.path.exists(del_file):
                    try:
                        with open(del_file, 'r', encoding='utf-8') as f:
                            items = json.load(f)
                    except Exception:
                        items = []

                import csv
                import io

                output = io.StringIO()
                writer = csv.writer(output, delimiter=';')
                now_str = datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                ts_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')

                # sep= para que Excel detecte el separador automaticamente
                output.write('sep=;\r\n')
                output.write('REPORTE DE ASISTENCIA - REUNION DE DELEGADOS 2026-2\r\n')
                output.write('Facultad de Ingenieria y Arquitectura - Universidad Cesar Vallejo\r\n')
                output.write(f'Generado el: {now_str}  |  Total de registros: {len(items)}\r\n')
                output.write('\r\n')
                writer.writerow([
                    'N', 'Apellidos y Nombres', 'Codigo de Alumno', 'Correo',
                    'Escuela Profesional', 'Asignatura', 'Seccion', 'Ciclo',
                    'Declaracion Aceptada', 'IP de Registro', 'Fecha y Hora de Registro'
                ])

                for idx, d in enumerate(items, 1):
                    writer.writerow([
                        idx,
                        d.get('apellidos_nombres', ''),
                        d.get('codigo_alumno', ''),
                        d.get('correo', ''),
                        d.get('escuela_profesional', ''),
                        d.get('asignatura', ''),
                        d.get('seccion', ''),
                        f"Ciclo {d.get('ciclo', '')}",
                        'SI' if d.get('declaracion_aceptada') else 'NO',
                        d.get('ip_registro', ''),
                        d.get('fecha_registro', '')
                    ])

                # Windows-1252: codificacion nativa de Excel en Espanol / Latinoamerica
                # No necesita BOM; Excel la lee directamente sin caracteres corruptos.
                csv_bytes = output.getvalue().encode('windows-1252', errors='replace')
                filename = f"Delegados_Reunion_2026-2_{ts_str}.csv"

                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=windows-1252')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.send_header('Content-Length', str(len(csv_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
                self.end_headers()
                self.wfile.write(csv_bytes)
                return
            except Exception as e:
                return self._send_json(500, {"success": False, "error": str(e)})

        if parsed_path in ['/formulario_estudiantes/submit.php', '/estudiantes/submit.php']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)

                nombres = str(data.get("nombres_completos", "")).strip()
                cod = str(data.get("codigo_alumno", "")).strip()
                carrera = str(data.get("carrera_profesional", "")).strip()
                correo = str(data.get("correo_institucional", "")).strip()
                tipo = str(data.get("tipo_atencion", "Solicitud")).strip()
                dia = str(data.get("dia_atencion", "")).strip()
                horario = str(data.get("horario_atencion", "")).strip()
                motivo = str(data.get("detalle_motivo", "")).strip()

                if not nombres or len(nombres) < 4:
                    return self._send_json(400, {
                        "success": False,
                        "message": "Ingrese sus Nombres y Apellidos completos."
                    })

                if not cod:
                    return self._send_json(400, {
                        "success": False,
                        "message": "El Código de Alumno es obligatorio."
                    })

                atn_dir = os.path.join(BASE_DIR, 'formulario_estudiantes', 'data')
                os.makedirs(atn_dir, exist_ok=True)
                atn_file = os.path.join(atn_dir, 'atenciones.json')

                items = []
                if os.path.exists(atn_file):
                    try:
                        with open(atn_file, 'r', encoding='utf-8') as f:
                            items = json.load(f)
                    except Exception:
                        items = []

                # Validación de turno ocupado (evitar doble reserva del mismo horario)
                def get_slot_range(s):
                    s = str(s or '').lower()
                    if '7:00' in s and '7:30' in s: return (19.0, 19.5)
                    if '7:30' in s and '8:00' in s: return (19.5, 20.0)
                    if '8:00' in s and '8:30' in s: return (20.0, 20.5)
                    if '8:30' in s and '9:00' in s: return (20.5, 21.0)
                    if '7:00' in s and '8:00' in s: return (19.0, 20.0)
                    if '8:00' in s and '9:00' in s: return (20.0, 21.0)
                    return None

                target_rng = get_slot_range(horario)
                for it in items:
                    if it.get('estado') != 'Cancelado' and it.get('dia_atencion') == dia:
                        exist_rng = get_slot_range(it.get('horario_atencion'))
                        if it.get('horario_atencion') == horario or (target_rng and exist_rng and max(target_rng[0], exist_rng[0]) < min(target_rng[1], exist_rng[1])):
                            return self._send_json(409, {
                                "success": False,
                                "message": f"El turno de {dia} ({horario}) ya fue reservado por otro estudiante. Por favor seleccione otro turno disponible.",
                                "error_code": "HORARIO_OCUPADO"
                            })

                fecha_now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                ticket_code = f"ATN-2026-{1000 + len(items) + 1}"
                new_entry = {
                    "id": len(items) + 1,
                    "codigo_ticket": ticket_code,
                    "nombres_completos": nombres,
                    "codigo_alumno": cod,
                    "carrera_profesional": carrera,
                    "correo_institucional": correo,
                    "tipo_atencion": tipo,
                    "dia_atencion": dia,
                    "horario_atencion": horario,
                    "detalle_motivo": motivo,
                    "estado": "Pendiente",
                    "link_zoom": "",
                    "observaciones_coordinacion": "",
                    "ip_registro": self.client_address[0],
                    "fecha_registro": fecha_now
                }
                items.insert(0, new_entry)

                with open(atn_file, 'w', encoding='utf-8') as f:
                    json.dump(items, f, indent=2, ensure_ascii=False)

                # Mantener sincronizado en data/atenciones.json
                data_atn = os.path.join(DATA_DIR, 'atenciones.json')
                with open(data_atn, 'w', encoding='utf-8') as f:
                    json.dump(items, f, indent=2, ensure_ascii=False)

                # Sincronizar en data/pau_correos.json (Bandeja PAE del DAC)
                try:
                    pau_items = []
                    if os.path.exists(PAU_FILE):
                        with open(PAU_FILE, 'r', encoding='utf-8') as f:
                            pau_items = json.load(f)
                    pau_entry = {
                        "id": int(datetime.datetime.now().timestamp()),
                        "fecha": datetime.datetime.now().strftime('%d/%m/%Y %H:%M'),
                        "remitente": nombres,
                        "correo": correo,
                        "escuela": carrera,
                        "asunto": f"[{tipo}] Atención Reservada: {dia} ({horario}) - Cód. {cod}",
                        "estado_atencion": "Sin Atención",
                        "visto_coordinacion": "SIN APROBACIÓN",
                        "fecha_respuesta": "-",
                        "tipo": tipo,
                        "codigo_ticket": ticket_code,
                        "codigo_alumno": cod,
                        "dia_atencion": dia,
                        "horario_atencion": horario,
                        "detalle_motivo": motivo,
                        "link_zoom": ""
                    }
                    pau_items.insert(0, pau_entry)
                    with open(PAU_FILE, 'w', encoding='utf-8') as f:
                        json.dump(pau_items, f, indent=2, ensure_ascii=False)
                except Exception:
                    pass

                return self._send_json(200, {
                    "success": True,
                    "message": "¡Reserva de atención registrada en la plataforma PAE del DAC!",
                    "id": new_entry["id"],
                    "codigo_ticket": ticket_code,
                    "engine": "local_dev",
                    "fecha": fecha_now
                })
            except Exception as e:
                return self._send_json(500, {"success": False, "error": str(e)})

        if parsed_path in ['/api/atenciones_dac', '/api/atenciones_dac.php']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)
                action = data.get("action", "update_status")
                target_id = data.get("id")
                ticket_code = data.get("codigo_ticket", "")

                atn_file = os.path.join(DATA_DIR, 'atenciones.json')
                if not os.path.exists(atn_file):
                    atn_file = os.path.join(BASE_DIR, 'formulario_estudiantes', 'data', 'atenciones.json')

                items = []
                if os.path.exists(atn_file):
                    with open(atn_file, 'r', encoding='utf-8') as f:
                        items = json.load(f)

                if action in ['update_status', 'assign_zoom']:
                    nuevo_estado = data.get("estado")
                    zoom_link = data.get("link_zoom")
                    obs = data.get("observaciones_coordinacion")

                    for item in items:
                        if item.get("id") == target_id or item.get("codigo_ticket") == ticket_code:
                            if nuevo_estado is not None: item["estado"] = nuevo_estado
                            if zoom_link is not None: item["link_zoom"] = zoom_link
                            if obs is not None: item["observaciones_coordinacion"] = obs
                            break

                    with open(atn_file, 'w', encoding='utf-8') as f:
                        json.dump(items, f, indent=2, ensure_ascii=False)

                    f2 = os.path.join(BASE_DIR, 'formulario_estudiantes', 'data', 'atenciones.json')
                    if f2 != atn_file:
                        os.makedirs(os.path.dirname(f2), exist_ok=True)
                        with open(f2, 'w', encoding='utf-8') as f:
                            json.dump(items, f, indent=2, ensure_ascii=False)

                    return self._send_json(200, {"success": True, "message": "Atención actualizada exitosamente"})

                if action == 'delete':
                    items = [it for it in items if it.get("id") != target_id and it.get("codigo_ticket") != ticket_code]
                    with open(atn_file, 'w', encoding='utf-8') as f:
                        json.dump(items, f, indent=2, ensure_ascii=False)
                    return self._send_json(200, {"success": True, "message": "Atención eliminada"})

                return self._send_json(400, {"error": "Acción no reconocida"})
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if parsed_path in ['/formulario_estudiantes/descargar.php', '/estudiantes/descargar.php']:
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)

                email_in = data.get("email", "").strip().lower()
                pass_in = data.get("password", "").strip()

                if email_in != "coordinacion.fia@ucvvirtual.edu.pe" or pass_in != "AtencionesFIA2026":
                    return self._send_json(401, {
                        "success": False,
                        "message": "Credenciales incorrectas de Coordinación."
                    })

                atn_file = os.path.join(BASE_DIR, 'formulario_estudiantes', 'data', 'atenciones.json')
                items = []
                if os.path.exists(atn_file):
                    try:
                        with open(atn_file, 'r', encoding='utf-8') as f:
                            items = json.load(f)
                    except Exception:
                        items = []

                import csv
                import io

                output = io.StringIO()
                writer = csv.writer(output, delimiter=';')
                now_str = datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                ts_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')

                output.write('sep=;\r\n')
                output.write('REPORTE OFICIAL DE RESERVAS DE ATENCION ESTUDIANTIL 2026-2\r\n')
                output.write('Facultad de Ingenieria y Arquitectura - Universidad Cesar Vallejo\r\n')
                output.write(f'Generado el: {now_str}  |  Total de atenciones: {len(items)}\r\n\r\n')
                writer.writerow([
                    'N', 'Codigo Ticket', 'Estudiante', 'Codigo Alumno', 'Carrera Profesional',
                    'Correo Institucional', 'Tipo de Atencion', 'Dia de Atencion', 'Horario',
                    'Estado', 'Detalle Motivo', 'Fecha de Registro'
                ])

                for idx, d in enumerate(items, 1):
                    writer.writerow([
                        idx,
                        d.get('codigo_ticket', ''),
                        d.get('nombres_completos', ''),
                        d.get('codigo_alumno', ''),
                        d.get('carrera_profesional', ''),
                        d.get('correo_institucional', ''),
                        d.get('tipo_atencion', ''),
                        d.get('dia_atencion', ''),
                        d.get('horario_atencion', ''),
                        d.get('estado', 'Pendiente'),
                        d.get('detalle_motivo', ''),
                        d.get('fecha_registro', '')
                    ])

                csv_bytes = output.getvalue().encode('windows-1252', errors='replace')
                filename = f"Atenciones_Estudiantes_2026-2_{ts_str}.csv"

                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=windows-1252')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.send_header('Content-Length', str(len(csv_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
                self.end_headers()
                self.wfile.write(csv_bytes)
                return
            except Exception as e:
                return self._send_json(500, {"success": False, "error": str(e)})

        if parsed_path.startswith('/api/whatsapp'):
            try:
                import urllib.request
                target_url = f"http://127.0.0.1:3001{self.path}"
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else None
                headers = {'User-Agent': 'MinisistemaProxy/1.0'}
                if self.headers.get('Content-Type'):
                    headers['Content-Type'] = self.headers.get('Content-Type')

                req = urllib.request.Request(target_url, data=body, headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=15) as response:
                    content = response.read()
                    status = response.status
                    content_type = response.headers.get('Content-Type', 'application/json')
                    self.send_response(status)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(content)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(content)
                    return
            except Exception as e:
                return self._send_json(503, {
                    "status": "OFFLINE_NODE",
                    "error": "Microservicio WhatsApp no conectado en puerto 3001.",
                    "details": str(e)
                })

        return self._send_json(404, {"error": "Ruta no encontrada"})

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    init_auth_db()
    ensure_data_files()
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
