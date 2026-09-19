/* ══════════════════════════════════════════════════════════════════════
   MODO TV — Fullscreen + Auto-scroll entre Guarda e Indução
   ══════════════════════════════════════════════════════════════════════ */

var TV_SCROLL_SPEED = 40;   // ms entre cada passo de scroll
var TV_SCROLL_PX = 1;       // pixels por passo
var TV_PAUSA_FINAL = 4000;  // ms de pausa no final antes de trocar
var TV_PAUSA_INICIO = 2000; // ms de pausa no início após trocar

/* ── Iniciar modo TV ── */
function iniciarTV() {
  tvAtivo = true;
  tvAbaAtual = "guarda";

  var overlay = document.getElementById("tv-overlay");
  overlay.style.display = "flex";

  // Fullscreen
  var el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();

  // Atualizar header
  document.getElementById("tv-facility").textContent = facilityName + " · " + dataRef;
  document.getElementById("tv-ciclo-label").textContent = activeCycle;
  tvTickClock();

  // Começar
  tvRenderAba();
}

/* ── Sair do modo TV ── */
function sairTV() {
  tvAtivo = false;
  tvPararScroll();

  var overlay = document.getElementById("tv-overlay");
  overlay.style.display = "none";

  // Sair fullscreen
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if (document.msExitFullscreen) document.msExitFullscreen();
}

/* ── Relógio do modo TV ── */
function tvTickClock() {
  if (!tvAtivo) return;
  document.getElementById("tv-clock").textContent =
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  setTimeout(tvTickClock, 30000);
}

/* ── Renderizar aba atual no modo TV ── */
function tvRenderAba() {
  if (!tvAtivo) return;

  var isGuarda = tvAbaAtual === "guarda";
  var dados = isGuarda ? dadosGuarda : dadosInducao;
  var duracao = isGuarda ? duracaoGuarda : duracaoInducao;
  var meta = isGuarda ? CONFIG.METAS.guarda : CONFIG.METAS.inducao;

  // Label
  var abaLabel = document.getElementById("tv-aba-label");
  abaLabel.textContent = isGuarda ? "GUARDA" : "INDUÇÃO";
  abaLabel.className = "tv-aba-label " + (isGuarda ? "aba-guarda" : "aba-inducao");
  abaLabel.style.color = "";

  // Filtro de ciclo
  var filtrados;
  if (activeCycle === "TODOS") {
    filtrados = dados;
  } else {
    filtrados = [];
    for (var i = 0; i < dados.length; i++) {
      if (dados[i].ciclo === activeCycle) filtrados.push(dados[i]);
    }
  }

  // Montar ranking (mesma lógica do renderRanking)
  var comTaxa = [];

  if (!isGuarda && Object.keys(mesaDuplas).length > 0) {
    // ── Indução com duplas ──
    var mesasAgrupadas = {};
    var individuais = [];

    for (var i = 0; i < filtrados.length; i++) {
      var op = filtrados[i];
      var dupla = mesaDuplas[op.ldap];
      if (dupla) {
        if (!mesasAgrupadas[dupla.mesa]) {
          mesasAgrupadas[dupla.mesa] = { mesa: dupla.mesa, ops: [] };
        }
        mesasAgrupadas[dupla.mesa].ops.push(op);
      } else {
        individuais.push(op);
      }
    }

    // Cards de mesa
    for (var key in mesasAgrupadas) {
      if (!mesasAgrupadas.hasOwnProperty(key)) continue;
      var grupo = mesasAgrupadas[key];
      var totalMesa = 0, duracaoAtivaMesa = 0, duracaoBrutaMesa = 0, tempoInativoMesa = 0, cicloMesa = "";

      for (var j = 0; j < grupo.ops.length; j++) {
        totalMesa += grupo.ops[j].total;
        duracaoAtivaMesa = Math.max(duracaoAtivaMesa, grupo.ops[j].duracaoAtivaMin || 0);
        duracaoBrutaMesa = Math.max(duracaoBrutaMesa, grupo.ops[j].duracaoBrutaMin || 0);
        tempoInativoMesa = Math.max(tempoInativoMesa, grupo.ops[j].tempoInativoMin || 0);
        if (!cicloMesa && grupo.ops[j].ciclo) cicloMesa = grupo.ops[j].ciclo;
      }

      var duracaoCicloRef = getDuracaoCicloUnico(duracao, cicloMesa);
      var minimoMin = (duracaoCicloRef && duracaoCicloRef.duracaoMin > 0)
        ? duracaoCicloRef.duracaoMin * CONFIG.MINIMO_ATIVO_PCT : 0;

      var taxa;
      if (duracaoAtivaMesa >= minimoMin && duracaoAtivaMesa > 0) {
        var porMin = totalMesa / duracaoAtivaMesa;
        taxa = { porMinuto: porMin, porHora: porMin * 60, temDuracao: true };
      } else {
        taxa = { porMinuto: 0, porHora: 0, temDuracao: false };
      }

      comTaxa.push({
        op: { operatorId: grupo.mesa, ldap: grupo.mesa.toLowerCase().replace(/\s/g, ""),
              ciclo: cicloMesa, total: totalMesa, duracaoAtivaMin: duracaoAtivaMesa,
              duracaoBrutaMin: duracaoBrutaMesa, tempoInativoMin: tempoInativoMesa },
        taxa: taxa, isMesa: true, mesaNome: grupo.mesa, operadores: grupo.ops
      });
    }

    // Individuais
    for (var i = 0; i < individuais.length; i++) {
      var op = individuais[i];
      var duracaoCicloRef = getDuracaoCicloUnico(duracao, op.ciclo);
      var minimoMin = (duracaoCicloRef && duracaoCicloRef.duracaoMin > 0)
        ? duracaoCicloRef.duracaoMin * CONFIG.MINIMO_ATIVO_PCT : 0;
      var taxa;
      if (op.duracaoAtivaMin >= minimoMin && op.duracaoAtivaMin > 0) {
        var porMin = op.total / op.duracaoAtivaMin;
        taxa = { porMinuto: porMin, porHora: porMin * 60, temDuracao: true };
      } else {
        taxa = { porMinuto: 0, porHora: 0, temDuracao: false };
      }
      comTaxa.push({ op: op, taxa: taxa, isMesa: false });
    }
  } else {
    // ── Guarda ou sem duplas ──
    for (var i = 0; i < filtrados.length; i++) {
      var op = filtrados[i];
      var duracaoCicloRef = getDuracaoCicloUnico(duracao, op.ciclo);
      var minimoMin = (duracaoCicloRef && duracaoCicloRef.duracaoMin > 0)
        ? duracaoCicloRef.duracaoMin * CONFIG.MINIMO_ATIVO_PCT : 0;
      var taxa;
      if (op.duracaoAtivaMin >= minimoMin && op.duracaoAtivaMin > 0) {
        var porMin = op.total / op.duracaoAtivaMin;
        taxa = { porMinuto: porMin, porHora: porMin * 60, temDuracao: true };
      } else {
        taxa = { porMinuto: 0, porHora: 0, temDuracao: false };
      }
      comTaxa.push({ op: op, taxa: taxa, isMesa: false });
    }
  }

  // Ordenar
  comTaxa.sort(function(a, b) {
    if (a.taxa.temDuracao && b.taxa.temDuracao) {
      var diff = b.taxa.porMinuto - a.taxa.porMinuto;
      if (Math.abs(diff) < 0.05) return (b.op.duracaoAtivaMin || 0) - (a.op.duracaoAtivaMin || 0);
      return diff;
    }
    if (a.taxa.temDuracao) return -1;
    if (b.taxa.temDuracao) return 1;
    return b.op.total - a.op.total;
  });

  // Renderizar cards
  var container = document.getElementById("tv-rank-list");
  container.innerHTML = "";

  if (comTaxa.length === 0) {
    container.innerHTML = '<div class="status-box info">Nenhum dado encontrado.</div>';
    tvAgendarTroca();
    return;
  }

  for (var i = 0; i < comTaxa.length; i++) {
    var item = comTaxa[i];
    var card;
    if (item.isMesa) {
      card = criarCardMesa(i + 1, item, meta);
    } else {
      card = criarCard(i + 1, item.op, item.taxa, meta, isGuarda);
    }
    card.classList.add("tv-card");
    container.appendChild(card);
  }

  // Resetar scroll e começar após pausa
  var content = document.getElementById("tv-content");
  content.scrollTop = 0;

  setTimeout(function() {
    tvIniciarScroll();
  }, TV_PAUSA_INICIO);
}

/* ── Auto-scroll suave ── */
function tvIniciarScroll() {
  if (!tvAtivo) return;
  tvPararScroll();

  var content = document.getElementById("tv-content");

  tvScrollTimer = setInterval(function() {
    if (!tvAtivo) { tvPararScroll(); return; }

    content.scrollTop += TV_SCROLL_PX;

    // Chegou no final?
    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
      tvPararScroll();
      tvAgendarTroca();
    }
  }, TV_SCROLL_SPEED);
}

/* ── Parar scroll ── */
function tvPararScroll() {
  if (tvScrollTimer) { clearInterval(tvScrollTimer); tvScrollTimer = null; }
  if (tvTrocaTimer) { clearTimeout(tvTrocaTimer); tvTrocaTimer = null; }
}

/* ── Agendar troca de aba ── */
function tvAgendarTroca() {
  if (!tvAtivo) return;
  tvTrocaTimer = setTimeout(function() {
    if (!tvAtivo) return;
    tvAbaAtual = (tvAbaAtual === "guarda") ? "inducao" : "guarda";
    tvRenderAba();
  }, TV_PAUSA_FINAL);
}

/* ── Event listeners ── */
document.getElementById("tv-btn").addEventListener("click", iniciarTV);
document.getElementById("tv-exit-btn").addEventListener("click", sairTV);

// ESC pra sair
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && tvAtivo) sairTV();
});

// Se sair do fullscreen pelo navegador, desativar modo TV
document.addEventListener("fullscreenchange", function() {
  if (!document.fullscreenElement && tvAtivo) sairTV();
});
document.addEventListener("webkitfullscreenchange", function() {
  if (!document.webkitFullscreenElement && tvAtivo) sairTV();
});