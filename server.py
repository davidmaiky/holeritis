"""
Servidor Web e API RESTful para o Sistema de Gestão de Holerites e Folha de Pagamento
Inclui Autenticação Segura (PBKDF2-HMAC-SHA256), Sessões Persistentes e Gestão de Usuários (RBAC)
"""

import os
import sys
import json
import io
import cgi
import re
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import database
import auth
import parser
import excel_generator

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", BASE_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class HoleriteRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _send_error(self, status_code, message):
        self._send_json(status_code, {"success": False, "error": message})

    def _read_body_dict(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                return {}
            raw_data = self.rfile.read(content_length).decode("utf-8", errors="replace")
            content_type = self.headers.get("Content-Type", "")
            if "application/x-www-form-urlencoded" in content_type:
                qs = urllib.parse.parse_qs(raw_data)
                return {k: v[0] if len(v) == 1 else v for k, v in qs.items()}
            return json.loads(raw_data) if raw_data else {}
        except Exception:
            return {}

    def _read_json_body(self):
        return self._read_body_dict()

    def _get_auth_token(self):
        # 1. Header Authorization: Bearer <token>
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            if token:
                return token

        # 2. Cookie session_token=<token>
        cookie_header = self.headers.get("Cookie", "")
        if cookie_header:
            for item in cookie_header.split(";"):
                parts = item.strip().split("=", 1)
                if len(parts) == 2 and parts[0] == "session_token":
                    return parts[1]

        return None

    def _get_current_user(self):
        token = self._get_auth_token()
        if not token:
            return None
        conn = database.get_connection()
        try:
            return auth.obter_usuario_por_token(conn, token)
        finally:
            conn.close()

    def _require_auth(self):
        user = self._get_current_user()
        if not user:
            self._send_json(401, {
                "success": False,
                "error": "Acesso não autorizado ou sessão expirada. Por favor, faça login.",
                "auth_required": True
            })
            return None
        return user

    def _require_admin(self):
        user = self._require_auth()
        if not user:
            return None
        if user.get("role") != "admin":
            self._send_json(403, {
                "success": False,
                "error": "Acesso restrito. Apenas administradores possuem permissão para esta funcionalidade."
            })
            return None
        return user

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)

        # 1. Healthcheck para monitoramento / Docker
        if path == "/api/health":
            self._send_json(200, {"status": "ok", "service": "holeritis"})
            return

        # 2. Obter usuário logado atual
        if path == "/api/auth/me":
            user = self._get_current_user()
            if user:
                self._send_json(200, {
                    "success": True,
                    "authenticated": True,
                    "user": user
                })
            else:
                self._send_json(200, {
                    "success": False,
                    "authenticated": False,
                    "user": None
                })
            return

        # 3. Gestão de Usuários (Admin)
        if path == "/api/usuarios":
            if not self._require_admin():
                return
            conn = database.get_connection()
            try:
                usuarios = auth.listar_usuarios(conn)
                self._send_json(200, {"success": True, "usuarios": usuarios})
            except Exception as e:
                self._send_error(500, f"Erro ao listar usuários: {str(e)}")
            finally:
                conn.close()
            return

        match_user = re.match(r"^/api/usuarios/(\d+)$", path)
        if match_user:
            if not self._require_admin():
                return
            user_id = int(match_user.group(1))
            conn = database.get_connection()
            try:
                usuario = auth.obter_usuario_por_id(conn, user_id)
                if not usuario:
                    self._send_error(404, "Usuário não encontrado.")
                else:
                    self._send_json(200, {"success": True, "usuario": usuario})
            except Exception as e:
                self._send_error(500, f"Erro ao buscar usuário: {str(e)}")
            finally:
                conn.close()
            return

        # 4. Rota de Lista de Empresas (Razões Sociais) - Requer Autenticação
        if path == "/api/empresas":
            if not self._require_auth():
                return
            try:
                empresas = database.listar_empresas()
                self._send_json(200, {
                    "success": True,
                    "empresas": empresas
                })
            except Exception as e:
                self._send_error(500, f"Erro ao listar empresas: {str(e)}")
            return

        # 5. Rota de Metadados de Filtros Disponíveis
        if path == "/api/filtros":
            if not self._require_auth():
                return
            try:
                filtros = database.obter_filtros_disponiveis()
                empresas = database.listar_empresas()
                self._send_json(200, {
                    "success": True,
                    "anos": filtros["anos"],
                    "competencias": filtros["competencias"],
                    "empresas": empresas
                })
            except Exception as e:
                self._send_error(500, f"Erro ao obter filtros: {str(e)}")
            return

        # 6. Rota de Evolução Histórica de 12 Meses
        if path == "/api/evolucao-12-meses":
            if not self._require_auth():
                return
            try:
                empresa_filtro = query.get("empresa", [None])[0]
                limite_str = query.get("limite", ["12"])[0]
                limite = int(limite_str) if limite_str and limite_str.isdigit() else 12
                de_filtro = query.get("de", [None])[0]
                ate_filtro = query.get("ate", [None])[0]
                ano_filtro = query.get("ano", [None])[0]

                dados_evolucao = database.obter_evolucao_12_meses(
                    empresa=empresa_filtro,
                    limite=limite,
                    de=de_filtro,
                    ate=ate_filtro,
                    ano=ano_filtro
                )
                self._send_json(200, {
                    "success": True,
                    "evolucao": dados_evolucao
                })
            except Exception as e:
                self._send_error(500, f"Erro ao obter evolução de 12 meses: {str(e)}")
            return

        # 7. Rota de Demonstração (Admin)
        if path == "/api/demo-12-meses":
            if not self._require_admin():
                return
            try:
                empresa_filtro = query.get("empresa", [None])[0]
                criados = database.gerar_folhas_demo_12m(empresa_filtro)
                self._send_json(200, {
                    "success": True,
                    "message": f"{criados} folhas adicionadas para completar o histórico de 12 meses!",
                    "criados": criados
                })
            except Exception as e:
                self._send_error(500, f"Erro ao gerar demo 12 meses: {str(e)}")
            return

        # 8. Rota de Períodos com Filtros
        if path == "/api/periodos":
            if not self._require_auth():
                return
            try:
                empresa_filtro = query.get("empresa", [None])[0]
                de_filtro = query.get("de", [None])[0]
                ate_filtro = query.get("ate", [None])[0]
                ano_filtro = query.get("ano", [None])[0]
                preset_filtro = query.get("preset", [None])[0]

                periodos = database.listar_periodos(
                    empresa=empresa_filtro,
                    de=de_filtro,
                    ate=ate_filtro,
                    ano=ano_filtro,
                    preset=preset_filtro
                )
                stats = database.estatisticas_gerais(
                    empresa=empresa_filtro,
                    de=de_filtro,
                    ate=ate_filtro,
                    ano=ano_filtro
                )
                self._send_json(200, {
                    "success": True,
                    "empresa_filtro": empresa_filtro,
                    "de_filtro": de_filtro,
                    "ate_filtro": ate_filtro,
                    "ano_filtro": ano_filtro,
                    "preset_filtro": preset_filtro,
                    "periodos": periodos,
                    "stats": stats
                })
            except Exception as e:
                self._send_error(500, f"Erro ao listar períodos: {str(e)}")
            return

        # 9. Rota de Detalhes de um Período
        match_periodo = re.match(r"^/api/periodos/(\d+)$", path)
        if match_periodo:
            if not self._require_auth():
                return
            periodo_id = int(match_periodo.group(1))
            try:
                rel = database.obter_relatorio(periodo_id)
                if not rel:
                    self._send_error(404, "Período não encontrado")
                else:
                    self._send_json(200, {"success": True, "relatorio": rel})
            except Exception as e:
                self._send_error(500, f"Erro ao obter período: {str(e)}")
            return

        # Rota de Comparativo de Recibo (OBS / Comparativo com o Recibo Anterior)
        if path == "/api/comparativo-recibo":
            if not self._require_auth():
                return
            periodo_id_str = query.get("periodo_id", [None])[0]
            if not periodo_id_str or not periodo_id_str.isdigit():
                self._send_error(400, "Parâmetro 'periodo_id' é obrigatório.")
                return
            periodo_id = int(periodo_id_str)
            item_id_str = query.get("item_id", [None])[0]
            item_id = int(item_id_str) if item_id_str and item_id_str.isdigit() else None
            codigo = query.get("codigo", [None])[0]
            nome = query.get("nome", [None])[0]

            try:
                comp = database.obter_comparativo_recibo(periodo_id, item_id=item_id, codigo=codigo, nome=nome)
                if not comp:
                    self._send_error(404, "Colaborador ou período não localizado.")
                else:
                    self._send_json(200, {"success": True, "comparativo": comp})
            except Exception as e:
                self._send_error(500, f"Erro ao gerar comparativo de recibo: {str(e)}")
            return


        # 10. Rota de Exportação CSV
        match_csv = re.match(r"^/api/export/csv/(\d+)$", path)
        if match_csv:
            if not self._require_auth():
                return
            periodo_id = int(match_csv.group(1))
            try:
                rel = database.obter_relatorio(periodo_id)
                if not rel:
                    self._send_error(404, "Período não encontrado")
                    return

                import csv
                output = io.StringIO()
                writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
                
                writer.writerow(["Período", "Código", "Nome", "Função", "Salário Base (R$)", "Proventos (R$)", "Adiantamento Anterior (R$)", "Descontos (R$)", "Total Líquido (R$)"])
                
                for item in rel["itens"]:
                    writer.writerow([
                        rel["periodo_texto"],
                        item["codigo"],
                        item["nome"],
                        item["funcao"],
                        f"{item['salario']:.2f}".replace('.', ','),
                        f"{item['proventos']:.2f}".replace('.', ','),
                        f"{item['adiantamento_anterior']:.2f}".replace('.', ','),
                        f"{item['descontos']:.2f}".replace('.', ','),
                        f"{item['liquido']:.2f}".replace('.', ',')
                    ])
                
                writer.writerow([])
                writer.writerow([
                    "TOTAIS",
                    "",
                    f"{len(rel['itens'])} funcionários",
                    "",
                    f"{rel['total_salario']:.2f}".replace('.', ','),
                    f"{rel['total_proventos']:.2f}".replace('.', ','),
                    f"{rel['total_adiantamento']:.2f}".replace('.', ','),
                    f"{rel['total_descontos']:.2f}".replace('.', ','),
                    f"{rel['total_liquido']:.2f}".replace('.', ',')
                ])

                content = "\ufeff" + output.getvalue()
                raw_bytes = content.encode("utf-8")

                safe_empresa = re.sub(r'[^a-zA-Z0-9_\-]', '_', rel.get('empresa', 'empresa'))[:25]
                safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', rel['mes_ano']) or f"periodo_{periodo_id}"
                filename = f"relatorio_folha_{safe_empresa}_{safe_name}.csv"

                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(raw_bytes)))
                self.end_headers()
                self.wfile.write(raw_bytes)
            except Exception as e:
                self._send_error(500, f"Erro ao gerar CSV: {str(e)}")
            return

        # 11. Rota de Exportação Excel (.xlsx)
        match_excel = re.match(r"^/api/export/excel/(\d+)$", path)
        if match_excel:
            if not self._require_auth():
                return
            periodo_id = int(match_excel.group(1))
            try:
                rel = database.obter_relatorio(periodo_id)
                if not rel:
                    self._send_error(404, "Período não encontrado")
                    return

                excel_bytes = excel_generator.gerar_excel_bytes(rel)

                safe_empresa = re.sub(r'[^a-zA-Z0-9_\-]', '_', rel.get('empresa', 'empresa'))[:25]
                safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', rel.get('mes_ano', 'periodo')) or f"periodo_{periodo_id}"
                filename = f"relatorio_completo_folha_{safe_empresa}_{safe_name}.xlsx"

                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(excel_bytes)))
                self.end_headers()
                self.wfile.write(excel_bytes)
            except Exception as e:
                self._send_error(500, f"Erro ao gerar Excel: {str(e)}")
            return

        # Servir index.html na raiz
        if path == "" or path == "/":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        if not path:
            path = "/"
        query = urllib.parse.parse_qs(parsed.query)
        print(f"[HTTP POST] path='{path}'")

        # 1. Login (suporta /api/auth/login, /api/login, /login e submissões nativas em / ou /index.html)
        if path in ("/api/auth/login", "/api/login", "/login") or (path in ("/", "/index.html") and self.headers.get("Content-Type")):
            body = self._read_body_dict()
            username = body.get("username", "")
            password = body.get("senha") or body.get("password", "")

            # Se for submissão vazia em / ou /index.html sem credenciais, apenas redireciona
            if not username and path in ("/", "/index.html"):
                self.send_response(303)
                self.send_header("Location", "/")
                self.end_headers()
                return

            conn = database.get_connection()
            try:
                sucesso, token, user, msg = auth.login(conn, username, password)
                if not sucesso:
                    if "text/html" in self.headers.get("Accept", ""):
                        self.send_response(303)
                        self.send_header("Location", "/?error=login_invalido")
                        self.end_headers()
                        return
                    self._send_json(401, {"success": False, "error": msg})
                    return

                # Se veio de formulário HTML clássico do navegador
                if "text/html" in self.headers.get("Accept", ""):
                    self.send_response(303)
                    self.send_header("Set-Cookie", f"session_token={token}; Path=/; Max-Age=604800; SameSite=Lax")
                    self.send_header("Location", "/")
                    self.end_headers()
                    return

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Set-Cookie", f"session_token={token}; Path=/; Max-Age=604800; SameSite=Lax")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "token": token,
                    "user": user,
                    "message": "Autenticação realizada com sucesso!"
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._send_error(500, f"Erro no processamento do login: {str(e)}")
            finally:
                conn.close()
            return

        # 2. Logout (suporta /api/auth/logout, /api/logout, /logout)
        if path in ("/api/auth/logout", "/api/logout", "/logout"):
            token = self._get_auth_token()
            if token:
                conn = database.get_connection()
                try:
                    auth.logout(conn, token)
                finally:
                    conn.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Set-Cookie", "session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": "Sessão finalizada com sucesso."
            }, ensure_ascii=False).encode("utf-8"))
            return

        # 3. Atualizar Meu Perfil / Senha (suporta /api/auth/perfil, /api/perfil)
        if path in ("/api/auth/perfil", "/api/perfil"):
            user = self._require_auth()
            if not user:
                return
            body = self._read_body_dict()
            nome = body.get("nome", user["nome"])
            email = body.get("email", user["email"])
            senha_atual = body.get("senha_atual")
            nova_senha = body.get("nova_senha")

            conn = database.get_connection()
            try:
                sucesso, updated_user, msg = auth.alterar_perfil_proprio(
                    conn, user["id"], nome, email, senha_atual, nova_senha
                )
                if not sucesso:
                    self._send_error(400, msg)
                else:
                    self._send_json(200, {
                        "success": True,
                        "message": msg,
                        "user": updated_user
                    })
            except Exception as e:
                self._send_error(500, f"Erro ao atualizar perfil: {str(e)}")
            finally:
                conn.close()
            return

        # 4. Criar Novo Usuário (Admin)
        if path in ("/api/usuarios", "/api/usuarios/"):
            admin_user = self._require_admin()
            if not admin_user:
                return
            body = self._read_body_dict()
            username = body.get("username", "")
            nome = body.get("nome", "")
            email = body.get("email", "")
            senha = body.get("senha", "")
            cargo = body.get("cargo", "Colaborador")
            role = body.get("role", "operador")
            ativo = body.get("ativo", True)
            if isinstance(ativo, str):
                ativo = ativo in ("1", "true", "True")

            conn = database.get_connection()
            try:
                sucesso, new_user, msg = auth.criar_usuario(
                    conn, username, nome, email, senha, cargo, role, ativo
                )
                if not sucesso:
                    self._send_error(400, msg)
                else:
                    self._send_json(201, {
                        "success": True,
                        "message": msg,
                        "usuario": new_user
                    })
            except Exception as e:
                self._send_error(500, f"Erro ao cadastrar usuário: {str(e)}")
            finally:
                conn.close()
            return

        # 5. Atualizar Usuário via POST (suporta /api/usuarios/<id> e /api/usuarios/<id>/atualizar)
        match_user_update = re.match(r"^/api/usuarios/(\d+)(?:/atualizar)?$", path)
        if match_user_update:
            admin_user = self._require_admin()
            if not admin_user:
                return
            user_id = int(match_user_update.group(1))
            body = self._read_body_dict()
            self._handle_update_user(user_id, body, admin_user["id"])
            return

        # 6. Alternar Status do Usuário (Ativar/Desativar)
        match_user_toggle = re.match(r"^/api/usuarios/(\d+)/toggle$", path)
        if match_user_toggle:
            admin_user = self._require_admin()
            if not admin_user:
                return
            user_id = int(match_user_toggle.group(1))
            conn = database.get_connection()
            try:
                target = auth.obter_usuario_por_id(conn, user_id)
                if not target:
                    self._send_error(404, "Usuário não encontrado.")
                    return
                novo_status = not target["ativo"]
                sucesso, updated_user, msg = auth.atualizar_usuario(
                    conn, user_id, target["nome"], target["email"],
                    target["cargo"], target["role"], novo_status,
                    current_user_id=admin_user["id"]
                )
                if not sucesso:
                    self._send_error(400, msg)
                else:
                    self._send_json(200, {
                        "success": True,
                        "message": f"Usuário {'ativado' if novo_status else 'desativado'} com sucesso.",
                        "usuario": updated_user
                    })
            except Exception as e:
                self._send_error(500, f"Erro ao alterar status: {str(e)}")
            finally:
                conn.close()
            return

        # 7. Excluir Usuário via POST (suporta /api/usuarios/<id>/excluir ou /api/usuarios/<id>/delete)
        match_user_del_post = re.match(r"^/api/usuarios/(\d+)/(?:excluir|delete)$", path)
        if match_user_del_post:
            admin_user = self._require_admin()
            if not admin_user:
                return
            user_id = int(match_user_del_post.group(1))
            self._handle_delete_user(user_id, admin_user["id"])
            return

        # 8. Upload de Relatório PDF (suporta /api/upload e /upload)
        if path in ("/api/upload", "/upload"):
            user = self._require_auth()
            if not user:
                return
            try:
                content_type = self.headers.get("Content-Type", "")
                content_length = int(self.headers.get("Content-Length", 0))

                if content_length == 0:
                    self._send_error(400, "Arquivo não enviado")
                    return

                # Processar multipart/form-data
                if "multipart/form-data" in content_type:
                    environ = {
                        "REQUEST_METHOD": "POST",
                        "CONTENT_TYPE": content_type,
                        "CONTENT_LENGTH": str(content_length),
                    }
                    form = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ=environ,
                        keep_blank_values=True
                    )

                    if "file" not in form:
                        self._send_error(400, "Campo 'file' não encontrado no envio")
                        return

                    fileitem = form["file"]
                    if isinstance(fileitem, list):
                        fileitem = fileitem[0]

                    if getattr(fileitem, "file", None) is None:
                        self._send_error(400, "Arquivo inválido ou não enviado")
                        return

                    raw_filename = getattr(fileitem, "filename", None) or "folha_upload.pdf"
                    filename = Path(raw_filename).name or "folha_upload.pdf"
                    file_bytes = fileitem.file.read()
                else:
                    file_bytes = self.rfile.read(content_length)
                    filename = "folha_upload.pdf"

                save_path = UPLOAD_DIR / filename
                with open(save_path, "wb") as f:
                    f.write(file_bytes)

                resumo, employees = parser.parse_folha_pdf(str(save_path))

                if not employees:
                    self._send_error(422, "Nenhum colaborador ou dado de folha identificado no PDF. Verifique se o formato do arquivo é compatível.")
                    return

                periodo_id = database.salvar_relatorio(resumo, employees, filename)
                relatorio_completo = database.obter_relatorio(periodo_id)

                self._send_json(201, {
                    "success": True,
                    "message": "Folha de pagamento processada e armazenada com sucesso!",
                    "periodo_id": periodo_id,
                    "relatorio": relatorio_completo
                })
            except Exception as e:
                import traceback
                traceback.print_exc()
                self._send_error(500, f"Erro ao processar PDF: {str(e)}")
            return

        # 9. Gerar Folhas de Demonstração (Admin via POST)
        if path in ("/api/demo-12-meses", "/demo-12-meses"):
            if not self._require_admin():
                return
            try:
                empresa_filtro = query.get("empresa", [None])[0]
                criados = database.gerar_folhas_demo_12m(empresa_filtro)
                self._send_json(200, {
                    "success": True,
                    "message": f"{criados} folhas adicionadas para completar o histórico de 12 meses!",
                    "criados": criados
                })
            except Exception as e:
                self._send_error(500, f"Erro ao gerar demo 12 meses: {str(e)}")
            return

        # 10. Excluir Período via POST (compatibilidade)
        match_periodo_del_post = re.match(r"^/api/periodos/(\d+)(?:/excluir|/delete)?$", path)
        if match_periodo_del_post:
            admin_user = self._require_admin()
            if not admin_user:
                return
            periodo_id = int(match_periodo_del_post.group(1))
            try:
                database.excluir_periodo(periodo_id)
                self._send_json(200, {
                    "success": True,
                    "message": f"Período {periodo_id} excluído com sucesso"
                })
            except Exception as e:
                self._send_error(500, f"Erro ao excluir período: {str(e)}")
            return

        print(f"[AVISO SERVER] Rota POST não reconhecida: '{path}' (full_path: '{self.path}')")
        self._send_error(404, f"Rota POST '{path}' não encontrada")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        # 1. Atualizar Perfil Próprio
        if path == "/api/auth/perfil":
            user = self._require_auth()
            if not user:
                return
            body = self._read_json_body()
            nome = body.get("nome", user["nome"])
            email = body.get("email", user["email"])
            senha_atual = body.get("senha_atual")
            nova_senha = body.get("nova_senha")

            conn = database.get_connection()
            try:
                sucesso, updated_user, msg = auth.alterar_perfil_proprio(
                    conn, user["id"], nome, email, senha_atual, nova_senha
                )
                if not sucesso:
                    self._send_error(400, msg)
                else:
                    self._send_json(200, {
                        "success": True,
                        "message": msg,
                        "user": updated_user
                    })
            except Exception as e:
                self._send_error(500, f"Erro ao atualizar perfil: {str(e)}")
            finally:
                conn.close()
            return

        # 2. Atualizar Usuário por ID (Admin)
        match_user = re.match(r"^/api/usuarios/(\d+)$", path)
        if match_user:
            admin_user = self._require_admin()
            if not admin_user:
                return
            user_id = int(match_user.group(1))
            body = self._read_json_body()
            self._handle_update_user(user_id, body, admin_user["id"])
            return

        self._send_error(404, "Rota PUT não encontrada")

    def _handle_update_user(self, user_id, body, admin_id):
        conn = database.get_connection()
        try:
            target = auth.obter_usuario_por_id(conn, user_id)
            if not target:
                self._send_error(404, "Usuário não encontrado.")
                return

            nome = body.get("nome", target["nome"])
            email = body.get("email", target["email"])
            cargo = body.get("cargo", target["cargo"])
            role = body.get("role", target["role"])
            ativo = body.get("ativo", target["ativo"])
            nova_senha = body.get("nova_senha") or body.get("senha")

            sucesso, updated_user, msg = auth.atualizar_usuario(
                conn, user_id, nome, email, cargo, role, ativo,
                nova_senha=nova_senha, current_user_id=admin_id
            )
            if not sucesso:
                self._send_error(400, msg)
            else:
                self._send_json(200, {
                    "success": True,
                    "message": msg,
                    "usuario": updated_user
                })
        except Exception as e:
            self._send_error(500, f"Erro ao atualizar usuário: {str(e)}")
        finally:
            conn.close()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        # 1. Excluir Usuário (Admin)
        match_user = re.match(r"^/api/usuarios/(\d+)$", path)
        if match_user:
            admin_user = self._require_admin()
            if not admin_user:
                return
            user_id = int(match_user.group(1))
            self._handle_delete_user(user_id, admin_user["id"])
            return

        # 2. Excluir Período de Folha (Admin)
        match_del = re.match(r"^/api/periodos/(\d+)$", path)
        if match_del:
            admin_user = self._require_admin()
            if not admin_user:
                return
            periodo_id = int(match_del.group(1))
            try:
                database.excluir_periodo(periodo_id)
                self._send_json(200, {
                    "success": True,
                    "message": f"Período {periodo_id} excluído com sucesso"
                })
            except Exception as e:
                self._send_error(500, f"Erro ao excluir período: {str(e)}")
            return

        self._send_error(404, "Rota DELETE não encontrada")

    def _handle_delete_user(self, user_id, current_user_id):
        conn = database.get_connection()
        try:
            sucesso, msg = auth.excluir_usuario(conn, user_id, current_user_id)
            if not sucesso:
                self._send_error(400, msg)
            else:
                self._send_json(200, {
                    "success": True,
                    "message": msg
                })
        except Exception as e:
            self._send_error(500, f"Erro ao excluir usuário: {str(e)}")
        finally:
            conn.close()

def start_server(host=None, port=None):
    if host is None:
        host = os.environ.get("HOST", "0.0.0.0")
    if port is None:
        try:
            port = int(os.environ.get("PORT", "8050"))
        except ValueError:
            port = 8050

    database.init_db()
    
    # Se a base estiver vazia e o modelo existir, importar automaticamente
    periodos = database.listar_periodos()
    if not periodos:
        modelo_pdf = BASE_DIR / "modelo" / "folha-agosto-2026.pdf"
        if modelo_pdf.exists():
            print(f"Importando folha modelo inicial de {modelo_pdf}...")
            resumo, emps = parser.parse_folha_pdf(str(modelo_pdf))
            database.salvar_relatorio(resumo, emps, "folha-agosto-2026.pdf")
            print("Importação inicial concluída com sucesso.")

    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, HoleriteRequestHandler)
    print(f"\n========================================================")
    print(f"  SISTEMA DE GESTÃO DE FOLHA E HOLERITES INICIADO")
    print(f"  Servidor ativo em: http://{host}:{port}")
    print(f"========================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado pelo usuário.")
        httpd.server_close()

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = None
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    if port is None:
        try:
            port = int(os.environ.get("PORT", "8050"))
        except ValueError:
            port = 8050
    start_server(host=host, port=port)
