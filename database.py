"""
Gerenciamento de Banco de Dados SQLite para Armazenamento e Consulta de Relatórios de Folha por Período
Armazena histórico, eventos detalhados (rubricas de crédito e débito) e bases de cálculo.
"""

import sqlite3
import os
import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
DB_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.environ.get("DB_PATH", DB_DIR / "holerites.db"))

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
            eventos TEXT,
            bases TEXT,
            dados_adicionais TEXT,
            FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE
        );
        """)

        # Migração automática de colunas para bancos existentes
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(relatorio_itens);")
        colunas_existentes = [row["name"] for row in cursor.fetchall()]
        if "eventos" not in colunas_existentes:
            conn.execute("ALTER TABLE relatorio_itens ADD COLUMN eventos TEXT;")
        if "bases" not in colunas_existentes:
            conn.execute("ALTER TABLE relatorio_itens ADD COLUMN bases TEXT;")
        if "dados_adicionais" not in colunas_existentes:
            conn.execute("ALTER TABLE relatorio_itens ADD COLUMN dados_adicionais TEXT;")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_itens_periodo ON relatorio_itens(periodo_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_periodos_mes_ano ON periodos(mes_ano);")
        
        # Inicialização do módulo de autenticação e usuários
        import auth
        auth.init_auth_db(conn)
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

        # Inserir cada item do funcionário com eventos e bases serializados
        for emp in employees:
            eventos_json = json.dumps(emp.get("eventos", []), ensure_ascii=False) if emp.get("eventos") is not None else None
            bases_json = json.dumps(emp.get("bases", {}), ensure_ascii=False) if emp.get("bases") is not None else None
            dados_adicionais_json = json.dumps(emp.get("dados_adicionais", {}), ensure_ascii=False) if emp.get("dados_adicionais") is not None else None

            cursor.execute("""
                INSERT INTO relatorio_itens (
                    periodo_id, codigo, nome, funcao, salario,
                    proventos, descontos, adiantamento_anterior, liquido,
                    eventos, bases, dados_adicionais
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                periodo_id,
                emp.get("codigo", ""),
                emp["nome"],
                emp.get("funcao", ""),
                emp["salario"],
                emp["proventos"],
                emp["descontos"],
                emp["adiantamento_anterior"],
                emp["liquido"],
                eventos_json,
                bases_json,
                dados_adicionais_json
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

def competencia_para_chave(mes_ano_str):
    """
    Converte competência 'MM/AAAA' para inteiro AAAA*100 + MM para ordenação e comparação cronológica.
    Ex: '08/2026' -> 202608
    """
    if not mes_ano_str:
        return 0
    parts = str(mes_ano_str).strip().split("/")
    if len(parts) == 2:
        try:
            mm = int(parts[0])
            aaaa = int(parts[1])
            return aaaa * 100 + mm
        except ValueError:
            pass
    return 0

def obter_filtros_disponiveis():
    """
    Retorna a lista de anos disponíveis, competências distintas ordenadas cronologicamente
    e empresas cadastradas para alimentar os filtros da interface.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT mes_ano 
        FROM periodos 
        WHERE mes_ano IS NOT NULL AND TRIM(mes_ano) != ''
    """)
    comps = [r["mes_ano"] for r in cursor.fetchall()]
    comps_sorted = sorted(comps, key=competencia_para_chave)

    anos = sorted(list(set(c.split("/")[1] for c in comps_sorted if "/" in c)), reverse=True)
    conn.close()

    return {
        "anos": anos,
        "competencias": comps_sorted
    }

def listar_periodos(empresa=None, de=None, ate=None, ano=None, preset=None):
    """
    Retorna a lista de períodos com filtros opcionais:
    - empresa: Razão Social da empresa
    - de: competência inicial (ex: '01/2026')
    - ate: competência final (ex: '08/2026')
    - ano: ano das competências (ex: '2026')
    - preset: 'last_12m', 'last_6m', 'last_3m', 'current_year'
    """
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            id, periodo_texto, mes_ano, empresa, cnpj,
            total_funcionarios, total_salario, total_proventos,
            total_adiantamento, total_descontos, total_liquido,
            nome_arquivo, criado_em
        FROM periodos
        WHERE 1=1
    """
    params = []

    if empresa and empresa.strip():
        query += " AND LOWER(TRIM(empresa)) = LOWER(TRIM(?))"
        params.append(empresa.strip())

    if ano and str(ano).strip():
        query += " AND (mes_ano LIKE ? OR periodo_texto LIKE ?)"
        params.append(f"%/{str(ano).strip()}")
        params.append(f"%/{str(ano).strip()}%")

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Filtros em memória baseados em chave cronológica de competência
    if de or ate:
        chave_de = competencia_para_chave(de) if de else 0
        chave_ate = competencia_para_chave(ate) if ate else 999999
        rows = [r for r in rows if chave_de <= competencia_para_chave(r.get("mes_ano")) <= chave_ate]

    if preset:
        # Ordenar cronologicamente para aplicar presets móveis
        sorted_chrono = sorted(rows, key=lambda r: competencia_para_chave(r.get("mes_ano")))
        if preset == "last_12m":
            rows = sorted_chrono[-12:]
        elif preset == "last_6m":
            rows = sorted_chrono[-6:]
        elif preset == "last_3m":
            rows = sorted_chrono[-3:]
        elif preset == "current_year":
            from datetime import datetime
            current_y = datetime.now().year
            rows = [r for r in rows if str(current_y) in (r.get("mes_ano") or "")]
        # Reordenar para retorno padrão do sistema (mais recentes primeiro)
        rows.sort(key=lambda r: r["id"], reverse=True)

    return rows

def obter_relatorio(periodo_id):
    """
    Obtém os dados consolidados do período e a lista detalhada de funcionários com eventos e bases.
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
            salario, proventos, descontos, adiantamento_anterior, liquido,
            eventos, bases, dados_adicionais
        FROM relatorio_itens
        WHERE periodo_id = ?
        ORDER BY nome ASC
    """, (periodo_id,))
    
    itens = []
    for row in cursor.fetchall():
        item = dict(row)
        if item.get("eventos"):
            try:
                item["eventos"] = json.loads(item["eventos"])
            except Exception:
                item["eventos"] = []
        else:
            item["eventos"] = []

        if item.get("bases"):
            try:
                item["bases"] = json.loads(item["bases"])
            except Exception:
                item["bases"] = {}
        else:
            item["bases"] = {}

        if item.get("dados_adicionais"):
            try:
                item["dados_adicionais"] = json.loads(item["dados_adicionais"])
            except Exception:
                item["dados_adicionais"] = {}
        else:
            item["dados_adicionais"] = {}

        itens.append(item)

    conn.close()

    periodo_info["itens"] = itens
    return periodo_info

def excluir_periodo(periodo_id):
    conn = get_connection()
    with conn:
        conn.execute("DELETE FROM periodos WHERE id = ?", (periodo_id,))
    conn.close()
    return True

def estatisticas_gerais(empresa=None, de=None, ate=None, ano=None):
    periodos = listar_periodos(empresa=empresa, de=de, ate=ate, ano=ano)
    
    total_periodos = len(periodos)
    soma_func = sum(p["total_funcionarios"] for p in periodos)
    soma_proventos = sum(p["total_proventos"] for p in periodos)
    soma_adiantamento = sum(p["total_adiantamento"] for p in periodos)
    soma_liquido = sum(p["total_liquido"] for p in periodos)
    soma_descontos = sum(p["total_descontos"] for p in periodos)

    return {
        "total_periodos": total_periodos,
        "soma_funcionarios": soma_func,
        "soma_proventos": soma_proventos,
        "soma_adiantamento": soma_adiantamento,
        "soma_descontos": soma_descontos,
        "soma_liquido": soma_liquido
    }

def obter_evolucao_12_meses(empresa=None, limite=12, de=None, ate=None, ano=None):
    """
    Agrupa e calcula a série histórica de evolução temporal (últimos 12 meses ou janela selecionada)
    com ênfase na comparação direta entre Total de Proventos, Total de Adiantamentos e Total Líquido.
    """
    periodos = listar_periodos(empresa=empresa, de=de, ate=ate, ano=ano)
    if not periodos:
        return {
            "labels": [],
            "periodos": [],
            "series": {
                "proventos": [],
                "adiantamento": [],
                "liquido": [],
                "descontos": [],
                "salarios": [],
                "colaboradores": []
            },
            "totais": {
                "total_proventos": 0.0,
                "media_proventos": 0.0,
                "total_adiantamento": 0.0,
                "media_adiantamento": 0.0,
                "total_liquido": 0.0,
                "media_liquido": 0.0,
                "total_descontos": 0.0,
                "pct_adiantamento_sobre_proventos": 0.0,
                "pct_liquido_sobre_proventos": 0.0,
                "mes_maior_folha": "",
                "mes_menor_folha": ""
            },
            "mes_a_mes": []
        }

    # Ordenar cronologicamente
    sorted_chrono = sorted(periodos, key=lambda r: competencia_para_chave(r.get("mes_ano")))

    # Se limite for especificado (ex: 12 meses)
    if limite and len(sorted_chrono) > limite:
        sorted_chrono = sorted_chrono[-limite:]

    labels = [p.get("mes_ano") or p.get("periodo_texto") for p in sorted_chrono]
    proventos = [round(p.get("total_proventos", 0.0), 2) for p in sorted_chrono]
    adiantamentos = [round(p.get("total_adiantamento", 0.0), 2) for p in sorted_chrono]
    liquidos = [round(p.get("total_liquido", 0.0), 2) for p in sorted_chrono]
    descontos = [round(p.get("total_descontos", 0.0), 2) for p in sorted_chrono]
    salarios = [round(p.get("total_salario", 0.0), 2) for p in sorted_chrono]
    colaboradores = [p.get("total_funcionarios", 0) for p in sorted_chrono]

    count = len(sorted_chrono)
    soma_prov = sum(proventos)
    soma_adiant = sum(adiantamentos)
    soma_liq = sum(liquidos)
    soma_desc = sum(descontos)

    media_prov = soma_prov / count if count > 0 else 0.0
    media_adiant = soma_adiant / count if count > 0 else 0.0
    media_liq = soma_liq / count if count > 0 else 0.0

    pct_adv = (soma_adiant / soma_prov * 100) if soma_prov > 0 else 0.0
    pct_liq = (soma_liq / soma_prov * 100) if soma_prov > 0 else 0.0

    # Maior e menor mês por proventos
    max_idx = proventos.index(max(proventos)) if proventos else -1
    min_idx = proventos.index(min(proventos)) if proventos else -1

    mes_maior = labels[max_idx] if max_idx >= 0 else ""
    mes_menor = labels[min_idx] if min_idx >= 0 else ""

    # Tabela analítica mês a mês com variações MoM
    mes_a_mes = []
    for i, p in enumerate(sorted_chrono):
        curr_prov = proventos[i]
        curr_adv = adiantamentos[i]
        curr_liq = liquidos[i]
        curr_desc = descontos[i]

        pct_adv_m = (curr_adv / curr_prov * 100) if curr_prov > 0 else 0.0
        pct_liq_m = (curr_liq / curr_prov * 100) if curr_prov > 0 else 0.0

        var_prov_mom = 0.0
        var_liq_mom = 0.0
        if i > 0 and proventos[i-1] > 0:
            var_prov_mom = ((curr_prov - proventos[i-1]) / proventos[i-1]) * 100
        if i > 0 and liquidos[i-1] > 0:
            var_liq_mom = ((curr_liq - liquidos[i-1]) / liquidos[i-1]) * 100

        mes_a_mes.append({
            "periodo_id": p.get("id"),
            "mes_ano": labels[i],
            "periodo_texto": p.get("periodo_texto", ""),
            "empresa": p.get("empresa", ""),
            "colaboradores": p.get("total_funcionarios", 0),
            "proventos": curr_prov,
            "adiantamento": curr_adv,
            "descontos": curr_desc,
            "liquido": curr_liq,
            "pct_adiantamento": round(pct_adv_m, 1),
            "pct_liquido": round(pct_liq_m, 1),
            "var_proventos_mom": round(var_prov_mom, 1),
            "var_liquido_mom": round(var_liq_mom, 1)
        })

    return {
        "labels": labels,
        "periodos": sorted_chrono,
        "series": {
            "proventos": proventos,
            "adiantamento": adiantamentos,
            "liquido": liquidos,
            "descontos": descontos,
            "salarios": salarios,
            "colaboradores": colaboradores
        },
        "totais": {
            "total_periodos": count,
            "total_proventos": round(soma_prov, 2),
            "media_proventos": round(media_prov, 2),
            "total_adiantamento": round(soma_adiant, 2),
            "media_adiantamento": round(media_adiant, 2),
            "total_liquido": round(soma_liq, 2),
            "media_liquido": round(media_liq, 2),
            "total_descontos": round(soma_desc, 2),
            "pct_adiantamento_sobre_proventos": round(pct_adv, 1),
            "pct_liquido_sobre_proventos": round(pct_liq, 1),
            "mes_maior_folha": mes_maior,
            "mes_menor_folha": mes_menor
        },
        "mes_a_mes": mes_a_mes
    }

def gerar_folhas_demo_12m(empresa_alvo=None):
    """
    Gera/completa um histórico de 12 meses contínuos se existirem lacunas,
    usando a base de funcionários reais existente com variações realistas (horas extras, comissões).
    Permite ao usuário visualizar imediatamente os gráficos de 12 meses completos.
    """
    periodos = listar_periodos()
    if not periodos:
        return False

    base_rel = None
    for p in periodos:
        if empresa_alvo and p.get("empresa") != empresa_alvo:
            continue
        rel = obter_relatorio(p["id"])
        if rel and len(rel.get("itens", [])) > 0:
            base_rel = rel
            break

    if not base_rel:
        base_rel = obter_relatorio(periodos[0]["id"])

    if not base_rel or not base_rel.get("itens"):
        return False

    empresa = base_rel.get("empresa", "PRIME PRO EXTREME COSMETICOS INC LTDA")
    cnpj = base_rel.get("cnpj", "")
    base_items = base_rel["itens"]

    meses_alvo = [
        ("01/2026", "01/01/2026 a 31/01/2026", 1.02),
        ("02/2026", "01/02/2026 a 28/02/2026", 1.08),
        ("03/2026", "01/03/2026 a 31/03/2026", 0.98),
        ("04/2026", "01/04/2026 a 30/04/2026", 1.00),
        ("05/2026", "01/05/2026 a 31/05/2026", 1.01),
        ("06/2026", "01/06/2026 a 30/06/2026", 1.03),
        ("07/2026", "01/07/2026 a 31/07/2026", 0.99),
        ("08/2026", "01/08/2026 a 31/08/2026", 1.02),
        ("09/2026", "01/09/2026 a 30/09/2026", 1.05),
        ("10/2026", "01/10/2026 a 31/10/2026", 1.04),
        ("11/2026", "01/11/2026 a 30/11/2026", 1.12),
        ("12/2026", "01/12/2026 a 31/12/2026", 1.25),
    ]

    import random
    random.seed(42)

    conn = get_connection()
    cursor = conn.cursor()

    novos_adicionados = 0
    for mes_ano, per_texto, fator in meses_alvo:
        cursor.execute("""
            SELECT id FROM periodos 
            WHERE mes_ano = ? AND LOWER(TRIM(empresa)) = LOWER(TRIM(?))
        """, (mes_ano, empresa))
        if cursor.fetchone():
            continue

        novos_emps = []
        for it in base_items:
            var_pct = random.uniform(0.96, 1.04) * fator
            sal = round(it["salario"], 2)
            prov = round(it["proventos"] * var_pct, 2)
            adiant = round(it["adiantamento_anterior"] * (1.0 if it["adiantamento_anterior"] > 0 else 0), 2)
            desc = round(it["descontos"] * var_pct, 2)
            liq = max(0.0, round(prov - desc, 2))

            # Replicar eventos proporcionalmente
            novos_eventos = []
            if it.get("eventos"):
                for ev in it["eventos"]:
                    fator_ev = 1.0 if str(ev.get("codigo")) == "12" else var_pct
                    novos_eventos.append({
                        "codigo": ev.get("codigo", ""),
                        "descricao": ev.get("descricao", ""),
                        "referencia": ev.get("referencia", ""),
                        "valor": round(ev["valor"] * fator_ev, 2),
                        "tipo": ev.get("tipo", "provento")
                    })

            # Replicar bases proporcionalmente
            novas_bases = {}
            if it.get("bases"):
                for k, v in it["bases"].items():
                    novas_bases[k] = round(v * var_pct, 2) if isinstance(v, (int, float)) else v

            novos_emps.append({
                "codigo": it["codigo"],
                "nome": it["nome"],
                "funcao": it["funcao"],
                "salario": sal,
                "proventos": prov,
                "descontos": desc,
                "adiantamento_anterior": adiant,
                "liquido": liq,
                "eventos": novos_eventos,
                "bases": novas_bases,
                "dados_adicionais": it.get("dados_adicionais", {})
            })

        resumo = {
            "periodo_texto": per_texto,
            "mes_ano": mes_ano,
            "empresa": empresa,
            "cnpj": cnpj,
            "total_funcionarios": len(novos_emps),
            "total_salario": sum(e["salario"] for e in novos_emps),
            "total_proventos": sum(e["proventos"] for e in novos_emps),
            "total_adiantamento": sum(e["adiantamento_anterior"] for e in novos_emps),
            "total_descontos": sum(e["descontos"] for e in novos_emps),
            "total_liquido": sum(e["liquido"] for e in novos_emps),
        }

        salvar_relatorio(resumo, novos_emps, f"folha_simulada_{mes_ano.replace('/', '_')}.pdf")
        novos_adicionados += 1

    conn.close()
    return novos_adicionados
