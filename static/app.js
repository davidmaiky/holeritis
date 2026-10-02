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
  activeChartTab: "12m", // "12m", "periodo" ou "headcount"
  
  // Filtros de Data e Período
  dateFilter: {
    preset: "all", // "all", "last_12m", "last_6m", "last_3m", "current_year"
    de: "",
    ate: "",
    ano: ""
  },
  availableFiltros: {
    anos: [],
    competencias: []
  },

  // Configuração do Gráfico de Evolução de 12 Meses
  chart12mType: "bar", // "bar", "line", "stacked"
  chart12mRange: "12", // "12", "6", "all"
  chart12mInstance: null,
  evolucao12mData: null,

  chartComposicao: null,
  chartTopSalarios: null,
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
  btnResetOrder: document.getElementById("btn-reset-order"),
  viewEmpresaNome: document.getElementById("view-empresa-nome"),
  bannerEmpresaTag: document.getElementById("banner-empresa-tag"),

  // Barra de Filtros de Datas e Períodos
  presetPills: document.getElementById("preset-pills"),
  filterDateDe: document.getElementById("filter-date-de"),
  filterDateAte: document.getElementById("filter-date-ate"),
  filterDateAno: document.getElementById("filter-date-ano"),
  btnApplyDateFilter: document.getElementById("btn-apply-date-filter"),
  btnClearDateFilter: document.getElementById("btn-clear-date-filter"),
  periodFilterBadge: document.getElementById("period-filter-badge"),
  btnQuick12m: document.getElementById("btn-quick-12m"),

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
  
  // Abas de Gráficos
  tabChart12m: document.getElementById("tab-chart-12m"),
  tabChartPeriodo: document.getElementById("tab-chart-periodo"),
  tabChartHeadcount: document.getElementById("tab-chart-headcount"),
  charts12mView: document.getElementById("charts-12m-view"),
  chartsPeriodoView: document.getElementById("charts-periodo-view"),
  chartsHeadcountView: document.getElementById("charts-headcount-view"),

  // Controles da Evolução de 12 Meses
  btnChartTypeBar: document.getElementById("btn-chart-type-bar"),
  btnChartTypeLine: document.getElementById("btn-chart-type-line"),
  btnChartTypeStacked: document.getElementById("btn-chart-type-stacked"),
  btnRange12m: document.getElementById("btn-range-12m"),
  btnRange6m: document.getElementById("btn-range-6m"),
  btnRangeAll: document.getElementById("btn-range-all"),
  btnSeed12m: document.getElementById("btn-seed-12m"),

  // KPIs dos 12 Meses
  kpi12mProventos: document.getElementById("kpi-12m-proventos"),
  kpi12mMediaProventos: document.getElementById("kpi-12m-media-proventos"),
  kpi12mAdiantamento: document.getElementById("kpi-12m-adiantamento"),
  kpi12mPctAdiantamento: document.getElementById("kpi-12m-pct-adiantamento"),
  kpi12mLiquido: document.getElementById("kpi-12m-liquido"),
  kpi12mPctLiquido: document.getElementById("kpi-12m-pct-liquido"),
  kpi12mPico: document.getElementById("kpi-12m-pico"),
  kpi12mMinimo: document.getElementById("kpi-12m-minimo"),

  // Tabela e Canvas dos 12 Meses
  table12mBody: document.getElementById("table-12m-body"),
  canvasEvolucao12m: document.getElementById("canvas-evolucao-12m"),

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
  await loadFiltrosMetadados();
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
      if (state.showCharts && state.activeChartTab === "12m") {
        await render12mChart();
      }
    });
  }

  // Presets de Filtros de Período (Todos, 12M, 6M, 3M, 2026)
  if (dom.presetPills) {
    dom.presetPills.addEventListener("click", async (e) => {
      const btn = e.target.closest(".preset-pill");
      if (!btn) return;
      dom.presetPills.querySelectorAll(".preset-pill").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      state.dateFilter.preset = btn.dataset.preset || "all";

      // Resetar seletores manuais quando um preset for acionado
      state.dateFilter.de = "";
      state.dateFilter.ate = "";
      state.dateFilter.ano = "";
      if (dom.filterDateDe) dom.filterDateDe.value = "";
      if (dom.filterDateAte) dom.filterDateAte.value = "";
      if (dom.filterDateAno) dom.filterDateAno.value = "";

      await loadPeriodos();
      if (state.showCharts && state.activeChartTab === "12m") {
        await render12mChart();
      }
    });
  }

  // Filtros Manuais de Data / Intervalo (De, Até, Ano)
  if (dom.btnApplyDateFilter) {
    dom.btnApplyDateFilter.addEventListener("click", async () => {
      state.dateFilter.de = dom.filterDateDe ? dom.filterDateDe.value : "";
      state.dateFilter.ate = dom.filterDateAte ? dom.filterDateAte.value : "";
      state.dateFilter.ano = dom.filterDateAno ? dom.filterDateAno.value : "";
      state.dateFilter.preset = "custom";

      if (dom.presetPills) {
        dom.presetPills.querySelectorAll(".preset-pill").forEach(p => p.classList.remove("active"));
      }

      await loadPeriodos();
      if (state.showCharts && state.activeChartTab === "12m") {
        await render12mChart();
      }
    });
  }

  // Botão Limpar Filtros de Datas e Períodos
  if (dom.btnClearDateFilter) {
    dom.btnClearDateFilter.addEventListener("click", async () => {
      state.dateFilter = { preset: "all", de: "", ate: "", ano: "" };
      if (dom.filterDateDe) dom.filterDateDe.value = "";
      if (dom.filterDateAte) dom.filterDateAte.value = "";
      if (dom.filterDateAno) dom.filterDateAno.value = "";
      if (dom.presetPills) {
        dom.presetPills.querySelectorAll(".preset-pill").forEach(p => {
          p.classList.toggle("active", p.dataset.preset === "all");
        });
      }
      await loadPeriodos();
      if (state.showCharts && state.activeChartTab === "12m") {
        await render12mChart();
      }
      showToast("Filtros de data/período redefinidos", "info");
    });
  }

  // Botão Rápido para Abrir Gráficos de 12 Meses
  if (dom.btnQuick12m) {
    dom.btnQuick12m.addEventListener("click", () => {
      state.showCharts = true;
      dom.chartsPanel.classList.remove("hidden");
      dom.chartToggleText.textContent = "Ocultar Gráficos";
      switchChartTab("12m");
      dom.chartsPanel.scrollIntoView({ behavior: "smooth" });
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

  // Alternar Visibilidade dos Gráficos
  dom.btnToggleCharts.addEventListener("click", () => {
    state.showCharts = !state.showCharts;
    dom.chartsPanel.classList.toggle("hidden", !state.showCharts);
    dom.chartToggleText.textContent = state.showCharts ? "Ocultar Gráficos" : "Ver Gráficos";
    if (state.showCharts) renderCharts();
  });

  // Função para Alternar Abas de Gráficos (12M, Período, Headcount)
  function switchChartTab(tabKey) {
    state.activeChartTab = tabKey;
    if (dom.tabChart12m) dom.tabChart12m.classList.toggle("active", tabKey === "12m");
    if (dom.tabChartPeriodo) dom.tabChartPeriodo.classList.toggle("active", tabKey === "periodo");
    if (dom.tabChartHeadcount) dom.tabChartHeadcount.classList.toggle("active", tabKey === "headcount");

    if (dom.charts12mView) dom.charts12mView.classList.toggle("hidden", tabKey !== "12m");
    if (dom.chartsPeriodoView) dom.chartsPeriodoView.classList.toggle("hidden", tabKey !== "periodo");
    if (dom.chartsHeadcountView) dom.chartsHeadcountView.classList.toggle("hidden", tabKey !== "headcount");

    renderCharts();
  }

  if (dom.tabChart12m) dom.tabChart12m.addEventListener("click", () => switchChartTab("12m"));
  if (dom.tabChartPeriodo) dom.tabChartPeriodo.addEventListener("click", () => switchChartTab("periodo"));
  if (dom.tabChartHeadcount) dom.tabChartHeadcount.addEventListener("click", () => switchChartTab("headcount"));

  // Controles de Tipo de Gráfico de 12 Meses (Barras, Linhas, Empilhado)
  function set12mChartType(type) {
    state.chart12mType = type;
    if (dom.btnChartTypeBar) dom.btnChartTypeBar.classList.toggle("active", type === "bar");
    if (dom.btnChartTypeLine) dom.btnChartTypeLine.classList.toggle("active", type === "line");
    if (dom.btnChartTypeStacked) dom.btnChartTypeStacked.classList.toggle("active", type === "stacked");
    render12mChart();
  }

  if (dom.btnChartTypeBar) dom.btnChartTypeBar.addEventListener("click", () => set12mChartType("bar"));
  if (dom.btnChartTypeLine) dom.btnChartTypeLine.addEventListener("click", () => set12mChartType("line"));
  if (dom.btnChartTypeStacked) dom.btnChartTypeStacked.addEventListener("click", () => set12mChartType("stacked"));

  // Controles de Janela de Meses (12M, 6M, Tudo)
  [dom.btnRange12m, dom.btnRange6m, dom.btnRangeAll].forEach(btn => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      [dom.btnRange12m, dom.btnRange6m, dom.btnRangeAll].forEach(b => b && b.classList.remove("active"));
      btn.classList.add("active");
      state.chart12mRange = btn.dataset.range;
      render12mChart();
    });
  });

  // Botão de Demonstração (Completar 12 Meses Contínuos)
  if (dom.btnSeed12m) {
    dom.btnSeed12m.addEventListener("click", async () => {
      try {
        let url = "/api/demo-12-meses";
        if (state.selectedEmpresa) url += `?empresa=${encodeURIComponent(state.selectedEmpresa)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          showToast(data.message || "Histórico de 12 meses preparado com sucesso!", "success");
          await loadFiltrosMetadados();
          await loadPeriodos();
          if (state.showCharts) renderCharts();
        } else {
          showToast(data.error || "Erro ao gerar folhas demonstrativas", "error");
        }
      } catch (e) {
        showToast("Falha na comunicação com o servidor", "error");
      }
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

  // Drag & Drop no container de períodos (para mover ao final da lista)
  if (dom.periodTabs) {
    dom.periodTabs.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      handleDragAutoScroll(e);
    });

    dom.periodTabs.addEventListener("drop", (e) => {
      if (e.target === dom.periodTabs && draggedPeriodId != null) {
        e.preventDefault();
        clearDragOverClasses();
        const sourceId = Number(draggedPeriodId);
        const sourceIdx = state.periodos.findIndex(item => item.id === sourceId);
        if (sourceIdx !== -1 && sourceIdx !== state.periodos.length - 1) {
          const [movedPeriod] = state.periodos.splice(sourceIdx, 1);
          state.periodos.push(movedPeriod);
          savePeriodOrder();
          renderPeriodTabs(sourceId);
          showToast(`Período ${movedPeriod.mes_ano || movedPeriod.periodo_texto} movido para o final!`, "info");
        }
      }
    });
  }

  // Botão de restaurar ordem original dos períodos
  if (dom.btnResetOrder) {
    dom.btnResetOrder.addEventListener("click", resetPeriodOrder);
  }
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

// Controle de estado e persistência para Drag & Drop de Folhas e Períodos
let draggedPeriodId = null;
let isDraggingTab = false;
let dragHasMoved = false;
const STORAGE_KEY_ORDER = "holeritis_periods_custom_order";

function getSavedPeriodOrder() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDER);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function applySavedPeriodOrder() {
  const savedOrder = getSavedPeriodOrder();
  if (!savedOrder || savedOrder.length === 0 || !state.periodos || state.periodos.length === 0) {
    return;
  }

  const orderMap = new Map();
  savedOrder.forEach((id, idx) => {
    orderMap.set(Number(id), idx);
  });

  state.periodos.sort((a, b) => {
    const hasA = orderMap.has(Number(a.id));
    const hasB = orderMap.has(Number(b.id));

    if (hasA && hasB) {
      return orderMap.get(Number(a.id)) - orderMap.get(Number(b.id));
    }
    if (!hasA && hasB) {
      return -1; // Novos relatórios adicionados ficam em destaque no topo
    }
    if (hasA && !hasB) {
      return 1;
    }
    return b.id - a.id;
  });
}

function savePeriodOrder() {
  try {
    const currentIds = state.periodos.map(p => Number(p.id));
    const previousOrder = getSavedPeriodOrder().map(id => Number(id));
    
    // Mesclar: preserva ordem visível atual e mantém IDs de outras empresas filtradas
    const currentSet = new Set(currentIds);
    const remaining = previousOrder.filter(id => !currentSet.has(id));
    const mergedOrder = [...currentIds, ...remaining];

    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(mergedOrder));
    updateResetOrderButton();
  } catch (e) {
    console.error("Erro ao salvar ordem dos períodos:", e);
  }
}

function resetPeriodOrder() {
  localStorage.removeItem(STORAGE_KEY_ORDER);
  updateResetOrderButton();
  loadPeriodos(state.currentPeriodoId);
  showToast("Ordem dos períodos restaurada para o padrão!", "info");
}

function updateResetOrderButton() {
  if (!dom.btnResetOrder) return;
  const savedOrder = getSavedPeriodOrder();
  if (savedOrder && savedOrder.length > 0) {
    dom.btnResetOrder.classList.remove("hidden");
  } else {
    dom.btnResetOrder.classList.add("hidden");
  }
}

function clearDragOverClasses() {
  if (!dom.periodTabs) return;
  dom.periodTabs.querySelectorAll(".period-tab-btn").forEach(el => {
    el.classList.remove("drag-over-before", "drag-over-after");
  });
}

function handleDragAutoScroll(e) {
  const wrapper = dom.periodTabs ? dom.periodTabs.parentElement : null;
  if (!wrapper) return;
  const rect = wrapper.getBoundingClientRect();
  const threshold = 60;
  
  if (e.clientX > rect.right - threshold && wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth) {
    wrapper.scrollLeft += 10;
  } else if (e.clientX < rect.left + threshold && wrapper.scrollLeft > 0) {
    wrapper.scrollLeft -= 10;
  }
}

// Atualizar título visual e contexto da empresa ativa
function updateCompanyDisplay() {
  if (dom.selectedCompanyTitle) {
    dom.selectedCompanyTitle.textContent = state.selectedEmpresa || "Todas as Empresas (Visão Global)";
  }
  if (dom.periodContextHint) {
    if (state.selectedEmpresa) {
      dom.periodContextHint.textContent = `Exibindo folhas da empresa: ${state.selectedEmpresa} • Arraste para reordenar`;
    } else {
      dom.periodContextHint.textContent = "Classificação automática por Razão Social e competência • Arraste para reordenar";
    }
  }
}

// Carregar metadados de filtros disponíveis (Anos e Competências)
async function loadFiltrosMetadados() {
  try {
    const res = await fetch("/api/filtros");
    const data = await res.json();
    if (!data.success) return;

    state.availableFiltros = {
      anos: data.anos || [],
      competencias: data.competencias || []
    };

    if (dom.filterDateDe && dom.filterDateAte) {
      const currentDe = dom.filterDateDe.value;
      const currentAte = dom.filterDateAte.value;

      dom.filterDateDe.innerHTML = '<option value="">Início</option>';
      dom.filterDateAte.innerHTML = '<option value="">Fim</option>';

      data.competencias.forEach(comp => {
        const optDe = document.createElement("option");
        optDe.value = comp;
        optDe.textContent = comp;
        dom.filterDateDe.appendChild(optDe);

        const optAte = document.createElement("option");
        optAte.value = comp;
        optAte.textContent = comp;
        dom.filterDateAte.appendChild(optAte);
      });

      dom.filterDateDe.value = currentDe || "";
      dom.filterDateAte.value = currentAte || "";
    }

    if (dom.filterDateAno) {
      const currentAno = dom.filterDateAno.value;
      dom.filterDateAno.innerHTML = '<option value="">Todos</option>';
      data.anos.forEach(ano => {
        const opt = document.createElement("option");
        opt.value = ano;
        opt.textContent = ano;
        dom.filterDateAno.appendChild(opt);
      });
      dom.filterDateAno.value = currentAno || "";
    }
  } catch (err) {
    console.error("Erro ao carregar metadados de filtros:", err);
  }
}

// Carregar lista de períodos da API (com filtro opcional de empresa, data e períodos)
async function loadPeriodos(selectPeriodoId = null) {
  try {
    const params = new URLSearchParams();
    if (state.selectedEmpresa) params.append("empresa", state.selectedEmpresa);
    if (state.dateFilter.de) params.append("de", state.dateFilter.de);
    if (state.dateFilter.ate) params.append("ate", state.dateFilter.ate);
    if (state.dateFilter.ano) params.append("ano", state.dateFilter.ano);
    if (state.dateFilter.preset && state.dateFilter.preset !== "all") {
      params.append("preset", state.dateFilter.preset);
    }

    const queryString = params.toString();
    const url = queryString ? `/api/periodos?${queryString}` : "/api/periodos";

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "Erro ao carregar períodos", "error");
      return;
    }

    state.periodos = data.periodos || [];

    // Atualizar badge de filtros e botão de limpar
    const isFiltered = state.dateFilter.preset !== "all" || !!state.dateFilter.de || !!state.dateFilter.ate || !!state.dateFilter.ano;
    if (dom.btnClearDateFilter) {
      dom.btnClearDateFilter.classList.toggle("hidden", !isFiltered);
    }
    if (dom.periodFilterBadge) {
      const count = state.periodos.length;
      dom.periodFilterBadge.textContent = `${count} ${count === 1 ? "Período" : "Períodos"}${isFiltered ? " (filtrado)" : ""}`;
      dom.periodFilterBadge.className = `badge ${isFiltered ? "badge-filter-count" : "badge-info"}`;
    }

    // Aplicar ordenação personalizada do usuário salva se existir
    applySavedPeriodOrder();

    if (state.periodos.length === 0) {
      dom.reportView.classList.add("hidden");
      dom.emptyState.classList.remove("hidden");
      dom.periodTabs.innerHTML = "<span class='tab-placeholder'>Nenhum relatório encontrado para este filtro</span>";
      state.currentPeriodoId = null;
      state.currentRelatorio = null;
      updateResetOrderButton();
      return;
    }

    dom.reportView.classList.remove("hidden");
    dom.emptyState.classList.add("hidden");

    renderPeriodTabs();
    updateResetOrderButton();

    // Selecionar o primeiro ou o especificado
    const toSelect = selectPeriodoId || (state.currentPeriodoId && state.periodos.some(p => p.id === state.currentPeriodoId) ? state.currentPeriodoId : state.periodos[0].id);
    await selectPeriodo(toSelect);
  } catch (err) {
    console.error(err);
    showToast("Falha ao comunicar com o servidor", "error");
  }
}

// Renderizar Tabs de Períodos com destaque para a Razão Social da Empresa e Suporte a Drag & Drop
function renderPeriodTabs(highlightId = null) {
  dom.periodTabs.innerHTML = "";
  state.periodos.forEach((p, index) => {
    const btn = document.createElement("div");
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("draggable", "true");
    btn.dataset.id = p.id;
    btn.dataset.index = index;
    btn.className = `period-tab-btn ${p.id === state.currentPeriodoId ? "active" : ""}`;
    btn.title = "Clique para selecionar • Arraste para mudar a ordem de lugar";

    if (highlightId && p.id === highlightId) {
      btn.classList.add("just-dropped");
      setTimeout(() => btn.classList.remove("just-dropped"), 500);
    }
    
    // Tag da Razão Social (quando estiver em visão global de todas as empresas)
    const empresaTag = (!state.selectedEmpresa && p.empresa) 
      ? `<span class="tab-empresa-pill" title="${p.empresa}">${p.empresa}</span>` 
      : "";

    btn.innerHTML = `
      <div class="tab-header-row">
        <div class="tab-title-with-drag">
          <span class="tab-drag-handle" title="Segure e arraste para mudar a ordem">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="5" r="2.2"/>
              <circle cx="16" cy="5" r="2.2"/>
              <circle cx="8" cy="12" r="2.2"/>
              <circle cx="16" cy="12" r="2.2"/>
              <circle cx="8" cy="19" r="2.2"/>
              <circle cx="16" cy="19" r="2.2"/>
            </svg>
          </span>
          <span class="tab-comp">${p.mes_ano || p.periodo_texto}</span>
        </div>
        ${empresaTag}
      </div>
      <span class="tab-sub">${p.total_funcionarios} colaborad. • ${formatBRL(p.total_liquido)}</span>
    `;

    // Click: seleciona período (ignora se o usuário estava arrastando)
    btn.addEventListener("click", (e) => {
      if (dragHasMoved || isDraggingTab) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      selectPeriodo(p.id);
    });

    // Acessibilidade via teclado (Enter ou Barra de Espaço)
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectPeriodo(p.id);
      }
    });

    // Início do arrasto
    btn.addEventListener("dragstart", (e) => {
      draggedPeriodId = p.id;
      isDraggingTab = true;
      dragHasMoved = false;
      btn.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(p.id));
    });

    // Passar por cima de outro período
    btn.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      dragHasMoved = true;

      if (draggedPeriodId == null || Number(draggedPeriodId) === p.id) {
        btn.classList.remove("drag-over-before", "drag-over-after");
        return;
      }

      const rect = btn.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const isBefore = e.clientX < midX;

      dom.periodTabs.querySelectorAll(".period-tab-btn").forEach(el => {
        if (el !== btn) el.classList.remove("drag-over-before", "drag-over-after");
      });

      if (isBefore) {
        btn.classList.add("drag-over-before");
        btn.classList.remove("drag-over-after");
      } else {
        btn.classList.add("drag-over-after");
        btn.classList.remove("drag-over-before");
      }

      handleDragAutoScroll(e);
    });

    // Sair do elemento alvo
    btn.addEventListener("dragleave", (e) => {
      if (!btn.contains(e.relatedTarget)) {
        btn.classList.remove("drag-over-before", "drag-over-after");
      }
    });

    // Soltar elemento para reposicionar
    btn.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearDragOverClasses();

      if (draggedPeriodId == null || Number(draggedPeriodId) === p.id) return;

      const rect = btn.getBoundingClientRect();
      const isBefore = e.clientX < rect.left + rect.width / 2;

      const sourceId = Number(draggedPeriodId);
      const targetId = p.id;

      const sourceIdx = state.periodos.findIndex(item => item.id === sourceId);
      if (sourceIdx === -1) return;

      const [movedPeriod] = state.periodos.splice(sourceIdx, 1);
      let targetIdx = state.periodos.findIndex(item => item.id === targetId);
      if (targetIdx === -1) {
        state.periodos.push(movedPeriod);
      } else {
        if (!isBefore) targetIdx += 1;
        state.periodos.splice(targetIdx, 0, movedPeriod);
      }

      savePeriodOrder();
      renderPeriodTabs(sourceId);
      showToast(`Ordem alterada: ${movedPeriod.mes_ano || movedPeriod.periodo_texto} reposicionado!`, "info");
    });

    // Finalizar arrasto
    btn.addEventListener("dragend", () => {
      btn.classList.remove("is-dragging");
      clearDragOverClasses();
      setTimeout(() => {
        isDraggingTab = false;
        dragHasMoved = false;
        draggedPeriodId = null;
      }, 120);
    });

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

  if (state.activeChartTab === "12m") {
    // 1. Gráfico Principal: Evolução de 12 Meses (Proventos vs Adiantamentos vs Líquido)
    render12mChart();
  } else if (state.activeChartTab === "periodo") {
    // 2. Gráficos do Período Selecionado
    if (!state.currentRelatorio) return;
    const rel = state.currentRelatorio;

    // Gráfico de Composição Financeira (Doughnut)
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

    // Gráfico dos Maiores Proventos (Horizontal Bar)
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
  } else if (state.activeChartTab === "headcount") {
    // 3. Gráfico de Evolução de Colaboradores e Média Salarial
    if (!state.periodos || state.periodos.length === 0) return;

    const sortedPeriodos = [...state.periodos].sort((a, b) => parseMesAnoKey(a.mes_ano) - parseMesAnoKey(b.mes_ano));
    const labels = sortedPeriodos.map(p => p.mes_ano || p.periodo_texto);
    const dataHeadcount = sortedPeriodos.map(p => p.total_funcionarios);
    const dataMediaSalarial = sortedPeriodos.map(p => p.total_funcionarios > 0 ? (p.total_salario / p.total_funcionarios) : 0);

    const ctxEvolucaoHeadcount = document.getElementById("canvas-evolucao-headcount");
    if (ctxEvolucaoHeadcount) {
      if (state.chartEvolucaoHeadcount) state.chartEvolucaoHeadcount.destroy();

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

// Renderização do Gráfico e Dashboard de Evolução de 12 Meses
async function render12mChart() {
  if (typeof Chart === "undefined") return;

  const isDark = document.body.classList.contains("theme-dark");
  const textColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const ctx12m = document.getElementById("canvas-evolucao-12m");
  if (!ctx12m) return;

  // Montar parâmetros de busca
  const params = new URLSearchParams();
  if (state.selectedEmpresa) params.append("empresa", state.selectedEmpresa);
  
  const limit = state.chart12mRange === "all" ? 100 : (parseInt(state.chart12mRange) || 12);
  params.append("limite", String(limit));

  if (state.dateFilter.de) params.append("de", state.dateFilter.de);
  if (state.dateFilter.ate) params.append("ate", state.dateFilter.ate);
  if (state.dateFilter.ano) params.append("ano", state.dateFilter.ano);

  try {
    const res = await fetch(`/api/evolucao-12-meses?${params.toString()}`);
    const data = await res.json();
    if (!data.success || !data.evolucao) return;

    const ev = data.evolucao;
    state.evolucao12mData = ev;

    // 1. Atualizar KPIs de 12M
    if (dom.kpi12mProventos) dom.kpi12mProventos.textContent = formatBRL(ev.totais.total_proventos);
    if (dom.kpi12mMediaProventos) dom.kpi12mMediaProventos.textContent = `Média: ${formatBRL(ev.totais.media_proventos)}/mês`;
    
    if (dom.kpi12mAdiantamento) dom.kpi12mAdiantamento.textContent = formatBRL(ev.totais.total_adiantamento);
    if (dom.kpi12mPctAdiantamento) dom.kpi12mPctAdiantamento.textContent = `${ev.totais.pct_adiantamento_sobre_proventos}% dos proventos • Média: ${formatBRL(ev.totais.media_adiantamento)}`;
    
    if (dom.kpi12mLiquido) dom.kpi12mLiquido.textContent = formatBRL(ev.totais.total_liquido);
    if (dom.kpi12mPctLiquido) dom.kpi12mPctLiquido.textContent = `${ev.totais.pct_liquido_sobre_proventos}% do bruto • Média: ${formatBRL(ev.totais.media_liquido)}`;

    if (dom.kpi12mPico) dom.kpi12mPico.textContent = ev.totais.mes_maior_folha || "--/----";
    if (dom.kpi12mMinimo) dom.kpi12mMinimo.textContent = `Menor folha: ${ev.totais.mes_menor_folha || "--/----"}`;

    // 2. Destruir instância anterior do Chart se existir
    if (state.chart12mInstance) {
      state.chart12mInstance.destroy();
      state.chart12mInstance = null;
    }

    const labels = ev.labels;
    const dataProv = ev.series.proventos;
    const dataAdv = ev.series.adiantamento;
    const dataLiq = ev.series.liquido;

    let chartConfig = null;

    if (state.chart12mType === "line") {
      chartConfig = {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Total Proventos",
              data: dataProv,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: "#3b82f6"
            },
            {
              label: "Total Adiantamentos",
              data: dataAdv,
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderWidth: 2.8,
              fill: true,
              tension: 0.35,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: "#f59e0b"
            },
            {
              label: "Total Líquido",
              data: dataLiq,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.14)",
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: "#10b981"
            }
          ]
        },
        options: get12mChartOptions(textColor, gridColor, false)
      };
    } else if (state.chart12mType === "stacked") {
      // Barras empilhadas mostrando a composição
      chartConfig = {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Total Líquido",
              data: dataLiq,
              backgroundColor: "#10b981",
              borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
              stack: "composicao"
            },
            {
              label: "Adiantamento Anterior",
              data: dataAdv,
              backgroundColor: "#f59e0b",
              borderRadius: 0,
              stack: "composicao"
            },
            {
              label: "Outros Descontos",
              data: ev.series.descontos.map((d, i) => Math.max(0, d - dataAdv[i])),
              backgroundColor: "#ef4444",
              borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
              stack: "composicao"
            }
          ]
        },
        options: get12mChartOptions(textColor, gridColor, true)
      };
    } else {
      // Barras agrupadas lado a lado (Padrão para Comparação Direta)
      chartConfig = {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Total Proventos",
              data: dataProv,
              backgroundColor: "#3b82f6",
              borderRadius: 5,
              borderSkipped: false
            },
            {
              label: "Total Adiantamentos",
              data: dataAdv,
              backgroundColor: "#f59e0b",
              borderRadius: 5,
              borderSkipped: false
            },
            {
              label: "Total Líquido",
              data: dataLiq,
              backgroundColor: "#10b981",
              borderRadius: 5,
              borderSkipped: false
            }
          ]
        },
        options: get12mChartOptions(textColor, gridColor, false)
      };
    }

    state.chart12mInstance = new Chart(ctx12m, chartConfig);

    // 3. Atualizar Tabela Analítica Mês a Mês dos 12 Meses
    render12mTable(ev.mes_a_mes);

  } catch (err) {
    console.error("Erro ao carregar gráfico de 12 meses:", err);
  }
}

// Opções Universais para o Gráfico de 12 Meses
function get12mChartOptions(textColor, gridColor, isStacked = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false
    },
    scales: {
      x: {
        stacked: isStacked,
        ticks: { color: textColor, font: { family: "Plus Jakarta Sans", weight: 600 } },
        grid: { color: gridColor }
      },
      y: {
        stacked: isStacked,
        ticks: {
          color: textColor,
          font: { family: "JetBrains Mono" },
          callback: (v) => "R$ " + (v / 1000).toFixed(0) + "k"
        },
        grid: { color: gridColor }
      }
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: textColor,
          font: { family: "Plus Jakarta Sans", size: 12, weight: 600 },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatBRL(ctx.raw)}`,
          footer: (items) => {
            const rawProv = items.find(it => it.dataset.label === "Total Proventos")?.raw;
            const rawAdv = items.find(it => it.dataset.label === "Total Adiantamentos")?.raw;
            if (rawProv && rawAdv && rawProv > 0) {
              const pct = ((rawAdv / rawProv) * 100).toFixed(1);
              return `\nAdiantamento representa ${pct}% dos proventos`;
            }
            return "";
          }
        }
      }
    }
  };
}

// Renderizar Tabela Comparativa Resumida Mês a Mês (12 Meses)
function render12mTable(meses) {
  if (!dom.table12mBody) return;
  dom.table12mBody.innerHTML = "";

  if (!meses || meses.length === 0) {
    dom.table12mBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 24px;">Nenhuma competência encontrada para o filtro</td></tr>`;
    return;
  }

  meses.forEach(m => {
    const tr = document.createElement("tr");

    let trendBadge = `<span class="badge-trend-neutral">─ Estável</span>`;
    if (m.var_liquido_mom > 0) {
      trendBadge = `<span class="badge-trend-up">▲ +${m.var_liquido_mom}%</span>`;
    } else if (m.var_liquido_mom < 0) {
      trendBadge = `<span class="badge-trend-down">▼ ${m.var_liquido_mom}%</span>`;
    }

    tr.innerHTML = `
      <td><strong>${m.mes_ano}</strong></td>
      <td><span class="tab-empresa-pill" title="${m.empresa}">${m.empresa || "Empresa"}</span></td>
      <td class="text-right">${m.colaboradores}</td>
      <td class="text-right font-mono font-semibold" style="color: #3b82f6;">${formatBRL(m.proventos)}</td>
      <td class="text-right font-mono text-amber font-semibold">${formatBRL(m.adiantamento)}</td>
      <td class="text-right font-mono text-muted">${m.pct_adiantamento}%</td>
      <td class="text-right font-mono text-danger font-semibold">${formatBRL(m.descontos)}</td>
      <td class="text-right font-mono text-success text-bold">${formatBRL(m.liquido)}</td>
      <td class="text-center">${trendBadge}</td>
      <td class="text-center">
        <button class="btn-table-goto" data-id="${m.periodo_id}" type="button" title="Ver relatório desta folha">
          Ver Folha
        </button>
      </td>
    `;

    const btnGoto = tr.querySelector(".btn-table-goto");
    if (btnGoto && m.periodo_id) {
      btnGoto.addEventListener("click", (e) => {
        e.stopPropagation();
        selectPeriodo(m.periodo_id);
        dom.reportView.scrollIntoView({ behavior: "smooth" });
      });
    }

    dom.table12mBody.appendChild(tr);
  });
}

// Iniciar ao carregar a página
document.addEventListener("DOMContentLoaded", initApp);

