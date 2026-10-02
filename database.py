"""
Gerenciamento de Banco de Dados SQLite para Armazenamento e Consulta de Relatórios de Folha por Período
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime

DB_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DB_DIR / "holerites.db"

def get_connection():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    with conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS periodos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            periodo_texto TEXT NOT NULL,
            mes_ano TEXT NOT NULL,
            empresa TEXT,
            cnpj TEXT,
            total_funcionarios INTEGER NOT NULL DEFAULT 0,
            total_salario REAL NOT NULL DEFAULT 0.0,
            total_proventos REAL NOT NULL DEFAULT 0.0,
            total_adiantamento REAL NOT NULL DEFAULT 0.0,
            total_descontos REAL NOT NULL DEFAULT 0.0,
            total_liquido REAL NOT NULL DEFAULT 0.0,
            nome_arquivo TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS relatorio_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            periodo_id INTEGER NOT NULL,
            codigo TEXT,
            nome TEXT NOT NULL,
            funcao TEXT,
            salario REAL NOT NULL DEFAULT 0.0,
            proventos REAL NOT NULL DEFAULT 0.0,
            descontos REAL NOT NULL DEFAULT 0.0,
            adiantamento_anterior REAL NOT NULL DEFAULT 0.0,
            liquido REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE
        );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_itens_periodo ON relatorio_itens(periodo_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_periodos_mes_ano ON periodos(mes_ano);")
    conn.close()

def salvar_relatorio(resumo, employees, nome_arquivo=""):
    """
    Armazena o relatório extraído classificado por período e Razão Social (Empresa).
    Se o período já existir para a MESMA empresa, remove o anterior e insere o atualizado.
    Se for uma empresa diferente no mesmo período, cria um novo registro independente!
    """
    conn = get_connection()
    with conn:
        empresa_nome = (resumo.get("empresa") or "").strip()
        cnpj = (resumo.get("cnpj") or "").strip()
        periodo_texto = (resumo.get("periodo_texto") or "").strip()

        cursor = conn.cursor()
        # Verificar se já existe registro dessa mesma empresa e mesmo período
        if cnpj:
            cursor.execute("""
                SELECT id FROM periodos 
                WHERE periodo_texto = ? 
                  AND (LOWER(TRIM(empresa)) = LOWER(TRIM(?)) OR cnpj = ?)
            """, (periodo_texto, empresa_nome, cnpj))
        else:
            cursor.execute("""
                SELECT id FROM periodos 
                WHERE periodo_texto = ? 
                  AND LOWER(TRIM(empresa)) = LOWER(TRIM(?))
            """, (periodo_texto, empresa_nome))

        existente = cursor.fetchone()
        
        if existente:
            periodo_id = existente["id"]
            cursor.execute("DELETE FROM relatorio_itens WHERE periodo_id = ?", (periodo_id,))
            cursor.execute("""
                UPDATE periodos SET
                    mes_ano = ?,
                    empresa = ?,
                    cnpj = ?,
                    total_funcionarios = ?,
                    total_salario = ?,
                    total_proventos = ?,
                    total_adiantamento = ?,
                    total_descontos = ?,
                    total_liquido = ?,
                    nome_arquivo = ?,
                    criado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                resumo["mes_ano"],
                resumo["empresa"],
                resumo["cnpj"],
                resumo["total_funcionarios"],
                resumo["total_salario"],
                resumo["total_proventos"],
                resumo["total_adiantamento"],
                resumo["total_descontos"],
                resumo["total_liquido"],
                nome_arquivo,
                periodo_id
            ))
        else:
            cursor.execute("""
                INSERT INTO periodos (
                    periodo_texto, mes_ano, empresa, cnpj,
                    total_funcionarios, total_salario, total_proventos,
                    total_adiantamento, total_descontos, total_liquido,
                    nome_arquivo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                resumo["periodo_texto"],
                resumo["mes_ano"],
                resumo["empresa"],
                resumo["cnpj"],
                resumo["total_funcionarios"],
                resumo["total_salario"],
                resumo["total_proventos"],
                resumo["total_adiantamento"],
                resumo["total_descontos"],
                resumo["total_liquido"],
                nome_arquivo
            ))
            periodo_id = cursor.lastrowid

        # Inserir cada item do funcionário
        for emp in employees:
            cursor.execute("""
                INSERT INTO relatorio_itens (
                    periodo_id, codigo, nome, funcao, salario,
                    proventos, descontos, adiantamento_anterior, liquido
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                periodo_id,
                emp.get("codigo", ""),
                emp["nome"],
                emp.get("funcao", ""),
                emp["salario"],
                emp["proventos"],
                emp["descontos"],
                emp["adiantamento_anterior"],
                emp["liquido"]
            ))

    conn.close()
    return periodo_id

def listar_empresas():
    """
    Retorna a lista distinta de empresas (Razões Sociais) cadastradas e quantidades associadas.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            empresa,
            COALESCE(cnpj, '') as cnpj,
            COUNT(id) as total_periodos,
            SUM(total_funcionarios) as total_colaboradores,
            MAX(id) as ultimo_periodo_id
        FROM periodos
        WHERE empresa IS NOT NULL AND TRIM(empresa) != ''
        GROUP BY empresa
        ORDER BY empresa ASC
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def listar_periodos(empresa=None):
    """
    Retorna a lista de todos os períodos classificados em ordem decrescente.
    Se empresa for informada, filtra os períodos correspondentes àquela Razão Social.
    """
    conn = get_connection()
    cursor = conn.cursor()
    if empresa and empresa.strip():
        cursor.execute("""
            SELECT 
                id, periodo_texto, mes_ano, empresa, cnpj,
                total_funcionarios, total_salario, total_proventos,
                total_adiantamento, total_descontos, total_liquido,
                nome_arquivo, criado_em
            FROM periodos
            WHERE LOWER(TRIM(empresa)) = LOWER(TRIM(?))
            ORDER BY id DESC
        """, (empresa.strip(),))
    else:
        cursor.execute("""
            SELECT 
                id, periodo_texto, mes_ano, empresa, cnpj,
                total_funcionarios, total_salario, total_proventos,
                total_adiantamento, total_descontos, total_liquido,
                nome_arquivo, criado_em
            FROM periodos
            ORDER BY id DESC
        """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def obter_relatorio(periodo_id):
    """
    Obtém os dados consolidados do período e a lista detalhada de funcionários.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM periodos WHERE id = ?", (periodo_id,))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        return None

    periodo_info = dict(p_row)

    cursor.execute("""
        SELECT 
            id, periodo_id, codigo, nome, funcao,
            salario, proventos, descontos, adiantamento_anterior, liquido
        FROM relatorio_itens
        WHERE periodo_id = ?
        ORDER BY nome ASC
    """, (periodo_id,))
    itens = [dict(row) for row in cursor.fetchall()]
    conn.close()

    periodo_info["itens"] = itens
    return periodo_info

def excluir_periodo(periodo_id):
    conn = get_connection()
    with conn:
        conn.execute("DELETE FROM periodos WHERE id = ?", (periodo_id,))
    conn.close()
    return True

def estatisticas_gerais(empresa=None):
    conn = get_connection()
    cursor = conn.cursor()
    if empresa and empresa.strip():
        cursor.execute("SELECT COUNT(*) as count FROM periodos WHERE LOWER(TRIM(empresa)) = LOWER(TRIM(?))", (empresa.strip(),))
        total_periodos = cursor.fetchone()["count"]

        cursor.execute("""
            SELECT 
                SUM(total_funcionarios) as soma_func,
                SUM(total_proventos) as soma_proventos,
                SUM(total_adiantamento) as soma_adiantamento,
                SUM(total_liquido) as soma_liquido
            FROM periodos
            WHERE LOWER(TRIM(empresa)) = LOWER(TRIM(?))
        """, (empresa.strip(),))
    else:
        cursor.execute("SELECT COUNT(*) as count FROM periodos")
        total_periodos = cursor.fetchone()["count"]

        cursor.execute("""
            SELECT 
                SUM(total_funcionarios) as soma_func,
                SUM(total_proventos) as soma_proventos,
                SUM(total_adiantamento) as soma_adiantamento,
                SUM(total_liquido) as soma_liquido
            FROM periodos
        """)

    row = cursor.fetchone()
    conn.close()
    return {
        "total_periodos": total_periodos,
        "soma_funcionarios": row["soma_func"] or 0,
        "soma_proventos": row["soma_proventos"] or 0.0,
        "soma_adiantamento": row["soma_adiantamento"] or 0.0,
        "soma_liquido": row["soma_liquido"] or 0.0
    }
