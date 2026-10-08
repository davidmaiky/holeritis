FROM python:3.11-slim

# Evita criação de arquivos .pyc e força flush imediato dos logs no stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8050 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/uploads

WORKDIR /app

# Instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código-fonte e arquivos estáticos
COPY . .

# Cria diretórios de persistência
RUN mkdir -p /app/data /app/uploads

# Declara volumes para persistência no Easypanel
VOLUME ["/app/data", "/app/uploads"]

# Porta interna exposta
EXPOSE 8050

# Verificação de saúde da aplicação
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8050/api/health')" || exit 1

# Comando de inicialização
CMD ["python", "server.py"]
