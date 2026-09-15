/* ══════════════════════════════════════════════════════════════════════
   GRID STATE — persistência de estado via Grid SDK
   Só funciona quando hospedado no Grid (grid.adminml.com)
   ══════════════════════════════════════════════════════════════════════ */

function salvarEstadoGrid() {
  if (typeof GRID === "undefined" || !GRID.state) return;
  try {
    GRID.state.set({
      activeSub: activeSub,
      activeCycle: activeCycle
    });
  } catch(e) { /* silencioso fora do Grid */ }
}

function carregarEstadoGrid() {
  if (typeof GRID === "undefined" || !GRID.state) return;
  try {
    var estado = GRID.state.get();
    if (estado) {
      if (estado.activeSub) {
        activeSub = estado.activeSub;
        document.querySelectorAll(".subtab").forEach(function(s) {
          s.classList.remove("active-guarda", "active-inducao");
          if (s.dataset.sub === activeSub) {
            s.classList.add(activeSub === "guarda" ? "active-guarda" : "active-inducao");
          }
        });
      }
      if (estado.activeCycle) {
        activeCycle = estado.activeCycle;
        document.querySelectorAll(".chip-cycle").forEach(function(c) {
          c.classList.remove("active");
          if (c.dataset.cycle === activeCycle) c.classList.add("active");
        });
      }
    }
  } catch(e) { /* silencioso fora do Grid */ }
}

// Tenta carregar estado salvo ao iniciar
carregarEstadoGrid();