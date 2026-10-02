# Sistema de Extração & Relatórios de Folha de Pagamento e Holerites

Sistema desenvolvido sob medida para **extração automatizada de dados de folhas de pagamento em PDF**, processamento contábil e geração de **relatórios gerenciais classificados por período**.

---

## 🚀 Funcionalidades

1. **Extração Inteligente de PDFs**:
   - Extrai automaticamente: **Período**, **Nome do Colaborador**, **Código**, **Cargo/Função**, **Salário Base**, **Proventos**, **Adiantamento Anterior**, **Descontos** e **Total Líquido**.
   - Trata continuidade de colaboradores divididos entre quebras de página.
   - Ignora seções de resumo corporativo ou guias de recolhimento GPS para não duplicar valores.

2. **Armazenamento Classificado por Período**:
   - Banco de dados relacional **SQLite** (`data/holerites.db`) com integridade referencial.
   - Histórico permanente de períodos importados (ex: `08/2026`, `09/2026`, etc.).
   - Suporte a múltiplos períodos simultâneos com navegação instantânea em abas.

3. **Dashboard & Relatórios Gerenciais**:
   - **Indicadores Chave (6 KPIs)**: Total de Colaboradores, Soma de Salários Base, Total de Proventos, Total de Adiantamento Anterior, Total de Descontos e Total Líquido a Pagar.
   - **Filtros Dinâmicos**: Busca por nome/código, filtro específico com/sem adiantamento anterior, e ordenação multicritério (incluindo por Descontos).
   - **Tabela Estruturada & Sticky Header**: Cabeçalho fixo durante a rolagem, remoção de redundância da coluna período e alinhamento contábil (`Proventos - Adiantamento - Descontos = Líquido`).
   - **Espelho de Holerite Individual (Modal)**: Visualização detalhada do contracheque de cada colaborador com 1 clique e botão para emissão de **Recibo Individual**.
   - **Visualizações Gráficas com Abas**:
     - *Análise do Período Atual*: Composição financeira (Doughnut) e Ranking dos Maiores Proventos/Líquidos (Barras Horizontais).
     - *Evolução Histórica Multiperíodos*: Trajetória financeira cronológica (Proventos, Descontos, Adiantamento e Líquido) e evolução do quadro de colaboradores (Headcount) com média salarial.

4. **Exportação & Impressão Corporativa**:
   - **Excel (.xlsx)**: Gera planilha Excel formatada com colunas ajustadas e totais consolidados.
   - **CSV**: Download direto em UTF-8 com BOM compatível com Excel.
   - **Impressão / PDF A4 Otimizada**: Cabeçalho de impressão com dados corporativos, repetição de `<thead>` entre páginas, quebra limpa de linhas sem cortar colaboradores ao meio, rodapé com data/hora e campos de assinatura para RH e Contabilidade.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: Python 3 (Biblioteca padrão `http.server`, `sqlite3`, `re`, `json`)
- **Parser PDF**: `pdfplumber` / `pypdf`
- **Frontend**: HTML5 Semântico, Vanilla CSS (Design Executivo com Tema Escuro/Claro e Glassmorphism), Javascript ES6+
- **Bibliotecas Web**: SheetJS (XLSX) e Chart.js

---

## 📁 Estrutura de Arquivos

```
d:\DEV\holeritis/
  ├── modelo/
  │    └── folha-agosto-2026.pdf     # Arquivo modelo fornecido
  ├── data/
  │    └── holerites.db              # Banco de dados SQLite persistente
  ├── uploads/                       # Armazenamento temporário de PDFs enviados
  ├── parser.py                      # Mecanismo de extração regex & layout do PDF
  ├── database.py                    # Camada de persistência SQLite
  ├── server.py                      # Servidor Web & API RESTful (porta 8050)
  ├── seed.py                        # Script de pré-carga da folha modelo
  ├── run.bat                        # Script de inicialização em 1 clique
  ├── static/                        # Frontend da aplicação
  │    ├── index.html
  │    ├── style.css
  │    └── app.js
  └── README.md
```

---

## ⚡ Como Executar

### Opção 1: Via script de 1 clique
Basta dar duplo clique no arquivo `run.bat`. O servidor será iniciado e abrirá automaticamente o navegador em `http://localhost:8050`.

### Opção 2: Via terminal
```bash
python server.py 8050
```
Em seguida, acesse no navegador: `http://localhost:8050`
