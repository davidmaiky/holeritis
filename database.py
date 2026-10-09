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

def obter_comparativo_recibo(periodo_id, item_id=None, codigo=None, nome=None):
    """
    Compara o recibo de um colaborador no período atual com o seu recibo no período imediatamente anterior da mesma empresa.
    Detecta e detalha:
    - Créditos/proventos novos ou removidos (ex: bonificação, férias, horas extras)
    - Débitos/descontos novos ou removidos (ex: plano de saúde ou vale transporte que estava no anterior e foi esquecido no atual)
    - Rubricas com valores ou referências alteradas
    - Variação nos totais de Salário Base, Proventos, Descontos, Adiantamento e Líquido
    - Alertas inteligentes de possíveis esquecimentos de descontos ou novidades na folha
    """
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Obter período atual
    cursor.execute("SELECT * FROM periodos WHERE id = ?", (periodo_id,))
    p_atual_row = cursor.fetchone()
    if not p_atual_row:
        conn.close()
        return None
    p_atual = dict(p_atual_row)

    # 2. Obter item do funcionário no período atual
    item_atual = None
    if item_id:
        cursor.execute("SELECT * FROM relatorio_itens WHERE id = ? AND periodo_id = ?", (item_id, periodo_id))
        r = cursor.fetchone()
        if r:
            item_atual = dict(r)

    if not item_atual and codigo:
        cursor.execute("SELECT * FROM relatorio_itens WHERE periodo_id = ? AND TRIM(codigo) = TRIM(?)", (periodo_id, str(codigo)))
        r = cursor.fetchone()
        if r:
            item_atual = dict(r)

    if not item_atual and nome:
        cursor.execute("SELECT * FROM relatorio_itens WHERE periodo_id = ? AND LOWER(TRIM(nome)) = LOWER(TRIM(?))", (periodo_id, str(nome)))
        r = cursor.fetchone()
        if r:
            item_atual = dict(r)

    if not item_atual:
        conn.close()
        return None

    # Parsear campos JSON do item atual
    for k in ["eventos", "bases", "dados_adicionais"]:
        if item_atual.get(k):
            try:
                item_atual[k] = json.loads(item_atual[k])
            except Exception:
                item_atual[k] = [] if k == "eventos" else {}
        else:
            item_atual[k] = [] if k == "eventos" else {}

    empresa_atual = (p_atual.get("empresa") or "").strip()
    cnpj_atual = (p_atual.get("cnpj") or "").strip()
    chave_atual = competencia_para_chave(p_atual.get("mes_ano"))
    emp_codigo = (item_atual.get("codigo") or "").strip()
    emp_nome = (item_atual.get("nome") or "").strip()

    # 3. Buscar períodos candidatos da mesma empresa
    cursor.execute("SELECT * FROM periodos WHERE id != ? ORDER BY id DESC", (periodo_id,))
    candidatos_periodos = [dict(r) for r in cursor.fetchall()]

    def mesma_empresa(p):
        if cnpj_atual and p.get("cnpj") and p.get("cnpj").strip() == cnpj_atual:
            return True
        if empresa_atual and p.get("empresa"):
            return p.get("empresa").strip().lower() == empresa_atual.lower()
        return False

    candidatos_periodos = [p for p in candidatos_periodos if mesma_empresa(p)]

    # Filtrar períodos que sejam cronologicamente anteriores
    anteriores = []
    for p in candidatos_periodos:
        chave_p = competencia_para_chave(p.get("mes_ano"))
        if chave_atual > 0 and chave_p > 0:
            if chave_p < chave_atual:
                anteriores.append((chave_p, p["id"], p))
        elif p["id"] < periodo_id:
            anteriores.append((chave_p, p["id"], p))

    # Ordenar pelos mais recentes anteriores primeiro (maior competência, maior ID)
    anteriores.sort(key=lambda x: (x[0], x[1]), reverse=True)

    # 4. Encontrar o recibo do funcionário no período anterior mais imediato
    item_anterior = None
    periodo_anterior = None

    for _, _, cand_p in anteriores:
        r_ant = None
        if emp_codigo:
            cursor.execute("""
                SELECT * FROM relatorio_itens 
                WHERE periodo_id = ? AND TRIM(codigo) = TRIM(?)
                LIMIT 1
            """, (cand_p["id"], emp_codigo))
            r_ant = cursor.fetchone()

        if not r_ant and emp_nome:
            cursor.execute("""
                SELECT * FROM relatorio_itens 
                WHERE periodo_id = ? AND LOWER(TRIM(nome)) = LOWER(TRIM(?))
                LIMIT 1
            """, (cand_p["id"], emp_nome))
            r_ant = cursor.fetchone()

        if r_ant:
            item_anterior = dict(r_ant)
            periodo_anterior = cand_p
            break

    conn.close()

    # Se não houver recibo anterior registrado
    if not item_anterior:
        return {
            "tem_recibo_anterior": False,
            "mensagem": "Este é o primeiro recibo registrado para este colaborador no sistema nesta empresa. Não há recibo anterior para comparação comparativa.",
            "funcionario": {
                "id": item_atual.get("id"),
                "codigo": emp_codigo,
                "nome": emp_nome,
                "funcao": item_atual.get("funcao", "")
            },
            "periodo_atual": {
                "id": p_atual.get("id"),
                "mes_ano": p_atual.get("mes_ano"),
                "periodo_texto": p_atual.get("periodo_texto"),
                "empresa": empresa_atual
            },
            "item_atual": item_atual
        }

    # Parsear campos JSON do item anterior
    for k in ["eventos", "bases", "dados_adicionais"]:
        if item_anterior.get(k):
            try:
                item_anterior[k] = json.loads(item_anterior[k])
            except Exception:
                item_anterior[k] = [] if k == "eventos" else {}
        else:
            item_anterior[k] = [] if k == "eventos" else {}

    # 5. Comparação Detalhada de Rubricas / Eventos
    evs_atual = item_atual.get("eventos") or []
    evs_ant = item_anterior.get("eventos") or []

    def chave_evento(e):
        cod = str(e.get("codigo", "")).strip()
        if cod and cod != "None":
            return f"cod_{cod}"
        desc = (e.get("descricao") or "").strip().lower()
        return f"desc_{desc}"

    map_ant = {chave_evento(e): e for e in evs_ant}
    map_atual = {chave_evento(e): e for e in evs_atual}
    chaves_todas = list(dict.fromkeys(list(map_ant.keys()) + list(map_atual.keys())))

    proventos_adicionados = []
    proventos_removidos = []
    proventos_alterados = []
    proventos_iguais = []

    descontos_adicionados = []
    descontos_removidos = []
    descontos_alterados = []
    descontos_iguais = []

    for k in chaves_todas:
        no_ant = map_ant.get(k)
        no_atual = map_atual.get(k)

        if no_ant and not no_atual:
            # Rubrica existia no mês anterior e NÃO está no atual (Removida)
            tipo = no_ant.get("tipo", "provento")
            diff_item = {
                "codigo": no_ant.get("codigo", ""),
                "descricao": no_ant.get("descricao", ""),
                "tipo": tipo,
                "referencia_anterior": no_ant.get("referencia", ""),
                "valor_anterior": round(no_ant.get("valor", 0.0), 2),
                "referencia_atual": "-",
                "valor_atual": 0.0,
                "diferenca": round(-no_ant.get("valor", 0.0), 2),
                "status": "removido"
            }
            if tipo == "provento":
                proventos_removidos.append(diff_item)
            else:
                descontos_removidos.append(diff_item)

        elif not no_ant and no_atual:
            # Rubrica NÃO existia no mês anterior e ESTÁ no atual (Nova / Adicionada)
            tipo = no_atual.get("tipo", "provento")
            diff_item = {
                "codigo": no_atual.get("codigo", ""),
                "descricao": no_atual.get("descricao", ""),
                "tipo": tipo,
                "referencia_anterior": "-",
                "valor_anterior": 0.0,
                "referencia_atual": no_atual.get("referencia", ""),
                "valor_atual": round(no_atual.get("valor", 0.0), 2),
                "diferenca": round(no_atual.get("valor", 0.0), 2),
                "status": "adicionado"
            }
            if tipo == "provento":
                proventos_adicionados.append(diff_item)
            else:
                descontos_adicionados.append(diff_item)

        else:
            # Presente em ambos
            tipo = no_atual.get("tipo", no_ant.get("tipo", "provento"))
            val_ant = round(no_ant.get("valor", 0.0), 2)
            val_at = round(no_atual.get("valor", 0.0), 2)
            ref_ant = str(no_ant.get("referencia", "")).strip()
            ref_at = str(no_atual.get("referencia", "")).strip()
            diff = round(val_at - val_ant, 2)
            mudou = (abs(diff) > 0.005) or (ref_ant != ref_at and ref_ant != "" and ref_at != "")

            diff_item = {
                "codigo": no_atual.get("codigo") or no_ant.get("codigo", ""),
                "descricao": no_atual.get("descricao") or no_ant.get("descricao", ""),
                "tipo": tipo,
                "referencia_anterior": ref_ant,
                "valor_anterior": val_ant,
                "referencia_atual": ref_at,
                "valor_atual": val_at,
                "diferenca": diff,
                "status": "alterado" if mudou else "igual"
            }
            if tipo == "provento":
                if mudou:
                    proventos_alterados.append(diff_item)
                else:
                    proventos_iguais.append(diff_item)
            else:
                if mudou:
                    descontos_alterados.append(diff_item)
                else:
                    descontos_iguais.append(diff_item)

    # 6. Totais comparativos
    def calc_tot(ant, at):
        ant = round(ant or 0.0, 2)
        at = round(at or 0.0, 2)
        diff = round(at - ant, 2)
        pct = round((diff / ant * 100), 2) if ant > 0 else 0.0
        return {"anterior": ant, "atual": at, "diferenca": diff, "percentual": pct}

    totais = {
        "salario": calc_tot(item_anterior.get("salario"), item_atual.get("salario")),
        "proventos": calc_tot(item_anterior.get("proventos"), item_atual.get("proventos")),
        "adiantamento": calc_tot(item_anterior.get("adiantamento_anterior"), item_atual.get("adiantamento_anterior")),
        "descontos": calc_tot(item_anterior.get("descontos"), item_atual.get("descontos")),
        "liquido": calc_tot(item_anterior.get("liquido"), item_atual.get("liquido"))
    }

    # 7. Geração de Alertas e Auditoria Sintética
    alertas = []

    # A) CRÍTICO: Débito / Desconto que estava no anterior e sumiu no atual (Ex: Plano de Saúde esquecido!)
    if descontos_removidos:
        for d in descontos_removidos:
            desc_upper = d["descricao"].upper()
            palavras_criticas = [
                "SAUDE", "SAÚDE", "MEDIC", "MÉDIC", "ODONTO", "CONVENIO", "CONVÊNIO", 
                "SEGURO", "VALE", "VT", "TRANSPORTE", "EMPRESTIMO", "EMPRÉSTIMO", 
                "PENSAO", "PENSÃO", "SINDICATO", "FARMACIA", "FARMÁCIA", "ALIMENTA"
            ]
            eh_critico = any(p in desc_upper for p in palavras_criticas)
            if eh_critico:
                alertas.append({
                    "tipo": "warning",
                    "badge": "⚠️ POSSÍVEL ESQUECIMENTO",
                    "titulo": f"Desconto '{d['descricao']}' ausente neste recibo",
                    "mensagem": f"O colaborador possuía o desconto de R$ {d['valor_anterior']:.2f} ({d['descricao']}) no recibo anterior ({periodo_anterior.get('mes_ano')}), mas ele NÃO consta no recibo atual ({p_atual.get('mes_ano')}). Verifique se foi esquecido de ser lançado ou se a cessação foi intencional."
                })

        outros_desc = [
            d for d in descontos_removidos 
            if not any(p in d["descricao"].upper() for p in [
                "SAUDE", "SAÚDE", "MEDIC", "MÉDIC", "ODONTO", "CONVENIO", "CONVÊNIO", 
                "SEGURO", "VALE", "VT", "TRANSPORTE", "EMPRESTIMO", "EMPRÉSTIMO", 
                "PENSAO", "PENSÃO", "SINDICATO", "FARMACIA", "FARMÁCIA", "ALIMENTA"
            ])
        ]
        if outros_desc:
            nomes = ", ".join(f"'{d['descricao']}' (R$ {d['valor_anterior']:.2f})" for d in outros_desc)
            alertas.append({
                "tipo": "warning",
                "badge": "DÉBITO(S) REMOVIDO(S)",
                "titulo": "Desconto(s) anterior(es) não repetido(s)",
                "mensagem": f"Rubricas de desconto presentes em {periodo_anterior.get('mes_ano')} que não constam neste mês: {nomes}."
            })

    # B) Novos Créditos / Proventos adicionados
    if proventos_adicionados:
        for p in proventos_adicionados:
            desc_upper = p["descricao"].upper()
            if any(w in desc_upper for w in ["FERIA", "FÉRIA", "1/3"]):
                badge_lbl = "🏖️ FÉRIAS CREDITADAS"
            elif any(w in desc_upper for w in ["BONIF", "GRATIF", "PREMIO", "PRÊMIO", "COMIS"]):
                badge_lbl = "⭐ BONIFICAÇÃO / PRÊMIO"
            elif any(w in desc_upper for w in ["HORA EXTRA", "EXTRA", "HE"]):
                badge_lbl = "⏱️ HORAS EXTRAS"
            elif any(w in desc_upper for w in ["13", "DÉCIMO", "DECIMO"]):
                badge_lbl = "🎁 13º SALÁRIO"
            else:
                badge_lbl = "✨ NOVO CRÉDITO"

            alertas.append({
                "tipo": "success",
                "badge": badge_lbl,
                "titulo": f"Novo Provento: {p['descricao']}",
                "mensagem": f"Foi adicionado neste recibo o provento '{p['descricao']}' no valor de R$ {p['valor_atual']:.2f}."
            })

    # C) Novos Descontos adicionados
    if descontos_adicionados:
        for d in descontos_adicionados:
            alertas.append({
                "tipo": "danger",
                "badge": "🛑 NOVO DÉBITO",
                "titulo": f"Novo Desconto: {d['descricao']}",
                "mensagem": f"Foi incluído neste recibo um novo desconto de R$ {d['valor_atual']:.2f} ({d['descricao']})."
            })

    # D) Proventos que cessaram
    if proventos_removidos:
        nomes = ", ".join(f"'{p['descricao']}' (R$ {p['valor_anterior']:.2f})" for p in proventos_removidos)
        alertas.append({
            "tipo": "info",
            "badge": "ℹ️ CRÉDITO CESSADO",
            "titulo": "Provento(s) do mês anterior ausente(s)",
            "mensagem": f"Não se repetiram neste mês os seguintes créditos de {periodo_anterior.get('mes_ano')}: {nomes}."
        })

    # E) Alteração no Salário Base
    if abs(totais["salario"]["diferenca"]) > 0.01:
        sinal = "+" if totais["salario"]["diferenca"] > 0 else ""
        alertas.append({
            "tipo": "primary",
            "badge": "💼 SALÁRIO BASE ALTERADO",
            "titulo": "Alteração no Salário Contratual",
            "mensagem": f"Salário base alterado de R$ {totais['salario']['anterior']:.2f} para R$ {totais['salario']['atual']:.2f} ({sinal}R$ {totais['salario']['diferenca']:.2f} / {sinal}{totais['salario']['percentual']:.1f}%)."
        })

    # F) Variação Líquida expressiva
    if abs(totais["liquido"]["diferenca"]) > 0.01:
        sinal = "+" if totais["liquido"]["diferenca"] > 0 else ""
        alertas.append({
            "tipo": "info",
            "badge": "💵 LÍQUIDO A RECEBER",
            "titulo": "Variação no Valor Líquido",
            "mensagem": f"Valor líquido a receber variou de R$ {totais['liquido']['anterior']:.2f} para R$ {totais['liquido']['atual']:.2f} ({sinal}R$ {totais['liquido']['diferenca']:.2f} / {sinal}{totais['liquido']['percentual']:.1f}%)."
        })

    total_mudancas = (
        len(proventos_adicionados) + len(proventos_removidos) + len(proventos_alterados) +
        len(descontos_adicionados) + len(descontos_removidos) + len(descontos_alterados)
    )

    if total_mudancas == 0 and abs(totais["liquido"]["diferenca"]) < 0.01:
        alertas.append({
            "tipo": "success",
            "badge": "✅ RECIBOS IDÊNTICOS",
            "titulo": "Sem alterações na composição",
            "mensagem": f"Todos os créditos, débitos e valores contratuais são exatamente iguais aos de {periodo_anterior.get('mes_ano')}."
        })

    return {
        "tem_recibo_anterior": True,
        "funcionario": {
            "id": item_atual.get("id"),
            "codigo": emp_codigo,
            "nome": emp_nome,
            "funcao": item_atual.get("funcao", "")
        },
        "periodo_atual": {
            "id": p_atual.get("id"),
            "mes_ano": p_atual.get("mes_ano"),
            "periodo_texto": p_atual.get("periodo_texto"),
            "empresa": empresa_atual
        },
        "periodo_anterior": {
            "id": periodo_anterior.get("id"),
            "mes_ano": periodo_anterior.get("mes_ano"),
            "periodo_texto": periodo_anterior.get("periodo_texto"),
            "empresa": periodo_anterior.get("empresa")
        },
        "totais": totais,
        "total_mudancas": total_mudancas,
        "alertas": alertas,
        "proventos": {
            "adicionados": proventos_adicionados,
            "removidos": proventos_removidos,
            "alterados": proventos_alterados,
            "iguais": proventos_iguais
        },
        "descontos": {
            "adicionados": descontos_adicionados,
            "removidos": descontos_removidos,
            "alterados": descontos_alterados,
            "iguais": descontos_iguais
        },
        "item_atual": item_atual,
        "item_anterior": item_anterior
    }

