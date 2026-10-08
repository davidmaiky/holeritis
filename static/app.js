/**
 * Lógica do Sistema de Gestão de Folha de Pagamento & Holerites
 * Responsável por: Autenticação, Gestão de Usuários, Uploads, Filtros, Gráficos e Exportações.
 */

// Estado Global da Aplicação
const state = {
  // Autenticação e Usuários
  token: localStorage.getItem("holerite_auth_token") || "",
  currentUser: null,
  usersList: [],

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

// Interceptor Global de Fetch para envio de Token e Detecção de 401
const _nativeFetch = window.fetch;
window.fetch = async function(resource, init) {
  init = init || {};
  init.headers = init.headers || {};
  if (state.token) {
    if (init.headers instanceof Headers) {
      if (!init.headers.has("Authorization")) {
        init.headers.set("Authorization", `Bearer ${state.token}`);
      }
    } else if (Array.isArray(init.headers)) {
      init.headers.push(["Authorization", `Bearer ${state.token}`]);
    } else {
      if (!init.headers["Authorization"]) {
        init.headers["Authorization"] = `Bearer ${state.token}`;
      }
    }
  }
  const response = await _nativeFetch(resource, init);
  if (response.status === 401) {
    const urlStr = typeof resource === "string" ? resource : (resource.url || "");
    if (!urlStr.includes("/api/auth/login") && !urlStr.includes("/api/auth/me")) {
      handleSessionExpired();
    }
  }
  return response;
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
  modalSalarioTop: document.getElementById("modal-salario-top"),
  modalEmpAdmissao: document.getElementById("modal-emp-admissao"),
  modalEmpSituacao: document.getElementById("modal-emp-situacao"),
  modalEmpDepIr: document.getElementById("modal-emp-dep-ir"),
  modalEventosTbody: document.getElementById("modal-eventos-tbody"),
  modalEventosCount: document.getElementById("modal-eventos-count"),
  modalTableTotalProventos: document.getElementById("modal-table-total-proventos"),
  modalTableTotalDescontos: document.getElementById("modal-table-total-descontos"),
  modalSalario: document.getElementById("modal-salario"),
  modalProventos: document.getElementById("modal-proventos"),
  modalAdiantamento: document.getElementById("modal-adiantamento"),
  modalDescontos: document.getElementById("modal-descontos"),
  modalLiquido: document.getElementById("modal-liquido"),
  modalBaseInssEmpresa: document.getElementById("modal-base-inss-empresa"),
  modalBaseInssFunc: document.getElementById("modal-base-inss-func"),
  modalBaseInss13: document.getElementById("modal-base-inss-13"),
  modalBaseFgts: document.getElementById("modal-base-fgts"),
  modalBaseFgts13: document.getElementById("modal-base-fgts-13"),
  modalValorFgts: document.getElementById("modal-valor-fgts"),
  modalBaseIrrf: document.getElementById("modal-base-irrf"),
  modalDeducoesIrrf: document.getElementById("modal-deducoes-irrf"),
  btnExportHoleriteExcel: document.getElementById("btn-export-holerite-excel"),

  printEmpresaInfo: document.getElementById("print-empresa-info"),
  printPeriodoInfo: document.getElementById("print-periodo-info"),
  printTimestamp: document.getElementById("print-timestamp"),

  // Elementos de Autenticação / Login
  authOverlay: document.getElementById("auth-overlay"),
  formLogin: document.getElementById("form-login"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginRemember: document.getElementById("login-remember"),
  btnToggleLoginPwd: document.getElementById("btn-toggle-login-pwd"),
  eyeOpenIcon: document.getElementById("eye-open-icon"),
  eyeClosedIcon: document.getElementById("eye-closed-icon"),
  btnSubmitLogin: document.getElementById("btn-submit-login"),
  loginSpinner: document.getElementById("login-spinner"),
  loginErrorAlert: document.getElementById("login-error-alert"),
  loginErrorText: document.getElementById("login-error-text"),
  btnFillDemoLogin: document.getElementById("btn-fill-demo-login"),

  // Menu de Usuário Topbar
  userMenuWrap: document.getElementById("user-menu-wrap"),
  btnUserProfileMenu: document.getElementById("btn-user-profile-menu"),
  userDropdownMenu: document.getElementById("user-dropdown-menu"),
  userAvatarInitials: document.getElementById("user-avatar-initials"),
  userDisplayName: document.getElementById("user-display-name"),
  userRoleBadge: document.getElementById("user-role-badge"),
  dropdownAvatarLarge: document.getElementById("dropdown-avatar-large"),
  dropdownUserName: document.getElementById("dropdown-user-name"),
  dropdownUserEmail: document.getElementById("dropdown-user-email"),
  dropdownUserCargo: document.getElementById("dropdown-user-cargo"),
  btnOpenPerfil: document.getElementById("btn-open-perfil"),
  btnOpenUsuarios: document.getElementById("btn-open-usuarios"),
  btnLogout: document.getElementById("btn-logout"),

  // Modal de Gerenciamento de Usuários
  modalUsuarios: document.getElementById("modal-usuarios"),
  btnCloseModalUsuarios: document.getElementById("btn-close-modal-usuarios"),
  btnCloseModalUsuariosBottom: document.getElementById("btn-close-modal-usuarios-bottom"),
  searchUsuarios: document.getElementById("search-usuarios"),
  filterUserRole: document.getElementById("filter-user-role"),
  btnNovoUsuario: document.getElementById("btn-novo-usuario"),
  usersTableBody: document.getElementById("users-table-body"),
  kpiUsersTotal: document.getElementById("kpi-users-total"),
  kpiUsersAdmins: document.getElementById("kpi-users-admins"),
  kpiUsersOperadores: document.getElementById("kpi-users-operadores"),
  kpiUsersAtivos: document.getElementById("kpi-users-ativos"),

  // Modal de Formulário de Usuário (Criar / Editar)
  modalFormUsuario: document.getElementById("modal-form-usuario"),
  userFormModalTitle: document.getElementById("user-form-modal-title"),
  btnCloseFormUsuario: document.getElementById("btn-close-form-usuario"),
  btnCancelarFormUsuario: document.getElementById("btn-cancelar-form-usuario"),
  formUsuario: document.getElementById("form-usuario"),
  formUserId: document.getElementById("form-user-id"),
  formUserNome: document.getElementById("form-user-nome"),
  formUserUsername: document.getElementById("form-user-username"),
  formUserEmail: document.getElementById("form-user-email"),
  formUserCargo: document.getElementById("form-user-cargo"),
  formUserRole: document.getElementById("form-user-role"),
  formUserAtivo: document.getElementById("form-user-ativo"),
  formUserSenha: document.getElementById("form-user-senha"),
  formUserConfirmaSenha: document.getElementById("form-user-confirma-senha"),
  labelUserSenha: document.getElementById("label-user-senha"),
  formSenhaHint: document.getElementById("form-senha-hint"),
  formUserError: document.getElementById("form-user-error"),
  spinnerSalvarUser: document.getElementById("spinner-salvar-user"),

  // Modal Meu Perfil
  modalPerfil: document.getElementById("modal-perfil"),
  btnCloseModalPerfil: document.getElementById("btn-close-modal-perfil"),
  btnCancelarPerfil: document.getElementById("btn-cancelar-perfil"),
  formMeuPerfil: document.getElementById("form-meu-perfil"),
  perfilAvatarPreview: document.getElementById("perfil-avatar-preview"),
  perfilBannerUsername: document.getElementById("perfil-banner-username"),
  perfilBannerRole: document.getElementById("perfil-banner-role"),
  perfilBannerCargo: document.getElementById("perfil-banner-cargo"),
  perfilInputNome: document.getElementById("perfil-input-nome"),
  perfilInputEmail: document.getElementById("perfil-input-email"),
  perfilSenhaAtual: document.getElementById("perfil-senha-atual"),
  perfilNovaSenha: document.getElementById("perfil-nova-senha"),
  perfilConfirmaSenha: document.getElementById("perfil-confirma-senha"),
  perfilErrorAlert: document.getElementById("perfil-error-alert"),
  spinnerSalvarPerfil: document.getElementById("spinner-salvar-perfil")
};

// Formatação Monetária Brasileira
function formatBRL(value) {
  if (value === null || value === undefined || isNaN(value)) value = 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

// Sanitização HTML segura
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

// ==========================================================================
// MÓDULO DE AUTENTICAÇÃO E SESSÃO DO USUÁRIO
// ==========================================================================

function handleSessionExpired() {
  state.token = "";
  state.currentUser = null;
  localStorage.removeItem("holerite_auth_token");
  sessionStorage.removeItem("holerite_auth_token");
  showAuthOverlay();
  showToast("Sua sessão expirou. Por favor, autentique-se novamente.", "error");
}

function showAuthOverlay() {
  if (dom.authOverlay) {
    dom.authOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function hideAuthOverlay() {
  if (dom.authOverlay) {
    dom.authOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

async function checkAuthAndInit() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.success && data.authenticated && data.user) {
      applyAuthenticatedUser(data.user);
      hideAuthOverlay();
      await loadEmpresas();
      await loadFiltrosMetadados();
      await loadPeriodos();
    } else {
      showAuthOverlay();
    }
  } catch (err) {
    console.error("Erro ao verificar autenticação inicial:", err);
    showAuthOverlay();
  }
}

function getInitials(name) {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function applyAuthenticatedUser(user) {
  state.currentUser = user;
  const initials = getInitials(user.nome || user.username);

  if (dom.userAvatarInitials) dom.userAvatarInitials.textContent = initials;
  if (dom.dropdownAvatarLarge) dom.dropdownAvatarLarge.textContent = initials;
  if (dom.userDisplayName) dom.userDisplayName.textContent = user.nome || user.username;
  if (dom.dropdownUserName) dom.dropdownUserName.textContent = user.nome || user.username;
  if (dom.dropdownUserEmail) dom.dropdownUserEmail.textContent = user.email || `${user.username}@holeritemanager.local`;
  if (dom.dropdownUserCargo) dom.dropdownUserCargo.textContent = user.cargo || "Colaborador";

  const isAdmin = user.role === "admin";
  if (dom.userRoleBadge) {
    dom.userRoleBadge.textContent = isAdmin ? "Admin" : "Operador";
    dom.userRoleBadge.className = `badge-role-pill ${isAdmin ? "badge-role-admin" : "badge-role-operador"}`;
  }

  // Visibilidade de botões restritos a administradores
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = isAdmin ? "" : "none";
  });

  if (dom.btnDeletePeriodo) {
    dom.btnDeletePeriodo.style.display = isAdmin ? "" : "none";
  }
  if (dom.btnSeed12m) {
    dom.btnSeed12m.style.display = isAdmin ? "" : "none";
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  if (dom.loginErrorAlert) dom.loginErrorAlert.classList.add("hidden");

  const username = dom.loginUsername.value.trim();
  const senha = dom.loginPassword.value;
  const remember = dom.loginRemember ? dom.loginRemember.checked : true;

  if (!username || !senha) {
    showLoginError("Informe o usuário e a senha.");
    return;
  }

  if (dom.btnSubmitLogin) dom.btnSubmitLogin.disabled = true;
  if (dom.loginSpinner) dom.loginSpinner.classList.remove("hidden");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, senha })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showLoginError(data.error || "Usuário ou senha incorretos.");
      return;
    }

    state.token = data.token;
    if (remember) {
      localStorage.setItem("holerite_auth_token", data.token);
    } else {
      sessionStorage.setItem("holerite_auth_token", data.token);
    }

    applyAuthenticatedUser(data.user);
    hideAuthOverlay();
    dom.formLogin.reset();
    showToast(`Bem-vindo(a), ${data.user.nome}!`, "success");

    await loadEmpresas();
    await loadFiltrosMetadados();
    await loadPeriodos();
  } catch (err) {
    console.error("Erro na requisição de login:", err);
    showLoginError("Erro de comunicação com o servidor. Tente novamente.");
  } finally {
    if (dom.btnSubmitLogin) dom.btnSubmitLogin.disabled = false;
    if (dom.loginSpinner) dom.loginSpinner.classList.add("hidden");
  }
}

function showLoginError(msg) {
  if (dom.loginErrorText) dom.loginErrorText.textContent = msg;
  if (dom.loginErrorAlert) dom.loginErrorAlert.classList.remove("hidden");
}

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (err) {
    console.warn("Erro ao notificar logout:", err);
  } finally {
    state.token = "";
    state.currentUser = null;
    localStorage.removeItem("holerite_auth_token");
    sessionStorage.removeItem("holerite_auth_token");
    closeUserDropdown();
    showAuthOverlay();
    showToast("Sessão finalizada com sucesso.", "info");
  }
}

function toggleUserDropdown() {
  if (!dom.userDropdownMenu) return;
  const isHidden = dom.userDropdownMenu.classList.contains("hidden");
  if (isHidden) {
    dom.userDropdownMenu.classList.remove("hidden");
    dom.btnUserProfileMenu.setAttribute("aria-expanded", "true");
  } else {
    closeUserDropdown();
  }
}

function closeUserDropdown() {
  if (dom.userDropdownMenu) {
    dom.userDropdownMenu.classList.add("hidden");
  }
  if (dom.btnUserProfileMenu) {
    dom.btnUserProfileMenu.setAttribute("aria-expanded", "false");
  }
}

// ==========================================================================
// MÓDULO DE GESTÃO DE USUÁRIOS (ADMINISTRADOR)
// ==========================================================================

async function openModalUsuarios() {
  closeUserDropdown();
  if (dom.modalUsuarios) {
    dom.modalUsuarios.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    await loadUsuarios();
  }
}

function closeModalUsuarios() {
  if (dom.modalUsuarios) {
    dom.modalUsuarios.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

async function loadUsuarios() {
  if (!dom.usersTableBody) return;
  dom.usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;">Carregando usuários...</td></tr>`;

  try {
    const res = await fetch("/api/usuarios");
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || "Erro ao carregar usuários.", "error");
      return;
    }

    state.usersList = data.usuarios || [];
    updateUsersKPIs(state.usersList);
    filterAndRenderUsuarios();
  } catch (err) {
    console.error("Erro ao carregar lista de usuários:", err);
    dom.usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 24px;">Falha ao carregar lista de usuários.</td></tr>`;
  }
}

function updateUsersKPIs(users) {
  const total = users.length;
  const admins = users.filter(u => u.role === "admin").length;
  const operadores = users.filter(u => u.role !== "admin").length;
  const ativos = users.filter(u => u.ativo).length;

  if (dom.kpiUsersTotal) dom.kpiUsersTotal.textContent = total;
  if (dom.kpiUsersAdmins) dom.kpiUsersAdmins.textContent = admins;
  if (dom.kpiUsersOperadores) dom.kpiUsersOperadores.textContent = operadores;
  if (dom.kpiUsersAtivos) dom.kpiUsersAtivos.textContent = ativos;
}

function filterAndRenderUsuarios() {
  const query = (dom.searchUsuarios ? dom.searchUsuarios.value : "").trim().toLowerCase();
  const roleFilter = dom.filterUserRole ? dom.filterUserRole.value : "all";

  let filtered = state.usersList;

  if (roleFilter !== "all") {
    filtered = filtered.filter(u => u.role === roleFilter);
  }

  if (query) {
    filtered = filtered.filter(u =>
      (u.nome && u.nome.toLowerCase().includes(query)) ||
      (u.username && u.username.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.cargo && u.cargo.toLowerCase().includes(query))
    );
  }

  renderUsuariosTable(filtered);
}

function renderUsuariosTable(users) {
  if (!dom.usersTableBody) return;
  dom.usersTableBody.innerHTML = "";

  if (users.length === 0) {
    dom.usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;">Nenhum usuário encontrado com os filtros atuais.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const tr = document.createElement("tr");
    const initials = getInitials(u.nome || u.username);
    const isAdmin = u.role === "admin";
    const isSelf = state.currentUser && state.currentUser.id === u.id;

    const roleBadge = isAdmin
      ? `<span class="badge-role-pill badge-role-admin">Administrador</span>`
      : `<span class="badge-role-pill badge-role-operador">Operador</span>`;

    const statusBadge = u.ativo
      ? `<span class="badge-status-ativo">Ativo</span>`
      : `<span class="badge-status-inativo">Inativo</span>`;

    const lastLoginText = u.ultimo_login
      ? formatDateTime(u.ultimo_login)
      : `<span class="text-muted">Nunca acessou</span>`;

    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-cell-avatar">${initials}</div>
          <div class="user-cell-meta">
            <strong>${escapeHtml(u.nome)} ${isSelf ? '<span class="badge badge-info" style="font-size: 10px; margin-left: 4px;">Você</span>' : ''}</strong>
            <span>@${escapeHtml(u.username)}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="user-contact-meta">
          <span>${escapeHtml(u.email || "Sem e-mail")}</span>
          <small>${escapeHtml(u.cargo || "Colaborador")}</small>
        </div>
      </td>
      <td class="text-center">${roleBadge}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center font-mono" style="font-size: 12px;">${lastLoginText}</td>
      <td class="text-center">
        <div class="user-actions-cell">
          <button class="btn-action-icon btn-action-edit" data-id="${u.id}" title="Editar dados e permissões" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="btn-action-icon btn-action-toggle" data-id="${u.id}" title="${u.ativo ? 'Desativar acesso deste usuário' : 'Reativar acesso deste usuário'}" type="button" ${isSelf ? 'disabled style="opacity: 0.35; cursor: not-allowed;"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
          </button>
          <button class="btn-action-icon btn-action-delete" data-id="${u.id}" data-name="${escapeHtml(u.username)}" title="Excluir usuário do sistema" type="button" ${isSelf ? 'disabled style="opacity: 0.35; cursor: not-allowed;"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-action-edit").addEventListener("click", () => openModalFormUsuario(u.id));

    const btnToggle = tr.querySelector(".btn-action-toggle");
    if (!isSelf && btnToggle) {
      btnToggle.addEventListener("click", () => toggleUserStatus(u.id, u.nome || u.username, u.ativo));
    }

    const btnDel = tr.querySelector(".btn-action-delete");
    if (!isSelf && btnDel) {
      btnDel.addEventListener("click", () => deleteUser(u.id, u.username));
    }

    dom.usersTableBody.appendChild(tr);
  });
}

function formatDateTime(dtStr) {
  if (!dtStr) return "";
  try {
    const d = new Date(dtStr.replace(" ", "T"));
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return dtStr;
  }
}

// Submodal de Usuário (Criar / Editar)
function openModalFormUsuario(userId = null) {
  if (dom.formUserError) dom.formUserError.classList.add("hidden");
  dom.formUsuario.reset();

  if (userId) {
    const target = state.usersList.find(u => u.id === userId);
    if (!target) return;

    dom.userFormModalTitle.textContent = "Editar Usuário: @" + target.username;
    dom.formUserId.value = target.id;
    dom.formUserNome.value = target.nome || "";
    dom.formUserUsername.value = target.username || "";
    dom.formUserUsername.disabled = true;
    dom.formUserEmail.value = target.email || "";
    dom.formUserCargo.value = target.cargo || "";
    dom.formUserRole.value = target.role || "operador";
    dom.formUserAtivo.value = target.ativo ? "1" : "0";

    dom.labelUserSenha.textContent = "Nova Senha (Opcional)";
    dom.formUserSenha.required = false;
    dom.formUserSenha.placeholder = "Deixe em branco para não alterar";
    dom.formSenhaHint.textContent = "Preencha apenas se desejar redefinir a senha do usuário.";
  } else {
    dom.userFormModalTitle.textContent = "Novo Usuário do Sistema";
    dom.formUserId.value = "";
    dom.formUserUsername.disabled = false;
    dom.formUserRole.value = "operador";
    dom.formUserAtivo.value = "1";

    dom.labelUserSenha.textContent = "Senha de Acesso *";
    dom.formUserSenha.required = true;
    dom.formUserSenha.placeholder = "Mínimo 4 caracteres";
    dom.formSenhaHint.textContent = "Mínimo de 4 caracteres para a senha inicial.";
  }

  if (dom.modalFormUsuario) {
    dom.modalFormUsuario.classList.remove("hidden");
  }
}

function closeModalFormUsuario() {
  if (dom.modalFormUsuario) {
    dom.modalFormUsuario.classList.add("hidden");
  }
}

async function handleSalvarUsuario(e) {
  e.preventDefault();
  if (dom.formUserError) dom.formUserError.classList.add("hidden");

  const id = dom.formUserId.value;
  const isEdit = Boolean(id);

  const nome = dom.formUserNome.value.trim();
  const username = dom.formUserUsername.value.trim().toLowerCase();
  const email = dom.formUserEmail.value.trim().toLowerCase();
  const cargo = dom.formUserCargo.value.trim();
  const role = dom.formUserRole.value;
  const ativo = dom.formUserAtivo.value === "1";
  const senha = dom.formUserSenha.value;
  const confirmaSenha = dom.formUserConfirmaSenha.value;

  if (!isEdit && !username) {
    showFormUserError("Informe o nome de usuário.");
    return;
  }

  if (!isEdit && (!senha || senha.length < 4)) {
    showFormUserError("A senha inicial deve ter pelo menos 4 caracteres.");
    return;
  }

  if (senha && senha !== confirmaSenha) {
    showFormUserError("A confirmação de senha não confere com a senha digitada.");
    return;
  }

  if (dom.spinnerSalvarUser) dom.spinnerSalvarUser.classList.remove("hidden");

  try {
    let url, method, body;
    if (isEdit) {
      url = `/api/usuarios/${id}`;
      method = "PUT";
      body = { nome, email, cargo, role, ativo };
      if (senha) body.nova_senha = senha;
    } else {
      url = "/api/usuarios";
      method = "POST";
      body = { username, nome, email, senha, cargo, role, ativo };
    }

    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showFormUserError(data.error || "Erro ao salvar usuário.");
      return;
    }

    showToast(data.message || "Usuário salvo com sucesso!", "success");
    closeModalFormUsuario();
    await loadUsuarios();

    if (isEdit && state.currentUser && state.currentUser.id === parseInt(id)) {
      applyAuthenticatedUser(data.usuario);
    }
  } catch (err) {
    console.error("Erro ao salvar usuário:", err);
    showFormUserError("Erro ao comunicar com o servidor.");
  } finally {
    if (dom.spinnerSalvarUser) dom.spinnerSalvarUser.classList.add("hidden");
  }
}

function showFormUserError(msg) {
  if (dom.formUserError) {
    dom.formUserError.textContent = msg;
    dom.formUserError.classList.remove("hidden");
  }
}

async function toggleUserStatus(userId, username, statusAtual) {
  const acao = statusAtual ? "desativar" : "ativar";
  if (!confirm(`Deseja realmente ${acao} o acesso do usuário '${username}'?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/usuarios/${userId}/toggle`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || `Erro ao ${acao} usuário.`, "error");
      return;
    }
    showToast(data.message || `Usuário atualizado com sucesso.`, "success");
    await loadUsuarios();
  } catch (err) {
    console.error("Erro ao alternar status do usuário:", err);
    showToast("Erro ao comunicar com o servidor.", "error");
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`Tem certeza de que deseja EXCLUIR definitivamente o usuário '${username}'?\nEsta ação não poderá ser desfeita.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/usuarios/${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || "Erro ao excluir usuário.", "error");
      return;
    }
    showToast(data.message || "Usuário excluído com sucesso.", "success");
    await loadUsuarios();
  } catch (err) {
    console.error("Erro ao excluir usuário:", err);
    showToast("Erro ao comunicar com o servidor.", "error");
  }
}

// ==========================================================================
// MÓDULO DE MEU PERFIL E ALTERAÇÃO DE SENHA PESSOAL
// ==========================================================================

function openModalPerfil() {
  closeUserDropdown();
  if (!state.currentUser) return;

  if (dom.perfilErrorAlert) dom.perfilErrorAlert.classList.add("hidden");
  dom.formMeuPerfil.reset();

  const u = state.currentUser;
  const initials = getInitials(u.nome || u.username);

  if (dom.perfilAvatarPreview) dom.perfilAvatarPreview.textContent = initials;
  if (dom.perfilBannerUsername) dom.perfilBannerUsername.textContent = "@" + u.username;
  if (dom.perfilBannerCargo) dom.perfilBannerCargo.textContent = u.cargo || "Colaborador";
  if (dom.perfilBannerRole) {
    const isAdmin = u.role === "admin";
    dom.perfilBannerRole.textContent = isAdmin ? "Administrador" : "Operador";
    dom.perfilBannerRole.className = `badge-role-pill ${isAdmin ? "badge-role-admin" : "badge-role-operador"}`;
  }

  if (dom.perfilInputNome) dom.perfilInputNome.value = u.nome || "";
  if (dom.perfilInputEmail) dom.perfilInputEmail.value = u.email || "";

  if (dom.modalPerfil) {
    dom.modalPerfil.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeModalPerfil() {
  if (dom.modalPerfil) {
    dom.modalPerfil.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

async function handleSalvarPerfil(e) {
  e.preventDefault();
  if (dom.perfilErrorAlert) dom.perfilErrorAlert.classList.add("hidden");

  const nome = dom.perfilInputNome.value.trim();
  const email = dom.perfilInputEmail.value.trim().toLowerCase();
  const senhaAtual = dom.perfilSenhaAtual.value;
  const novaSenha = dom.perfilNovaSenha.value;
  const confirmaSenha = dom.perfilConfirmaSenha.value;

  if (!nome) {
    showPerfilError("O nome completo é obrigatório.");
    return;
  }

  if (novaSenha) {
    if (!senhaAtual) {
      showPerfilError("Informe sua senha atual para autorizar a troca de senha.");
      return;
    }
    if (novaSenha.length < 4) {
      showPerfilError("A nova senha deve ter no mínimo 4 caracteres.");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      showPerfilError("A confirmação da nova senha não confere.");
      return;
    }
  }

  if (dom.spinnerSalvarPerfil) dom.spinnerSalvarPerfil.classList.remove("hidden");

  try {
    const payload = { nome, email };
    if (novaSenha) {
      payload.senha_atual = senhaAtual;
      payload.nova_senha = novaSenha;
    }

    const res = await fetch("/api/auth/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showPerfilError(data.error || "Erro ao atualizar perfil.");
      return;
    }

    showToast("Perfil atualizado com sucesso!", "success");
    applyAuthenticatedUser(data.user);
    closeModalPerfil();
  } catch (err) {
    console.error("Erro ao atualizar perfil próprio:", err);
    showPerfilError("Erro ao comunicar com o servidor.");
  } finally {
    if (dom.spinnerSalvarPerfil) dom.spinnerSalvarPerfil.classList.add("hidden");
  }
}

function showPerfilError(msg) {
  if (dom.perfilErrorAlert) {
    dom.perfilErrorAlert.textContent = msg;
    dom.perfilErrorAlert.classList.remove("hidden");
  }
}

function setupAuthEventListeners() {
  if (dom.formLogin) {
    dom.formLogin.addEventListener("submit", (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      handleLoginSubmit(e);
      return false;
    });
  }

  if (dom.btnSubmitLogin) {
    dom.btnSubmitLogin.addEventListener("click", (e) => {
      if (e) {
        e.preventDefault();
      }
      handleLoginSubmit(e);
    });
  }

  if (dom.btnToggleLoginPwd) {
    dom.btnToggleLoginPwd.addEventListener("click", () => {
      const isPwd = dom.loginPassword.type === "password";
      dom.loginPassword.type = isPwd ? "text" : "password";
      if (dom.eyeOpenIcon && dom.eyeClosedIcon) {
        dom.eyeOpenIcon.classList.toggle("hidden", isPwd);
        dom.eyeClosedIcon.classList.toggle("hidden", !isPwd);
      }
    });
  }

  if (dom.btnFillDemoLogin) {
    dom.btnFillDemoLogin.addEventListener("click", () => {
      if (dom.loginUsername) dom.loginUsername.value = "admin";
      if (dom.loginPassword) dom.loginPassword.value = "admin";
      if (dom.loginErrorAlert) dom.loginErrorAlert.classList.add("hidden");
    });
  }

  if (dom.btnUserProfileMenu) {
    dom.btnUserProfileMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleUserDropdown();
    });
  }

  document.addEventListener("click", (e) => {
    if (dom.userMenuWrap && !dom.userMenuWrap.contains(e.target)) {
      closeUserDropdown();
    }
  });

  if (dom.btnLogout) {
    dom.btnLogout.addEventListener("click", handleLogout);
  }

  if (dom.btnOpenPerfil) dom.btnOpenPerfil.addEventListener("click", openModalPerfil);
  if (dom.btnCloseModalPerfil) dom.btnCloseModalPerfil.addEventListener("click", closeModalPerfil);
  if (dom.btnCancelarPerfil) dom.btnCancelarPerfil.addEventListener("click", closeModalPerfil);
  if (dom.formMeuPerfil) dom.formMeuPerfil.addEventListener("submit", handleSalvarPerfil);

  if (dom.btnOpenUsuarios) dom.btnOpenUsuarios.addEventListener("click", openModalUsuarios);
  if (dom.btnCloseModalUsuarios) dom.btnCloseModalUsuarios.addEventListener("click", closeModalUsuarios);
  if (dom.btnCloseModalUsuariosBottom) dom.btnCloseModalUsuariosBottom.addEventListener("click", closeModalUsuarios);

  if (dom.searchUsuarios) dom.searchUsuarios.addEventListener("input", filterAndRenderUsuarios);
  if (dom.filterUserRole) dom.filterUserRole.addEventListener("change", filterAndRenderUsuarios);

  if (dom.btnNovoUsuario) dom.btnNovoUsuario.addEventListener("click", () => openModalFormUsuario(null));
  if (dom.btnCloseFormUsuario) dom.btnCloseFormUsuario.addEventListener("click", closeModalFormUsuario);
  if (dom.btnCancelarFormUsuario) dom.btnCancelarFormUsuario.addEventListener("click", closeModalFormUsuario);
  if (dom.formUsuario) dom.formUsuario.addEventListener("submit", handleSalvarUsuario);
}

// Inicialização da Aplicação com Verificação de Sessão
async function initApp() {
  initTheme();
  setupAuthEventListeners();
  setupEventListeners();
  await checkAuthAndInit();
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
  if (dom.btnExportHoleriteExcel) {
    dom.btnExportHoleriteExcel.addEventListener("click", () => {
      if (state.currentModalEmployee) {
        exportIndividualHoleriteExcel(state.currentModalEmployee);
      }
    });
  }

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

// ============================================================================
// EXPORTAÇÃO EXCEL PROFISSIONAL COM DETALHAMENTO COMPLETO DE HOLERITES
// Formatação: Cores Azuis para Créditos / Proventos e Vermelhas para Débitos / Descontos
// ============================================================================

const EXCEL_STYLES = {
  fontTitle: { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
  fontSubtitle: { name: "Segoe UI", size: 10, italic: true, color: { argb: "FFFFFFFF" } },
  fontTh: { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
  fontEmpHeader: { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } },
  fontEmpSub: { name: "Segoe UI", size: 9, bold: false, color: { argb: "FF334155" } },
  fontText: { name: "Segoe UI", size: 9, color: { argb: "FF1F2937" } },
  fontCode: { name: "Consolas", size: 9, color: { argb: "FF475569" } },
  fontMuted: { name: "Segoe UI", size: 9, color: { argb: "FF9CA3AF" } },

  // Crédito (Azul Real)
  fontCreditoBadge: { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF1E40AF" } },
  fontCreditoVal: { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF1E40AF" } },
  fillCreditoBadge: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } },
  fillCreditoCell: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } },
  borderCredito: {
    top: { style: "thin", color: { argb: "FFBFDBFE" } },
    left: { style: "thin", color: { argb: "FFBFDBFE" } },
    bottom: { style: "thin", color: { argb: "FFBFDBFE" } },
    right: { style: "thin", color: { argb: "FFBFDBFE" } }
  },

  // Débito (Vermelho Carmesim)
  fontDebitoBadge: { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF991B1B" } },
  fontDebitoVal: { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFB91C1C" } },
  fillDebitoBadge: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } },
  fillDebitoCell: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } },
  borderDebito: {
    top: { style: "thin", color: { argb: "FFFECACA" } },
    left: { style: "thin", color: { argb: "FFFECACA" } },
    bottom: { style: "thin", color: { argb: "FFFECACA" } },
    right: { style: "thin", color: { argb: "FFFECACA" } }
  },

  // Líquido (Verde Institucional)
  fontLiquidoVal: { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF166534" } },
  fillLiquido: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } },

  fontTotaisHeader: { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } },
  fillTotaisBar: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } },

  fillBrand: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } },
  fillTableHead: { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } },
  fillEmpHead: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } },
  fillBasesHead: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } },

  borderBox: {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } }
  },

  numFmtCurr: '"R$" #,##0.00;[Red]-"R$" #,##0.00;"R$" 0.00'
};

async function buildExcelReportWorkbook(rel, employeesList, isIndividual = false) {
  if (typeof ExcelJS === "undefined") {
    throw new Error("Biblioteca ExcelJS indisponível");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "HoleriteManager";
  wb.created = new Date();

  const empresaNome = rel.empresa || "EMPRESA";
  const periodoTxt = rel.periodo_texto || rel.mes_ano || "--";
  const cnpjTxt = rel.cnpj ? `CNPJ: ${rel.cnpj}` : "";

  // =========================================================================
  // ABA 1: HOLERITES DETALHADOS (Todos os eventos, créditos e débitos)
  // =========================================================================
  const sheetTitle = isIndividual ? "Holerite Detalhado" : "Holerites Detalhados";
  const ws1 = wb.addWorksheet(sheetTitle, { views: [{ showGridLines: true }] });

  ws1.columns = [
    { key: "c1", width: 10 }, // Cód
    { key: "c2", width: 44 }, // Descrição
    { key: "c3", width: 14 }, // Referência
    { key: "c4", width: 14 }, // Tipo
    { key: "c5", width: 24 }, // Crédito
    { key: "c6", width: 24 }  // Débito
  ];

  // Banner Geral da Empresa
  ws1.mergeCells(1, 1, 1, 6);
  const titleCell = ws1.getCell(1, 1);
  titleCell.value = `DEMONSTRATIVO DETALHADO DE FOLHA DE PAGAMENTO - ${empresaNome}`;
  titleCell.font = EXCEL_STYLES.fontTitle;
  titleCell.fill = EXCEL_STYLES.fillBrand;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 28;

  ws1.mergeCells(2, 1, 2, 6);
  const subCell = ws1.getCell(2, 1);
  subCell.value = `${cnpjTxt ? cnpjTxt + "   |   " : ""}Período: ${periodoTxt}   |   Competência: ${rel.mes_ano || "--"}`;
  subCell.font = EXCEL_STYLES.fontSubtitle;
  subCell.fill = EXCEL_STYLES.fillBrand;
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 20;

  let r = 4;
  for (const emp of employeesList) {
    const dados = emp.dados_adicionais || {};
    const bases = emp.bases || {};
    const eventos = Array.isArray(emp.eventos) && emp.eventos.length > 0 ? emp.eventos : [];

    // Card do Colaborador - Linha 1: Nome e Código
    ws1.mergeCells(r, 1, r, 6);
    const cEmp = ws1.getCell(r, 1);
    const codStr = emp.codigo ? `Cód: ${emp.codigo}` : "Cód: -";
    cEmp.value = `👤 ${emp.nome}  (${codStr})`;
    cEmp.font = EXCEL_STYLES.fontEmpHeader;
    cEmp.fill = EXCEL_STYLES.fillEmpHead;
    cEmp.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    for (let c = 1; c <= 6; c++) ws1.getCell(r, c).border = EXCEL_STYLES.borderBox;
    ws1.getRow(r).height = 24;
    r++;

    // Card do Colaborador - Linha 2: Ficha Cadastral e Salário Base
    ws1.mergeCells(r, 1, r, 6);
    const cMeta = ws1.getCell(r, 1);
    const salStr = formatBRL(emp.salario);
    cMeta.value = `Cargo: ${emp.funcao || "Não informado"}   |   Admissão: ${dados.admissao || "-"}   |   Situação: ${dados.situacao || "Ativo"}   |   Dep. IR: ${dados.dependentes_ir !== undefined ? dados.dependentes_ir : 0}   |   Salário Base: ${salStr}`;
    cMeta.font = EXCEL_STYLES.fontEmpSub;
    cMeta.fill = EXCEL_STYLES.fillBasesHead;
    cMeta.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    for (let c = 1; c <= 6; c++) ws1.getCell(r, c).border = EXCEL_STYLES.borderBox;
    ws1.getRow(r).height = 20;
    r++;

    // Cabeçalho da Tabela de Rubricas
    const ths = [
      "Cód.",
      "Descrição da Rubrica / Evento",
      "Referência",
      "Tipo",
      "Crédito / Proventos (R$)",
      "Débito / Descontos (R$)"
    ];
    ths.forEach((txt, idx) => {
      const cell = ws1.getCell(r, idx + 1);
      cell.value = txt;
      cell.font = EXCEL_STYLES.fontTh;
      cell.fill = EXCEL_STYLES.fillTableHead;
      cell.alignment = {
        horizontal: (idx === 0 || idx === 2 || idx === 3) ? "center" : (idx >= 4 ? "right" : "left"),
        vertical: "middle"
      };
      cell.border = EXCEL_STYLES.borderBox;
    });
    ws1.getRow(r).height = 22;
    r++;

    // Eventos a renderizar (com fallback elegante para folhas legadas sem rubricas)
    const evtsToRender = eventos.length > 0 ? eventos : [
      { codigo: "001", descricao: "Salário Base / Proventos Contratuais", referencia: "30d", valor: emp.proventos, tipo: "provento" }
    ];
    if (eventos.length === 0 && emp.adiantamento_anterior > 0) {
      evtsToRender.push({ codigo: "012", descricao: "Adiantamento Anterior Compensado", referencia: "-", valor: emp.adiantamento_anterior, tipo: "desconto" });
    }
    if (eventos.length === 0 && emp.descontos > 0) {
      evtsToRender.push({ codigo: "999", descricao: "Descontos e Retenções Legais Totais", referencia: "-", valor: emp.descontos, tipo: "desconto" });
    }

    let somaCred = 0;
    let somaDeb = 0;

    for (const evt of evtsToRender) {
      const isProv = evt.tipo === "provento";
      const val = Number(evt.valor) || 0;
      if (isProv) somaCred += val; else somaDeb += val;

      const c1 = ws1.getCell(r, 1);
      c1.value = evt.codigo || "-";
      c1.font = EXCEL_STYLES.fontCode;
      c1.alignment = { horizontal: "center", vertical: "middle" };
      c1.border = EXCEL_STYLES.borderBox;

      const c2 = ws1.getCell(r, 2);
      c2.value = evt.descricao || "Item";
      c2.font = EXCEL_STYLES.fontText;
      c2.alignment = { horizontal: "left", vertical: "middle" };
      c2.border = EXCEL_STYLES.borderBox;

      const c3 = ws1.getCell(r, 3);
      c3.value = (evt.referencia && evt.referencia !== "-") ? evt.referencia : "-";
      c3.font = EXCEL_STYLES.fontCode;
      c3.alignment = { horizontal: "center", vertical: "middle" };
      c3.border = EXCEL_STYLES.borderBox;

      const c4 = ws1.getCell(r, 4);
      const c5 = ws1.getCell(r, 5);
      const c6 = ws1.getCell(r, 6);

      if (isProv) {
        // Formatação de CRÉDITO em AZUL
        c4.value = "CRÉDITO";
        c4.font = EXCEL_STYLES.fontCreditoBadge;
        c4.fill = EXCEL_STYLES.fillCreditoBadge;
        c4.alignment = { horizontal: "center", vertical: "middle" };
        c4.border = EXCEL_STYLES.borderCredito;

        c5.value = val;
        c5.numFmt = EXCEL_STYLES.numFmtCurr;
        c5.font = EXCEL_STYLES.fontCreditoVal;
        c5.fill = EXCEL_STYLES.fillCreditoCell;
        c5.alignment = { horizontal: "right", vertical: "middle" };
        c5.border = EXCEL_STYLES.borderCredito;

        c6.value = "-";
        c6.font = EXCEL_STYLES.fontMuted;
        c6.alignment = { horizontal: "center", vertical: "middle" };
        c6.border = EXCEL_STYLES.borderBox;
      } else {
        // Formatação de DÉBITO em VERMELHO
        c4.value = "DÉBITO";
        c4.font = EXCEL_STYLES.fontDebitoBadge;
        c4.fill = EXCEL_STYLES.fillDebitoBadge;
        c4.alignment = { horizontal: "center", vertical: "middle" };
        c4.border = EXCEL_STYLES.borderDebito;

        c5.value = "-";
        c5.font = EXCEL_STYLES.fontMuted;
        c5.alignment = { horizontal: "center", vertical: "middle" };
        c5.border = EXCEL_STYLES.borderBox;

        c6.value = val;
        c6.numFmt = EXCEL_STYLES.numFmtCurr;
        c6.font = EXCEL_STYLES.fontDebitoVal;
        c6.fill = EXCEL_STYLES.fillDebitoCell;
        c6.alignment = { horizontal: "right", vertical: "middle" };
        c6.border = EXCEL_STYLES.borderDebito;
      }
      ws1.getRow(r).height = 20;
      r++;
    }

    // Linha de Totais de Eventos (Proventos x Descontos)
    ws1.mergeCells(r, 1, r, 4);
    const cTotL = ws1.getCell(r, 1);
    cTotL.value = "TOTAIS DE EVENTOS (CRÉDITOS & DÉBITOS):";
    cTotL.font = EXCEL_STYLES.fontTotaisHeader;
    cTotL.fill = EXCEL_STYLES.fillTotaisBar;
    cTotL.alignment = { horizontal: "right", vertical: "middle" };
    for (let c = 1; c <= 4; c++) ws1.getCell(r, c).border = EXCEL_STYLES.borderBox;

    const cTotProv = ws1.getCell(r, 5);
    cTotProv.value = somaCred || emp.proventos;
    cTotProv.numFmt = EXCEL_STYLES.numFmtCurr;
    cTotProv.font = EXCEL_STYLES.fontCreditoVal;
    cTotProv.fill = EXCEL_STYLES.fillCreditoBadge;
    cTotProv.alignment = { horizontal: "right", vertical: "middle" };
    cTotProv.border = EXCEL_STYLES.borderCredito;

    const cTotDesc = ws1.getCell(r, 6);
    cTotDesc.value = somaDeb || emp.descontos;
    cTotDesc.numFmt = EXCEL_STYLES.numFmtCurr;
    cTotDesc.font = EXCEL_STYLES.fontDebitoVal;
    cTotDesc.fill = EXCEL_STYLES.fillDebitoBadge;
    cTotDesc.alignment = { horizontal: "right", vertical: "middle" };
    cTotDesc.border = EXCEL_STYLES.borderDebito;
    ws1.getRow(r).height = 22;
    r++;

    // Linha de Resumo Financeiro & Líquido a Receber
    ws1.mergeCells(r, 1, r, 3);
    const cAd = ws1.getCell(r, 1);
    const adVal = Number(emp.adiantamento_anterior) || 0;
    cAd.value = `Adiantamento Anterior Compensado: ${formatBRL(adVal)}`;
    cAd.font = EXCEL_STYLES.fontEmpSub;
    cAd.fill = EXCEL_STYLES.fillBasesHead;
    cAd.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    for (let c = 1; c <= 3; c++) ws1.getCell(r, c).border = EXCEL_STYLES.borderBox;

    const cLiqL = ws1.getCell(r, 4);
    cLiqL.value = "VALOR LÍQUIDO:";
    cLiqL.font = EXCEL_STYLES.fontLiquidoVal;
    cLiqL.fill = EXCEL_STYLES.fillLiquido;
    cLiqL.alignment = { horizontal: "right", vertical: "middle" };
    cLiqL.border = EXCEL_STYLES.borderBox;

    ws1.mergeCells(r, 5, r, 6);
    const cLiqV = ws1.getCell(r, 5);
    cLiqV.value = Number(emp.liquido) || 0;
    cLiqV.numFmt = EXCEL_STYLES.numFmtCurr;
    cLiqV.font = EXCEL_STYLES.fontLiquidoVal;
    cLiqV.fill = EXCEL_STYLES.fillLiquido;
    cLiqV.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 5; c <= 6; c++) ws1.getCell(r, c).border = EXCEL_STYLES.borderBox;
    ws1.getRow(r).height = 24;
    r++;

    // Quadro de Bases de Cálculo e Encargos
    const basesItems = [
      { label: "Salário Base", val: Number(emp.salario) || 0 },
      { label: "Base INSS Empresa", val: Number(bases.base_inss_empresa) || 0 },
      { label: "Base INSS Func.", val: Number(bases.base_inss_funcionario) || 0 },
      { label: "Base FGTS", val: Number(bases.base_fgts) || 0 },
      { label: "F.G.T.S. Mês (8%)", val: Number(bases.valor_fgts) || 0 },
      { label: "Base IRRF", val: Number(bases.base_irrf) || 0 }
    ];

    basesItems.forEach((bItem, bIdx) => {
      const cellHead = ws1.getCell(r, bIdx + 1);
      cellHead.value = bItem.label;
      cellHead.font = { name: "Segoe UI", size: 8, bold: true, color: { argb: "FF64748B" } };
      cellHead.fill = EXCEL_STYLES.fillBasesHead;
      cellHead.alignment = { horizontal: "center", vertical: "middle" };
      cellHead.border = EXCEL_STYLES.borderBox;
    });
    ws1.getRow(r).height = 18;
    r++;

    basesItems.forEach((bItem, bIdx) => {
      const cellVal = ws1.getCell(r, bIdx + 1);
      cellVal.value = bItem.val;
      cellVal.numFmt = EXCEL_STYLES.numFmtCurr;
      cellVal.font = { name: "Consolas", size: 8, bold: true, color: { argb: "FF334155" } };
      cellVal.fill = EXCEL_STYLES.fillBasesHead;
      cellVal.alignment = { horizontal: "center", vertical: "middle" };
      cellVal.border = EXCEL_STYLES.borderBox;
    });
    ws1.getRow(r).height = 18;
    r += 2; // Espaçamento para o próximo funcionário
  }

  // =========================================================================
  // ABA 2: RESUMO GERAL DA FOLHA (Tabela Sintética de Conferência)
  // =========================================================================
  if (!isIndividual && employeesList.length > 0) {
    const ws2 = wb.addWorksheet("Resumo Consolidado", { views: [{ showGridLines: true }] });

    ws2.merge_cells = ws2.mergeCells; // alias
    ws2.mergeCells(1, 1, 1, 11);
    const t2 = ws2.getCell(1, 1);
    t2.value = `RESUMO CONSOLIDADO DA FOLHA - ${empresaNome}`;
    t2.font = EXCEL_STYLES.fontTitle;
    t2.fill = EXCEL_STYLES.fillBrand;
    t2.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 28;

    ws2.mergeCells(2, 1, 2, 11);
    const sub2 = ws2.getCell(2, 1);
    sub2.value = `Competência: ${rel.mes_ano || "--"}   |   Período: ${periodoTxt}   |   Total de Colaboradores: ${employeesList.length}`;
    sub2.font = EXCEL_STYLES.fontSubtitle;
    sub2.fill = EXCEL_STYLES.fillBrand;
    sub2.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(2).height = 20;

    const summaryHeaders = [
      "Cód.",
      "Colaborador",
      "Cargo / Função",
      "Salário Base (R$)",
      "Créditos / Proventos (R$)",
      "Adiantamento Anterior (R$)",
      "Débitos / Descontos (R$)",
      "Total Líquido (R$)",
      "Base INSS (R$)",
      "Base FGTS (R$)",
      "FGTS do Mês (R$)"
    ];

    summaryHeaders.forEach((hTxt, idx) => {
      const cell = ws2.getCell(4, idx + 1);
      cell.value = hTxt;
      cell.font = EXCEL_STYLES.fontTh;
      cell.fill = EXCEL_STYLES.fillTableHead;
      cell.alignment = {
        horizontal: idx === 0 ? "center" : (idx >= 3 ? "right" : "left"),
        vertical: "middle"
      };
      cell.border = EXCEL_STYLES.borderBox;
    });
    ws2.getRow(4).height = 24;

    let sRow = 5;
    for (const emp of employeesList) {
      const bases = emp.bases || {};

      const cCod = ws2.getCell(sRow, 1);
      cCod.value = emp.codigo || "-";
      cCod.alignment = { horizontal: "center", vertical: "middle" };

      const cNome = ws2.getCell(sRow, 2);
      cNome.value = emp.nome || "";
      cNome.alignment = { horizontal: "left", vertical: "middle" };

      const cFunc = ws2.getCell(sRow, 3);
      cFunc.value = emp.funcao || "";
      cFunc.alignment = { horizontal: "left", vertical: "middle" };

      const cSal = ws2.getCell(sRow, 4);
      cSal.value = Number(emp.salario) || 0;
      cSal.numFmt = EXCEL_STYLES.numFmtCurr;
      cSal.alignment = { horizontal: "right", vertical: "middle" };

      // Proventos em AZUL
      const cProv = ws2.getCell(sRow, 5);
      cProv.value = Number(emp.proventos) || 0;
      cProv.numFmt = EXCEL_STYLES.numFmtCurr;
      cProv.font = EXCEL_STYLES.fontCreditoVal;
      cProv.fill = EXCEL_STYLES.fillCreditoCell;
      cProv.alignment = { horizontal: "right", vertical: "middle" };
      cProv.border = EXCEL_STYLES.borderCredito;

      const cAd = ws2.getCell(sRow, 6);
      cAd.value = Number(emp.adiantamento_anterior) || 0;
      cAd.numFmt = EXCEL_STYLES.numFmtCurr;
      cAd.alignment = { horizontal: "right", vertical: "middle" };

      // Descontos em VERMELHO
      const cDesc = ws2.getCell(sRow, 7);
      cDesc.value = Number(emp.descontos) || 0;
      cDesc.numFmt = EXCEL_STYLES.numFmtCurr;
      cDesc.font = EXCEL_STYLES.fontDebitoVal;
      cDesc.fill = EXCEL_STYLES.fillDebitoCell;
      cDesc.alignment = { horizontal: "right", vertical: "middle" };
      cDesc.border = EXCEL_STYLES.borderDebito;

      // Líquido em VERDE
      const cLiq = ws2.getCell(sRow, 8);
      cLiq.value = Number(emp.liquido) || 0;
      cLiq.numFmt = EXCEL_STYLES.numFmtCurr;
      cLiq.font = EXCEL_STYLES.fontLiquidoVal;
      cLiq.fill = EXCEL_STYLES.fillLiquido;
      cLiq.alignment = { horizontal: "right", vertical: "middle" };

      const cBinss = ws2.getCell(sRow, 9);
      cBinss.value = Number(bases.base_inss_funcionario) || 0;
      cBinss.numFmt = EXCEL_STYLES.numFmtCurr;
      cBinss.alignment = { horizontal: "right", vertical: "middle" };

      const cBfgts = ws2.getCell(sRow, 10);
      cBfgts.value = Number(bases.base_fgts) || 0;
      cBfgts.numFmt = EXCEL_STYLES.numFmtCurr;
      cBfgts.alignment = { horizontal: "right", vertical: "middle" };

      const cVfgts = ws2.getCell(sRow, 11);
      cVfgts.value = Number(bases.valor_fgts) || 0;
      cVfgts.numFmt = EXCEL_STYLES.numFmtCurr;
      cVfgts.alignment = { horizontal: "right", vertical: "middle" };

      for (let c = 1; c <= 11; c++) {
        const cell = ws2.getCell(sRow, c);
        if (!cell.font) cell.font = EXCEL_STYLES.fontText;
        if (!cell.border.top) cell.border = EXCEL_STYLES.borderBox;
      }
      ws2.getRow(sRow).height = 20;
      sRow++;
    }

    // Linha de TOTAIS CONSOLIDADOS
    ws2.mergeCells(sRow, 1, sRow, 3);
    const cTotLbl = ws2.getCell(sRow, 1);
    cTotLbl.value = `TOTAIS CONSOLIDADOS (${employeesList.length} colaboradores)`;
    cTotLbl.font = EXCEL_STYLES.fontTotaisHeader;
    cTotLbl.fill = EXCEL_STYLES.fillTotaisBar;
    cTotLbl.alignment = { horizontal: "right", vertical: "middle" };
    for (let c = 1; c <= 3; c++) ws2.getCell(sRow, c).border = EXCEL_STYLES.borderBox;

    const summarySums = [
      { col: 4, val: employeesList.reduce((a, b) => a + (Number(b.salario) || 0), 0) },
      { col: 5, val: employeesList.reduce((a, b) => a + (Number(b.proventos) || 0), 0), font: EXCEL_STYLES.fontCreditoVal, fill: EXCEL_STYLES.fillCreditoBadge, border: EXCEL_STYLES.borderCredito },
      { col: 6, val: employeesList.reduce((a, b) => a + (Number(b.adiantamento_anterior) || 0), 0) },
      { col: 7, val: employeesList.reduce((a, b) => a + (Number(b.descontos) || 0), 0), font: EXCEL_STYLES.fontDebitoVal, fill: EXCEL_STYLES.fillDebitoBadge, border: EXCEL_STYLES.borderDebito },
      { col: 8, val: employeesList.reduce((a, b) => a + (Number(b.liquido) || 0), 0), font: EXCEL_STYLES.fontLiquidoVal, fill: EXCEL_STYLES.fillLiquido },
      { col: 9, val: employeesList.reduce((a, b) => a + (Number((b.bases || {}).base_inss_funcionario) || 0), 0) },
      { col: 10, val: employeesList.reduce((a, b) => a + (Number((b.bases || {}).base_fgts) || 0), 0) },
      { col: 11, val: employeesList.reduce((a, b) => a + (Number((b.bases || {}).valor_fgts) || 0), 0) }
    ];

    summarySums.forEach(sumItem => {
      const cSum = ws2.getCell(sRow, sumItem.col);
      cSum.value = sumItem.val;
      cSum.numFmt = EXCEL_STYLES.numFmtCurr;
      cSum.font = sumItem.font || EXCEL_STYLES.fontTotaisHeader;
      cSum.fill = sumItem.fill || EXCEL_STYLES.fillTotaisBar;
      cSum.border = sumItem.border || EXCEL_STYLES.borderBox;
      cSum.alignment = { horizontal: "right", vertical: "middle" };
    });
    ws2.getRow(sRow).height = 24;

    const sCols = [8, 36, 30, 18, 22, 22, 22, 22, 18, 18, 18];
    sCols.forEach((w, idx) => {
      ws2.getColumn(idx + 1).width = w;
    });
  }

  return wb;
}

// Exportação Completa de Todos os Colaboradores em Excel (.xlsx)
async function exportToExcel() {
  if (!state.currentRelatorio || !state.currentRelatorio.itens) {
    showToast("Nenhum dado disponível para exportação", "warning");
    return;
  }

  const items = getFilteredAndSortedItems();
  const rel = state.currentRelatorio;

  showToast("Gerando planilha Excel com detalhamento completo...", "info");

  try {
    if (typeof ExcelJS !== "undefined") {
      const wb = await buildExcelReportWorkbook(rel, items, false);
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const safeEmpresa = (rel.empresa || "empresa").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25);
      const safeComp = (rel.mes_ano || "periodo").replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `relatorio_completo_folha_${safeEmpresa}_${safeComp}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      showToast("Planilha Excel completa gerada com sucesso!", "success");
      return;
    }
  } catch (err) {
    console.warn("Falha no gerador ExcelJS do navegador, utilizando endpoint do servidor:", err);
  }

  // Fallback transparente para o gerador Python openpyxl no servidor
  if (state.currentPeriodoId) {
    window.location.href = `/api/export/excel/${state.currentPeriodoId}`;
    showToast("Download da planilha Excel iniciado!", "success");
  } else {
    showToast("Erro ao gerar planilha Excel", "error");
  }
}

// Exportação do Holerite Individual de um Colaborador em Excel (.xlsx)
async function exportIndividualHoleriteExcel(emp) {
  if (!emp) return;
  const rel = state.currentRelatorio || {};

  showToast(`Gerando Excel do holerite de ${emp.nome}...`, "info");

  try {
    if (typeof ExcelJS !== "undefined") {
      const wb = await buildExcelReportWorkbook(rel, [emp], true);
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const safeEmp = (emp.nome || "colaborador").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25);
      const safeComp = (rel.mes_ano || "periodo").replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `holerite_${safeEmp}_${safeComp}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      showToast(`Holerite de ${emp.nome} exportado com sucesso!`, "success");
      return;
    }
  } catch (err) {
    console.error("Erro ao exportar holerite individual:", err);
    showToast("Erro ao exportar holerite individual", "error");
  }
}

// Funções do Modal de Holerite Individual Detalhado
function openHoleriteModal(emp) {
  state.currentModalEmployee = emp;
  const rel = state.currentRelatorio || {};
  const dados = emp.dados_adicionais || {};
  const bases = emp.bases || {};

  // Cabeçalho da Empresa e Período
  if (dom.modalCompBadge) dom.modalCompBadge.textContent = rel.mes_ano || "--/----";
  if (dom.modalEmpresaNome) dom.modalEmpresaNome.textContent = rel.empresa || "EMPRESA";
  if (dom.modalEmpresaCnpj) dom.modalEmpresaCnpj.textContent = `CNPJ: ${rel.cnpj || "Não informado"}`;

  // Ficha Cadastral do Colaborador
  if (dom.modalEmpNome) dom.modalEmpNome.textContent = emp.nome || "Colaborador";
  if (dom.modalEmpCodigo) dom.modalEmpCodigo.textContent = emp.codigo ? `Cód: ${emp.codigo}` : "Cód: -";
  if (dom.modalEmpFuncao) dom.modalEmpFuncao.textContent = emp.funcao ? `Cargo: ${emp.funcao}` : "Cargo: Não informado";
  if (dom.modalEmpPeriodo) dom.modalEmpPeriodo.textContent = `Período de Apuração: ${rel.periodo_texto || "--"}`;
  if (dom.modalSalarioTop) dom.modalSalarioTop.textContent = formatBRL(emp.salario);

  // Metadados funcionais adicionais
  if (dom.modalEmpAdmissao) dom.modalEmpAdmissao.textContent = `Admissão: ${dados.admissao || "-"}`;
  if (dom.modalEmpSituacao) dom.modalEmpSituacao.textContent = `Situação: ${dados.situacao || "Ativo"}`;
  if (dom.modalEmpDepIr) dom.modalEmpDepIr.textContent = `Dep. IR: ${dados.dependentes_ir !== undefined ? dados.dependentes_ir : 0}`;

  // Renderização da Tabela de Eventos (Créditos / Proventos e Débitos / Descontos)
  if (dom.modalEventosTbody) {
    dom.modalEventosTbody.innerHTML = "";
    const eventos = Array.isArray(emp.eventos) && emp.eventos.length > 0 ? emp.eventos : [];

    let somaProventos = 0;
    let somaDescontos = 0;

    if (eventos.length > 0) {
      if (dom.modalEventosCount) {
        dom.modalEventosCount.textContent = `${eventos.length} rubricas detalhadas`;
      }

      eventos.forEach(evt => {
        const tr = document.createElement("tr");
        const isProvento = evt.tipo === "provento";
        const val = Number(evt.valor) || 0;

        if (isProvento) {
          somaProventos += val;
        } else {
          somaDescontos += val;
        }

        const refText = evt.referencia && evt.referencia !== "-" ? evt.referencia : "";
        const proventoCell = isProvento
          ? `<span class="event-tag-provento font-mono font-bold">${formatBRL(val)}</span>`
          : `<span class="text-muted font-mono">-</span>`;
        const descontoCell = !isProvento
          ? `<span class="event-tag-desconto font-mono font-bold">${formatBRL(val)}</span>`
          : `<span class="text-muted font-mono">-</span>`;

        tr.innerHTML = `
          <td class="col-cod text-center font-mono text-muted">${evt.codigo || "-"}</td>
          <td class="col-desc"><strong>${escapeHtml(evt.descricao || "Item")}</strong></td>
          <td class="col-ref text-center font-mono">${refText || "-"}</td>
          <td class="col-prov text-right">${proventoCell}</td>
          <td class="col-desc-val text-right">${descontoCell}</td>
        `;
        dom.modalEventosTbody.appendChild(tr);
      });

      if (dom.modalTableTotalProventos) dom.modalTableTotalProventos.textContent = formatBRL(somaProventos || emp.proventos);
      if (dom.modalTableTotalDescontos) dom.modalTableTotalDescontos.textContent = formatBRL(somaDescontos || emp.descontos);
    } else {
      // Fallback gracioso para períodos legados
      if (dom.modalEventosCount) dom.modalEventosCount.textContent = "Resumo Consolidado";
      dom.modalEventosTbody.innerHTML = `
        <tr>
          <td class="text-center font-mono text-muted">001</td>
          <td><strong>Salário Base / Proventos Contratuais</strong></td>
          <td class="text-center font-mono">30d</td>
          <td class="text-right font-mono event-tag-provento">${formatBRL(emp.proventos)}</td>
          <td class="text-right font-mono text-muted">-</td>
        </tr>
        ${emp.adiantamento_anterior > 0 ? `
        <tr>
          <td class="text-center font-mono text-muted">012</td>
          <td><strong>Adiantamento Anterior Compensado</strong></td>
          <td class="text-center font-mono">-</td>
          <td class="text-right font-mono text-muted">-</td>
          <td class="text-right font-mono event-tag-desconto">${formatBRL(emp.adiantamento_anterior)}</td>
        </tr>` : ""}
        ${emp.descontos > 0 ? `
        <tr>
          <td class="text-center font-mono text-muted">999</td>
          <td><strong>Descontos e Retenções Legais Totais</strong></td>
          <td class="text-center font-mono">-</td>
          <td class="text-right font-mono text-muted">-</td>
          <td class="text-right font-mono event-tag-desconto">${formatBRL(emp.descontos)}</td>
        </tr>` : ""}
      `;
      if (dom.modalTableTotalProventos) dom.modalTableTotalProventos.textContent = formatBRL(emp.proventos);
      if (dom.modalTableTotalDescontos) dom.modalTableTotalDescontos.textContent = formatBRL(emp.descontos);
    }
  }

  // Resumo Financeiro em Destaque
  if (dom.modalProventos) dom.modalProventos.textContent = formatBRL(emp.proventos);
  if (dom.modalAdiantamento) dom.modalAdiantamento.textContent = formatBRL(emp.adiantamento_anterior);
  if (dom.modalDescontos) dom.modalDescontos.textContent = formatBRL(emp.descontos);
  if (dom.modalLiquido) dom.modalLiquido.textContent = formatBRL(emp.liquido);

  // Quadro de Bases de Cálculo Oficiais
  const valSalarioBase = emp.salario || 0;
  const valBaseInssEmp = bases.base_inss_empresa !== undefined ? bases.base_inss_empresa : valSalarioBase;
  const valBaseInssFunc = bases.base_inss_funcionario !== undefined ? bases.base_inss_funcionario : valSalarioBase;
  const valBaseInss13 = bases.base_inss_13 || 0;
  const valBaseFgts = bases.base_fgts !== undefined ? bases.base_fgts : valSalarioBase;
  const valBaseFgts13 = bases.base_fgts_13 || 0;
  const valValorFgts = bases.valor_fgts !== undefined ? bases.valor_fgts : (valBaseFgts * 0.08);
  const valBaseIrrf = bases.base_irrf !== undefined ? bases.base_irrf : valSalarioBase;
  const valDeducoesIrrf = bases.deducoes_irrf || 0;

  if (dom.modalSalario) dom.modalSalario.textContent = formatBRL(valSalarioBase);
  if (dom.modalBaseInssEmpresa) dom.modalBaseInssEmpresa.textContent = formatBRL(valBaseInssEmp);
  if (dom.modalBaseInssFunc) dom.modalBaseInssFunc.textContent = formatBRL(valBaseInssFunc);
  if (dom.modalBaseInss13) dom.modalBaseInss13.textContent = formatBRL(valBaseInss13);
  if (dom.modalBaseFgts) dom.modalBaseFgts.textContent = formatBRL(valBaseFgts);
  if (dom.modalBaseFgts13) dom.modalBaseFgts13.textContent = formatBRL(valBaseFgts13);
  if (dom.modalValorFgts) dom.modalValorFgts.textContent = formatBRL(valValorFgts);
  if (dom.modalBaseIrrf) dom.modalBaseIrrf.textContent = formatBRL(valBaseIrrf);
  if (dom.modalDeducoesIrrf) dom.modalDeducoesIrrf.textContent = formatBRL(valDeducoesIrrf);

  // Exibe o modal e reseta rolagem
  dom.modalHolerite.classList.remove("hidden");
  const scrollArea = dom.modalHolerite.querySelector(".modal-body-scroll");
  if (scrollArea) scrollArea.scrollTop = 0;
}

function closeHoleriteModal() {
  dom.modalHolerite.classList.add("hidden");
  state.currentModalEmployee = null;
}

function printHoleriteIndividual() {
  if (!state.currentModalEmployee) return;
  const emp = state.currentModalEmployee;
  const rel = state.currentRelatorio || {};
  const bases = emp.bases || {};
  const dados = emp.dados_adicionais || {};
  const eventos = Array.isArray(emp.eventos) && emp.eventos.length > 0 ? emp.eventos : [];

  const printWindow = window.open("", "_blank", "width=900,height=800");
  if (!printWindow) {
    showToast("Permita pop-ups no navegador para imprimir o recibo individual", "error");
    return;
  }

  // Gera linhas da tabela de eventos para impressão
  let eventosRowsHtml = "";
  if (eventos.length > 0) {
    eventosRowsHtml = eventos.map(evt => {
      const isProv = evt.tipo === "provento";
      const v = Number(evt.valor) || 0;
      return `
        <tr>
          <td style="text-align:center; font-family:monospace;">${evt.codigo || "-"}</td>
          <td><strong>${escapeHtml(evt.descricao || "")}</strong></td>
          <td style="text-align:center; font-family:monospace;">${evt.referencia || "-"}</td>
          <td style="text-align:right; font-family:monospace; color: ${isProv ? '#047857' : '#999'};">${isProv ? formatBRL(v) : "-"}</td>
          <td style="text-align:right; font-family:monospace; color: ${!isProv ? '#b91c1c' : '#999'};">${!isProv ? formatBRL(v) : "-"}</td>
        </tr>
      `;
    }).join("");
  } else {
    eventosRowsHtml = `
      <tr>
        <td style="text-align:center; font-family:monospace;">001</td>
        <td><strong>Salário Base / Proventos</strong></td>
        <td style="text-align:center; font-family:monospace;">30d</td>
        <td style="text-align:right; font-family:monospace; color:#047857;">${formatBRL(emp.proventos)}</td>
        <td style="text-align:right; font-family:monospace; color:#999;">-</td>
      </tr>
      ${emp.adiantamento_anterior > 0 ? `
      <tr>
        <td style="text-align:center; font-family:monospace;">012</td>
        <td><strong>Adiantamento Anterior</strong></td>
        <td style="text-align:center; font-family:monospace;">-</td>
        <td style="text-align:right; font-family:monospace; color:#999;">-</td>
        <td style="text-align:right; font-family:monospace; color:#b91c1c;">${formatBRL(emp.adiantamento_anterior)}</td>
      </tr>` : ""}
      ${emp.descontos > 0 ? `
      <tr>
        <td style="text-align:center; font-family:monospace;">999</td>
        <td><strong>Descontos e Retenções</strong></td>
        <td style="text-align:center; font-family:monospace;">-</td>
        <td style="text-align:right; font-family:monospace; color:#999;">-</td>
        <td style="text-align:right; font-family:monospace; color:#b91c1c;">${formatBRL(emp.descontos)}</td>
      </tr>` : ""}
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recibo de Pagamento - ${emp.nome}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #111; font-size: 12px; line-height: 1.4; }
        .receipt-card { border: 2px solid #111; padding: 20px; max-width: 820px; margin: 0 auto; background: #fff; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
        .company h2 { margin: 0 0 4px 0; font-size: 16px; font-weight: 800; }
        .company p { margin: 0; font-size: 11px; color: #444; }
        .comp { text-align: right; font-weight: bold; font-size: 12px; }
        .emp-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; font-size: 11px; }
        .val-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
        .val-table th, .val-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        .val-table th { background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; font-size: 10px; text-transform: uppercase; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; font-size: 12px; }
        .totais-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
        .tot-card { border: 1px solid #cbd5e1; padding: 8px; text-align: center; border-radius: 4px; background: #f8fafc; }
        .tot-card .l { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .tot-card .v { font-size: 13px; font-weight: bold; margin-top: 2px; }
        .liq-card { background: #ecfdf5; border-color: #10b981; }
        .liq-card .l { color: #047857; }
        .liq-card .v { color: #047857; font-size: 15px; }
        .bases-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; border: 1px solid #cbd5e1; }
        .bases-table th { background: #f8fafc; padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: 600; text-align: center; }
        .bases-table td { padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold; }
        .signatures { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
        .sig-box { flex: 1; text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-bottom: 6px; }
        .sig-box p { margin: 0; font-size: 10px; }
        .footer-note { margin-top: 20px; font-size: 9px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
        @media print {
          body { padding: 0; }
          .receipt-card { border: 1px solid #000; }
        }
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
            RECIBO DE PAGAMENTO DE SALÁRIO<br>
            Competência: ${rel.mes_ano || "--/----"}
          </div>
        </div>

        <div class="emp-box">
          <div><strong>Colaborador:</strong> ${emp.nome}</div>
          <div><strong>Código:</strong> ${emp.codigo || "-"}</div>
          <div><strong>Cargo/Função:</strong> ${emp.funcao || "-"}</div>
          <div><strong>Admissão:</strong> ${dados.admissao || "-"}</div>
          <div><strong>Situação:</strong> ${dados.situacao || "Ativo"}</div>
          <div><strong>Período:</strong> ${rel.periodo_texto || "-"}</div>
        </div>

        <table class="val-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align:center;">Cód</th>
              <th>Descrição do Evento / Rubrica</th>
              <th style="width: 80px; text-align:center;">Referência</th>
              <th style="width: 130px; text-align:right;">Proventos (R$)</th>
              <th style="width: 130px; text-align:right;">Descontos (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${eventosRowsHtml}
          </tbody>
        </table>

        <div class="totais-bar">
          <div class="tot-card">
            <div class="l">Total Proventos</div>
            <div class="v font-mono" style="color: #2563eb;">${formatBRL(emp.proventos)}</div>
          </div>
          <div class="tot-card">
            <div class="l">Adiantamento</div>
            <div class="v font-mono" style="color: #d97706;">${formatBRL(emp.adiantamento_anterior)}</div>
          </div>
          <div class="tot-card">
            <div class="l">Total Descontos</div>
            <div class="v font-mono" style="color: #dc2626;">${formatBRL(emp.descontos)}</div>
          </div>
          <div class="tot-card liq-card">
            <div class="l">Valor Líquido</div>
            <div class="v font-mono">${formatBRL(emp.liquido)}</div>
          </div>
        </div>

        <table class="bases-table">
          <thead>
            <tr>
              <th>Salário Base</th>
              <th>Base INSS Empresa</th>
              <th>Base INSS Func.</th>
              <th>Base INSS 13º</th>
              <th>Base F.G.T.S.</th>
              <th>F.G.T.S. do Mês</th>
              <th>Base I.R.R.F.</th>
              <th>Deduções IRRF</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${formatBRL(emp.salario)}</td>
              <td>${formatBRL(bases.base_inss_empresa !== undefined ? bases.base_inss_empresa : emp.salario)}</td>
              <td>${formatBRL(bases.base_inss_funcionario !== undefined ? bases.base_inss_funcionario : emp.salario)}</td>
              <td>${formatBRL(bases.base_inss_13 || 0)}</td>
              <td>${formatBRL(bases.base_fgts !== undefined ? bases.base_fgts : emp.salario)}</td>
              <td>${formatBRL(bases.valor_fgts !== undefined ? bases.valor_fgts : (emp.salario * 0.08))}</td>
              <td>${formatBRL(bases.base_irrf !== undefined ? bases.base_irrf : emp.salario)}</td>
              <td>${formatBRL(bases.deducoes_irrf || 0)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <p>EMPREGADOR / DEPARTAMENTO PESSOAL</p>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <p>${emp.nome}<br>Assinatura do Colaborador</p>
          </div>
        </div>

        <div class="footer-note">
          Recibo individual emitido pelo Sistema de Holerites em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
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
              ticks: { color: textColor, callback: (v) => "R$ " + (v / 1000).toFixed(0) + "k" },
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
              ticks: { color: textColor, callback: (v) => "R$ " + (v / 1000).toFixed(1) + "k" },
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

