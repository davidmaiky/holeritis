"""
Módulo de Autenticação, Sessões e Gerenciamento de Usuários
Zero dependências externas (utiliza hashlib com PBKDF2-SHA256, secrets e SQLite)
"""

import sqlite3
import hashlib
import secrets
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin"
DEFAULT_ADMIN_NAME = "Administrador do Sistema"
DEFAULT_ADMIN_EMAIL = "admin@holeritemanager.local"
DEFAULT_ADMIN_CARGO = "Administrador Geral"
DEFAULT_ADMIN_ROLE = "admin"

SESSION_DURATION_DAYS = 7
HASH_ITERATIONS = 100_000

def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Gera hash seguro PBKDF2-HMAC-SHA256 com salt individual."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS
    )
    return key.hex(), salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verifica se a senha coincide com o hash armazenado de forma resistente a timing attacks."""
    computed_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(computed_hash, stored_hash)

def init_auth_db(conn: sqlite3.Connection):
    """Cria tabelas de usuários e sessões e inicializa o usuário admin padrão caso não exista."""
    with conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            email TEXT,
            senha_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            cargo TEXT DEFAULT 'Colaborador',
            role TEXT NOT NULL DEFAULT 'operador',
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            ultimo_login DATETIME
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS sessoes (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            expira_em DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessoes_user_id ON sessoes(user_id);")

        # Verificar se existe ao menos um usuário cadastrado
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(id) as total FROM usuarios")
        count = cursor.fetchone()["total"]

        if count == 0:
            senha_hash, salt = hash_password(DEFAULT_ADMIN_PASSWORD)
            cursor.execute("""
                INSERT INTO usuarios (username, nome, email, senha_hash, salt, cargo, role, ativo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, (
                DEFAULT_ADMIN_USERNAME,
                DEFAULT_ADMIN_NAME,
                DEFAULT_ADMIN_EMAIL,
                senha_hash,
                salt,
                DEFAULT_ADMIN_CARGO,
                DEFAULT_ADMIN_ROLE
            ))
            print(f"[AUTH] Usuário administrador padrão criado com sucesso: '{DEFAULT_ADMIN_USERNAME}'")

def sanitizar_user_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Retorna dados do usuário sem informações sensíveis como hash e salt."""
    if not row:
        return {}
    return {
        "id": row["id"],
        "username": row["username"],
        "nome": row["nome"],
        "email": row["email"] or "",
        "cargo": row["cargo"] or "Colaborador",
        "role": row["role"] or "operador",
        "ativo": bool(row["ativo"]),
        "criado_em": row["criado_em"],
        "ultimo_login": row["ultimo_login"]
    }

def login(conn: sqlite3.Connection, username: str, password: str) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]], str]:
    """
    Autentica um usuário e cria uma nova sessão persistida no banco.
    Retorna (sucesso, token, user_dict, mensagem_erro).
    """
    username = (username or "").strip().lower()
    if not username or not password:
        return False, None, None, "Informe o nome de usuário e a senha."

    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM usuarios WHERE LOWER(username) = ?
    """, (username,))
    user = cursor.fetchone()

    if not user:
        return False, None, None, "Credenciais inválidas. Usuário não encontrado."

    if not user["ativo"]:
        return False, None, None, "Esta conta de usuário está desativada. Contate o administrador."

    if not verify_password(password, user["senha_hash"], user["salt"]):
        return False, None, None, "Credenciais inválidas. Senha incorreta."

    # Gerar token seguro de sessão
    token = secrets.token_hex(32)
    agora = datetime.utcnow()
    expira_em = agora + timedelta(days=SESSION_DURATION_DAYS)

    with conn:
        cursor.execute("""
            INSERT INTO sessoes (token, user_id, expira_em)
            VALUES (?, ?, ?)
        """, (token, user["id"], expira_em.isoformat()))

        cursor.execute("""
            UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?
        """, (user["id"],))

    # Obter dados atualizados
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user["id"],))
    updated_user = cursor.fetchone()

    return True, token, sanitizar_user_dict(updated_user), ""

def logout(conn: sqlite3.Connection, token: str) -> bool:
    """Encerra uma sessão ativa removendo o token do banco."""
    if not token:
        return False
    with conn:
        conn.execute("DELETE FROM sessoes WHERE token = ?", (token,))
    return True

def obter_usuario_por_token(conn: sqlite3.Connection, token: str) -> Optional[Dict[str, Any]]:
    """Valida o token da sessão e retorna o usuário logado caso válido e não expirado."""
    if not token:
        return None

    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.expira_em, u.*
        FROM sessoes s
        JOIN usuarios u ON s.user_id = u.id
        WHERE s.token = ?
    """, (token,))
    row = cursor.fetchone()

    if not row:
        return None

    # Verificar expiração
    expira_str = row["expira_em"]
    try:
        expira_dt = datetime.fromisoformat(expira_str)
        if datetime.utcnow() > expira_dt:
            with conn:
                conn.execute("DELETE FROM sessoes WHERE token = ?", (token,))
            return None
    except Exception:
        pass

    if not row["ativo"]:
        return None

    return sanitizar_user_dict(row)

def listar_usuarios(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Retorna lista de todos os usuários ordenados por nome."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM usuarios ORDER BY nome ASC
    """)
    rows = cursor.fetchall()
    return [sanitizar_user_dict(r) for r in rows]

def obter_usuario_por_id(conn: sqlite3.Connection, user_id: int) -> Optional[Dict[str, Any]]:
    """Busca detalhes públicos de um usuário por ID."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    return sanitizar_user_dict(row) if row else None

def criar_usuario(
    conn: sqlite3.Connection,
    username: str,
    nome: str,
    email: str,
    senha: str,
    cargo: str = "Colaborador",
    role: str = "operador",
    ativo: bool = True
) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """Cria um novo usuário no sistema."""
    username = (username or "").strip().lower()
    nome = (nome or "").strip()
    email = (email or "").strip().lower()
    cargo = (cargo or "").strip() or "Colaborador"
    role = "admin" if role == "admin" else "operador"

    if not username or len(username) < 3:
        return False, None, "O nome de usuário deve ter pelo menos 3 caracteres."

    if not re.match(r"^[a-zA-Z0-9_\.\-]+$", username):
        return False, None, "O nome de usuário deve conter apenas letras, números, ponto, hífen ou sublinhado."

    if not nome:
        return False, None, "O nome completo é obrigatório."

    if not senha or len(senha) < 4:
        return False, None, "A senha deve ter pelo menos 4 caracteres."

    cursor = conn.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE LOWER(username) = ?", (username,))
    if cursor.fetchone():
        return False, None, f"O nome de usuário '{username}' já está em uso."

    if email:
        cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ?", (email,))
        if cursor.fetchone():
            return False, None, f"O e-mail '{email}' já está associado a outro usuário."

    senha_hash, salt = hash_password(senha)

    with conn:
        cursor.execute("""
            INSERT INTO usuarios (username, nome, email, senha_hash, salt, cargo, role, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (username, nome, email, senha_hash, salt, cargo, role, 1 if ativo else 0))
        new_id = cursor.lastrowid

    return True, obter_usuario_por_id(conn, new_id), "Usuário criado com sucesso!"

def atualizar_usuario(
    conn: sqlite3.Connection,
    user_id: int,
    nome: str,
    email: str,
    cargo: str,
    role: str,
    ativo: bool,
    nova_senha: Optional[str] = None,
    current_user_id: Optional[int] = None
) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """Atualiza dados cadastrais, perfil de acesso e status de um usuário existente."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user_id,))
    target = cursor.fetchone()

    if not target:
        return False, None, "Usuário não encontrado."

    nome = (nome or "").strip()
    email = (email or "").strip().lower()
    cargo = (cargo or "").strip() or target["cargo"]
    role = "admin" if role == "admin" else "operador"

    if not nome:
        return False, None, "O nome completo não pode ser vazio."

    if email:
        cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?", (email, user_id))
        if cursor.fetchone():
            return False, None, f"O e-mail '{email}' já está em uso por outro usuário."

    # Proteção: Não permitir que o usuário logado desative ou remova privilégios de si mesmo se for admin
    if current_user_id == user_id:
        if not ativo:
            return False, None, "Você não pode desativar sua própria conta."
        if role != "admin" and target["role"] == "admin":
            return False, None, "Você não pode revogar seus próprios privilégios de administrador."

    # Proteção: Garantir que sempre haja pelo menos um administrador ativo
    if target["role"] == "admin" and (role != "admin" or not ativo):
        cursor.execute("SELECT COUNT(id) as total FROM usuarios WHERE role = 'admin' AND ativo = 1 AND id != ?", (user_id,))
        outros_admins = cursor.fetchone()["total"]
        if outros_admins == 0:
            return False, None, "Operação bloqueada: o sistema precisa manter pelo menos um Administrador ativo."

    with conn:
        if nova_senha and len(nova_senha.strip()) >= 4:
            senha_hash, salt = hash_password(nova_senha.strip())
            cursor.execute("""
                UPDATE usuarios SET
                    nome = ?, email = ?, cargo = ?, role = ?, ativo = ?,
                    senha_hash = ?, salt = ?
                WHERE id = ?
            """, (nome, email, cargo, role, 1 if ativo else 0, senha_hash, salt, user_id))
        else:
            cursor.execute("""
                UPDATE usuarios SET
                    nome = ?, email = ?, cargo = ?, role = ?, ativo = ?
                WHERE id = ?
            """, (nome, email, cargo, role, 1 if ativo else 0, user_id))

        # Se o usuário foi desativado, encerrar todas as suas sessões ativas
        if not ativo:
            cursor.execute("DELETE FROM sessoes WHERE user_id = ?", (user_id,))

    return True, obter_usuario_por_id(conn, user_id), "Usuário atualizado com sucesso!"

def excluir_usuario(conn: sqlite3.Connection, user_id: int, current_user_id: int) -> Tuple[bool, str]:
    """Exclui um usuário do sistema com proteções contra auto-exclusão e exclusão do último admin."""
    if user_id == current_user_id:
        return False, "Você não pode excluir sua própria conta enquanto estiver logado."

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user_id,))
    target = cursor.fetchone()

    if not target:
        return False, "Usuário não encontrado."

    if target["role"] == "admin":
        cursor.execute("SELECT COUNT(id) as total FROM usuarios WHERE role = 'admin' AND ativo = 1 AND id != ?", (user_id,))
        outros_admins = cursor.fetchone()["total"]
        if outros_admins == 0:
            return False, "Não é possível excluir o único administrador ativo do sistema."

    with conn:
        cursor.execute("DELETE FROM sessoes WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))

    return True, f"Usuário '{target['username']}' excluído com sucesso."

def alterar_perfil_proprio(
    conn: sqlite3.Connection,
    user_id: int,
    nome: str,
    email: str,
    senha_atual: Optional[str] = None,
    nova_senha: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """Permite ao próprio usuário atualizar seu nome, e-mail e alterar sua própria senha."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if not user:
        return False, None, "Usuário não encontrado."

    nome = (nome or "").strip()
    email = (email or "").strip().lower()

    if not nome:
        return False, None, "O nome não pode estar em branco."

    if email:
        cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?", (email, user_id))
        if cursor.fetchone():
            return False, None, f"O e-mail '{email}' já está cadastrado em outra conta."

    with conn:
        if nova_senha:
            if not senha_atual:
                return False, None, "Para alterar a senha, informe sua senha atual."
            if not verify_password(senha_atual, user["senha_hash"], user["salt"]):
                return False, None, "A senha atual está incorreta."
            if len(nova_senha) < 4:
                return False, None, "A nova senha deve possuir pelo menos 4 caracteres."

            nova_hash, novo_salt = hash_password(nova_senha)
            cursor.execute("""
                UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, salt = ? WHERE id = ?
            """, (nome, email, nova_hash, novo_salt, user_id))
        else:
            cursor.execute("""
                UPDATE usuarios SET nome = ?, email = ? WHERE id = ?
            """, (nome, email, user_id))

    return True, obter_usuario_por_id(conn, user_id), "Perfil atualizado com sucesso!"
