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

    html += "<tr>";
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
  }
  tbody.innerHTML = html;

  updateLmsSortIcons();
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
