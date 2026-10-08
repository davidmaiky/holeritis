# 🚀 Guia de Implantação no Easypanel

Este documento contém todas as instruções necessárias para publicar o **Sistema de Gestão de Holerites e Folha de Pagamento** em um servidor com [Easypanel](https://easypanel.io).

---

## 📋 Pré-requisitos

1. Um servidor VPS (Ubuntu/Debian) com o **Easypanel** instalado.
2. O código do projeto hospedado em um repositório Git (GitHub, GitLab, ou Git privado).
3. (Opcional) Um domínio ou subdomínio apontado para o IP do seu servidor (ex: `holerites.suaempresa.com.br`).

---

## 🛠️ Passo a Passo no Easypanel

### 1. Criar um Projeto
1. Acesse o painel web do seu **Easypanel**.
2. Clique em **+ New Project** (ou selecione um projeto existente).
3. Dê um nome, por exemplo: `rh-holerites`.

---

### 2. Adicionar o Serviço (App)
1. Dentro do projeto, clique em **+ Service** e selecione **App**.
2. Defina o nome do serviço (ex: `holeritis-app`).

---

### 3. Configurar a Fonte do Código (Source)
Na aba **Source**:
- **Source**: Selecione **GitHub** (ou Git).
- **Repository**: Selecione o seu repositório onde este código foi enviado.
- **Branch**: `main` (ou a branch padrão do seu projeto).
- **Build Type**: Selecione **Dockerfile**.
  - O Easypanel detectará automaticamente o arquivo `Dockerfile` na raiz do repositório.

---

### 4. Configurar Volumes Persistentes (Mounts) ⚠️ CRÍTICO
Como o sistema utiliza **SQLite** e armazena relatórios e PDFs gerados, **é essencial configurar volumes persistentes** para não perder dados ao reiniciar ou atualizar o container.

Na aba **Mounts / Volumes**, adicione dois volumes:

#### Volume 1 (Banco de Dados SQLite)
- **Type**: `Volume`
- **Name**: `holeritis-data`
- **Mount Path**: `/app/data`

#### Volume 2 (Arquivos e PDFs enviados)
- **Type**: `Volume`
- **Name**: `holeritis-uploads`
- **Mount Path**: `/app/uploads`

---

### 5. Configurar Domínio e Portas (Domains)
Na aba **Domains**:
1. Clique em **+ Add Domain**.
2. Preencha:
   - **Host**: Seu domínio (ex: `folha.meudominio.com`) ou deixe o domínio padrão gerado pelo Easypanel.
   - **Port**: `8050` *(porta interna da aplicação)*
   - **HTTPS**: Habilitado (o Easypanel gerencia o certificado Let's Encrypt automaticamente).

---

### 6. Variáveis de Ambiente (Environment)
Na aba **Environment**, as variáveis já possuem valores padrão configurados no `Dockerfile`, mas você pode reforçar se desejar:

| Variável | Valor Padrão | Descrição |
| :--- | :--- | :--- |
| `PORT` | `8050` | Porta em que o servidor web escuta |
| `HOST` | `0.0.0.0` | IP de escuta (obrigatório 0.0.0.0 para Docker) |
| `DATA_DIR` | `/app/data` | Diretório onde o arquivo `holerites.db` será salvo |
| `UPLOAD_DIR` | `/app/uploads` | Diretório onde os uploads de PDFs serão salvos |

---

### 7. Health Check (Verificação de Saúde)
Na aba **Advanced / Healthcheck**:
- **Path**: `/api/health`
- **Port**: `8050`
- O endpoint `/api/health` retorna `{"status": "ok", "service": "holeritis"}` com código HTTP 200.

---

### 8. Fazer o Deploy
1. Clique no botão **Deploy** no topo da página.
2. Acompanhe a aba **Deployments** até o status mudar para **Running / Green**.
3. Acesse a URL do seu domínio configurado!

---

## 💾 Backup dos Dados

Os dados do sistema ficam isolados nos volumes do Docker:
- Banco de dados: `/app/data/holerites.db`
- Arquivos enviados: `/app/uploads/`

Para fazer backup pelo servidor host via terminal SSH:
```bash
# Localização padrão dos volumes gerenciados pelo Docker no servidor
docker run --rm -v holeritis-data:/data -v $(pwd):/backup alpine tar czf /backup/holerites_db_backup.tar.gz /data
```

---

## 🧪 Teste Local com Docker Compose

Caso queira testar a imagem localmente antes de subir no servidor:

```bash
# Construir e iniciar os containers
docker compose up -d

# Ver logs
docker compose logs -f

# Acessar no navegador
http://localhost:8050
```
