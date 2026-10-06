"""
Módulo de Extração de Dados de Folha de Pagamento em PDF
Extrai: Período, Nome, Salário, Proventos, Adiantamento Anterior, Descontos, Total Líquido,
Eventos Detalhados (Créditos / Proventos e Débitos / Descontos) e Bases de Cálculo.
"""

import re
import os
import pdfplumber

def to_float(val_str):
    if not val_str:
        return 0.0
    if isinstance(val_str, (int, float)):
        return float(val_str)
    clean = re.sub(r'[^\d,.-]', '', str(val_str).strip())
    clean = clean.replace('.', '').replace(',', '.')
    try:
        return float(clean)
    except ValueError:
        return 0.0

def format_currency(val):
    if val is None:
        val = 0.0
    return f"R$ {val:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

def split_codigo_descricao(text):
    text = text.strip()
    # Casos especiais onde a descrição começa com números como '1/3' ou '13º':
    m = re.match(r'^(\d+)(1/3\s*.*)$', text)
    if m:
        return m.group(1), m.group(2).strip()
    m = re.match(r'^(\d+)(13[ºoªa]\s*.*)$', text, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2).strip()
    m = re.match(r'^(\d+)\s*(.*)$', text)
    if m:
        return m.group(1), m.group(2).strip()
    return '', text

def parse_rubrica_item(item_str, tipo):
    item_str = item_str.strip()
    if not item_str:
        return None
    # Valor é o último número formatado em moeda (ex: 3.053,74 ou 470,81 ou 0,00)
    m_val = re.search(r'((?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}))\s*$', item_str)
    if not m_val:
        return None
    valor_str = m_val.group(1)
    valor = to_float(valor_str)
    before_val = item_str[:m_val.start()].strip()

    # Verificar se há referência logo antes do valor (ex: 30,50 ou 12,00 ou 6,00)
    m_ref = re.search(r'((?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}))\s*$', before_val)
    referencia = ''
    if m_ref:
        referencia = m_ref.group(1)
        cod_desc = before_val[:m_ref.start()].strip()
    else:
        cod_desc = before_val

    codigo, descricao = split_codigo_descricao(cod_desc)
    return {
        'codigo': codigo,
        'descricao': descricao,
        'referencia': referencia,
        'valor': valor,
        'tipo': tipo
    }

def parse_folha_pdf(pdf_path_or_bytes):
    """
    Processa o PDF da folha de pagamento e extrai a lista de funcionários e os dados do período,
    incluindo todas as rubricas detalhadas (créditos/proventos e débitos/descontos) e bases de cálculo.
    """
    if isinstance(pdf_path_or_bytes, (bytes, bytearray)):
        import io
        pdf_ctx = pdfplumber.open(io.BytesIO(pdf_path_or_bytes))
    else:
        pdf_ctx = pdfplumber.open(pdf_path_or_bytes)

    periodo_texto = ""
    cleaned_lines = []
    empresa_info = {"razao_social": "", "cnpj": ""}

    with pdf_ctx as pdf:
        for page_idx, page in enumerate(pdf.pages):
            try:
                text = page.extract_text(layout=True) or ""
            except Exception:
                text = page.extract_text() or ""
            
            # Detectar Razão Social / CNPJ se ainda não achou
            if not empresa_info["razao_social"]:
                m_rz = re.search(r'Raz[^\n:]*Social:\s*(.*?)(?:\s+P[^\n\s:]*g:\s*\d+|\s{2,}\S+:\s*\d+|\r?\n|$)', text, re.IGNORECASE)
                if m_rz and m_rz.group(1).strip():
                    empresa_info["razao_social"] = m_rz.group(1).strip()
                else:
                    try:
                        raw_t = page.extract_text() or ""
                        m_rz_raw = re.search(r'Raz[^\n:]*Social:\s*(.*?)(?:\s+P[^\n\s:]*g:|\r?\n|$)', raw_t, re.IGNORECASE)
                        if m_rz_raw and m_rz_raw.group(1).strip():
                            empresa_info["razao_social"] = m_rz_raw.group(1).strip()
                    except Exception:
                        pass

            if not empresa_info["cnpj"]:
                m_cnpj = re.search(r'CNPJ(?:/CEI)?:\s*([\d\.\/\-]+)', text)
                if m_cnpj and m_cnpj.group(1).strip():
                    empresa_info["cnpj"] = m_cnpj.group(1).strip()

            # Detectar Período de pagamento
            if not periodo_texto:
                m_per = re.search(r'Per[^\n:]+de:\s*([0-9]{2}/[0-9]{2}/[0-9]{4}\s*a\s*[0-9]{2}/[0-9]{2}/[0-9]{4})', text)
                if m_per:
                    periodo_texto = m_per.group(1).strip()
                else:
                    m_comp = re.search(r'([0-9]{2}/[0-9]{4})', text)
                    if m_comp:
                        periodo_texto = m_comp.group(1).strip()

            # Pular páginas de Resumo e GPS para não misturar os totais gerais com registros de empregados
            if re.search(r'\bR\s*E\s*S\s*U\s*M\s*O\b', text, re.IGNORECASE) or re.search(r'\bG\s*P\s*S\b', text, re.IGNORECASE):
                continue

            for line in text.split("\n"):
                if any(h in line for h in ["Folha de Pagamento", "Apelido:", "CNPJ/CEI:", "Endere", "Pg:", "Pág:"]):
                    continue
                if re.match(r"^\s*\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}", line.strip()):
                    continue
                if line.strip():
                    cleaned_lines.append(line)

    full_content = "\n".join(cleaned_lines)

    # Dividir blocos de cada empregado identificados por Cód: ou Cd:
    emp_chunks = re.split(r"\n(?=\s*C[^\s:]*:\s*\d+)", full_content)

    employees = []

    for chunk in emp_chunks:
        if not re.search(r"C[^\s:]*:\s*\d+", chunk):
            continue

        # Código do funcionário
        m_cod = re.search(r"C[^\s:]*:\s*(\d+)", chunk)
        codigo = m_cod.group(1).strip() if m_cod else ""

        # Nome e Cargo/Função
        m_name = re.search(r"Nome:\s*(.*?)\s+Fun[^\s:]*:\s*([^\n\r]+?)(?:\s+Dep\.|\n|$)", chunk)
        if m_name:
            nome = m_name.group(1).strip()
            funcao = m_name.group(2).strip()
        else:
            m_name_fallback = re.search(r"Nome:\s*([A-Z\s]+)", chunk)
            nome = m_name_fallback.group(1).strip() if m_name_fallback else "Não identificado"
            funcao = ""

        # Salário base contratual
        m_sal = re.search(r"Sal[^\s:]*:\s*([\d\.,]+)", chunk)
        salario = to_float(m_sal.group(1)) if m_sal else 0.0

        # Adiantamento Anterior
        m_adiant = re.search(r"Adiantamento\s*Anterior\s*([\d\.,]+)", chunk)
        adiantamento = to_float(m_adiant.group(1)) if m_adiant else 0.0

        # Totais do funcionário: Proventos, Descontos, Liquido
        m_tot = re.search(r"Proventos:\s*([\d\.,]+)\s+Descontos:\s*([\d\.,]+)\s+Liquido:\s*([\d\.,]+)", chunk)
        if m_tot:
            proventos = to_float(m_tot.group(1))
            descontos = to_float(m_tot.group(2))
            liquido = to_float(m_tot.group(3))
        else:
            proventos = 0.0
            descontos = 0.0
            liquido = 0.0

        # Dados cadastrais adicionais
        m_adm = re.search(r"Admiss[^\s:]*:\s*([0-9]{2}/[0-9]{2}/[0-9]{4})", chunk)
        admissao = m_adm.group(1) if m_adm else ""

        m_sit = re.search(r"Situa[^\s:]*:\s*(.*?)(?:\s+Data:|\s+Ocorr[^\s:]*:|\s+Sal[^\s:]*:|$)", chunk)
        situacao = m_sit.group(1).strip() if m_sit else ""

        m_dep = re.search(r"Dep\.\s*IR:\s*(\d+)", chunk)
        dependentes_ir = int(m_dep.group(1)) if m_dep else 0

        # Extração das Bases de Cálculo
        m_inss_emp = re.search(r"Base INSS Empresa:\s*([\d\.,]+)", chunk)
        m_inss_func = re.search(r"Base INSS Funcion[^\s:]*:\s*([\d\.,]+)", chunk)
        m_inss_13 = re.search(r"Base INSS Func\.\s*13[^\s:]*:\s*([\d\.,]+)", chunk)
        m_fgts_base = re.search(r"Base F\.G\.T\.S\.:\s*([\d\.,]+)", chunk)
        m_fgts_13 = re.search(r"Base F\.G\.T\.S\.\s*13[^\s:]*:\s*([\d\.,]+)", chunk)
        m_fgts_val = re.search(r"(?<!Base )F\.G\.T\.S\.:\s*([\d\.,]+)", chunk)
        m_irrf_base = re.search(r"Base I\.R\.R\.F\.:\s*([\d\.,]+)", chunk)
        m_deducoes = re.search(r"Dedu[^\s:]*:\s*([\d\.,]+)", chunk)

        bases = {
            "base_inss_empresa": to_float(m_inss_emp.group(1)) if m_inss_emp else 0.0,
            "base_inss_funcionario": to_float(m_inss_func.group(1)) if m_inss_func else 0.0,
            "base_inss_13": to_float(m_inss_13.group(1)) if m_inss_13 else 0.0,
            "base_fgts": to_float(m_fgts_base.group(1)) if m_fgts_base else 0.0,
            "base_fgts_13": to_float(m_fgts_13.group(1)) if m_fgts_13 else 0.0,
            "valor_fgts": to_float(m_fgts_val.group(1)) if m_fgts_val else 0.0,
            "base_irrf": to_float(m_irrf_base.group(1)) if m_irrf_base else 0.0,
            "deducoes_irrf": to_float(m_deducoes.group(1)) if m_deducoes else 0.0,
        }

        # Extração de Rubricas / Eventos (Proventos e Descontos)
        eventos = []
        lines = chunk.split("\n")
        in_rubricas = False

        for l in lines:
            if "Admissão:" in l or "Admissao:" in l:
                in_rubricas = True
                continue
            if "Base INSS" in l or "Proventos:" in l:
                in_rubricas = False
                continue
            if in_rubricas and l.strip():
                raw = l.rstrip()
                if len(raw) > 35 and raw[:35].strip() == "":
                    # Apenas coluna da direita (desconto)
                    esq = ""
                    dir_ = raw.strip()
                else:
                    # Dividir coluna esquerda e direita usando a divisa entre valor e código
                    m = list(re.finditer(r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d+[A-Za-zÀ-ÿ])", raw))
                    split_pos = None
                    for match in m:
                        if 30 <= match.start(2) <= 65:
                            split_pos = match.start(2)
                            break
                    if split_pos is not None:
                        esq = raw[:split_pos].strip()
                        dir_ = raw[split_pos:].strip()
                    else:
                        esq = raw.strip()
                        dir_ = ""

                if esq:
                    item_esq = parse_rubrica_item(esq, "provento")
                    if item_esq:
                        eventos.append(item_esq)
                if dir_:
                    item_dir = parse_rubrica_item(dir_, "desconto")
                    if item_dir:
                        eventos.append(item_dir)

        # Se não foram extraídos eventos pelo layout, mas temos totais consolidados,
        # gerar eventos padrão mínimos para manter a integridade visual
        if not eventos and (proventos > 0 or descontos > 0):
            if proventos > 0:
                eventos.append({
                    "codigo": "1",
                    "descricao": "Salário / Proventos",
                    "referencia": "30,00",
                    "valor": proventos,
                    "tipo": "provento"
                })
            if adiantamento > 0:
                eventos.append({
                    "codigo": "12",
                    "descricao": "Adiantamento Anterior",
                    "referencia": "",
                    "valor": adiantamento,
                    "tipo": "desconto"
                })
            if descontos > adiantamento:
                eventos.append({
                    "codigo": "11",
                    "descricao": "Descontos Diversos",
                    "referencia": "",
                    "valor": round(descontos - adiantamento, 2),
                    "tipo": "desconto"
                })

        employees.append({
            "codigo": codigo,
            "nome": nome,
            "funcao": funcao,
            "salario": salario,
            "proventos": proventos,
            "descontos": descontos,
            "adiantamento_anterior": adiantamento,
            "liquido": liquido,
            "eventos": eventos,
            "bases": bases,
            "dados_adicionais": {
                "admissao": admissao,
                "situacao": situacao,
                "dependentes_ir": dependentes_ir
            }
        })

    # Gerar nome amigável do período (Ex: '08/2026' a partir de '01/08/2026 a 31/08/2026')
    mes_ano = ""
    m_mes_ano = re.search(r"[0-9]{2}/([0-9]{2})/([0-9]{4})", periodo_texto)
    if m_mes_ano:
        mes_ano = f"{m_mes_ano.group(1)}/{m_mes_ano.group(2)}"
    elif periodo_texto:
        mes_ano = periodo_texto

    resumo = {
        "periodo_texto": periodo_texto or "Período não identificado",
        "mes_ano": mes_ano,
        "empresa": empresa_info.get("razao_social") or "Empresa",
        "cnpj": empresa_info.get("cnpj") or "",
        "total_funcionarios": len(employees),
        "total_salario": sum(e["salario"] for e in employees),
        "total_proventos": sum(e["proventos"] for e in employees),
        "total_adiantamento": sum(e["adiantamento_anterior"] for e in employees),
        "total_descontos": sum(e["descontos"] for e in employees),
        "total_liquido": sum(e["liquido"] for e in employees),
    }

    return resumo, employees
