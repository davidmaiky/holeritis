"""
Teste Automatizado de API de Autenticação e Gestão de Usuários
"""
import sys
import time
import threading
import urllib.request
import urllib.error
import http.cookiejar
import json

import database
import server

PORT = 8059
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

def run_tests():
    # Iniciar banco e servidor em thread de background
    database.init_db()
    httpd = server.ThreadingHTTPServer((HOST, PORT), server.HoleriteRequestHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(1)

    print(f"[*] Servidor de testes rodando em {BASE_URL}")

    # Configurar opener com suporte a Cookies
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

    def request(method, path, data=None, token=None):
        url = BASE_URL + path
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        req_data = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with opener.open(req) as resp:
                status = resp.status
                body = json.loads(resp.read().decode("utf-8"))
                return status, body
        except urllib.error.HTTPError as e:
            status = e.code
            try:
                body = json.loads(e.read().decode("utf-8"))
            except Exception:
                body = {"raw": "non-json error"}
            return status, body

    # 1. Healthcheck
    st, res = request("GET", "/api/health")
    assert st == 200, f"Healthcheck falhou: {st}"
    print(" [OK] 1. Healthcheck OK")

    # 2. GET /api/auth/me sem login
    st, res = request("GET", "/api/auth/me")
    assert st == 200 and res.get("authenticated") is False, f"Auth me anonimo falhou: {res}"
    print(" [OK] 2. GET /api/auth/me anônimo OK (não autenticado)")

    # 3. GET /api/empresas sem token (deve ser 401)
    st, res = request("GET", "/api/empresas")
    assert st == 401, f"GET empresas deveria retornar 401, retornou: {st}"
    print(" [OK] 3. Proteção 401 em rota privada OK")

    # 4. Login com senha errada
    st, res = request("POST", "/api/auth/login", {"username": "admin", "senha": "senha_errada"})
    assert st == 401, f"Login com senha errada deveria falhar: {st}"
    print(" [OK] 4. Bloqueio de senha incorreta OK")

    # 5. Login com admin / admin
    st, res = request("POST", "/api/auth/login", {"username": "admin", "senha": "admin"})
    assert st == 200 and res.get("success") is True, f"Login admin falhou: {res}"
    admin_token = res["token"]
    assert admin_token, "Token não retornado no login"
    print(f" [OK] 5. Login admin OK! Token gerado.")

    # 6. GET /api/auth/me com token
    st, res = request("GET", "/api/auth/me", token=admin_token)
    assert st == 200 and res.get("authenticated") is True, f"GET auth/me com token falhou: {res}"
    assert res["user"]["role"] == "admin"
    print(f" [OK] 6. GET /api/auth/me com token OK (Role: {res['user']['role']})")

    # 7. GET /api/empresas autenticado
    st, res = request("GET", "/api/empresas", token=admin_token)
    assert st == 200 and res.get("success") is True, f"GET empresas autenticado falhou: {res}"
    print(f" [OK] 7. Rota protegida acessada com sucesso (Empresas: {len(res.get('empresas', []))})")

    # 8. Listar Usuários como Admin
    st, res = request("GET", "/api/usuarios", token=admin_token)
    assert st == 200 and res.get("success") is True, f"Listagem de usuarios falhou: {res}"
    print(f" [OK] 8. Listagem de usuários (Admin) OK: {len(res['usuarios'])} usuário(s)")

    # 9. Criar novo usuário operador
    novo_user = {
        "username": "operador.teste",
        "nome": "Operador de Testes",
        "email": "operador@teste.local",
        "senha": "senha123teste",
        "cargo": "Analista de DP",
        "role": "operador",
        "ativo": True
    }
    st, res = request("POST", "/api/usuarios", data=novo_user, token=admin_token)
    assert st == 201 and res.get("success") is True, f"Criação de usuário falhou: {res}"
    operador_id = res["usuario"]["id"]
    print(f" [OK] 9. Criação de usuário operador OK (ID: {operador_id})")

    # 10. Login com o novo operador
    st, res = request("POST", "/api/auth/login", {"username": "operador.teste", "senha": "senha123teste"})
    assert st == 200 and res.get("success") is True, f"Login de operador falhou: {res}"
    operador_token = res["token"]
    print(f" [OK] 10. Login com credenciais do novo operador OK")

    # 11. Teste de RBAC: operador tentando acessar rota administrativa /api/usuarios (deve retornar 403)
    st, res = request("GET", "/api/usuarios", token=operador_token)
    assert st == 403, f"Operador deveria receber 403 ao tentar gerenciar usuários, recebeu: {st}"
    print(" [OK] 11. RBAC Funcionando! Operador bloqueado com 403 em rota de Admin")

    # 12. Operador atualizando seu próprio perfil
    st, res = request("PUT", "/api/auth/perfil", {
        "nome": "Operador de Testes Renomeado",
        "email": "operador.novo@teste.local"
    }, token=operador_token)
    assert st == 200 and res.get("success") is True, f"Atualização de perfil falhou: {res}"
    print(" [OK] 12. Atualização de perfil próprio do usuário OK")

    # 13. Admin editando cargo do operador
    st, res = request("PUT", f"/api/usuarios/{operador_id}", {
        "cargo": "Coordenador de RH",
        "role": "operador",
        "ativo": True
    }, token=admin_token)
    assert st == 200 and res.get("success") is True, f"Admin editando usuário falhou: {res}"
    print(" [OK] 13. Admin editando dados do operador OK")

    # 14. Alternar status (toggle ativo/inativo)
    st, res = request("POST", f"/api/usuarios/{operador_id}/toggle", token=admin_token)
    assert st == 200 and res.get("success") is True, f"Toggle status falhou: {res}"
    print(f" [OK] 14. Alternância de status ativo/inativo OK ({res.get('message')})")

    # 15. Tentar logar com usuário desativado (deve falhar)
    st, res = request("POST", "/api/auth/login", {"username": "operador.teste", "senha": "senha123teste"})
    assert st == 401, f"Usuário desativado não deveria conseguir login, retornou {st}"
    print(" [OK] 15. Usuário inativo impedido de logar OK")

    # 16. Excluir usuário de testes
    st, res = request("DELETE", f"/api/usuarios/{operador_id}", token=admin_token)
    assert st == 200 and res.get("success") is True, f"Exclusão de usuário falhou: {res}"
    print(" [OK] 16. Exclusão de usuário pelo Admin OK")

    # 17. Logout
    st, res = request("POST", "/api/auth/logout", token=admin_token)
    assert st == 200, f"Logout falhou: {st}"
    print(" [OK] 17. Logout do sistema OK")

    # 18. Teste de alias POST /login e POST /api/login
    st, res = request("POST", "/login", {"username": "admin", "senha": "admin"})
    assert st == 200 and res.get("success") is True, f"Login via /login falhou: {res}"
    alias_token = res["token"]
    print(" [OK] 18. Alias POST /login funcionando")

    st, res = request("POST", "/api/login", {"username": "admin", "senha": "admin"})
    assert st == 200 and res.get("success") is True, f"Login via /api/login falhou: {res}"
    print(" [OK] 19. Alias POST /api/login funcionando")

    # 20. Teste POST /api/demo-12-meses
    st, res = request("POST", "/api/demo-12-meses", token=alias_token)
    assert st == 200 and res.get("success") is True, f"POST /api/demo-12-meses falhou: {res}"
    print(" [OK] 20. Rota POST /api/demo-12-meses funcionando")

    print("\n========================================================")
    print("  TODOS OS 20 TESTES DE ROTAS E AUTENTICAÇÃO PASSARAM!")
    print("========================================================\n")
    httpd.shutdown()

if __name__ == "__main__":
    run_tests()
