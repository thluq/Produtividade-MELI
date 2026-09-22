/* ══════════════════════════════════════════════════════════════════════
   NAVEGAÇÃO — abas, sub-abas, filtros de ciclo
   ══════════════════════════════════════════════════════════════════════ */

/* ── NAV PRINCIPAL (Sorting / Carregamento / Divisão HC) ── */
document.querySelectorAll(".nav-tab").forEach(function(tab) {
  tab.addEventListener("click", function() {
    document.querySelectorAll(".nav-tab").forEach(function(t) { t.classList.remove("active"); });
    tab.classList.add("active");
    ["sorting", "divisaohc", "lms"].forEach(function(p) {
      var el = document.getElementById("page-" + p);
      if (el) el.style.display = (p === tab.dataset.page) ? "" : "none";
    });
  });
});

/* ── SUB-ABAS SORTING (Guarda / Indução) ── */
document.querySelectorAll(".subtab").forEach(function(sub) {
  sub.addEventListener("click", function() {
    document.querySelectorAll(".subtab").forEach(function(s) { s.classList.remove("active-guarda", "active-inducao"); });
    activeSub = sub.dataset.sub;
    sub.classList.add(activeSub === "guarda" ? "active-guarda" : "active-inducao");
    
    if (activeSub !== "guarda") {
      activeVolumoso = false;
      var chipVol = document.getElementById("chip-volumoso");
      if (chipVol) {
        chipVol.classList.remove("active");
        chipVol.style.display = "none";
      }
    } else {
      var chipVol = document.getElementById("chip-volumoso");
      if (chipVol && Object.keys(mapaMt).length > 0) {
        chipVol.style.display = "inline-block";
      }
    }

    renderRanking();
  });
});

/* ── FILTRO DE CICLO ── */
document.querySelectorAll(".chip-cycle").forEach(function(chip) {
  chip.addEventListener("click", function() {
    if (chip.id === "chip-volumoso") {
      activeVolumoso = !activeVolumoso;
      if (activeVolumoso) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
      renderRanking();
      return;
    }
    document.querySelectorAll(".chip-cycle:not(#chip-volumoso)").forEach(function(c) { c.classList.remove("active"); });
    chip.classList.add("active");
    activeCycle = chip.dataset.cycle;
    renderRanking();
  });
});

/* ── SUB-ABAS DIVISÃO HC (Sorting / Carregamento) ── */
document.querySelectorAll(".subtab-hc").forEach(function(tab) {
  tab.addEventListener("click", function() {
    activeHcSub = tab.dataset.hcsub;
    document.querySelectorAll(".subtab-hc").forEach(function(t) {
      t.classList.remove("active-hc-sorting", "active-hc-carreg");
    });
    tab.classList.add(activeHcSub === "hc-sorting" ? "active-hc-sorting" : "active-hc-carreg");

    // Limpar busca ao trocar de sub-aba
    var input = document.getElementById("hc-search-input");
    if (input) {
      input.value = "";
      document.getElementById("hc-search-clear").style.display = "none";
    }
    renderListaHC("");
  });
});

/* ── BOTÃO MAPA ── */
var _mapaBtn = document.getElementById("hc-mapa-btn");
if (_mapaBtn) _mapaBtn.addEventListener("click", abrirMapa);

/* ── INICIALIZAR BUSCA HC ── */
initBuscaHC();

/* ── TOGGLE JORNADA ── */
var jornadaBtn = document.getElementById("jornada-toggle-btn");
if (jornadaBtn) {
  jornadaBtn.addEventListener("click", function() {
    activeJornada = !activeJornada;
    try {
      localStorage.setItem("kpi_jornada", activeJornada ? "1" : "0");
    } catch(e) {}
    if (typeof renderRanking === "function") {
      renderRanking();
    }
  });
}