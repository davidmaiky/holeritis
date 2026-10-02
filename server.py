"""
Servidor Web e API RESTful para o Sistema de Gestão de Holerites e Folha de Pagamento
Zero dependências externas adicionais (usa biblioteca padrão do Python + pdfplumber para extração)
"""

import os
import sys
import json
import io
import cgi
import re
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import database
import parser

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class HoleriteRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _send_error(self, status_code, message):
        self._send_json(status_code, {"success": False, "error": message})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)

        # Rota de Períodos
        if path == "/api/periodos":
            try:
                periodos = database.listar_periodos()
                stats = database.estatisticas_gerais()
                self._send_json(200, {
                    "success": True,
                    "periodos": periodos,
                    "stats": stats
                })
            except Exception as e:
                self._send_error(500, f"Erro ao listar períodos: {str(e)}")
            return

        # Rota de Detalhes de um Período
        match_periodo = re.match(r"^/api/periodos/(\d+)$", path)
        if match_periodo:
            periodo_id = int(match_periodo.group(1))
            try:
                rel = database.obter_relatorio(periodo_id)
                if not rel:
                    self._send_error(404, "Período não encontrado")
                else:
                    self._send_json(200, {"success": True, "relatorio": rel})
            except Exception as e:
                self._send_error(500, f"Erro ao obter período: {str(e)}")
            return

        # Rota de Exportação CSV
        match_csv = re.match(r"^/api/export/csv/(\d+)$", path)
        if match_csv:
            periodo_id = int(match_csv.group(1))
            try:
                rel = database.obter_relatorio(periodo_id)
                if not rel:
                    self._send_error(404, "Período não encontrado")
                    return

                # Montar CSV em UTF-8 com BOM para Excel
                import csv
                output = io.StringIO()
                writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
                
                # Cabeçalhos requeridos pelo usuário
                writer.writerow(["Período", "Código", "Nome", "Função", "Salário Base (R$)", "Proventos (R$)", "Adiantamento Anterior (R$)", "Descontos (R$)", "Total Líquido (R$)"])
                
                for item in rel["itens"]:
                    writer.writerow([
                        rel["periodo_texto"],
                        item["codigo"],
                        item["nome"],
                        item["funcao"],
                        f"{item['salario']:.2f}".replace('.', ','),
                        f"{item['proventos']:.2f}".replace('.', ','),
                        f"{item['adiantamento_anterior']:.2f}".replace('.', ','),
                        f"{item['descontos']:.2f}".replace('.', ','),
                        f"{item['liquido']:.2f}".replace('.', ',')
                    ])
                
                # Linha de totais
                writer.writerow([])
                writer.writerow([
                    "TOTAIS",
                    "",
                    f"{len(rel['itens'])} funcionários",
                    "",
                    f"{rel['total_salario']:.2f}".replace('.', ','),
                    f"{rel['total_proventos']:.2f}".replace('.', ','),
                    f"{rel['total_adiantamento']:.2f}".replace('.', ','),
                    f"{rel['total_descontos']:.2f}".replace('.', ','),
                    f"{rel['total_liquido']:.2f}".replace('.', ',')
                ])

                content = "\ufeff" + output.getvalue()
                raw_bytes = content.encode("utf-8")

                safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', rel['mes_ano']) or f"periodo_{periodo_id}"
                filename = f"relatorio_folha_{safe_name}.csv"

                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(raw_bytes)))
                self.end_headers()
                self.wfile.write(raw_bytes)
            except Exception as e:
                self._send_error(500, f"Erro ao gerar CSV: {str(e)}")
            return

        # Servir index.html na raiz
        if path == "" or path == "/":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/upload":
            try:
                content_type = self.headers.get("Content-Type", "")
                content_length = int(self.headers.get("Content-Length", 0))

                if content_length == 0:
                    self._send_error(400, "Arquivo não enviado")
                    return

                # Processar multipart/form-data
                if "multipart/form-data" in content_type:
                    environ = {
                        "REQUEST_METHOD": "POST",
                        "CONTENT_TYPE": content_type,
                        "CONTENT_LENGTH": str(content_length),
                    }
                    form = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ=environ,
                        keep_blank_values=True
                    )

                    if "file" not in form:
                        self._send_error(400, "Campo 'file' não encontrado no envio")
                        return

                    fileitem = form["file"]
                    if isinstance(fileitem, list):
                        fileitem = fileitem[0]

                    if getattr(fileitem, "file", None) is None:
                        self._send_error(400, "Arquivo inválido ou não enviado")
                        return

                    raw_filename = getattr(fileitem, "filename", None) or "folha_upload.pdf"
                    filename = Path(raw_filename).name or "folha_upload.pdf"
                    file_bytes = fileitem.file.read()
                else:
                    # Receber binário direto
                    file_bytes = self.rfile.read(content_length)
                    filename = "folha_upload.pdf"

                # Salvar cópia local do arquivo enviado
                save_path = UPLOAD_DIR / filename
                with open(save_path, "wb") as f:
                    f.write(file_bytes)

                # Processar com o parser
                resumo, employees = parser.parse_folha_pdf(str(save_path))

                if not employees:
                    self._send_error(422, "Nenhum colaborador ou dado de folha identificado no PDF. Verifique se o formato do arquivo é compatível.")
                    return

                # Armazenar no banco de dados
                periodo_id = database.salvar_relatorio(resumo, employees, filename)
                relatorio_completo = database.obter_relatorio(periodo_id)

                self._send_json(201, {
                    "success": True,
                    "message": "Folha de pagamento processada e armazenada com sucesso!",
                    "periodo_id": periodo_id,
                    "relatorio": relatorio_completo
                })
            except Exception as e:
                import traceback
                traceback.print_exc()
                self._send_error(500, f"Erro ao processar PDF: {str(e)}")
            return

        self._send_error(404, "Rota POST não encontrada")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        match_del = re.match(r"^/api/periodos/(\d+)$", path)
        if match_del:
            periodo_id = int(match_del.group(1))
            try:
                database.excluir_periodo(periodo_id)
                self._send_json(200, {
                    "success": True,
                    "message": f"Período {periodo_id} excluído com sucesso"
                })
            except Exception as e:
                self._send_error(500, f"Erro ao excluir período: {str(e)}")
            return

        self._send_error(404, "Rota DELETE não encontrada")

def start_server(port=8050):
    database.init_db()
    
    # Se a base estiver vazia e o modelo existir, importar automaticamente
    periodos = database.listar_periodos()
    if not periodos:
        modelo_pdf = BASE_DIR / "modelo" / "folha-agosto-2026.pdf"
        if modelo_pdf.exists():
            print(f"Importando folha modelo inicial de {modelo_pdf}...")
            resumo, emps = parser.parse_folha_pdf(str(modelo_pdf))
            database.salvar_relatorio(resumo, emps, "folha-agosto-2026.pdf")
            print("Importação inicial concluída com sucesso.")

    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, HoleriteRequestHandler)
    print(f"\n========================================================")
    print(f"  SISTEMA DE GESTÃO DE FOLHA E HOLERITES INICIADO")
    print(f"  Acesse no navegador: http://localhost:{port}")
    print(f"========================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado pelo usuário.")
        httpd.server_close()

if __name__ == "__main__":
    port = 8050
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    start_server(port)
