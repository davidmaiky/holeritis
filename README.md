# Sistema de Extração & Relatórios de Folha de Pagamento e Holerites

Sistema desenvolvido sob medida para **extração automatizada de dados de folhas de pagamento em PDF**, processamento contábil e geração de **relatórios gerenciais classificados por período**.

---

## 🚀 Funcionalidades

1. **Extração Inteligente de PDFs**:
   - Extrai automaticamente: **Período**, **Nome do Colaborador**, **Código**, **Cargo/Função**, **Salário Base**, **Proventos**, **Adiantamento Anterior**, **Descontos** e **Total Líquido**.
   - Trata continuidade de colaboradores divididos entre quebras de página.
   - Ignora seções de resumo corporativo ou guias de recolhimento GPS para não duplicar valores.

2. **Gestão Multi-Empresa & Separação por Razão Social**:
   - Identificação e extração precisa da **Razão Social** e **CNPJ** no cabeçalho do PDF.
   - **Chave de unicidade composta (Empresa + Período)**: você pode subir PDFs de empresas distintas para o mesmo mês/competência (ex: Agosto/2026 da Empresa A e da Empresa B) sem que um sobrescreva o outro.
   - Ao reenviar uma folha corrigida da mesma empresa, o sistema atualiza exclusivamente o registro daquela empresa e daquele período.
   - **Seletor de Razão Social no Painel**: permite alternar a visualização entre "Todas as Empresas (Visão Global)" ou focar em uma empresa específica.
   - **Abas Inteligentes**: exibem a Razão Social da empresa em destaque quando na visualização global.

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
holeritis/
  ├── modelo/
  │    └── folha-agosto-2026.pdf     # Arquivo modelo fornecido
  ├── data/
  │    └── holerites.db              # Banco de dados SQLite persistente
  ├── uploads/                       # Armazenamento temporário de PDFs enviados
  ├── parser.py                      # Mecanismo de extração regex & layout do PDF
  ├── database.py                    # Camada de persistência SQLite
  ├── server.py                      # Servidor Web & API RESTful (porta 8050)
  ├── seed.py                        # Script de pré-carga da folha modelo
  ├── requirements.txt               # Dependências do projeto (pdfplumber)
  ├── run.sh                         # Script de inicialização automática (macOS / Linux)
  ├── run.bat                        # Script de inicialização em 1 clique (Windows)
  ├── static/                        # Frontend da aplicação
  │    ├── index.html
  │    ├── style.css
  │    └── app.js
  └── README.md
```

---

## ⚡ Como Executar

### 🍎 No macOS (e Linux)

#### 1. Pré-requisitos
Certifique-se de ter o **Python 3.8+** instalado. Para verificar, abra o Terminal e execute:
```bash
python3 --version
```
> Caso não tenha o Python instalado, você pode instalá-lo via Homebrew: `brew install python`.

#### 2. Configurar o Ambiente Virtual e Dependências
No macOS (especialmente com Homebrew ou versões modernas do Python), é recomendado utilizar um ambiente virtual:

```bash
# 1. Entre na pasta do projeto (caso ainda não esteja nela)
cd holeritis-main

# 2. Crie o ambiente virtual
python3 -m venv venv

# 3. Ative o ambiente virtual
source venv/bin/activate

# 4. Instale as dependências
pip install -r requirements.txt
```

#### 3. (Opcional) Carregar Folha de Teste / Demonstração
Se quiser popular o banco com a folha de exemplo fornecida:
```bash
python3 seed.py
```

#### 4. Iniciar a Aplicação

- **Opção A: Via script de inicialização rápida (`run.sh`)**
  ```bash
  ./run.sh
  ```
  *(Ele detecta o ambiente virtual automaticamente, inicia o servidor e abre a página no seu navegador)*.

- **Opção B: Diretamente pelo terminal**
  ```bash
  python3 server.py 8050
  ```
  Em seguida, acesse no navegador: [http://localhost:8050](http://localhost:8050).

---

### 🪟 No Windows

#### Opção 1: Via script de 1 clique
1. Certifique-se de ter o Python instalado e o pacote `pdfplumber` (`pip install -r requirements.txt`).
2. Dê duplo clique no arquivo `run.bat`. O servidor será iniciado e abrirá automaticamente o navegador em `http://localhost:8050`.

#### Opção 2: Via terminal (Prompt de Comando ou PowerShell)
```bash
pip install -r requirements.txt
python server.py 8050
```
Em seguida, acesse no navegador: [http://localhost:8050](http://localhost:8050).

