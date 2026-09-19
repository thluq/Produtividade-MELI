/* ══════════════════════════════════════════════════════════════════════
   THEME — Controle de Modo Claro e Modo Escuro
   ══════════════════════════════════════════════════════════════════════ */

(function () {
  var STORAGE_KEY = "kpi_meli_theme";
  var DEFAULT_THEME = "light";

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    updateToggleButton(theme);
  }

  function updateToggleButton(theme) {
    var btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;

    var textEl = btn.querySelector(".theme-toggle-text");

    if (theme === "dark") {
      if (textEl) textEl.textContent = "Claro";
      btn.title = "Mudar para Modo Claro";
      btn.setAttribute("aria-label", "Mudar para Modo Claro");
    } else {
      if (textEl) textEl.textContent = "Escuro";
      btn.title = "Mudar para Modo Escuro";
      btn.setAttribute("aria-label", "Mudar para Modo Escuro");
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = current === "dark" ? "light" : "dark";

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}

    applyTheme(next);
  }

  // Inicializar estado do botão assim que o DOM carregar
  document.addEventListener("DOMContentLoaded", function () {
    var saved = getSavedTheme();
    applyTheme(saved);

    var btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
    }
  });

  // Expor globalmente se necessário
  window.KPI_THEME = {
    getTheme: getSavedTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme
  };
})();
