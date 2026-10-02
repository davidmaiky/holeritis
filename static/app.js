/**
 * Lógica do Sistema de Gestão de Folha de Pagamento & Holerites
 * Responsável por: Comunicação com a API, Uploads, Filtros, Gráficos e Exportações.
 */

// Estado Global da Aplicação
const state = {
  empresas: [],
  selectedEmpresa: "", // "" = todas as empresas
  periodos: [],
  currentPeriodoId: null,
  currentRelatorio: null,
  searchQuery: "",
  adiantamentoFilter: "all",
  sortBy: "nome_asc",
  showCharts: false,
  activeChartTab: "periodo", // "periodo" ou "evolucao"
  chartComposicao: null,
  chartTopSalarios: null,
  chartEvolucaoFin: null,
  chartEvolucaoHeadcount: null,
  currentModalEmployee: null
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
  
  // Elementos da Empresa / Razão Social
  companyFilterSelect: document.getElementById("company-filter-select"),
  selectedCompanyTitle: document.getElementById("selected-company-title"),
  companyCountBadge: document.getElementById("company-count-badge"),
  periodContextHint: document.getElementById("period-context-hint"),
  viewEmpresaNome: document.getElementById("view-empresa-nome"),
  bannerEmpresaTag: document.getElementById("banner-empresa-tag"),

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
  tabChartPeriodo: document.getElementById("tab-chart-periodo"),
  tabChartEvolucao: document.getElementById("tab-chart-evolucao"),
  chartsPeriodoView: document.getElementById("charts-periodo-view"),
  chartsEvolucaoView: document.getElementById("charts-evolucao-view"),

  btnExportExcel: document.getElementById("btn-export-excel"),
  btnExportCsv: document.getElementById("btn-export-csv"),
  btnPrint: document.getElementById("btn-print"),
  btnDeletePeriodo: document.getElementById("btn-delete-periodo"),
  
  kpiColaboradores: document.getElementById("kpi-colaboradores"),
  kpiSalarios: document.getElementById("kpi-salarios"),
  kpiProventos: document.getElementById("kpi-proventos"),
  kpiAdiantamento: document.getElementById("kpi-adiantamento"),
  kpiDescontos: document.getElementById("kpi-descontos"),
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
  footDescontos: document.getElementById("foot-descontos"),
  footLiquido: document.getElementById("foot-liquido"),

  modalHolerite: document.getElementById("modal-holerite"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  btnCloseModalBottom: document.getElementById("btn-close-modal-bottom"),
  btnPrintHolerite: document.getElementById("btn-print-holerite"),
  modalCompBadge: document.getElementById("modal-comp-badge"),
  modalEmpresaNome: document.getElementById("modal-empresa-nome"),
  modalEmpresaCnpj: document.getElementById("modal-empresa-cnpj"),
  modalEmpNome: document.getElementById("modal-emp-nome"),
  modalEmpCodigo: document.getElementById("modal-emp-codigo"),
  modalEmpFuncao: document.getElementById("modal-emp-funcao"),
  modalEmpPeriodo: document.getElementById("modal-emp-periodo"),
  modalSalario: document.getElementById("modal-salario"),
  modalProventos: document.getElementById("modal-proventos"),
  modalAdiantamento: document.getElementById("modal-adiantamento"),
  modalDescontos: document.getElementById("modal-descontos"),
  modalLiquido: document.getElementById("modal-liquido"),

  printEmpresaInfo: document.getElementById("print-empresa-info"),
  printPeriodoInfo: document.getElementById("print-periodo-info"),
  printTimestamp: document.getElementById("print-timestamp")
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
  await loadEmpresas();
  await loadPeriodos();
}

// Configuração de Eventos
function setupEventListeners() {
  // Filtro de Empresa / Razão Social
  if (dom.companyFilterSelect) {
    dom.companyFilterSelect.addEventListener("change", async (e) => {
      state.selectedEmpresa = e.target.value;
      updateCompanyDisplay();
      await loadPeriodos();
    });
  }

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

  // Abas de Gráficos (Período vs Evolução)
  if (dom.tabChartPeriodo && dom.tabChartEvolucao) {
    dom.tabChartPeriodo.addEventListener("click", () => {
      state.activeChartTab = "periodo";
      dom.tabChartPeriodo.classList.add("active");
      dom.tabChartEvolucao.classList.remove("active");
      dom.chartsPeriodoView.classList.remove("hidden");
      dom.chartsEvolucaoView.classList.add("hidden");
      renderCharts();
    });

    dom.tabChartEvolucao.addEventListener("click", () => {
      state.activeChartTab = "evolucao";
      dom.tabChartEvolucao.classList.add("active");
      dom.tabChartPeriodo.classList.remove("active");
      dom.chartsEvolucaoView.classList.remove("hidden");
      dom.chartsPeriodoView.classList.add("hidden");
      renderCharts();
    });
  }

  // Modal de Holerite Individual
  if (dom.btnCloseModal) dom.btnCloseModal.addEventListener("click", closeHoleriteModal);
  if (dom.btnCloseModalBottom) dom.btnCloseModalBottom.addEventListener("click", closeHoleriteModal);
  if (dom.modalHolerite) {
    dom.modalHolerite.addEventListener("click", (e) => {
      if (e.target === dom.modalHolerite) closeHoleriteModal();
    });
  }
  if (dom.btnPrintHolerite) dom.btnPrintHolerite.addEventListener("click", printHoleriteIndividual);

  // Tecla ESC para fechar modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.modalHolerite && !dom.modalHolerite.classList.contains("hidden")) {
      closeHoleriteModal();
    }
  });

  // Exportações
  dom.btnExportExcel.addEventListener("click", exportToExcel);
  dom.btnExportCsv.addEventListener("click", () => {
    if (state.currentPeriodoId) {
      window.location.href = `/api/export/csv/${state.currentPeriodoId}`;
    }
  });

  dom.btnPrint.addEventListener("click", () => {
    if (dom.printTimestamp) {
      dom.printTimestamp.textContent = `Emissão: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`;
    }
    window.print();
  });

  // Excluir Período
  dom.btnDeletePeriodo.addEventListener("click", confirmDeletePeriodo);
}

// Carregar empresas cadastradas da API
async function loadEmpresas(selectEmpresa = null) {
  try {
    const res = await fetch("/api/empresas");
    const data = await res.json();
    if (data.success) {
      state.empresas = data.empresas || [];
      renderCompanySelector(selectEmpresa);
    }
  } catch (err) {
    console.error("Erro ao carregar lista de empresas:", err);
  }
}

// Renderizar opções do seletor corporativo de empresas
function renderCompanySelector(selectEmpresa = null) {
  if (selectEmpresa !== null) {
    state.selectedEmpresa = selectEmpresa;
  }

  const count = state.empresas.length;
  if (dom.companyCountBadge) {
    dom.companyCountBadge.textContent = `${count} ${count === 1 ? "Empresa" : "Empresas"}`;
  }

  if (dom.companyFilterSelect) {
    const currentVal = state.selectedEmpresa;
    dom.companyFilterSelect.innerHTML = `<option value="">🏢 Todas as Empresas (Visão Global)</option>`;

    state.empresas.forEach(emp => {
      const opt = document.createElement("option");
      opt.value = emp.empresa;
      const countLabel = emp.total_periodos === 1 ? "1 folha" : `${emp.total_periodos} folhas`;
      opt.textContent = `🏢 ${emp.empresa} (${countLabel})`;
      dom.companyFilterSelect.appendChild(opt);
    });

    dom.companyFilterSelect.value = currentVal || "";
  }

  updateCompanyDisplay();
}

// Atualizar título visual e contexto da empresa ativa
function updateCompanyDisplay() {
  if (dom.selectedCompanyTitle) {
    dom.selectedCompanyTitle.textContent = state.selectedEmpresa || "Todas as Empresas (Visão Global)";
  }
  if (dom.periodContextHint) {
    if (state.selectedEmpresa) {
      dom.periodContextHint.textContent = `Exibindo folhas da empresa: ${state.selectedEmpresa}`;
    } else {
      dom.periodContextHint.textContent = "Classificação automática por Razão Social e competência";
    }
  }
}

// Carregar lista de períodos da API (com filtro opcional de empresa)
async function loadPeriodos(selectPeriodoId = null) {
  try {
    let url = "/api/periodos";
    if (state.selectedEmpresa) {
      url += `?empresa=${encodeURIComponent(state.selectedEmpresa)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "Erro ao carregar períodos", "error");
      return;
    }

    state.periodos = data.periodos || [];

    if (state.periodos.length === 0) {
      dom.reportView.classList.add("hidden");
      dom.emptyState.classList.remove("hidden");
      dom.periodTabs.innerHTML = "<span class='tab-placeholder'>Nenhum relatório encontrado para este filtro</span>";
      state.currentPeriodoId = null;
      state.currentRelatorio = null;
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

// Renderizar Tabs de Períodos com destaque para a Razão Social da Empresa
function renderPeriodTabs() {
  dom.periodTabs.innerHTML = "";
  state.periodos.forEach(p => {
    const btn = document.createElement("button");
    btn.className = `period-tab-btn ${p.id === state.currentPeriodoId ? "active" : ""}`;
    
    // Tag da Razão Social (quando estiver em visão global de todas as empresas)
    const empresaTag = (!state.selectedEmpresa && p.empresa) 
      ? `<span class="tab-empresa-pill" title="${p.empresa}">${p.empresa}</span>` 
      : "";

    btn.innerHTML = `
      <div class="tab-header-row">
        <span class="tab-comp">${p.mes_ano || p.periodo_texto}</span>
        ${empresaTag}
      </div>
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
  if (dom.viewEmpresaNome) {
    dom.viewEmpresaNome.textContent = rel.empresa || "Razão Social Não Identificada";
  }
  dom.viewPeriodoTexto.textContent = rel.periodo_texto || "Período Selecionado";
  dom.viewCompetencia.textContent = rel.mes_ano || "Folha";
  dom.viewEmpresaInfo.textContent = `CNPJ: ${rel.cnpj || "Não informado"} • Arquivo Original: ${rel.nome_arquivo || "folha.pdf"}`;

  // Atualizar cabeçalho de impressão
  if (dom.printEmpresaInfo) dom.printEmpresaInfo.textContent = rel.empresa || "EMPRESA";
  if (dom.printPeriodoInfo) dom.printPeriodoInfo.textContent = `Período: ${rel.periodo_texto}`;

  // KPIs
  dom.kpiColaboradores.textContent = rel.total_funcionarios;
  dom.kpiSalarios.textContent = formatBRL(rel.total_salario);
  dom.kpiProventos.textContent = formatBRL(rel.total_proventos);
  dom.kpiAdiantamento.textContent = formatBRL(rel.total_adiantamento);
  if (dom.kpiDescontos) dom.kpiDescontos.textContent = formatBRL(rel.total_descontos);
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
      case "descontos_desc":
        return b.descontos - a.descontos;
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
    if (dom.footDescontos) dom.footDescontos.textContent = "R$ 0,00";
    dom.footLiquido.textContent = "R$ 0,00";
    return;
  }

  dom.tableEmpty.classList.add("hidden");

  let sumSalario = 0;
  let sumProventos = 0;
  let sumAdiantamento = 0;
  let sumDescontos = 0;
  let sumLiquido = 0;

  items.forEach(emp => {
    sumSalario += emp.salario;
    sumProventos += emp.proventos;
    sumAdiantamento += emp.adiantamento_anterior;
    sumDescontos += emp.descontos;
    sumLiquido += emp.liquido;

    const tr = document.createElement("tr");
    tr.className = "row-clickable";
    tr.title = "Clique para abrir o holerite detalhado";
    tr.innerHTML = `
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
      <td class="col-num text-right font-mono text-danger font-semibold">${formatBRL(emp.descontos)}</td>
      <td class="col-num text-right font-mono text-bold text-success">${formatBRL(emp.liquido)}</td>
      <td class="col-actions">
        <button class="btn-action-view" type="button" title="Ver Holerite Individual">
          📄 Recibo
        </button>
      </td>
    `;

    tr.addEventListener("click", () => openHoleriteModal(emp));
    dom.tableBody.appendChild(tr);
  });

  // Atualizar Rodapé da Tabela
  dom.footCount.textContent = items.length;
  dom.footSalario.textContent = formatBRL(sumSalario);
  dom.footProventos.textContent = formatBRL(sumProventos);
  dom.footAdiantamento.textContent = formatBRL(sumAdiantamento);
  if (dom.footDescontos) dom.footDescontos.textContent = formatBRL(sumDescontos);
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

    const importedEmpresa = data.relatorio ? data.relatorio.empresa : "";
    showToast(`Folha da empresa "${importedEmpresa || 'importada'}" processada com sucesso!`, "success");
    dom.uploadPanel.classList.add("hidden");
    dom.pdfFileInput.value = "";

    // Atualizar seletor de empresas e focar no período importado
    await loadEmpresas(importedEmpresa || state.selectedEmpresa);
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
  const empresa = state.currentRelatorio.empresa || "Empresa";
  if (!confirm(`Deseja realmente excluir o relatório de "${nome}" da empresa "${empresa}"?\nEsta ação não poderá ser desfeita.`)) {
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
    await loadEmpresas();
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
    "Empresa": rel.empresa || "",
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
    "Empresa": "",
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
    { wch: 32 }, // Empresa
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

  const safeEmpresa = (rel.empresa || "empresa").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25);
  const safeComp = (rel.mes_ano || "periodo").replace(/[^a-zA-Z0-9]/g, "_");
  const safeFileName = `relatorio_folha_${safeEmpresa}_${safeComp}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
  showToast("Planilha Excel gerada com sucesso!", "success");
}

// Funções do Modal de Holerite Individual
function openHoleriteModal(emp) {
  state.currentModalEmployee = emp;
  const rel = state.currentRelatorio || {};

  dom.modalCompBadge.textContent = rel.mes_ano || "--/----";
  dom.modalEmpresaNome.textContent = rel.empresa || "EMPRESA";
  dom.modalEmpresaCnpj.textContent = `CNPJ: ${rel.cnpj || "Não informado"}`;

  dom.modalEmpNome.textContent = emp.nome;
  dom.modalEmpCodigo.textContent = emp.codigo ? `Cód: ${emp.codigo}` : "Cód: Não informado";
  dom.modalEmpFuncao.textContent = emp.funcao ? `Cargo: ${emp.funcao}` : "Cargo: Não informado";
  dom.modalEmpPeriodo.textContent = `Período de: ${rel.periodo_texto || "--"}`;

  dom.modalSalario.textContent = formatBRL(emp.salario);
  dom.modalProventos.textContent = formatBRL(emp.proventos);
  dom.modalAdiantamento.textContent = formatBRL(emp.adiantamento_anterior);
  dom.modalDescontos.textContent = formatBRL(emp.descontos);
  dom.modalLiquido.textContent = formatBRL(emp.liquido);

  dom.modalHolerite.classList.remove("hidden");
}

function closeHoleriteModal() {
  dom.modalHolerite.classList.add("hidden");
  state.currentModalEmployee = null;
}

function printHoleriteIndividual() {
  if (!state.currentModalEmployee) return;
  const emp = state.currentModalEmployee;
  const rel = state.currentRelatorio || {};

  const printWindow = window.open("", "_blank", "width=850,height=750");
  if (!printWindow) {
    showToast("Permita pop-ups no navegador para imprimir o recibo individual", "error");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recibo de Pagamento - ${emp.nome}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #111; font-size: 13px; line-height: 1.5; }
        .receipt-card { border: 2px solid #222; padding: 24px; max-width: 650px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
        .company h2 { margin: 0 0 4px 0; font-size: 17px; }
        .company p { margin: 0; font-size: 11px; color: #555; }
        .comp { text-align: right; font-weight: bold; font-size: 13px; }
        .emp-box { background: #f5f5f5; border: 1px solid #ddd; padding: 12px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .val-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .val-table th, .val-table td { padding: 10px 12px; border-bottom: 1px solid #ddd; text-align: left; }
        .val-table th { background: #f0f0f0; }
        .text-right { text-align: right; }
        .font-mono { font-family: monospace; font-size: 13px; }
        .total-row { background: #e8f5e9; font-weight: bold; font-size: 14px; }
        .total-row td { border-top: 2px solid #2e7d32; border-bottom: 2px solid #2e7d32; color: #1b5e20; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; gap: 40px; }
        .sig-box { flex: 1; text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-bottom: 6px; }
        .sig-box p { margin: 0; font-size: 10px; }
        .footer-note { margin-top: 24px; font-size: 10px; color: #777; text-align: center; }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="header">
          <div class="company">
            <h2>${rel.empresa || "EMPRESA"}</h2>
            <p>CNPJ: ${rel.cnpj || "Não informado"}</p>
          </div>
          <div class="comp">
            RECIBO DE PAGAMENTO<br>
            Competência: ${rel.mes_ano || "--/----"}
          </div>
        </div>

        <div class="emp-box">
          <div><strong>Colaborador:</strong> ${emp.nome}</div>
          <div><strong>Código:</strong> ${emp.codigo || "-"}</div>
          <div><strong>Cargo/Função:</strong> ${emp.funcao || "-"}</div>
          <div><strong>Período:</strong> ${rel.periodo_texto || "-"}</div>
        </div>

        <table class="val-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th class="text-right">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Salário Base Contratual</td>
              <td class="text-right font-mono">${formatBRL(emp.salario)}</td>
            </tr>
            <tr>
              <td>Total de Proventos (Bruto)</td>
              <td class="text-right font-mono">${formatBRL(emp.proventos)}</td>
            </tr>
            <tr>
              <td>(-) Adiantamento Anterior Compensado</td>
              <td class="text-right font-mono">${formatBRL(emp.adiantamento_anterior)}</td>
            </tr>
            <tr>
              <td>(-) Total de Descontos e Retenções</td>
              <td class="text-right font-mono">${formatBRL(emp.descontos)}</td>
            </tr>
            <tr class="total-row">
              <td>VALOR LÍQUIDO CREDITADO</td>
              <td class="text-right font-mono">${formatBRL(emp.liquido)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <p>EMPREGADOR / RH</p>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <p>${emp.nome}<br>Assinatura do Colaborador</p>
          </div>
        </div>

        <div class="footer-note">
          Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} - HoleriteManager
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Ordenação cronológica de competências (MM/AAAA)
function parseMesAnoKey(mesAnoStr) {
  if (!mesAnoStr) return 0;
  const parts = mesAnoStr.split("/");
  if (parts.length === 2) {
    const mm = parseInt(parts[0], 10);
    const yyyy = parseInt(parts[1], 10);
    return yyyy * 100 + mm;
  }
  return 0;
}

// Renderização dos Gráficos com Chart.js
function renderCharts() {
  if (typeof Chart === "undefined") return;

  const isDark = document.body.classList.contains("theme-dark");
  const textColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  if (state.activeChartTab === "periodo") {
    if (!state.currentRelatorio) return;
    const rel = state.currentRelatorio;

    // 1. Gráfico de Composição Financeira (Doughnut)
    const ctxComp = document.getElementById("canvas-composicao");
    if (ctxComp) {
      if (state.chartComposicao) state.chartComposicao.destroy();
      
      const outrosDescontos = Math.max(0, rel.total_descontos - rel.total_adiantamento);
      state.chartComposicao = new Chart(ctxComp, {
        type: "doughnut",
        data: {
          labels: ["Total Líquido", "Adiantamento Anterior", "Outros Descontos"],
          datasets: [{
            data: [
              rel.total_liquido,
              rel.total_adiantamento,
              outrosDescontos
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
              grid: { color: gridColor }
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
  } else if (state.activeChartTab === "evolucao") {
    // 3. Gráficos de Evolução Histórica Multiperíodos
    if (!state.periodos || state.periodos.length === 0) return;

    // Ordenar períodos cronologicamente (ex: 03/2026 -> 04/2026 -> 05/2026 -> ...)
    const sortedPeriodos = [...state.periodos].sort((a, b) => parseMesAnoKey(a.mes_ano) - parseMesAnoKey(b.mes_ano));

    const labels = sortedPeriodos.map(p => p.mes_ano || p.periodo_texto);
    const dataProventos = sortedPeriodos.map(p => p.total_proventos);
    const dataLiquido = sortedPeriodos.map(p => p.total_liquido);
    const dataDescontos = sortedPeriodos.map(p => p.total_descontos);
    const dataAdiantamento = sortedPeriodos.map(p => p.total_adiantamento);

    // Gráfico de Evolução Financeira
    const ctxEvolucaoFin = document.getElementById("canvas-evolucao-financeira");
    if (ctxEvolucaoFin) {
      if (state.chartEvolucaoFin) state.chartEvolucaoFin.destroy();

      state.chartEvolucaoFin = new Chart(ctxEvolucaoFin, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Proventos Brutos",
              data: dataProventos,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderWidth: 2.5,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: false
            },
            {
              label: "Total Líquido",
              data: dataLiquido,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderWidth: 2.5,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: false
            },
            {
              label: "Total Descontos",
              data: dataDescontos,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: false
            },
            {
              label: "Adiantamento Anterior",
              data: dataAdiantamento,
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: textColor },
              grid: { color: gridColor }
            },
            y: {
              ticks: { color: textColor, callback: (v) => "R$ " + (v/1000).toFixed(0) + "k" },
              grid: { color: gridColor }
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: textColor, font: { family: "Plus Jakarta Sans", size: 11 } }
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

    // Gráfico de Evolução de Colaboradores e Média Salarial
    const ctxEvolucaoHeadcount = document.getElementById("canvas-evolucao-headcount");
    if (ctxEvolucaoHeadcount) {
      if (state.chartEvolucaoHeadcount) state.chartEvolucaoHeadcount.destroy();

      const dataHeadcount = sortedPeriodos.map(p => p.total_funcionarios);
      const dataMediaSalarial = sortedPeriodos.map(p => p.total_funcionarios > 0 ? (p.total_salario / p.total_funcionarios) : 0);

      state.chartEvolucaoHeadcount = new Chart(ctxEvolucaoHeadcount, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              type: "bar",
              label: "Nº de Colaboradores",
              data: dataHeadcount,
              backgroundColor: isDark ? "rgba(99, 102, 241, 0.6)" : "rgba(79, 70, 229, 0.65)",
              borderRadius: 4,
              yAxisID: "y"
            },
            {
              type: "line",
              label: "Salário Base Médio",
              data: dataMediaSalarial,
              borderColor: "#f59e0b",
              backgroundColor: "#f59e0b",
              borderWidth: 2.5,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: textColor },
              grid: { color: gridColor }
            },
            y: {
              type: "linear",
              display: true,
              position: "left",
              ticks: { color: textColor, stepSize: 1 },
              grid: { color: gridColor },
              title: { display: true, text: "Colaboradores", color: textColor, font: { size: 10 } }
            },
            y1: {
              type: "linear",
              display: true,
              position: "right",
              ticks: { color: textColor, callback: (v) => "R$ " + (v/1000).toFixed(1) + "k" },
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Média Salarial (R$)", color: textColor, font: { size: 10 } }
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: textColor, font: { family: "Plus Jakarta Sans", size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (ctx.dataset.yAxisID === "y1") {
                    return ` ${ctx.dataset.label}: ${formatBRL(ctx.raw)}`;
                  }
                  return ` ${ctx.dataset.label}: ${ctx.raw} pessoas`;
                }
              }
            }
          }
        }
      });
    }
  }
}

// Iniciar ao carregar a página
document.addEventListener("DOMContentLoaded", initApp);

