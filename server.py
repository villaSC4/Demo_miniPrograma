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
DIRECTORIOS_FILE = os.path.join(DATA_DIR, 'directorios.json')
CARPETAS_FILE = os.path.join(DATA_DIR, 'carpetas.json')
SUPERVISIONES_FILE = os.path.join(DATA_DIR, 'supervisiones.json')
PAU_FILE = os.path.join(DATA_DIR, 'pau_correos.json')
AUTH_DB_FILE = os.path.join(DATA_DIR, 'usuarios.db')

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

        # Hash SHA-256 con salt de la contraseña oficial institucional
        salt = "ucvfia2026"
        expected_hash = f"sha256${salt}$" + hashlib.sha256((salt + "DelegadosFIA2026").encode('utf-8')).hexdigest()

        cur.execute("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)", ('coordinacion.fia@ucvvirtual.edu.pe',))
        row = cur.fetchone()
        if not row:
            cur.execute("""
                INSERT INTO usuarios (email, username, password_hash, nombre, rol, escuela, estado)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (
                'coordinacion.fia@ucvvirtual.edu.pe',
                'coordinacion.fia',
                expected_hash,
                'Coordinación Académica FIA',
                'Coordinador',
                'Facultad de Ingeniería y Arquitectura'
            ))
        else:
            cur.execute("""
                UPDATE usuarios SET password_hash = ?, estado = 1 WHERE id = ?
            """, (expected_hash, row[0]))

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
            user_data = {
                "id": row['id'],
                "email": row['email'],
                "username": row['username'],
                "nombre": row['nombre'],
                "rol": row['rol'],
                "escuela": row['escuela']
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

        if parsed_path == '/api/pau':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)

                os.makedirs(DATA_DIR, exist_ok=True)

                # Caso A: Webhook de correo individual entrante
                if isinstance(data, dict):
                    existing = []
                    if os.path.exists(PAU_FILE):
                        try:
                            with open(PAU_FILE, 'r', encoding='utf-8') as f:
                                existing = json.load(f)
                        except Exception:
                            existing = []

                    correo = (data.get('correo') or '').strip()
                    asunto = (data.get('asunto') or 'SIN ASUNTO').strip()

                    # Evitar duplicados exactos
                    for item in existing:
                        if item.get('correo', '').lower() == correo.lower() and item.get('asunto', '').lower() == asunto.lower():
                            return self._send_json(200, {
                                "status": "already_exists",
                                "message": "Este correo ya fue sincronizado previamente",
                                "ticket": item
                            })

                    max_id = max([t.get('id', 0) for t in existing] or [0])
                    now_str = datetime.datetime.now().strftime('%d/%m/%Y %H:%M')

                    new_ticket = {
                        "id": max_id + 1,
                        "fecha_correo": data.get("fecha_correo") or now_str,
                        "remitente": (data.get("remitente") or "ALUMNO / DOCENTE UCV").strip().upper(),
                        "correo": correo,
                        "escuela": data.get("escuela") or "Ingeniería Industrial",
                        "telefono": data.get("telefono") or "",
                        "asunto": asunto,
                        "estado_atencion": "Sin Atención",
                        "visto_coordinacion": "SIN APROBACIÓN",
                        "fecha_respuesta": "-",
                        "observaciones": (data.get("observaciones") or "Sincronizado automáticamente desde Gmail Coordinación").strip()
                    }

                    existing.insert(0, new_ticket)
                    with open(PAU_FILE, 'w', encoding='utf-8') as f:
                        json.dump(existing, f, indent=2, ensure_ascii=False)

                    return self._send_json(200, {
                        "status": "success",
                        "message": "Nuevo correo recibido y sincronizado correctamente en la bandeja",
                        "ticket": new_ticket,
                        "total": len(existing)
                    })

                # Caso B: Lista completa de tickets
                if not isinstance(data, list):
                    return self._send_json(400, {"error": "Se esperaba una lista de solicitudes PAU o un objeto de correo"})

                with open(PAU_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return self._send_json(200, {
                    "status": "success",
                    "count": len(data),
                    "message": f"Registro PAU actualizado ({len(data)} solicitudes)"
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
                    if (email in ["coordinacion.fia@ucvvirtual.edu.pe", "coordinacion.fia"]) and (pwd in ["DelegadosFIA2026", "ucv2026"]):
                        return self._send_json(200, {
                            "success": True,
                            "message": "Credenciales validadas exitosamente.",
                            "email": "coordinacion.fia@ucvvirtual.edu.pe"
                        })
                    return self._send_json(401, {
                        "success": False,
                        "message": "Credenciales incorrectas. Verifique el correo institucional y la contraseña."
                    })

                pwd = data.get("password", "").strip()
                if pwd not in ['DelegadosFIA2026', 'ucv2026']:
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

                email_in = data.get("email", "").strip().lower()
                pass_in = data.get("password", "").strip()

                if email_in != "coordinacion.fia@ucvvirtual.edu.pe" or pass_in != "DelegadosFIA2026":
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

        return self._send_json(404, {"error": "Ruta no encontrada"})

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    init_auth_db()
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
