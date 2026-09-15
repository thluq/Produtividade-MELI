/* ══════════════════════════════════════════════════════════════════════
   MAIN — relógio, inicialização, auto-refresh
   ══════════════════════════════════════════════════════════════════════ */

/* ── RELÓGIO ── */
function tick() {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ── START ── */
tick();
setInterval(tick, 30000);
carregarDados();

/* ── AUTO-REFRESH ── */
setInterval(function() {
  carregarDados();
}, CONFIG.AUTO_REFRESH_MS);