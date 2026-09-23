/* ══════════════════════════════════════════════════════════════════════
   PAINEL LMS (FEATURE 4)
   ══════════════════════════════════════════════════════════════════════ */

function renderLms() {
  var tbody = document.getElementById("lms-tbody");
  var summaryBar = document.getElementById("lms-summary-bar");
  if (!tbody || !summaryBar) return;

  var keys = Object.keys(mapaLms);
  if (keys.length === 0) {
    summaryBar.innerHTML = "";
    tbody.innerHTML = "<tr><td colspan='10' style='text-align:center; padding: 40px;'><div class='status-box info'>Nenhum dado de LMS disponível.</div></td></tr>";
    return;
  }

  var data = [];
  var totalOcupacao = 0;
  var countOcupacao = 0;
  var countEit = 0;
  var countCiaCoaZero = 0;

  var searchUpper = (lmsSearchText || "").toUpperCase();

  for (var i = 0; i < keys.length; i++) {
    var ldap = keys[i];
    var lms = mapaLms[ldap];
    
    // Summary metrics (calculate for all, unfiltered)
    if (lms.ocupacao >= 0) {
      totalOcupacao += lms.ocupacao;
      countOcupacao++;
    }
    if (lms.flagEit === 1) countEit++;
    if (lms.entradas !== null && lms.cia === 0 && lms.coa === 0) {
      countCiaCoaZero++;
    }

    // Filter
    var info = mapaNomes[ldap];
    var nome = (info && info.nome) ? info.nome : ldap;
    if (searchUpper) {
      if (nome.toUpperCase().indexOf(searchUpper) === -1 && ldap.toUpperCase().indexOf(searchUpper) === -1) {
        continue; // skipped by filter
      }
    }

    data.push({
      ldap: ldap,
      nome: nome,
      foto: (info && info.foto) ? info.foto : "",
      processo: lms.processo,
      ocioso: lms.ocioso,
      tnd: lms.tnd,
      flagEit: lms.flagEit,
      ocupacao: lms.ocupacao,
      autoatribuiu: lms.autoatribuiu,
      entradas: lms.entradas,
      cia: lms.cia,
      coa: lms.coa,
      pctCia: lms.pctCia,
      pctCoa: lms.pctCoa,
      jornada: lms.jornada
    });
  }

  // Summary rendering
  var mediaOcupacao = countOcupacao > 0 ? (totalOcupacao / countOcupacao) : 0;
  var pctCiaCoaZero = keys.length > 0 ? (countCiaCoaZero / keys.length) * 100 : 0;

  summaryBar.innerHTML = 
    "<div class='summary-item'>" +
      "<div class='summary-value'>" + mediaOcupacao.toFixed(1) + "%</div>" +
      "<div class='summary-label'>Ocupação (MT)</div>" +
    "</div>" +
    "<div class='summary-item'>" +
      "<div class='summary-value'>" + countEit + "</div>" +
      "<div class='summary-label'>Reps com EIT</div>" +
    "</div>" +
    "<div class='summary-item'>" +
      "<div class='summary-value'>" + pctCiaCoaZero.toFixed(1) + "%</div>" +
      "<div class='summary-label'>% Reps 0 CIA/COA</div>" +
    "</div>";

  // Sorting
  data.sort(function(a, b) {
    var valA = a[lmsSortCol];
    var valB = b[lmsSortCol];
    
    // Treat strings (like nome)
    if (typeof valA === "string" && typeof valB === "string") {
      valA = valA.toUpperCase();
      valB = valB.toUpperCase();
      if (valA < valB) return lmsSortAsc ? -1 : 1;
      if (valA > valB) return lmsSortAsc ? 1 : -1;
      return 0;
    }
    
    // Numerics and booleans
    valA = (valA === null || valA === undefined) ? -999999 : Number(valA);
    valB = (valB === null || valB === undefined) ? -999999 : Number(valB);
    
    return lmsSortAsc ? (valA - valB) : (valB - valA);
  });

  // Render Table
  if (data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='10' style='text-align:center; padding: 40px;'><div class='status-box info'>Nenhum resultado para a busca.</div></td></tr>";
    return;
  }

  var html = "";
  for (var i = 0; i < data.length; i++) {
    var item = data[i];

    // Ocupação color
    var corOcupacao = "";
    if (item.ocupacao >= 80) corOcupacao = "status-verde";
    else if (item.ocupacao >= 60) corOcupacao = "status-amarelo";
    else corOcupacao = "status-vermelho";

    // CIA / COA color
    var corCia = "", corCoa = "";
    var textoCia = "—", textoCoa = "—";
    
    if (item.entradas !== null) {
      textoCia = item.pctCia.toFixed(1) + "%";
      if (item.pctCia < 5) corCia = "status-verde";
      else if (item.pctCia <= 10) corCia = "status-amarelo";
      else corCia = "status-vermelho";

      textoCoa = item.pctCoa.toFixed(1) + "%";
      if (item.pctCoa < 5) corCoa = "status-verde";
      else if (item.pctCoa <= 10) corCoa = "status-amarelo";
      else corCoa = "status-vermelho";
    }

    // Autoatribuiu
    var aaText = item.autoatribuiu ? "<span style='color: var(--green); font-weight: 800;'>✓</span>" : "<span style='color: var(--t4);'>—</span>";

    // EIT
    var eitText = item.flagEit === 1 ? "<span class='badge-eit' style='position:static; display:inline-block;'>EIT</span>" : "<span style='color: var(--t4);'>—</span>";

    // Avatar
    var fotoUrl = item.foto ? item.foto : CONFIG.PHOTO_FOLDER + item.ldap + ".png";
    var iniciais = item.ldap.substring(0, 2).toUpperCase();
    var pNome = item.nome.trim().split(/\s+/);
    if (pNome.length >= 2) iniciais = (pNome[0][0] + pNome[pNome.length-1][0]).toUpperCase();
    else if (pNome[0].length >= 2) iniciais = pNome[0].substring(0, 2).toUpperCase();

    html += "<tr class='lms-row' data-ldap='" + item.ldap + "' style='cursor:pointer;'>";
    html += "<td>" +
              "<div class='lms-avatar'>" +
                "<div class='rank-photo' style='width: 32px; height: 32px;'>" +
                  "<img src='" + fotoUrl + "' alt='' onerror=\"this.style.display='none'; this.parentElement.textContent='" + iniciais + "'; this.parentElement.classList.add('rank-photo-fallback');\">" +
                "</div>" +
                "<div class='lms-name'>" + item.nome + "</div>" +
              "</div>" +
            "</td>";
    html += "<td>" + item.processo.toFixed(0) + "</td>";
    html += "<td>" + item.ocioso.toFixed(0) + "</td>";
    html += "<td>" + item.tnd.toFixed(0) + "</td>";
    html += "<td>" + eitText + "</td>";
    html += "<td class='" + corOcupacao + "' style='font-weight: 800;'>" + item.ocupacao.toFixed(1) + "%</td>";
    html += "<td>" + aaText + "</td>";
    html += "<td class='" + corCia + "' style='font-weight: 700;'>" + textoCia + "</td>";
    html += "<td class='" + corCoa + "' style='font-weight: 700;'>" + textoCoa + "</td>";
    html += "<td style='color: var(--t3);'>" + item.jornada.toFixed(1) + "%</td>";
    html += "</tr>";
    
    // Detalhe escondido
    html += "<tr class='lms-detail-row' id='lms-det-" + item.ldap + "' style='display:none;'>";
    html += "<td colspan='10' class='lms-detail-cell' style='padding:0;'></td>";
    html += "</tr>";
  }
  tbody.innerHTML = html;
  
  updateLmsSortIcons();
  bindLmsRowClicks();
}

function updateLmsSortIcons() {
  document.querySelectorAll(".lms-sortable").forEach(function(th) {
    var icon = th.querySelector(".sort-icon");
    if (!icon) return;
    icon.className = "sort-icon";
    if (th.dataset.col === lmsSortCol) {
      icon.classList.add(lmsSortAsc ? "asc" : "desc");
      th.classList.add("active-sort");
    } else {
      th.classList.remove("active-sort");
    }
  });
}

function bindLmsRowClicks() {
  document.querySelectorAll(".lms-row").forEach(function(row) {
    row.addEventListener("click", function() {
      var ldap = this.dataset.ldap;
      var detRow = document.getElementById("lms-det-" + ldap);
      var detCell = detRow.querySelector(".lms-detail-cell");
      
      if (detRow.style.display === "none") {
        document.querySelectorAll(".lms-detail-row").forEach(function(r) { r.style.display = "none"; });
        renderLmsDetalhe(ldap, detCell);
        detRow.style.display = "table-row";
      } else {
        detRow.style.display = "none";
      }
    });
  });
}

var mapaLmsNomes = {
  "sorting": "Guarda",
  "dispatch_svc": "Carregamento",
  "labeling": "Indução",
  "inductor": "Indutor",
  "customs_support": "Apoio Customs",
  "labeling_support": "Apoio Indução",
  "fishing": "Pesca",
  "problem_solver_svc": "PS",
  "bathroom": "Pausa pessoal",
  "order_cleaning": "Limpeza de pedidos",
  "simulacrum": "Simulacro",
  "shadowing": "Shadowing",
  "extended_idle_time": "Ociosidade Estendida (EIT)",
  "return_to_station": "Retorno à estação",
  "layout_setup": "Setup de layout"
};

function renderLmsDetalhe(ldap, container) {
  if (typeof mapaLmsDet === "undefined" || !mapaLmsDet[ldap] || !mapaLmsDet[ldap].itens || mapaLmsDet[ldap].itens.length === 0) {
    var mt = typeof mapaMt !== "undefined" && mapaMt[ldap] && mapaMt[ldap]["TOTAL"];
    if (!mt) {
      container.innerHTML = "<div style='padding: 16px; text-align: center; color: var(--t4);'>Nenhum detalhe disponível.</div>";
      return;
    }
    container.innerHTML = "<div style='padding: 16px; color: var(--t2);'>Detalhes baseados em MT: Total " + Math.round(mt.total) + "m (Ocioso: " + Math.round(mt.ocioso) + "m, TND: " + Math.round(mt.tnd) + "m)</div>";
    return;
  }
  
  var det = mapaLmsDet[ldap];
  var itens = det.itens.slice();
  var tndItens = [];
  var normItens = [];
  var somaTotal = 0;
  
  for (var i = 0; i < itens.length; i++) {
    somaTotal += itens[i].minDia;
    if (itens[i].timeType === "time_tndnp") {
      tndItens.push(itens[i]);
    } else {
      normItens.push(itens[i]);
    }
  }
  
  normItens.sort(function(a, b) { return b.minDia - a.minDia; });
  tndItens.sort(function(a, b) { return b.minDia - a.minDia; });
  
  var html = "<div style='padding: 16px 32px; background-color: var(--s2); border-bottom: 1px solid var(--border);'>";
  if (det.tl) {
    html += "<div style='margin-bottom: 12px; font-weight: 600; color: var(--t2);'>TL: " + det.tl + "</div>";
  }
  
  function renderItemRow(item) {
    var nomeAmigavel = mapaLmsNomes[item.processo] || item.processo;
    var isEit = (item.processo === "extended_idle_time");
    
    var h = Math.floor(item.minDia / 60);
    var m = Math.round(item.minDia % 60);
    var tempoStr = (h > 0 ? h + "h " : "") + m + "m";
    
    var pct = somaTotal > 0 ? Math.round((item.minDia / somaTotal) * 100) + "%" : "0%";
    
    var tagHtml = "";
    if (item.tipo && item.tipo.indexOf("systemic") === 0) {
      tagHtml = "<span style='margin-left: 8px; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--s3); color: var(--t2);'>Sistêmico</span>";
    } else if (item.tipo === "non_systemic") {
      tagHtml = "<span style='margin-left: 8px; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--s3); color: var(--t2);'>Não-sistêmico</span>";
    }
    
    var colorStyle = isEit ? "color: #d32f2f; font-weight: 600;" : "color: var(--t2);";
    
    return "<div style='display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--s3); " + colorStyle + "'>" +
             "<div>" + nomeAmigavel + tagHtml + "</div>" +
             "<div><span style='display:inline-block; width: 40px; text-align:right; margin-right: 16px; opacity: 0.7; font-size: 13px;'>" + pct + "</span><span style='display:inline-block; width: 50px; text-align:right;'>" + tempoStr + "</span></div>" +
           "</div>";
  }
  
  for (var j = 0; j < normItens.length; j++) {
    html += renderItemRow(normItens[j]);
  }
  
  if (tndItens.length > 0) {
    html += "<div style='margin-top: 16px; margin-bottom: 8px; font-size: 12px; font-weight: 700; color: var(--t3); text-transform: uppercase;'>TND</div>";
    for (var k = 0; k < tndItens.length; k++) {
      html += renderItemRow(tndItens[k]);
    }
  }
  
  html += "</div>";
  container.innerHTML = html;
}

// Inicializa Event Listeners do LMS quando o script carregar
document.addEventListener("DOMContentLoaded", function() {
  // Sort
  document.querySelectorAll(".lms-sortable").forEach(function(th) {
    th.addEventListener("click", function() {
      var col = th.dataset.col;
      if (lmsSortCol === col) {
        lmsSortAsc = !lmsSortAsc;
      } else {
        lmsSortCol = col;
        lmsSortAsc = (col === "nome" || col === "ldap") ? true : false; // Default desc for numbers, asc for strings
      }
      renderLms();
    });
  });

  // Busca
  var searchInput = document.getElementById("lms-search-input");
  var clearBtn = document.getElementById("lms-search-clear");
  
  if (searchInput) {
    searchInput.addEventListener("input", function() {
      lmsSearchText = this.value.trim();
      clearBtn.style.display = lmsSearchText ? "inline-block" : "none";
      renderLms();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function() {
      searchInput.value = "";
      lmsSearchText = "";
      this.style.display = "none";
      renderLms();
    });
  }
});
