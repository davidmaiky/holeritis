#!/usr/bin/env bash

# Script de inicialização para macOS / Linux
echo "========================================================"
echo "  INICIANDO O SISTEMA DE FOLHA DE PAGAMENTO"
echo "  Acesse: http://localhost:8050"
echo "========================================================"
echo ""

# Navega até o diretório do script
cd "$(dirname "$0")"

# Ativa venv se existir
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Abre o navegador no macOS ou Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1 && open "http://localhost:8050") &
elif command -v xdg-open > /dev/null; then
    (sleep 1 && xdg-open "http://localhost:8050") &
fi

# Executa o servidor Python
python3 server.py 8050
