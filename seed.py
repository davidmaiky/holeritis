import database
import parser

def run_seed():
    database.init_db()
    resumo, emps = parser.parse_folha_pdf("modelo/folha-agosto-2026.pdf")
    pid = database.salvar_relatorio(resumo, emps, "folha-agosto-2026.pdf")
    print(f"Relatório importado com sucesso! ID: {pid}")
    periodos = database.listar_periodos()
    print(f"Total de períodos no banco: {len(periodos)}")
    rel = database.obter_relatorio(pid)
    print(f"Período: {rel['periodo_texto']}, Funcionários: {len(rel['itens'])}")
    print(f"Total Proventos: R$ {rel['total_proventos']:,.2f}")
    print(f"Total Adiantamento: R$ {rel['total_adiantamento']:,.2f}")
    print(f"Total Líquido: R$ {rel['total_liquido']:,.2f}")

if __name__ == "__main__":
    run_seed()
