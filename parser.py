"""
Módulo de Extração de Dados de Folha de Pagamento em PDF
Extrai: Período, Nome, Salário, Proventos, Adiantamento Anterior, Descontos e Total Líquido.
"""

import re
import os
import pdfplumber

def to_float(val_str):
    if not val_str:
        return 0.0
    if isinstance(val_str, (int, float)):
        return float(val_str)
    # Remove pontos de milhar e troca vírgula por ponto
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

def parse_folha_pdf(pdf_path_or_bytes):
    """
    Processa o PDF da folha de pagamento e extrai a lista de funcionários e os dados do período.
    Pode receber o caminho do arquivo ou um file-like object / bytes.
    """
    if isinstance(pdf_path_or_bytes, (str, os.PathLike)):
        pdf_ctx = pdfplumber.open(pdf_path_or_bytes)
    else:
        pdf_ctx = pdfplumber.open(pdf_path_or_bytes)

    periodo_texto = ""
    cleaned_lines = []
    empresa_info = {"razao_social": "", "cnpj": ""}

    with pdf_ctx as pdf:
        for page_idx, page in enumerate(pdf.pages):
            text = page.extract_text(layout=True) or ""
            
            # Detectar Razão Social / CNPJ se ainda não achou
            if not empresa_info["razao_social"]:
                m_rz = re.search(r'Raz[^\n:]+Social:\s*([^\n\r]+?)(?:\s+P[^\n:]+g:|\n|$)', text)
                if m_rz:
                    empresa_info["razao_social"] = m_rz.group(1).strip()
            if not empresa_info["cnpj"]:
                m_cnpj = re.search(r'CNPJ/CEI:\s*([\d\.\/\-]+)', text)
                if m_cnpj:
                    empresa_info["cnpj"] = m_cnpj.group(1).strip()

            # Detectar Período de pagamento
            if not periodo_texto:
                m_per = re.search(r'Per[^\n:]+de:\s*([0-9]{2}/[0-9]{2}/[0-9]{4}\s*a\s*[0-9]{2}/[0-9]{2}/[0-9]{4})', text)
                if m_per:
                    periodo_texto = m_per.group(1).strip()
                else:
                    # Alternativa: tentar competência no formato MM/AAAA
                    m_comp = re.search(r'([0-9]{2}/[0-9]{4})', text)
                    if m_comp:
                        periodo_texto = m_comp.group(1).strip()

            # Pular páginas de Resumo e GPS para não misturar os totais gerais com registros de empregados
            if "R E S U M O" in text or "G P S" in text:
                continue

            for line in text.split("\n"):
                # Remover cabeçalhos de página para viabilizar continuidade entre páginas
                if any(h in line for h in ["Folha de Pagamento", "Apelido:", "CNPJ/CEI:", "Endere", "Pg:", "Pág:"]):
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
            # Fallback se Função não estiver na mesma linha
            m_name_fallback = re.search(r"Nome:\s*([A-Z\s]+)", chunk)
            nome = m_name_fallback.group(1).strip() if m_name_fallback else "Não identificado"
            funcao = ""

        # Salário base contratual
        m_sal = re.search(r"Sal[^\s:]*:\s*([\d\.,]+)", chunk)
        salario = to_float(m_sal.group(1)) if m_sal else 0.0

        # Adiantamento Anterior (código 12 ou texto Adiantamento Anterior)
        # Pode aparecer como '12Adiantamento Anterior 1.241,52'
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

        employees.append({
            "codigo": codigo,
            "nome": nome,
            "funcao": funcao,
            "salario": salario,
            "proventos": proventos,
            "descontos": descontos,
            "adiantamento_anterior": adiantamento,
            "liquido": liquido
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
