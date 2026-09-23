/* ══════════════════════════════════════════════════════════════════════
   CARREGAMENTO DE DADOS
   ══════════════════════════════════════════════════════════════════════ */
var _retryCount = 0;
var _maxRetries = 3;

function carregarDados() {
  setStatus("loading", "carregando…");
  
  // Reseta visibilidade da UI para o estado de loading apenas se for o primeiro carregamento
  if (!window.lastUpdate) {
    var gdpErrorBox = document.getElementById("gdp-error-box");
    var oauthBox = document.getElementById("oauth-box");
    var rankList = document.getElementById("rank-list");
    var loadingSpinner = document.getElementById("loading-spinner");
    
    if (gdpErrorBox) gdpErrorBox.style.display = "none";
    if (oauthBox) oauthBox.style.display = "none";
    if (rankList) rankList.style.display = "none";
    if (loadingSpinner) loadingSpinner.style.display = "flex";
  }

  tentarFontes(0);
}

function tentarFontes(idx) {
  if (idx >= CONFIG.ORDER.length) {
    setStatus("error", "falha total");
    
    if (!window.lastUpdate) {
      document.getElementById("status-msg").innerHTML = "";
      document.getElementById("rank-list").style.display = "none";
      var loadingSpinner = document.getElementById("loading-spinner");
      if (loadingSpinner) loadingSpinner.style.display = "none";
      
      // Mostra erro genérico apenas se não for erro de OAuth já ativo
      if (document.getElementById("oauth-box").style.display !== "flex") {
        document.getElementById("gdp-error-box").style.display = "flex";
      }

      // Retry automático agressivo só no primeiro load
      if (_retryCount < _maxRetries) {
        _retryCount++;
        setTimeout(function() {
          carregarDados();
        }, 3000);
      }
    } else {
      // Last known good: manter dados antigos na tela, mostrar indicador de alerta
      var ind = document.getElementById("last-update-indicator");
      if (ind && window.lastUpdate) {
        var d = window.lastUpdate;
        var h = ("0" + d.getHours()).slice(-2);
        var m = ("0" + d.getMinutes()).slice(-2);
        ind.textContent = "⚠️ Atualizado às " + h + ":" + m;
        ind.style.display = "block";
      }
      // Nenhuma limpeza de estado. A próxima tentativa normal virá do ciclo de auto-refresh.
    }
    return;
  }
  var fonte = CONFIG.ORDER[idx];
  if (fonte === "grid")       fetchGrid(function() { tentarFontes(idx + 1); });
  else if (fonte === "appsscript") fetchAppsScript(function() { tentarFontes(idx + 1); });
  else if (fonte === "csv")   fetchCSV(function() { tentarFontes(idx + 1); });
  else tentarFontes(idx + 1);
}

function fetchGrid(onFail) {
  // Caminho 1: Grid SDK (grid-sdk.js)
  if (typeof Grid !== "undefined" && Grid.sheets && typeof Grid.sheets.get === "function") {
    try {
      if (typeof Grid.configure === "function" && typeof GRID !== "undefined" && GRID.docId) {
        Grid.configure({ docId: GRID.docId });
      }
      Grid.sheets.get({
        spreadsheetId: CONFIG.SHEET_ID,
        range: "Página1!A1:AU200"
      }).then(function(resp) {
        var rows = resp && resp.values ? resp.values : [];
        if (rows.length < 3) { fetchGridAPI(onFail); return; }
        carregarExtrasGrid(function() {
          processarDados(rows, "grid");
        });
      }).catch(function() { fetchGridAPI(onFail); });
      return;
    } catch(e) {}
  }
  // Caminho 2: API REST direta
  fetchGridAPI(onFail);
}

function fetchGridAPI(onFail) {
  fetch("/api/v1/sheets/" + CONFIG.SHEET_ID + "?range=" + encodeURIComponent("Página1!A1:AU200"), {
    credentials: "include"
  }).then(function(resp) {
    if (resp.status === 401 || resp.status === 403) {
      mostrarErroOAuth();
      throw new Error("oauth");
    }
    if (!resp.ok) throw new Error(resp.status);
    return resp.json();
  }).then(function(data) {
    var rows = data && data.values ? data.values : [];
    if (rows.length < 3) { onFail(); return; }
    carregarExtrasAPI(function() {
      processarDados(rows, "grid");
    });
  }).catch(function() { onFail(); });
}

function carregarExtrasGrid(onDone) {
  var p = 3;
  function ck() { p--; if (p <= 0) onDone(); }

  Grid.sheets.get({ spreadsheetId: CONFIG.SHEET_ID, range: "LDAP!A:C" })
    .then(function(r) { processarLdap(r && r.values ? r.values : []); ck(); })
    .catch(function() { ck(); });

  Grid.sheets.get({ spreadsheetId: CONFIG.SHEET_ID, range: "SORTING!A1:W93" })
    .then(function(r) { dadosSortingRaw = r && r.values ? r.values : []; ck(); })
    .catch(function() { ck(); });

  Grid.sheets.get({ spreadsheetId: CONFIG.SHEET_ID, range: "CARREGAMENTO!A1:BR40" })
    .then(function(r) { dadosCarregRaw = r && r.values ? r.values : []; ck(); })
    .catch(function() { ck(); });
}

function carregarExtrasAPI(onDone) {
  var p = 3;
  function ck() { p--; if (p <= 0) onDone(); }
  var base = "/api/v1/sheets/" + CONFIG.SHEET_ID + "?range=";

  fetch(base + encodeURIComponent("LDAP!A:C"), { credentials: "include" })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function(d) { processarLdap(d && d.values ? d.values : []); ck(); })
    .catch(function() { ck(); });

  fetch(base + encodeURIComponent("SORTING!A1:W93"), { credentials: "include" })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function(d) { dadosSortingRaw = d && d.values ? d.values : []; ck(); })
    .catch(function() { ck(); });

  fetch(base + encodeURIComponent("CARREGAMENTO!A1:BR40"), { credentials: "include" })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function(d) { dadosCarregRaw = d && d.values ? d.values : []; ck(); })
    .catch(function() { ck(); });
}

/* ── APPS SCRIPT via JSONP — com aproveitamento de resposta tardia ── */
var _appsScriptRespondeu = false;
var _currentAppsScriptCb = null;

function fetchAppsScript(onFail) {
  var cbName = "_cb_" + Date.now();
  _currentAppsScriptCb = cbName;
  _appsScriptRespondeu = false;

  var timeout = setTimeout(function() {
    if (!_appsScriptRespondeu) {
      var s = document.getElementById(cbName);
      if (s && s.parentNode) s.parentNode.removeChild(s);
      window[cbName] = function() {}; // Invalida orfão
      onFail("lento (>30s) — timeout");
    }
  }, 30000);

  window[cbName] = function(resp) {
    clearTimeout(timeout);
    _appsScriptRespondeu = true;
    
    // Proteção contra respostas atrasadas de timeouts passados
    if (cbName !== _currentAppsScriptCb) return;

    try {
      var rows = resp && resp.values ? resp.values : [];
      if (rows.length <= 1) {
        onFail("resposta ok mas payload malformado (length <= 1)");
        return;
      }
      processarLdap(resp.ldap || []);
      processarMt(resp.mt || []);
      processarLms(resp.lms || []);
      processarLmsDet(resp.lmsDet || []);
      dadosSortingRaw  = resp.sorting || [];
      dadosCarregRaw   = resp.carregamento || [];
      limparErro();                          // ← some o popup de erro
      processarDados(rows, "appsscript");    // sobrescreve CSV se já carregou
    } catch (e) {
      onFail("erro ao processar: " + e.message);
    } finally {
      // limpa a tag script pra não acumular no DOM
      var s = document.getElementById(cbName);
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
  };

  var script = document.createElement("script");
  script.id = cbName;
  script.src = CONFIG.APPS_SCRIPT_URL + "?callback=" + cbName;
  script.onerror = function() {
    clearTimeout(timeout);
    var s = document.getElementById(cbName);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    window[cbName] = function() {};
    onFail("erro de rede/script (URL ou bloqueio)");
  };
  document.head.appendChild(script);
}

function fetchCSV(onFail) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", CONFIG.CSV_URL, true);
  xhr.timeout = 15000;
  xhr.onload = function() {
    if (xhr.status !== 200) { onFail(); return; }
    var rows = parseCSV(xhr.responseText);
    if (rows.length < 3) { onFail(); return; }
    processarDados(rows, "csv");
  };
  xhr.onerror = function() { onFail(); };
  xhr.ontimeout = function() { onFail(); };
  xhr.send();
}

function parseCSV(text) {
  var rows = [];
  var lines = text.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/\r$/, "");
    if (line === "") continue;
    var row = [];
    var inQuote = false;
    var field = "";
    for (var j = 0; j < line.length; j++) {
      var ch = line[j];
      if (inQuote) {
        if (ch === '"' && line[j + 1] === '"') { field += '"'; j++; }
        else if (ch === '"') { inQuote = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { row.push(field.trim()); field = ""; }
        else { field += ch; }
      }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

/* ══════════════════════════════════════════════════════════════════════
   PROCESSAMENTO DOS DADOS
   ══════════════════════════════════════════════════════════════════════ */
function processarLdap(rows) {
  mapaNomes = {};
  if (!rows || rows.length < 2) return;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[0] || r[0] === "") continue;
    var ldap = r[0].toString().toLowerCase().trim();
    mapaNomes[ldap] = {
      nome: (r[1] || "").trim(),
      foto: (r[2] || "").trim()
    };
  }
}

function processarDados(rows, fonte) {
  fonteDados = fonte;
  _retryCount = 0; // Reset retry ao ter sucesso

  facilityName = (rows[CONFIG.META.facilityRow] && rows[CONFIG.META.facilityRow][CONFIG.META.facilityCol]) || "SSP20";
  var rawData = (rows[CONFIG.META.dataRow] && rows[CONFIG.META.dataRow][CONFIG.META.dataCol]) || "";
  dataRef = formatarData(rawData);

  // ── Guarda (com duração individual) ──
  dadosGuarda = [];
  var cg = CONFIG.COLS_GUARDA;
  for (var i = CONFIG.DATA_START_ROW; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[cg.operatorId] || r[cg.operatorId] === "") continue;
    var total = parseInt(r[cg.total], 10);
    if (isNaN(total) || total === 0) continue;
    dadosGuarda.push({
      operatorId: r[cg.operatorId],
      ldap: (r[cg.ldap] || "").toLowerCase(),
      ciclo: (r[cg.ciclo] || "").toUpperCase(),
      total: total,
      duracaoAtivaMin: parseInt(r[cg.duracaoAtivaMin], 10) || 0,
      duracaoBrutaMin: parseInt(r[cg.duracaoBrutaMin], 10) || 0,
      tempoInativoMin: parseInt(r[cg.tempoInativoMin], 10) || 0,
      pacotesPorMin: parseFloat((r[cg.pacotesPorMin] || "0").toString().replace(",", ".")) || 0
    });
  }

  // ── Indução (COM duração individual por operador) ──
  dadosInducao = [];
  var ci = CONFIG.COLS_INDUCAO;
  for (var i = CONFIG.DATA_START_ROW; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[ci.operatorId] || r[ci.operatorId] === "") continue;
    var total = parseInt(r[ci.total], 10);
    if (isNaN(total) || total === 0) continue;
    dadosInducao.push({
      operatorId: r[ci.operatorId],
      ldap: (r[ci.ldap] || "").toLowerCase(),
      ciclo: (r[ci.ciclo] || "").toUpperCase(),
      total: total,
      duracaoAtivaMin: parseInt(r[ci.duracaoAtivaMin], 10) || 0,
      duracaoBrutaMin: parseInt(r[ci.duracaoBrutaMin], 10) || 0,
      tempoInativoMin: parseInt(r[ci.tempoInativoMin], 10) || 0,
      pacotesPorMin: parseFloat((r[ci.pacotesPorMin] || "0").toString().replace(",", ".")) || 0
    });
  }

  // ── Duração Guarda por ciclo ──
  duracaoGuarda = [];
  var dg = CONFIG.COLS_DURACAO_GUARDA;
  for (var i = CONFIG.DATA_START_ROW; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[dg.ciclo] || r[dg.ciclo] === "") continue;
    var durMin = parseInt(r[dg.duracaoAjustadaMin], 10);
    if (isNaN(durMin)) continue;
    duracaoGuarda.push({
      ciclo: (r[dg.ciclo] || "").toUpperCase(),
      inicio: r[dg.inicio] || "",
      fimAjustado: r[dg.fimAjustado] || "",
      fimBruto: r[dg.fimBruto] || "",
      duracaoMin: durMin,
      duracaoHms: r[dg.duracaoAjustadaHms] || ""
    });
  }

  // ── Duração Indução por ciclo ──
  duracaoInducao = [];
  var di = CONFIG.COLS_DURACAO_INDUCAO;
  for (var i = CONFIG.DATA_START_ROW; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[di.ciclo] || r[di.ciclo] === "") continue;
    var durMin = parseInt(r[di.duracaoAjustadaMin], 10);
    if (isNaN(durMin)) continue;
    duracaoInducao.push({
      ciclo: (r[di.ciclo] || "").toUpperCase(),
      inicio: r[di.inicio] || "",
      fimAjustado: r[di.fimAjustado] || "",
      fimBruto: r[di.fimBruto] || "",
      duracaoMin: durMin,
      duracaoHms: r[di.duracaoAjustadaHms] || ""
    });
  }
  // Montar mapa de duplas (mesa → ldaps)
  montarMapaDuplas();
  esconderErroOAuth();
  document.getElementById("gdp-error-box").style.display = "none";
  var loadingSpinner = document.getElementById("loading-spinner");
  if (loadingSpinner) loadingSpinner.style.display = "none";
  document.getElementById("rank-list").style.display = "block";
  window.lastUpdate = new Date();
  
  var ind = document.getElementById("last-update-indicator");
  if (ind) ind.style.display = "none";
  
  var hdFacilityName = document.getElementById("hd-facility-name");
  if (hdFacilityName) hdFacilityName.textContent = facilityName;
  var tvFacility = document.getElementById("tv-facility");
  if (tvFacility) tvFacility.textContent = facilityName + " · " + dataRef;
  setStatus("ok", fonte);
  
  if (activeSub === "guarda") {
    var chipVol = document.getElementById("chip-volumoso");
    if (chipVol) {
      chipVol.style.display = Object.keys(mapaMt).length > 0 ? "inline-block" : "none";
    }
  }
  
  renderRanking();

  // Renderizar lista HC se a página estiver visível
  if (typeof renderListaHC === "function") {
    renderListaHC("");
  }

  // Renderizar aba LMS
  if (typeof renderLms === "function") {
    renderLms();
  }
}

function setStatus(type, label) {
  var dot = document.getElementById("status-dot");
  var txt = document.getElementById("status-text");
  dot.className = "dot";
  if (type === "ok")      dot.classList.add("dot-ok");
  else if (type === "error") dot.classList.add("dot-err");
  else                      dot.classList.add("dot-load");
  txt.textContent = label;
}

/* ═════════════════════════════════════════════════════════════════════���
   OAUTH — Autorização do Google no Grid
   ══════════════════════════════════════════════════════════════════════ */
function autorizarOAuth() {
  window.open("/api/v1/google/oauth/start", "_blank");
  document.getElementById("oauth-box").innerHTML =
    '<img src="https://http2.mlstatic.com/frontend-assets/logistics-gdp-frontend/icon-gdp-load-page.svg" alt="Autorização" class="gdp-error-img">' +
    '<h2>Aguardando autorização...</h2>' +
    '<p>Autorize na aba que abriu e depois clique em tentar novamente para acessar os dados da operação.</p>' +
    '<button class="gdp-btn-primary" onclick="carregarDados()">Tentar novamente</button>';
}

function mostrarErroOAuth() {
  document.getElementById("oauth-box").style.display = "flex";
}

function esconderErroOAuth() {
  document.getElementById("oauth-box").style.display = "none";
}

/* ══════════════════════════════════════════════════════════════════════
   MONTAR MAPA DE DUPLAS A PARTIR DA ABA SORTING
   Lê dadosSortingRaw e preenche mesaDuplas = { ldap: { mesa, parceiroLdap } }
   ══════════════════════════════════════════════════════════════════════ */
function montarMapaDuplas() {
  mesaDuplas = {};
  if (!dadosSortingRaw || dadosSortingRaw.length < 2) return;

  var mesas = CONFIG.DIM_SORTING.MESAS;

  for (var m = 0; m < mesas.length; m++) {
    var mesa = mesas[m];
    var ops = [];

    for (var i = mesa.startRow; i <= Math.min(mesa.endRow, dadosSortingRaw.length - 1); i++) {
      var nome = cellStr(dadosSortingRaw, i, mesa.nome);
      var ldap = cellStr(dadosSortingRaw, i, mesa.ldap);
      if (ldap && ldap !== "LDAP" && ldap !== mesa.id) {
        ops.push(ldap.toLowerCase().trim());
      }
    }

    // Registrar cada operador com referência ao parceiro
    for (var o = 0; o < ops.length; o++) {
      var parceiro = "";
      if (ops.length === 2) {
        parceiro = ops[o === 0 ? 1 : 0];
      }
      mesaDuplas[ops[o]] = {
        mesa: mesa.id,
        parceiroLdap: parceiro
      };
    }
  }
}

function formatarData(raw) {
  if (!raw) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  try {
    var d = new Date(raw);
    if (isNaN(d)) return raw;
    var dia = ("0" + d.getDate()).slice(-2);
    var mes = ("0" + (d.getMonth() + 1)).slice(-2);
    var ano = d.getFullYear();
    return dia + "/" + mes + "/" + ano;
  } catch(e) {
    return raw;
  }
}

function processarMt(rows) {
  mapaMt = {};
  if (!rows || rows.length < 2) return;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    var ldap = r[0].toString().toLowerCase().trim();
    var ciclo = (r[1] || "").toString().toUpperCase().trim();
    if (!mapaMt[ldap]) {
      mapaMt[ldap] = { TOTAL: { guarda: 0, volumoso: 0, inducao: 0, carregamento: 0, ps: 0, pesca: 0, apoio: 0, outros: 0, tnd: 0, ocioso: 0, flagEit: 0, total: 0 } };
    }
    var num = function(val) { return parseFloat((val || "0").toString().replace(",", ".")) || 0; };
    var obj = {
      guarda: num(r[2]),
      volumoso: num(r[3]),
      inducao: num(r[4]),
      carregamento: num(r[5]),
      ps: num(r[6]),
      pesca: num(r[7]),
      apoio: num(r[8]),
      outros: num(r[9]),
      tnd: num(r[10]),
      ocioso: num(r[11]),
      flagEit: num(r[12]),
      total: num(r[13])
    };
    mapaMt[ldap][ciclo] = obj;
    
    var tot = mapaMt[ldap].TOTAL;
    tot.guarda += obj.guarda;
    tot.volumoso += obj.volumoso;
    tot.inducao += obj.inducao;
    tot.carregamento += obj.carregamento;
    tot.ps += obj.ps;
    tot.pesca += obj.pesca;
    tot.apoio += obj.apoio;
    tot.outros += obj.outros;
    tot.tnd += obj.tnd;
    tot.ocioso += obj.ocioso;
    tot.flagEit = Math.max(tot.flagEit, obj.flagEit);
    tot.total += obj.total;
  }
}

function processarLms(rows) {
  mapaLms = {};
  if (!rows || rows.length < 2) return;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    var ldap = r[0].toString().toLowerCase().trim();
    var num = function(val) { return parseFloat((val || "0").toString().replace(",", ".")) || 0; };
    
    var aaRaw = r[6];
    var aa = false;
    if (aaRaw === true) {
      aa = true;
    } else if (typeof aaRaw === "string") {
      var upper = aaRaw.toUpperCase().trim();
      aa = (upper === "TRUE" || upper === "VERDADEIRO");
    }

    mapaLms[ldap] = {
      processo: num(r[1]),
      ocioso: num(r[2]),
      tnd: num(r[3]),
      flagEit: num(r[4]),
      ocupacao: num(r[5]),
      autoatribuiu: aa,
      entradas: (r[7] === "" || r[7] === null || r[7] === undefined) ? null : num(r[7]),
      cia: num(r[8]),
      coa: num(r[9]),
      pctCia: num(r[10]),
      pctCoa: num(r[11]),
      jornada: num(r[12])
    };
  }
}

var mapaLmsDet = {};

function processarLmsDet(rows) {
  mapaLmsDet = {};
  if (!rows || rows.length === 0) return;
  
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    
    var ldap = r[0].toString().toLowerCase().trim();
    if (!mapaLmsDet[ldap]) {
      mapaLmsDet[ldap] = {
        tl: (r[1] || "").toString().trim(),
        itens: []
      };
    }
    
    var minDia = parseFloat(String(r[5] || "0").replace(",", "."));
    if (isNaN(minDia)) minDia = 0;
    
    mapaLmsDet[ldap].itens.push({
      processo: (r[2] || "").toString().trim(),
      tipo: (r[3] || "").toString().trim(),
      timeType: (r[4] || "").toString().trim(),
      minDia: minDia
    });
  }
}