/**
 * Lógica do Sistema de Gestão de Folha de Pagamento & Holerites
 * Responsável por: Comunicação com a API, Uploads, Filtros, Gráficos e Exportações.
 */

// Estado Global da Aplicação
const state = {
  periodos: [],
  currentPeriodoId: null,
  currentRelatorio: null,
  searchQuery: "",
  adiantamentoFilter: "all",
  sortBy: "nome_asc",
  showCharts: false,
  chartComposicao: null,
  chartTopSalarios: null
};

// Elementos DOM
const dom = {
  toastContainer: document.getElementById("toast-container"),
  btnToggleTheme: document.getElementById("btn-toggle-theme"),
  btnOpenUpload: document.getElementById("btn-open-upload"),
  btnCloseUpload: document.getElementById("btn-close-upload"),
  uploadPanel: document.getElementById("upload-panel"),
  dropZone: document.getElementById("drop-zone"),
  pdfFileInput: document.getElementById("pdf-file-input"),
  uploadProgress: document.getElementById("upload-progress"),
  uploadStatusText: document.getElementById("upload-status-text"),
  
  periodTabs: document.getElementById("period-tabs"),
  reportView: document.getElementById("report-view"),
  emptyState: document.getElementById("empty-state"),
  btnEmptyUpload: document.getElementById("btn-empty-upload"),
  
  viewPeriodoTexto: document.getElementById("view-periodo-texto"),
  viewCompetencia: document.getElementById("view-competencia"),
  viewEmpresaInfo: document.getElementById("view-empresa-info"),
  
  btnToggleCharts: document.getElementById("btn-toggle-charts"),
  chartToggleText: document.getElementById("chart-toggle-text"),
  chartsPanel: document.getElementById("charts-panel"),
  btnExportExcel: document.getElementById("btn-export-excel"),
  btnExportCsv: document.getElementById("btn-export-csv"),
  btnPrint: document.getElementById("btn-print"),
  btnDeletePeriodo: document.getElementById("btn-delete-periodo"),
  
  kpiColaboradores: document.getElementById("kpi-colaboradores"),
  kpiSalarios: document.getElementById("kpi-salarios"),
  kpiProventos: document.getElementById("kpi-proventos"),
  kpiAdiantamento: document.getElementById("kpi-adiantamento"),
  kpiLiquido: document.getElementById("kpi-liquido"),
  
  searchInput: document.getElementById("search-input"),
  btnClearSearch: document.getElementById("btn-clear-search"),
  filterAdiantamento: document.getElementById("filter-adiantamento"),
  sortSelect: document.getElementById("sort-select"),
  visibleCount: document.getElementById("visible-count"),
  totalCount: document.getElementById("total-count"),
  
  tableBody: document.getElementById("table-body"),
  tableEmpty: document.getElementById("table-empty"),
  footCount: document.getElementById("foot-count"),
  footSalario: document.getElementById("foot-salario"),
  footProventos: document.getElementById("foot-proventos"),
  footAdiantamento: document.getElementById("foot-adiantamento"),
  footLiquido: document.getElementById("foot-liquido"),

  printEmpresaInfo: document.getElementById("print-empresa-info"),
  printPeriodoInfo: document.getElementById("print-periodo-info")
};

// Formatação Monetária Brasileira
function formatBRL(value) {
  if (value === null || value === undefined || isNaN(value)) value = 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

// Toast Notificações
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Alternância de Tema Claro / Escuro
function initTheme() {
  const savedTheme = localStorage.getItem("holerite_theme") || "theme-dark";
  document.body.className = savedTheme;

  dom.btnToggleTheme.addEventListener("click", () => {
    const isDark = document.body.classList.contains("theme-dark");
    const newTheme = isDark ? "theme-light" : "theme-dark";
    document.body.className = newTheme;
    localStorage.setItem("holerite_theme", newTheme);
    if (state.showCharts) renderCharts();
  });
}

// Inicialização da Aplicação
async function initApp() {
  initTheme();
  setupEventListeners();
  await loadPeriodos();
}

// Configuração de Eventos
function setupEventListeners() {
  // Painel de Upload
  dom.btnOpenUpload.addEventListener("click", () => {
    dom.uploadPanel.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  dom.btnCloseUpload.addEventListener("click", () => {
    dom.uploadPanel.classList.add("hidden");
  });

  if (dom.btnEmptyUpload) {
    dom.btnEmptyUpload.addEventListener("click", () => {
      dom.uploadPanel.classList.remove("hidden");
    });
  }

  // Drag & Drop no Upload
  dom.dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dom.dropZone.classList.add("dragover");
  });

  dom.dropZone.addEventListener("dragleave", () => {
    dom.dropZone.classList.remove("dragover");
  });

  dom.dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dom.dropZone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  dom.pdfFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Filtros de Tabela
  dom.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    dom.btnClearSearch.classList.toggle("hidden", !state.searchQuery);
    renderTable();
  });

  dom.btnClearSearch.addEventListener("click", () => {
    dom.searchInput.value = "";
    state.searchQuery = "";
    dom.btnClearSearch.classList.add("hidden");
    renderTable();
  });

  dom.filterAdiantamento.addEventListener("change", (e) => {
    state.adiantamentoFilter = e.target.value;
    renderTable();
  });

  dom.sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderTable();
  });

  // Alternar Gráficos
  dom.btnToggleCharts.addEventListener("click", () => {
    state.showCharts = !state.showCharts;
    dom.chartsPanel.classList.toggle("hidden", !state.showCharts);
    dom.chartToggleText.textContent = state.showCharts ? "Ocultar Gráficos" : "Ver Gráficos";
    if (state.showCharts) renderCharts();
  });

  // Exportações
  dom.btnExportExcel.addEventListener("click", exportToExcel);
  dom.btnExportCsv.addEventListener("click", () => {
    if (state.currentPeriodoId) {
      window.location.href = `/api/export/csv/${state.currentPeriodoId}`;
    }
  });

  dom.btnPrint.addEventListener("click", () => {
    window.print();
  });

  // Excluir Período
  dom.btnDeletePeriodo.addEventListener("click", confirmDeletePeriodo);
}

// Carregar lista de períodos da API
async function loadPeriodos(selectPeriodoId = null) {
  try {
    const res = await fetch("/api/periodos");
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "Erro ao carregar períodos", "error");
      return;
    }

    state.periodos = data.periodos || [];

    if (state.periodos.length === 0) {
      dom.reportView.classList.add("hidden");
      dom.emptyState.classList.remove("hidden");
      dom.periodTabs.innerHTML = "<span class='tab-placeholder'>Nenhum período cadastrado</span>";
      return;
    }

    dom.reportView.classList.remove("hidden");
    dom.emptyState.classList.add("hidden");

    renderPeriodTabs();

    // Selecionar o primeiro ou o especificado
    const toSelect = selectPeriodoId || (state.currentPeriodoId && state.periodos.some(p => p.id === state.currentPeriodoId) ? state.currentPeriodoId : state.periodos[0].id);
    await selectPeriodo(toSelect);
  } catch (err) {
    console.error(err);
    showToast("Falha ao comunicar com o servidor", "error");
  }
}

// Renderizar Tabs de Períodos
function renderPeriodTabs() {
  dom.periodTabs.innerHTML = "";
  state.periodos.forEach(p => {
    const btn = document.createElement("button");
    btn.className = `period-tab-btn ${p.id === state.currentPeriodoId ? "active" : ""}`;
    btn.innerHTML = `
      <span class="tab-comp">${p.mes_ano || p.periodo_texto}</span>
      <span class="tab-sub">${p.total_funcionarios} colaborad. • ${formatBRL(p.total_liquido)}</span>
    `;
    btn.addEventListener("click", () => selectPeriodo(p.id));
    dom.periodTabs.appendChild(btn);
  });
}

// Selecionar e carregar dados de um período
async function selectPeriodo(periodoId) {
  state.currentPeriodoId = periodoId;
  renderPeriodTabs();

  try {
    const res = await fetch(`/api/periodos/${periodoId}`);
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "Erro ao carregar dados do período", "error");
      return;
    }

    state.currentRelatorio = data.relatorio;
    updateViewWithRelatorio(data.relatorio);
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar relatório do período", "error");
  }
}

// Atualizar interface com o relatório carregado
function updateViewWithRelatorio(rel) {
  dom.viewPeriodoTexto.textContent = rel.periodo_texto || "Período Selecionado";
  dom.viewCompetencia.textContent = rel.mes_ano || "Folha";
  dom.viewEmpresaInfo.textContent = `Empresa: ${rel.empresa || "Não informada"} | CNPJ: ${rel.cnpj || "Não informado"} | Arquivo: ${rel.nome_arquivo || "folha.pdf"}`;

  // Atualizar cabeçalho de impressão
  if (dom.printEmpresaInfo) dom.printEmpresaInfo.textContent = rel.empresa || "EMPRESA";
  if (dom.printPeriodoInfo) dom.printPeriodoInfo.textContent = `Período: ${rel.periodo_texto}`;

  // KPIs
  dom.kpiColaboradores.textContent = rel.total_funcionarios;
  dom.kpiSalarios.textContent = formatBRL(rel.total_salario);
  dom.kpiProventos.textContent = formatBRL(rel.total_proventos);
  dom.kpiAdiantamento.textContent = formatBRL(rel.total_adiantamento);
  dom.kpiLiquido.textContent = formatBRL(rel.total_liquido);

  renderTable();

  if (state.showCharts) {
    renderCharts();
  }
}

// Filtragem e Ordenação da Tabela
function getFilteredAndSortedItems() {
  if (!state.currentRelatorio || !state.currentRelatorio.itens) return [];

  let items = [...state.currentRelatorio.itens];

  // Filtro por Texto de Busca (Nome ou Código)
  if (state.searchQuery) {
    items = items.filter(it => 
      it.nome.toLowerCase().includes(state.searchQuery) ||
      (it.codigo && it.codigo.toLowerCase().includes(state.searchQuery)) ||
      (it.funcao && it.funcao.toLowerCase().includes(state.searchQuery))
    );
  }

  // Filtro de Adiantamento Anterior
  if (state.adiantamentoFilter === "with_adv") {
    items = items.filter(it => it.adiantamento_anterior > 0);
  } else if (state.adiantamentoFilter === "without_adv") {
    items = items.filter(it => it.adiantamento_anterior === 0);
  }

  // Ordenação
  items.sort((a, b) => {
    switch (state.sortBy) {
      case "nome_asc":
        return a.nome.localeCompare(b.nome);
      case "nome_desc":
        return b.nome.localeCompare(a.nome);
      case "liquido_desc":
        return b.liquido - a.liquido;
      case "proventos_desc":
        return b.proventos - a.proventos;
      case "adiantamento_desc":
        return b.adiantamento_anterior - a.adiantamento_anterior;
      case "salario_desc":
        return b.salario - a.salario;
      default:
        return 0;
    }
  });

  return items;
}

// Renderização da Tabela de Relatório
function renderTable() {
  const items = getFilteredAndSortedItems();
  const totalItems = state.currentRelatorio ? state.currentRelatorio.itens.length : 0;

  dom.visibleCount.textContent = items.length;
  dom.totalCount.textContent = totalItems;

  dom.tableBody.innerHTML = "";

  if (items.length === 0) {
    dom.tableEmpty.classList.remove("hidden");
    dom.footCount.textContent = "0";
    dom.footSalario.textContent = "R$ 0,00";
    dom.footProventos.textContent = "R$ 0,00";
    dom.footAdiantamento.textContent = "R$ 0,00";
    dom.footLiquido.textContent = "R$ 0,00";
    return;
  }

  dom.tableEmpty.classList.add("hidden");

  let sumSalario = 0;
  let sumProventos = 0;
  let sumAdiantamento = 0;
  let sumLiquido = 0;

  const periodoTexto = state.currentRelatorio.periodo_texto || "";

  items.forEach(emp => {
    sumSalario += emp.salario;
    sumProventos += emp.proventos;
    sumAdiantamento += emp.adiantamento_anterior;
    sumLiquido += emp.liquido;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-periodo">${periodoTexto}</td>
      <td class="col-nome">
        <div class="emp-name-line">
          ${emp.codigo ? `<span class="badge-code">Cód ${emp.codigo}</span>` : ""}
          <span>${emp.nome}</span>
        </div>
        ${emp.funcao ? `<div class="emp-role-line">${emp.funcao}</div>` : ""}
      </td>
      <td class="col-num text-right font-mono">${formatBRL(emp.salario)}</td>
      <td class="col-num text-right font-mono">${formatBRL(emp.proventos)}</td>
      <td class="col-num text-right font-mono">
        ${emp.adiantamento_anterior > 0 
          ? `<span class="badge-adiantamento">${formatBRL(emp.adiantamento_anterior)}</span>` 
          : `<span class="text-muted">R$ 0,00</span>`}
      </td>
      <td class="col-num text-right font-mono text-bold text-success">${formatBRL(emp.liquido)}</td>
    `;
    dom.tableBody.appendChild(tr);
  });

  // Atualizar Rodapé da Tabela
  dom.footCount.textContent = items.length;
  dom.footSalario.textContent = formatBRL(sumSalario);
  dom.footProventos.textContent = formatBRL(sumProventos);
  dom.footAdiantamento.textContent = formatBRL(sumAdiantamento);
  dom.footLiquido.textContent = formatBRL(sumLiquido);
}

// Upload de Arquivo PDF
async function handleFileUpload(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Por favor, selecione um arquivo em formato PDF", "error");
    return;
  }

  dom.uploadProgress.classList.remove("hidden");
  dom.uploadStatusText.textContent = `Enviando e extraindo dados de ${file.name}...`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || "Erro ao processar arquivo PDF", "error");
      return;
    }

    showToast("Folha de pagamento importada com sucesso!", "success");
    dom.uploadPanel.classList.add("hidden");
    dom.pdfFileInput.value = "";

    await loadPeriodos(data.periodo_id);
  } catch (err) {
    console.error(err);
    showToast("Falha na comunicação ao enviar PDF", "error");
  } finally {
    dom.uploadProgress.classList.add("hidden");
  }
}

// Confirmação e Exclusão de Período
async function confirmDeletePeriodo() {
  if (!state.currentPeriodoId || !state.currentRelatorio) return;

  const nome = state.currentRelatorio.mes_ano || state.currentRelatorio.periodo_texto;
  if (!confirm(`Deseja realmente excluir o relatório do período "${nome}"?\nEsta ação não poderá ser desfeita.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/periodos/${state.currentPeriodoId}`, {
      method: "DELETE"
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "Erro ao excluir período", "error");
      return;
    }

    showToast("Período excluído com sucesso", "success");
    state.currentPeriodoId = null;
    await loadPeriodos();
  } catch (err) {
    console.error(err);
    showToast("Erro ao excluir período", "error");
  }
}

// Exportação para Excel (.xlsx) com formatação profissional
function exportToExcel() {
  if (!state.currentRelatorio || !state.currentRelatorio.itens) return;

  if (typeof XLSX === "undefined") {
    showToast("Biblioteca XLSX indisponível. Utilize a exportação CSV.", "error");
    return;
  }

  const items = getFilteredAndSortedItems();
  const rel = state.currentRelatorio;

  // Montar array de objetos para a planilha
  const rows = items.map(emp => ({
    "Período": rel.periodo_texto,
    "Código": emp.codigo || "",
    "Nome do Colaborador": emp.nome,
    "Cargo / Função": emp.funcao || "",
    "Salário Base (R$)": emp.salario,
    "Proventos (R$)": emp.proventos,
    "Adiantamento Anterior (R$)": emp.adiantamento_anterior,
    "Descontos (R$)": emp.descontos,
    "Total Líquido (R$)": emp.liquido
  }));

  // Linha de total geral
  rows.push({
    "Período": "TOTAL CONSOLIDADO",
    "Código": "",
    "Nome do Colaborador": `${items.length} colaboradores`,
    "Cargo / Função": "",
    "Salário Base (R$)": items.reduce((a, b) => a + b.salario, 0),
    "Proventos (R$)": items.reduce((a, b) => a + b.proventos, 0),
    "Adiantamento Anterior (R$)": items.reduce((a, b) => a + b.adiantamento_anterior, 0),
    "Descontos (R$)": items.reduce((a, b) => a + b.descontos, 0),
    "Total Líquido (R$)": items.reduce((a, b) => a + b.liquido, 0)
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ajustar largura das colunas
  worksheet["!cols"] = [
    { wch: 28 }, // Periodo
    { wch: 10 }, // Codigo
    { wch: 38 }, // Nome
    { wch: 32 }, // Cargo
    { wch: 18 }, // Salario
    { wch: 18 }, // Proventos
    { wch: 24 }, // Adiantamento
    { wch: 18 }, // Descontos
    { wch: 20 }, // Liquido
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = (rel.mes_ano || "Folha").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeFileName = `relatorio_folha_${(rel.mes_ano || "periodo").replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
  showToast("Planilha Excel gerada com sucesso!", "success");
}

// Renderização dos Gráficos com Chart.js
function renderCharts() {
  if (!state.currentRelatorio || typeof Chart === "undefined") return;

  const rel = state.currentRelatorio;
  const isDark = document.body.classList.contains("theme-dark");
  const textColor = isDark ? "#94a3b8" : "#475569";

  // 1. Gráfico de Composição Financeira (Doughnut)
  const ctxComp = document.getElementById("canvas-composicao");
  if (ctxComp) {
    if (state.chartComposicao) state.chartComposicao.destroy();
    
    state.chartComposicao = new Chart(ctxComp, {
      type: "doughnut",
      data: {
        labels: ["Total Líquido", "Adiantamento Anterior", "Outros Descontos"],
        datasets: [{
          data: [
            rel.total_liquido,
            rel.total_adiantamento,
            Math.max(0, rel.total_descontos - rel.total_adiantamento)
          ],
          backgroundColor: [
            "#10b981", // Verde liquido
            "#f59e0b", // Ambar adiantamento
            "#ef4444"  // Vermelho descontos
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor, font: { family: "Plus Jakarta Sans", size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${formatBRL(context.raw)}`
            }
          }
        },
        cutout: "68%"
      }
    });
  }

  // 2. Gráfico dos Maiores Proventos (Horizontal Bar)
  const ctxTop = document.getElementById("canvas-top-salarios");
  if (ctxTop) {
    if (state.chartTopSalarios) state.chartTopSalarios.destroy();

    const top5 = [...rel.itens].sort((a, b) => b.proventos - a.proventos).slice(0, 5);
    const labels = top5.map(e => e.nome.length > 20 ? e.nome.slice(0, 20) + "..." : e.nome);
    const dataProv = top5.map(e => e.proventos);
    const dataLiq = top5.map(e => e.liquido);

    state.chartTopSalarios = new Chart(ctxTop, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Proventos",
            data: dataProv,
            backgroundColor: "#3b82f6",
            borderRadius: 4
          },
          {
            label: "Total Líquido",
            data: dataLiq,
            backgroundColor: "#10b981",
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            ticks: { color: textColor, callback: (v) => "R$ " + (v/1000).toFixed(0) + "k" },
            grid: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }
          },
          y: {
            ticks: { color: textColor },
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor, font: { family: "Plus Jakarta Sans", size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatBRL(ctx.raw)}`
            }
          }
        }
      }
    });
  }
}

// Iniciar ao carregar a página
document.addEventListener("DOMContentLoaded", initApp);
