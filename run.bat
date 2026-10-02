@echo off
title Sistema de Relatorios de Folha de Pagamento & Holerites
echo ========================================================
echo   INICIANDO O SISTEMA DE FOLHA DE PAGAMENTO
echo   Acesse: http://localhost:8050
echo ========================================================
echo.
start http://localhost:8050
python server.py 8050
pause
