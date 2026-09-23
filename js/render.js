/* ══════════════════════════════════════════════════════════════════════
   RENDERIZAÇÃO DO RANKING
   ══════════════════════════════════════════════════════════════════════ */
function agregarReps(arr) {
  var map = {};
  var order = [];
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    var ldap = item.ldap;
    if (!map[ldap]) {
      var clone = {};
      for (var key in item) {
        if (item.hasOwnProperty(key)) {
          clone[key] = item[key];
        }
      }
      clone.ciclosArr = [{ ciclo: item.ciclo, total: item.total }];
      map[ldap] = clone;
      order.push(ldap);
    } else {
      var exist = map[ldap];
      var foundCiclo = false;
      for (var c = 0; c < exist.ciclosArr.length; c++) {
        if (exist.ciclosArr[c].ciclo === item.ciclo) {
          exist.ciclosArr[c].total += item.total;
          foundCiclo = true;
          break;
        }
      }
      if (!foundCiclo) {
        exist.ciclosArr.push({ ciclo: item.ciclo, total: item.total });
      }
      exist.total += item.total;
      exist.duracaoAtivaMin += item.duracaoAtivaMin;
      exist.duracaoBrutaMin += item.duracaoBrutaMin;
      exist.tempoInativoMin += (item.tempoInativoMin || 0); // Correção 2: soma em vez de max
    }
  }

  var res = [];
  for (var j = 0; j < order.length; j++) {
    var rep = map[order[j]];
    if (rep.ciclosArr && rep.ciclosArr.length > 1) {
      // Correção 1: recalcular a taxa
      rep.pacotesPorMin = rep.duracaoAtivaMin > 0
        ? rep.total / rep.duracaoAtivaMin
        : 0;
    }
    res.push(rep);
  }
  return res;
}

function renderRanking() {
  var isGuarda = activeSub === "guarda";
  var dados = isGuarda ? dadosGuarda : dadosInducao;
  var duracao = isGuarda ? duracaoGuarda : duracaoInducao;
  var meta = isGuarda ? CONFIG.METAS.guarda : CONFIG.METAS.inducao;
  if (isGuarda && activeVolumoso) {
    meta = CONFIG.METAS.volumoso;
  }

  // ── Filtro de ciclo e Volumoso ──
  var filtrados = [];
  for (var i = 0; i < dados.length; i++) {
    var op = dados[i];
    if (activeCycle !== "TODOS" && op.ciclo !== activeCycle) continue;
    
    if (Object.keys(mapaMt).length > 0) {
      var ldap = op.ldap;
      var cicloMap = activeCycle === "TODOS" ? "TOTAL" : op.ciclo;
      var mtInfo = mapaMt[ldap] && mapaMt[ldap][cicloMap];
      var isVolumoso = false;
      if (mtInfo) {
        isVolumoso = mtInfo.volumoso >= 30 &&
                     mtInfo.volumoso > mtInfo.guarda &&
                     mtInfo.volumoso > mtInfo.inducao;
      }
      if (isGuarda) {
        // Guarda: chip volumoso alterna entre as duas populações
        if (activeVolumoso && !isVolumoso) continue;
        if (!activeVolumoso && isVolumoso) continue;
      } else {
        // Indução: rep de volumoso NUNCA aparece (evita duplicidade
        // do bipe único e meta injusta de 2000/h para volumoso)
        if (isVolumoso) continue;
      }
    }
    
    filtrados.push(op);
  }

  // ══════════════════════════════════════════════════════════════
  // INDUÇÃO: Agrupar por mesa (duplas) antes de calcular taxa
  // ══════════════════════════════════════════════════════════════
  if (!isGuarda && Object.keys(mesaDuplas).length > 0) {
    var mesasAgrupadas = {};  // { "MESA 1": { ops: [...], mesa: "MESA 1" } }
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

    // Montar array de itens para ranking (mesas + individuais)
    var comTaxa = [];

    // ── Cards de MESA ──
    for (var key in mesasAgrupadas) {
      if (!mesasAgrupadas.hasOwnProperty(key)) continue;
      var grupo = mesasAgrupadas[key];
      var totalMesa = 0;
      var duracaoAtivaMesa = 0;
      var duracaoBrutaMesa = 0;
      var tempoInativoMesa = 0;
      var cicloMesa = "";

      for (var j = 0; j < grupo.ops.length; j++) {
        totalMesa += grupo.ops[j].total;
        duracaoAtivaMesa = Math.max(duracaoAtivaMesa, grupo.ops[j].duracaoAtivaMin || 0);
        duracaoBrutaMesa = Math.max(duracaoBrutaMesa, grupo.ops[j].duracaoBrutaMin || 0);
        tempoInativoMesa = Math.max(tempoInativoMesa, grupo.ops[j].tempoInativoMin || 0);
        if (!cicloMesa && grupo.ops[j].ciclo) cicloMesa = grupo.ops[j].ciclo;
      }

      // Busca duração do ciclo para calcular o mínimo ativo
      var duracaoCicloRef = getDuracaoCicloUnico(duracao, cicloMesa);
      var minimoMin = (duracaoCicloRef && duracaoCicloRef.duracaoMin > 0)
        ? duracaoCicloRef.duracaoMin * CONFIG.MINIMO_ATIVO_PCT
        : 0;

      var taxa;
      if (duracaoAtivaMesa >= minimoMin && duracaoAtivaMesa > 0) {
        var porMin = totalMesa / duracaoAtivaMesa;
        taxa = { porMinuto: porMin, porHora: porMin * 60, temDuracao: true };
      } else {
        taxa = { porMinuto: 0, porHora: 0, temDuracao: false };
      }

      comTaxa.push({
        op: {
          operatorId: grupo.mesa,
          ldap: grupo.mesa.toLowerCase().replace(/\s/g, ""),
          ciclo: cicloMesa,
          total: totalMesa,
          duracaoAtivaMin: duracaoAtivaMesa,
          duracaoBrutaMin: duracaoBrutaMesa,
          tempoInativoMin: tempoInativoMesa
        },
        taxa: taxa,
        isMesa: true,
        mesaNome: grupo.mesa,
        operadores: grupo.ops
      });
    }

    // ── Cards INDIVIDUAIS (sem mesa) ──
    if (activeCycle === "TODOS") {
      individuais = agregarReps(individuais);
    }
    for (var i = 0; i < individuais.length; i++) {
      var op = individuais[i];
      var minimoMin = 0;
      if (op.ciclosArr) {
        for (var c = 0; c < op.ciclosArr.length; c++) {
          var ref = getDuracaoCicloUnico(duracao, op.ciclosArr[c].ciclo);
          if (ref && ref.duracaoMin > 0) minimoMin += ref.duracaoMin * CONFIG.MINIMO_ATIVO_PCT;
        }
      } else {
        var duracaoCicloRef = getDuracaoCicloUnico(duracao, op.ciclo);
        minimoMin = (duracaoCicloRef && duracaoCicloRef.duracaoMin > 0)
          ? duracaoCicloRef.duracaoMin * CONFIG.MINIMO_ATIVO_PCT
          : 0;
      }

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
    // ══════════════════════════════════════════════════════════════
    // GUARDA ou sem duplas: lógica original
    // ══════════════════════════════════════════════════════════════
    var comTaxa = [];
    if (activeCycle === "TODOS") {
      filtrados = agregarReps(filtrados);
    }
    for (var i = 0; i < filtrados.length; i++) {
      var op = filtrados[i];
      
      var minutosAtivos = op.duracaoAtivaMin;
      if (isGuarda && activeVolumoso && Object.keys(mapaMt).length > 0) {
        var cicloMapTaxa = activeCycle === "TODOS" ? "TOTAL" : op.ciclo;
        var mtV = mapaMt[op.ldap] && mapaMt[op.ldap][cicloMapTaxa];
        if (mtV && mtV.volumoso > 0) {
          minutosAtivos = mtV.volumoso;
        }
      }
      
      var opToRender = op;
      if (minutosAtivos !== op.duracaoAtivaMin) {
        opToRender = {
          operatorId: op.operatorId,
          ldap: op.ldap,
          ciclo: op.ciclo,
          total: op.total,
          duracaoAtivaMin: minutosAtivos,
          duracaoBrutaMin: op.duracaoBrutaMin,
          tempoInativoMin: op.tempoInativoMin,
          pacotesPorMin: op.pacotesPorMin,
          ciclosArr: op.ciclosArr
        };
      }

      var minimoMin = 0;
      if (opToRender.ciclosArr) {
        for (var c = 0; c < opToRender.ciclosArr.length; c++) {
          var ref = getDuracaoCicloUnico(duracao, opToRender.ciclosArr[c].ciclo);
          if (ref && ref.duracaoMin > 0) minimoMin += ref.duracaoMin * CONFIG.MINIMO_ATIVO_PCT;
        }
      } else {
        var duracaoCicloRef = getDuracaoCicloUnico(duracao, opToRender.ciclo);
        minimoMin = (duracaoCicloRef && duracaoCicloRef.duracaoMin > 0)
          ? duracaoCicloRef.duracaoMin * CONFIG.MINIMO_ATIVO_PCT
          : 0;
      }

      var taxa;
      if (opToRender.duracaoAtivaMin >= minimoMin && opToRender.duracaoAtivaMin > 0) {
        var porMin = opToRender.total / opToRender.duracaoAtivaMin;
        taxa = { porMinuto: porMin, porHora: porMin * 60, temDuracao: true };
      } else {
        taxa = { porMinuto: 0, porHora: 0, temDuracao: false };
      }

      comTaxa.push({ op: opToRender, taxa: taxa, isMesa: false });
    }
  }

  // ── Ordena por taxa desc ──
  comTaxa.sort(function(a, b) {
    if (activeCycle === "TODOS") {
      if (a.taxa.temDuracao && b.taxa.temDuracao) {
        var diff = b.taxa.porMinuto - a.taxa.porMinuto;
        if (Math.abs(diff) < 0.05) {
          var tempoA = a.op.duracaoAtivaMin || 0;
          var tempoB = b.op.duracaoAtivaMin || 0;
          return tempoB - tempoA;
        }
        return diff;
      }
      if (a.taxa.temDuracao) return -1;
      if (b.taxa.temDuracao) return 1;
      return b.op.total - a.op.total;
    } else {
      if (b.op.total !== a.op.total) return b.op.total - a.op.total;
      var taxaA = a.taxa.temDuracao ? a.taxa.porMinuto : 0;
      var taxaB = b.taxa.temDuracao ? b.taxa.porMinuto : 0;
      if (taxaB !== taxaA) return taxaB - taxaA;
      return (b.op.duracaoAtivaMin || 0) - (a.op.duracaoAtivaMin || 0);
    }
  });

  // ── Summary bar ──
  renderSummary(comTaxa, duracao, meta, isGuarda);

  // ── Updated line ──
  var updLine = document.getElementById("updated-line");
  if (lastUpdate) {
    updLine.textContent = "Atualizado: " + lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " · via " + fonteDados;
  }

  // ── Rank list ──
  var container = document.getElementById("rank-list");
  container.innerHTML = "";

  if (comTaxa.length === 0) {
    container.innerHTML = '<div class="status-box info">Nenhum dado encontrado para este filtro.</div>';
    return;
  }

  for (var i = 0; i < comTaxa.length; i++) {
    var item = comTaxa[i];
    if (item.isMesa) {
      var card = criarCardMesa(i + 1, item, meta);
      container.appendChild(card);
    } else {
      var card = criarCard(i + 1, item.op, item.taxa, meta, isGuarda);
      container.appendChild(card);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   BUSCAR DURAÇÃO DE UM CICLO ESPECÍFICO
   ══════════════════════════════════════════════════════════════════════ */
function getDuracaoCicloUnico(duracao, ciclo) {
  for (var i = 0; i < duracao.length; i++) {
    if (duracao[i].ciclo === ciclo) return duracao[i];
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════
   CALCULAR TAXA (usado pela indução)
   ══════════════════════════════════════════════════════════════════════ */
function calcularTaxa(op, duracaoCiclo) {
  if (!duracaoCiclo || duracaoCiclo.duracaoMin <= 0) {
    return { porMinuto: 0, porHora: 0, temDuracao: false };
  }
  var porMin = op.total / duracaoCiclo.duracaoMin;
  var porHora = porMin * 60;
  return { porMinuto: porMin, porHora: porHora, temDuracao: true };
}

/* ══════════════════════════════════════════════════════════════════════
   STATUS DA META
   ══════════════════════════════════════════════════════════════════════ */
function getStatusMeta(taxa, meta, isGuarda) {
  if (!taxa.temDuracao) return { classe: "status-sem-dados", label: "—", pct: 0, cor: null };

  var pct = isGuarda
    ? taxa.porMinuto / meta.porMinuto
    : taxa.porHora / meta.porHora;

  // Label
  var label;
  if (pct >= 1.0) label = "Na meta";
  else if (pct >= 0.8) label = "Atenção";
  else label = "Abaixo";

  // Cor gradiente: 0% = vermelho(0°), 80% = amarelo(45°), 100%+ = verde(140°)
  var hue;
  if (pct >= 1.0) {
    hue = 140; // verde
  } else if (pct >= 0.8) {
    // 80%-100% → amarelo(45°) até verde(140°)
    var t = (pct - 0.8) / 0.2;
    hue = 45 + (t * 95);
  } else if (pct >= 0.4) {
    // 40%-80% → vermelho(0°) até amarelo(45°)
    var t = (pct - 0.4) / 0.4;
    hue = t * 45;
  } else {
    hue = 0; // vermelho
  }

  var cor = "hsl(" + Math.round(hue) + ", 85%, 50%)";
  var corBg = "hsla(" + Math.round(hue) + ", 85%, 50%, 0.12)";

  return { classe: "status-gradiente", label: label, pct: pct, cor: cor, corBg: corBg };
}

/* ══════════════════════════════════════════════════════════════════════
   CRIAR CARD DO OPERADOR
   ══════════════════════════════════════════════════════════════════════ */
function criarCard(pos, op, taxa, meta, isGuarda) {
  var status = getStatusMeta(taxa, meta, isGuarda);
  var card = document.createElement("div");
  card.className = "rank-card";

  // ── Posição ──
  var posEl = document.createElement("div");
  posEl.className = "rank-pos";
  posEl.textContent = pos + "º";
  if (pos <= 3) posEl.classList.add("rank-top3");

  // ── Foto ──
  var foto = document.createElement("div");
  foto.className = "rank-photo";
  var infoFoto = mapaNomes[op.ldap];
  var fotoUrl = (infoFoto && infoFoto.foto) ? infoFoto.foto : CONFIG.PHOTO_FOLDER + op.ldap + ".png";
  var iniciais = op.ldap.substring(0, 2).toUpperCase();
  if (infoFoto && infoFoto.nome) {
    var partes = infoFoto.nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      iniciais = (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    } else {
      iniciais = infoFoto.nome.substring(0, 2).toUpperCase();
    }
  }
  var img = document.createElement("img");
  img.src = fotoUrl;
  img.alt = op.ldap;
  img.onerror = function() {
    this.style.display = "none";
    this.parentElement.textContent = iniciais;
    this.parentElement.classList.add("rank-photo-fallback");
  };
  foto.appendChild(img);

  // ── Info (nome + ciclo + tempo inativo) ──
  var info = document.createElement("div");
  info.className = "rank-info";
  var nome = document.createElement("div");
  nome.className = "rank-name";
  var infoLdap = mapaNomes[op.ldap];
  var nomeExibir = (infoLdap && infoLdap.nome) ? infoLdap.nome : op.ldap;
  nome.textContent = nomeExibir;
  var cicloTag = document.createElement("div");
  cicloTag.className = "rank-ciclo";
  if (op.ciclosArr && op.ciclosArr.length > 1) {
    var chipsHtml = "";
    for (var c = 0; c < op.ciclosArr.length; c++) {
      chipsHtml += "<span class='badge-ciclo'>" + op.ciclosArr[c].ciclo + " &middot; " + op.ciclosArr[c].total + "</span> ";
    }
    if (op.duracaoAtivaMin > 0) {
      chipsHtml += " &middot; " + formatarMinutos(op.duracaoAtivaMin) + " ativo";
    }
    cicloTag.innerHTML = chipsHtml;
  } else {
    var cicloTxt = op.ciclo;
    if (op.duracaoAtivaMin > 0) {
      cicloTxt += " · " + formatarMinutos(op.duracaoAtivaMin) + " ativo";
      // if (op.tempoInativoMin > 0) {
      //   cicloTxt += " · " + formatarMinutos(op.tempoInativoMin) + " parado";
      // }
    }
    cicloTag.textContent = cicloTxt;
  }
  info.appendChild(nome);
  info.appendChild(cicloTag);

  // ── Total ──
  var totalEl = document.createElement("div");
  totalEl.className = "rank-total";
  totalEl.textContent = op.total.toLocaleString("pt-BR");

  // ── Métricas (taxa/min + taxa/hora) ──
  var metricas = document.createElement("div");
  metricas.className = "rank-metricas";

 if (taxa.temDuracao) {
    var taxaPrincipal = document.createElement("div");
    taxaPrincipal.className = "rank-taxa-min";
    taxaPrincipal.style.color = status.cor;

    var taxaSecundaria = document.createElement("div");
    taxaSecundaria.className = "rank-taxa-hora";

    if (isGuarda) {
      taxaPrincipal.textContent = taxa.porMinuto.toFixed(1) + "/min";
      taxaSecundaria.textContent = Math.round(taxa.porHora).toLocaleString("pt-BR") + "/h";
    } else {
      taxaPrincipal.textContent = Math.round(taxa.porHora).toLocaleString("pt-BR") + "/h";
      taxaSecundaria.textContent = taxa.porMinuto.toFixed(1) + "/min";
    }

    var barraContainer = document.createElement("div");
    barraContainer.className = "rank-barra-container";
    var barra = document.createElement("div");
    barra.className = "rank-barra";
    barra.style.width = Math.min(status.pct * 100, 100) + "%";
    barra.style.background = status.cor;
    barraContainer.appendChild(barra);

    metricas.appendChild(taxaPrincipal);
    metricas.appendChild(taxaSecundaria);
    metricas.appendChild(barraContainer);
  }
   else {
    var semDados = document.createElement("div");
    semDados.className = "rank-taxa-min status-sem-dados";
    semDados.textContent = "—";
    metricas.appendChild(semDados);
  }

  // ── Pill de status ──
  var pill = document.createElement("div");
  pill.className = "rank-pill";
  if (status.cor) {
    pill.style.color = status.cor;
    pill.style.background = status.corBg;
    pill.style.border = "1px solid " + status.cor;
  } else {
    pill.classList.add("status-sem-dados");
  }
  pill.textContent = status.label;

  // ── Montar card ──
  card.appendChild(posEl);
  card.appendChild(foto);
  card.appendChild(info);
  card.appendChild(totalEl);
  card.appendChild(metricas);
  card.appendChild(pill);

  // ── Jornada e EIT ──
  if (activeJornada && mapaMt[op.ldap]) {
    var mtData = mapaMt[op.ldap]["TOTAL"];

    if (mtData) {
      // EIT badge
      if (mtData.flagEit === 1) {
        card.style.position = "relative";
        var badgeEit = document.createElement("div");
        badgeEit.className = "badge-eit";
        badgeEit.textContent = "EIT";
        card.appendChild(badgeEit);
      }
      
      // Barra de Jornada
      if (mtData.total > 0) {
        card.style.flexWrap = "wrap";
        
        var jContainer = document.createElement("div");
        jContainer.className = "rank-jornada-container";
        jContainer.title = "Jornada (dia inteiro)";
        
        var jBar = document.createElement("div");
        jBar.className = "jornada-bar";
        jBar.title = "Jornada (dia inteiro)";
        
        var jChips = document.createElement("div");
        jChips.className = "jornada-chips";
        
        var segments = [
          { key: 'guarda', label: 'Guarda', color: '#2e7d32' },
          { key: 'volumoso', label: 'Volumoso', color: '#8d6e63' },
          { key: 'inducao', label: 'Indução', color: '#1565c0' },
          { key: 'carregamento', label: 'Carreg.', color: '#6a1b9a' },
          { key: 'ps', label: 'PS', color: '#ef6c00' },
          { key: 'pesca', label: 'Pesca', color: '#00838f' },
          { key: 'apoio', label: 'Apoio', color: '#9e9d24' },
          { key: 'outros', label: 'Outros', color: '#546e7a' },
          { key: 'tnd', label: 'TND', color: '#fdd835' },
          { key: 'ocioso', label: 'Ocioso', color: '#b71c1c' }
        ];
        
        for (var i = 0; i < segments.length; i++) {
          var seg = segments[i];
          var min = mtData[seg.key] || 0;
          if (min > 0) {
            var pct = mtData.total > 0 ? (min / mtData.total) * 100 : 0;
            
            var divSeg = document.createElement("div");
            divSeg.className = "jornada-segment";
            divSeg.style.width = pct + "%";
            divSeg.style.backgroundColor = seg.color;
            divSeg.title = seg.label + " (" + formatarMinutos(Math.round(min)) + ")";
            jBar.appendChild(divSeg);
            
            var chip = document.createElement("div");
            chip.className = "jornada-chip";
            chip.title = "Jornada (dia inteiro)";
            chip.innerHTML = '<span class="jornada-chip-dot" style="background-color:' + seg.color + '"></span>' + seg.label + ' ' + formatarMinutos(Math.round(min));
            jChips.appendChild(chip);
          }
        }
        
        jContainer.appendChild(jBar);
        jContainer.appendChild(jChips);
        card.appendChild(jContainer);
      }
    }
  }

  return card;
}

/* ══════════════════════════════════════════════════════════════════════
   CRIAR CARD DE MESA (DUPLA)
   ══════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════
   CRIAR CARD DE MESA (DUPLA)
   ══════════════════════════════════════════════════════════════════════ */
function criarCardMesa(pos, item, meta) {
  var status = getStatusMeta(item.taxa, meta, false);
  var card = document.createElement("div");
  card.className = "rank-card rank-card-mesa";

  // ── Posição ──
  var posEl = document.createElement("div");
  posEl.className = "rank-pos";
  posEl.textContent = pos + "º";
  if (pos <= 3) posEl.classList.add("rank-top3");

  // ── Fotos sobrepostas (dupla) ──
  var fotoContainer = document.createElement("div");
  fotoContainer.className = "rank-photo-dupla";

  // Coletar todos os operadores (presentes + ausentes)
  var todosOps = [];
  for (var i = 0; i < item.operadores.length; i++) {
    todosOps.push(item.operadores[i].ldap);
  }
  // Adicionar ausentes
  for (var ldap in mesaDuplas) {
    if (!mesaDuplas.hasOwnProperty(ldap)) continue;
    if (mesaDuplas[ldap].mesa === item.mesaNome && todosOps.indexOf(ldap) === -1) {
      todosOps.push(ldap);
    }
  }

  for (var f = 0; f < todosOps.length; f++) {
    var ldap = todosOps[f];
    var infoFoto = mapaNomes[ldap];
    var fotoUrl = (infoFoto && infoFoto.foto) ? infoFoto.foto : CONFIG.PHOTO_FOLDER + ldap + ".png";
    var iniciais = ldap.substring(0, 2).toUpperCase();
    if (infoFoto && infoFoto.nome) {
      var partes = infoFoto.nome.trim().split(/\s+/);
      if (partes.length >= 2) {
        iniciais = (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
      } else {
        iniciais = infoFoto.nome.substring(0, 2).toUpperCase();
      }
    }

    var fotoEl = document.createElement("div");
    fotoEl.className = "rank-photo-dupla-item";
    if (f === 1) fotoEl.classList.add("rank-photo-dupla-second");
    var img = document.createElement("img");
    img.src = fotoUrl;
    img.alt = ldap;
    (function(el, ini) {
      img.onerror = function() {
        this.style.display = "none";
        el.textContent = ini;
        el.classList.add("rank-photo-fallback");
      };
    })(fotoEl, iniciais);
    fotoEl.appendChild(img);
    fotoContainer.appendChild(fotoEl);
  }

  // ── Info (nome da mesa + nomes dos operadores) ──
  var info = document.createElement("div");
  info.className = "rank-info";

  var nome = document.createElement("div");
  nome.className = "rank-name";
  nome.textContent = item.mesaNome;

  var opsDetail = document.createElement("div");
  opsDetail.className = "rank-mesa-ops";

  // Operadores presentes (com dados)
  for (var i = 0; i < item.operadores.length; i++) {
    var op = item.operadores[i];
    var infoLdap = mapaNomes[op.ldap];
    var nomeOp = (infoLdap && infoLdap.nome) ? infoLdap.nome : op.ldap;
    var totalOp = op.total.toLocaleString("pt-BR");

    var opLine = document.createElement("div");
    opLine.className = "rank-mesa-op-line";
    opLine.innerHTML = '<span class="rank-mesa-op-nome">' + nomeOp + '</span>' +
                       '<span class="rank-mesa-op-total">' + totalOp + '</span>';
    opsDetail.appendChild(opLine);
  }

  // Operadores ausentes (sem dados de produtividade)
  for (var ldap in mesaDuplas) {
    if (!mesaDuplas.hasOwnProperty(ldap)) continue;
    if (mesaDuplas[ldap].mesa === item.mesaNome) {
      var encontrado = false;
      for (var j = 0; j < item.operadores.length; j++) {
        if (item.operadores[j].ldap === ldap) { encontrado = true; break; }
      }
      if (!encontrado) {
        var infoLdap = mapaNomes[ldap];
        var nomeFalta = (infoLdap && infoLdap.nome) ? infoLdap.nome : ldap;
        var opLine = document.createElement("div");
        opLine.className = "rank-mesa-op-line rank-mesa-op-zero";
        opLine.innerHTML = '<span class="rank-mesa-op-nome">' + nomeFalta + '</span>' +
                           '<span class="rank-mesa-op-total">0</span>';
        opsDetail.appendChild(opLine);
      }
    }
  }

  var cicloTag = document.createElement("div");
  cicloTag.className = "rank-ciclo";
  var cicloTxt = item.op.ciclo || "";
  if (item.op.duracaoAtivaMin > 0) {
    cicloTxt += " · " + formatarMinutos(item.op.duracaoAtivaMin) + " ativo";
    // if (item.op.tempoInativoMin > 0) {
    //   cicloTxt += " · " + formatarMinutos(item.op.tempoInativoMin) + " parado";
    // }
  }
  cicloTag.textContent = cicloTxt;

  info.appendChild(nome);
  info.appendChild(opsDetail);
  info.appendChild(cicloTag);

  // ── Total ──
  var totalEl = document.createElement("div");
  totalEl.className = "rank-total";
  totalEl.textContent = item.op.total.toLocaleString("pt-BR");

  // ── Métricas ──
  var metricas = document.createElement("div");
  metricas.className = "rank-metricas";

  if (item.taxa.temDuracao) {
    var taxaPrincipal = document.createElement("div");
    taxaPrincipal.className = "rank-taxa-min";
    taxaPrincipal.style.color = status.cor;
    taxaPrincipal.textContent = Math.round(item.taxa.porHora).toLocaleString("pt-BR") + "/h";

    var taxaSecundaria = document.createElement("div");
    taxaSecundaria.className = "rank-taxa-hora";
    taxaSecundaria.textContent = item.taxa.porMinuto.toFixed(1) + "/min";

    var barraContainer = document.createElement("div");
    barraContainer.className = "rank-barra-container";
    var barra = document.createElement("div");
    barra.className = "rank-barra";
    barra.style.width = Math.min(status.pct * 100, 100) + "%";
    barra.style.background = status.cor;
    barraContainer.appendChild(barra);

    metricas.appendChild(taxaPrincipal);
    metricas.appendChild(taxaSecundaria);
    metricas.appendChild(barraContainer);
  } else {
    var semDados = document.createElement("div");
    semDados.className = "rank-taxa-min status-sem-dados";
    semDados.textContent = "—";
    metricas.appendChild(semDados);
  }

  // ── Pill de status ──
  var pill = document.createElement("div");
  pill.className = "rank-pill";
  if (status.cor) {
    pill.style.color = status.cor;
    pill.style.background = status.corBg;
    pill.style.border = "1px solid " + status.cor;
  } else {
    pill.classList.add("status-sem-dados");
  }
  pill.textContent = status.label;

  // ── Montar card ──
  card.appendChild(posEl);
  card.appendChild(fotoContainer);
  card.appendChild(info);
  card.appendChild(totalEl);
  card.appendChild(metricas);
  card.appendChild(pill);

  return card;
}

/* ══════════════════════════════════════════════════════════════════════
   SUMMARY BAR
   ══════════════════════════════════════════════════════════════════════ */
function renderSummary(comTaxa, duracao, meta, isGuarda) {
  var bar = document.getElementById("summary-bar");

  var totalPacotes = 0;
  var totalOperadores = comTaxa.length;
  for (var i = 0; i < comTaxa.length; i++) {
    totalPacotes += comTaxa[i].op.total;
  }

  // ── Duração para exibição ──
  var duracaoTxt = "—";
  if (activeCycle === "TODOS") {
    var partes = [];
    for (var i = 0; i < duracao.length; i++) {
      partes.push(duracao[i].ciclo + ": " + formatarMinutos(duracao[i].duracaoMin));
    }
    duracaoTxt = partes.length > 0 ? partes.join(" · ") : "—";
  } else {
    var dc = getDuracaoCicloUnico(duracao, activeCycle);
    if (dc && dc.duracaoMin > 0) {
      duracaoTxt = formatarMinutos(dc.duracaoMin);
    }
  }

  // ── Taxa geral (só ciclo específico + indução, OU guarda com soma) ──
  var taxaGeralHtml = "";
  if (activeCycle !== "TODOS") {
    if (isGuarda) {
      // Guarda: soma tempo ativo individual dos operadores filtrados
      var somaAtivo = 0;
      for (var i = 0; i < comTaxa.length; i++) {
        if (comTaxa[i].op.duracaoAtivaMin) somaAtivo += comTaxa[i].op.duracaoAtivaMin;
      }
      if (somaAtivo > 0) {
        var mediaMin = totalPacotes / (somaAtivo / totalOperadores);
        // Usa média do tempo ativo pra taxa geral
        var dcg = getDuracaoCicloUnico(duracao, activeCycle);
        if (dcg && dcg.duracaoMin > 0) {
          var taxaMin = totalPacotes / dcg.duracaoMin;
          var taxaHora = taxaMin * 60;
          taxaGeralHtml =
            '<div class="summary-item">' +
              '<div class="summary-value">' + taxaMin.toFixed(1) + '/min</div>' +
              '<div class="summary-label">Taxa geral ciclo</div>' +
            '</div>' +
            '<div class="summary-item">' +
              '<div class="summary-value">' + Math.round(taxaHora).toLocaleString("pt-BR") + '/h</div>' +
              '<div class="summary-label">Projeção/hora</div>' +
            '</div>';
        }
      }
    } else {
      // Indução: usa duração do ciclo
      var dc = getDuracaoCicloUnico(duracao, activeCycle);
      if (dc && dc.duracaoMin > 0) {
        var taxaMin = totalPacotes / dc.duracaoMin;
        var taxaHora = taxaMin * 60;
        taxaGeralHtml =
          '<div class="summary-item">' +
            '<div class="summary-value">' + taxaMin.toFixed(1) + '/min</div>' +
            '<div class="summary-label">Taxa geral</div>' +
          '</div>' +
          '<div class="summary-item">' +
            '<div class="summary-value">' + Math.round(taxaHora).toLocaleString("pt-BR") + '/h</div>' +
            '<div class="summary-label">Projeção/hora</div>' +
          '</div>';
      }
    }
  }

  bar.innerHTML =
    '<div class="summary-item">' +
      '<div class="summary-value">' + totalPacotes.toLocaleString("pt-BR") + '</div>' +
      '<div class="summary-label">Total pacotes</div>' +
    '</div>' +
    '<div class="summary-item">' +
      '<div class="summary-value">' + totalOperadores + '</div>' +
      '<div class="summary-label">Operadores</div>' +
    '</div>' +
    '<div class="summary-item">' +
      '<div class="summary-value" style="font-size:' + (activeCycle === "TODOS" ? '12px' : '20px') + '">' + duracaoTxt + '</div>' +
      '<div class="summary-label">Duração ciclo</div>' +
    '</div>' +
    taxaGeralHtml +
    '<div class="summary-item">' +
      '<div class="summary-value summary-meta">' +
        (activeSub === "guarda" ? meta.porMinuto + '/min' : meta.porHora.toLocaleString("pt-BR") + '/h') +
      '</div>' +
      '<div class="summary-label">Meta</div>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════════════════════════ */
function formatarMinutos(min) {
  var h = Math.floor(min / 60);
  var m = min % 60;
  if (h > 0 && m > 0) return h + "h " + m + "m";
  if (h > 0) return h + "h";
  return m + "min";
}

function minutosParaHms(min) {
  var h = Math.floor(min / 60);
  var m = min % 60;
  return pad(h) + ":" + pad(m) + ":00";
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

/* Remove qualquer popup/box de erro e o card de autorização do Google */
function limparErro() {
  var el = document.getElementById("status-msg");
  if (el) el.innerHTML = "";
  // se o box de erro/autorização for outro container, esconda aqui também:
  var authBox = document.getElementById("auth-box");
  if (authBox) authBox.style.display = "none";
  setStatus("ok", "appsscript");
}