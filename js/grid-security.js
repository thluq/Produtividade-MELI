/* ══════════════════════════════════════════════════════════════════════
   GRID URL SYNC — sincroniza estado com a URL (hash)
   Permite compartilhar link com filtro ativo
   ══════════════════════════════════════════════════════════════════════ */

(function() {

  function lerHash() {
    var hash = window.location.hash.replace("#", "");
    if (!hash) return {};
    var params = {};
    hash.split("&").forEach(function(par) {
      var kv = par.split("=");
      if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]);
    });
    return params;
  }

  function escreverHash() {
    var parts = [];
    if (activeSub !== "guarda") parts.push("sub=" + activeSub);
    if (activeCycle !== "TODOS") parts.push("ciclo=" + activeCycle);
    window.location.hash = parts.length ? parts.join("&") : "";
  }

  // ── Ao carregar, lê da URL ──
  var params = lerHash();
  if (params.sub && (params.sub === "guarda" || params.sub === "inducao")) {
    activeSub = params.sub;
    document.querySelectorAll(".subtab").forEach(function(s) {
      s.classList.remove("active-guarda", "active-inducao");
      if (s.dataset.sub === activeSub) {
        s.classList.add(activeSub === "guarda" ? "active-guarda" : "active-inducao");
      }
    });
  }
  if (params.ciclo) {
    var valid = ["TODOS", "AM1", "PM1", "SD", "SDE1"];
    if (valid.indexOf(params.ciclo) !== -1) {
      activeCycle = params.ciclo;
      document.querySelectorAll(".chip-cycle").forEach(function(c) {
        c.classList.remove("active");
        if (c.dataset.cycle === activeCycle) c.classList.add("active");
      });
    }
  }

  // ── Observa mudanças e atualiza hash ──
  var _origRender = window.renderRanking;
  window.renderRanking = function() {
    _origRender();
    escreverHash();
  };

})();