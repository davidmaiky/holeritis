import re
import pdfplumber

def parse_folha_pdf(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        periodo = ''
        cleaned_lines = []
        
        # Inspecionar cabeçalho nas primeiras páginas
        for page_idx, page in enumerate(pdf.pages):
            text = page.extract_text(layout=True) or ''
            if not periodo:
                m_per = re.search(r'Per[^\n:]+de:\s*([0-9]{2}/[0-9]{2}/[0-9]{4}\s*a\s*[0-9]{2}/[0-9]{2}/[0-9]{4})', text)
                if m_per:
                    periodo = m_per.group(1).strip()
            
            # Se a página contiver R E S U M O ou G P S isoladamente como título de resumo geral, pulamos lançamentos de empregado
            if 'R E S U M O' in text or 'G P S' in text:
                continue
            
            for line in text.split('\n'):
                # Ignorar cabeçalhos repetidos entre páginas
                if any(h in line for h in ['Folha de Pagamento', 'Apelido:', 'CNPJ/CEI:', 'Endere', 'Pg:']):
                    continue
                if line.strip():
                    cleaned_lines.append(line)

    full_content = '\n'.join(cleaned_lines)
    
    # Dividir em blocos de funcionários baseado em 'Cód:' ou 'Cd:' ou 'Cd:'
    emp_chunks = re.split(r'\n(?=\s*C[^\s:]*:\s*\d+)', full_content)
    
    employees = []
    
    for chunk in emp_chunks:
        if not re.search(r'C[^\s:]*:\s*\d+', chunk):
            continue
        
        # Código do funcionário
        m_cod = re.search(r'C[^\s:]*:\s*(\d+)', chunk)
        codigo = m_cod.group(1).strip() if m_cod else ''

        # Nome
        m_name = re.search(r'Nome:\s*(.*?)\s+Fun[^\s:]*:', chunk)
        name = m_name.group(1).strip() if m_name else ''
        
        # Salário base
        m_sal = re.search(r'Sal[^\s:]*:\s*([\d\.,]+)', chunk)
        salario = m_sal.group(1).strip() if m_sal else '0,00'
        
        # Adiantamento Anterior
        m_adiant = re.search(r'Adiantamento\s*Anterior\s*([\d\.,]+)', chunk)
        adiantamento = m_adiant.group(1).strip() if m_adiant else '0,00'
        
        # Proventos, Descontos, Liquido
        m_tot = re.search(r'Proventos:\s*([\d\.,]+)\s+Descontos:\s*([\d\.,]+)\s+Liquido:\s*([\d\.,]+)', chunk)
        if m_tot:
            proventos = m_tot.group(1).strip()
            descontos = m_tot.group(2).strip()
            liquido = m_tot.group(3).strip()
        else:
            proventos = '0,00'
            descontos = '0,00'
            liquido = '0,00'
            
        employees.append({
            'codigo': codigo,
            'periodo': periodo,
            'nome': name,
            'salario': salario,
            'proventos': proventos,
            'descontos': descontos,
            'adiantamento_anterior': adiantamento,
            'liquido': liquido
        })

    return periodo, employees

if __name__ == '__main__':
    pdf_file = 'modelo/folha-agosto-2026.pdf'
    periodo, employees = parse_folha_pdf(pdf_file)
    print(f'Período extraído: {periodo}')
    print(f'Total de empregados encontrados: {len(employees)}\n')
    
    def to_float(val_str):
        if not val_str:
            return 0.0
        return float(val_str.replace('.', '').replace(',', '.'))
        
    for i, e in enumerate(employees, 1):
        print(f"{i:02d} | Cód {e['codigo']:<4} | {e['nome']:<35} | Sal: R$ {e['salario']:>9} | Prov: R$ {e['proventos']:>9} | Adiant: R$ {e['adiantamento_anterior']:>9} | Liq: R$ {e['liquido']:>9}")

    total_sal = sum(to_float(e['salario']) for e in employees)
    total_prov = sum(to_float(e['proventos']) for e in employees)
    total_adiant = sum(to_float(e['adiantamento_anterior']) for e in employees)
    total_desc = sum(to_float(e['descontos']) for e in employees)
    total_liq = sum(to_float(e['liquido']) for e in employees)

    print('\n================== TOTAIS EXTRAÍDOS ==================')
    print(f'Total Salários Base : R$ {total_sal:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f'Total Proventos     : R$ {total_prov:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f'Total Adiantamento  : R$ {total_adiant:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f'Total Descontos     : R$ {total_desc:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f'Total Líquido       : R$ {total_liq:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
    print('======================================================')
