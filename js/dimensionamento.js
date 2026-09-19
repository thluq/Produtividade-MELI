/* ══════════════════════════════════════════════════════════════════════
   DIMENSIONAMENTO — Parser + Busca + Mapa Visual
   ══════════════════════════════════════════════════════════════════════ */

/* ── Extrair valor de célula como string limpa ── */
function cellStr(rows, row, col) {
  if (!rows || !rows[row] || rows[row][col] === undefined || rows[row][col] === null) return "";
  var val = rows[row][col];
  
  // Se for Date (horários do Sheets vêm como Date), formata como HH:MM
  if (val instanceof Date || (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
    try {
      var d = (val instanceof Date) ? val : new Date(val);
      if (!isNaN(d.getTime())) {
        var h = d.getHours ? d.getHours() : d.getUTCHours();
        var m = d.getMinutes ? d.getMinutes() : d.getUTCMinutes();
        // Se ano é 1899/1900, é só horário (padrão Sheets)
        if (d.getFullYear() <= 1900) {
          h = d.getUTCHours();
          m = d.getUTCMinutes();
        }
        return ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2);
      }
    } catch(e) {}
  }
  
  return val.toString().trim();
}

/* ══════════════════════════════════════════════════════════════════════
   PARSER — ABA SORTING
   Transforma o mapa visual em array plano [{nome, setor, posicao, ldap, dupla}]
   ══════════════════════════════════════════════════════════════════════ */
function parseSorting(rows) {
  var resultado = [];
  if (!rows || rows.length < 2) return resultado;

  var cfg = CONFIG.DIM_SORTING;

  // ── RUAS ESQUERDO ──
  var re = cfg.ESQUERDO;
  for (var i = re.startRow; i <= Math.min(re.endRow, rows.length - 1); i++) {
    var nome = cellStr(rows, i, re.startCol);
    var funcao = cellStr(rows, i, re.endCol);
    if (nome && nome !== "NOME" && nome !== "ESQUERDO" && !/^RUA\s/i.test(nome)) {
      resultado.push({ nome: nome, setor: "SORTING", posicao: "RUA ESQUERDO", detalhe: funcao || "" });
    }
  }

  // ── RUAS DIREITO ──
  var rd = cfg.DIREITO;
  for (var i = rd.startRow; i <= Math.min(rd.endRow, rows.length - 1); i++) {
    var nome = cellStr(rows, i, rd.startCol);
    var funcao = cellStr(rows, i, rd.endCol);
    if (nome && nome !== "NOME" && nome !== "DIRETO" && nome !== "DIREITO" && !/^RUA\s/i.test(nome)) {
      resultado.push({ nome: nome, setor: "SORTING", posicao: "RUA DIREITO", detalhe: funcao || "" });
    }
  }

  // ── MESAS (duplas de indução) ──
  var mesas = cfg.MESAS;
  for (var m = 0; m < mesas.length; m++) {
    var mesa = mesas[m];
    var dupla = [];

    // Pegar os 2 operadores da mesa (linhas de dados)
    for (var i = mesa.startRow; i <= Math.min(mesa.endRow, rows.length - 1); i++) {
      var nome = cellStr(rows, i, mesa.nome);
      var ldap = cellStr(rows, i, mesa.ldap);
      if (nome && nome !== "NOME" && nome !== mesa.id) {
        dupla.push({ nome: nome, ldap: ldap });
      }
    }

    // Adicionar cada operador com referência à dupla
    for (var d = 0; d < dupla.length; d++) {
      var parceiro = dupla.length > 1 ? dupla[1 - d] : null;
      resultado.push({
        nome: dupla[d].nome,
        ldap: dupla[d].ldap || "",
        setor: "SORTING",
        posicao: mesa.id,
        detalhe: parceiro ? "Dupla com " + parceiro.nome : "",
        mesa: mesa.id,
        duplaLdap: parceiro ? parceiro.ldap : ""
      });
    }

    // Flow Rack da mesa
    for (var i = mesa.startRow; i <= Math.min(mesa.endRow, rows.length - 1); i++) {
      var nome = cellStr(rows, i, mesa.flowRack);
      if (nome && nome !== "NOME" && nome !== "FLOW RACK") {
        resultado.push({ nome: nome, setor: "SORTING", posicao: "FLOW RACK (" + mesa.id + ")", detalhe: "" });
      }
    }
  }

  // ── ÁREAS OPERACIONAIS (LINE HAUL, PALETEIRA, YMS, INDUÇÃO) ──
  var areas = cfg.AREAS;
  for (var a = 0; a < areas.length; a++) {
    var area = areas[a];
    for (var i = area.startRow; i <= Math.min(area.endRow, rows.length - 1); i++) {
      var nome = cellStr(rows, i, area.col);
      if (nome && nome !== area.id && nome !== "NOME") {
        resultado.push({ nome: nome, setor: "SORTING", posicao: area.id, detalhe: "" });
      }
    }
  }

  return resultado;
}

/* ══════════════════════════════════════════════════════════════════════
   PARSER — ABA CARREGAMENTO
   Transforma a tabela semi-estruturada em array plano
   ══════════════════════════════════════════════════════════════════════ */
function parseCarregamento(rows) {
  var resultado = [];
  if (!rows || rows.length < 2) return resultado;

  var secoes = CONFIG.DIM_CARREGAMENTO.SECOES;

  for (var s = 0; s < secoes.length; s++) {
    var sec = secoes[s];

    for (var i = sec.startRow; i <= Math.min(sec.endRow, rows.length - 1); i++) {
      var nome = cellStr(rows, i, sec.colNome);

      // Ignorar headers e vazios
      if (!nome || nome === "NOME" || nome === sec.id || /^CARREGAMENTO/i.test(nome)) continue;

      // Montar detalhes extras
      var detalhes = [];
      if (sec.extras) {
        for (var e = 0; e < sec.extras.length; e++) {
          var val = cellStr(rows, i, sec.extras[e].col);
          if (val && val !== sec.extras[e].label) {
            detalhes.push(sec.extras[e].label + ": " + val);
          }
        }
      }

      resultado.push({
        nome: nome,
        setor: "CARREGAMENTO",
        posicao: sec.id,
        detalhe: detalhes.join(" · ")
      });
    }
  }

  return resultado;
}

/* ══════════════════════════════════════════════════════════════════════
   BUSCA POR NOME
   ══════════════════════════════════════════════════════════════════════ */
function normalizarTexto(txt) {
  if (!txt) return "";
  return txt.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

function buscarPorNome(query) {
  var queryNorm = normalizarTexto(query);
  if (!queryNorm || queryNorm.length < 2) return [];

  var isSorting = activeHcSub === "hc-sorting";
  var dados;

  if (isSorting) {
    dados = parseSorting(dadosSortingRaw);
  } else {
    dados = parseCarregamento(dadosCarregRaw);
  }

  var resultados = [];
  for (var i = 0; i < dados.length; i++) {
    var nomeNorm = normalizarTexto(dados[i].nome);
    if (nomeNorm.indexOf(queryNorm) !== -1) {
      resultados.push(dados[i]);
    }
  }

  return resultados;
}

/* ══════════════════════════════════════════════════════════════════════
   RENDERIZAR RESULTADOS DA BUSCA
   ══════════════════════════════════════════════════════════════════════ */
function renderBusca(resultados) {
  var container = document.getElementById("hc-results");

  if (!resultados || resultados.length === 0) {
    container.innerHTML =
      '<div class="hc-placeholder">' +
        '<div class="hc-placeholder-icon"><img src="assets/magnifying-glass.png" alt="" class="placeholder-img"></div>' +
        '<p>Nenhum resultado encontrado</p>' +
      '</div>';
    return;
  }

  var html = "";
  for (var i = 0; i < resultados.length; i++) {
    var r = resultados[i];
    var corClasse = r.setor === "SORTING" ? "hc-card-sorting" : "hc-card-carreg";

    // Buscar foto pela aba LDAP (por nome, já que carregamento não tem LDAP)
    var fotoHtml = gerarFotoHtml(r.nome, r.ldap || "");

    html += '<div class="hc-card ' + corClasse + '">';
    html += '  ' + fotoHtml;
    html += '  <div class="hc-card-body">';
    html += '    <div class="hc-card-nome">' + r.nome + '</div>';
    html += '    <div class="hc-card-posicao">' + r.posicao + '</div>';
    if (r.detalhe) {
      html += '    <div class="hc-card-detalhe">' + r.detalhe + '</div>';
    }
    html += '  </div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

/* ── Gerar HTML de foto/iniciais ── */
function gerarFotoHtml(nome, ldap) {
  var fotoUrl = "";
  var iniciais = "";

  // Tentar achar por LDAP primeiro
  if (ldap && mapaNomes[ldap.toLowerCase()]) {
    var info = mapaNomes[ldap.toLowerCase()];
    fotoUrl = info.foto || "";
    if (info.nome) {
      var partes = info.nome.trim().split(/\s+/);
      iniciais = partes.length >= 2
        ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
        : info.nome.substring(0, 2).toUpperCase();
    }
  }

  // Se não achou por LDAP, tentar buscar por nome na aba LDAP
  if (!fotoUrl && nome) {
    var nomeNorm = normalizarTexto(nome);
    for (var key in mapaNomes) {
      if (mapaNomes.hasOwnProperty(key)) {
        var nomeMap = normalizarTexto(mapaNomes[key].nome || "");
        if (nomeMap && nomeNorm.indexOf(nomeMap) !== -1 || nomeMap.indexOf(nomeNorm) !== -1) {
          fotoUrl = mapaNomes[key].foto || "";
          break;
        }
      }
    }
  }

  // Gerar iniciais pelo nome se não tem
  if (!iniciais && nome) {
    var partes = nome.trim().split(/\s+/);
    iniciais = partes.length >= 2
      ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
      : nome.substring(0, 2).toUpperCase();
  }

  if (fotoUrl) {
    return '<div class="hc-card-foto"><img src="' + fotoUrl + '" alt="" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + iniciais + '\';this.parentElement.classList.add(\'hc-foto-fallback\')"></div>';
  } else {
    return '<div class="hc-card-foto hc-foto-fallback">' + iniciais + '</div>';
  }
}

/* ══════════════════════════════════════════════════════════════════════
   INICIALIZAR BUSCA (eventos)
   ══════════════════════════════════════════════════════════════════════ */
function initBuscaHC() {
  var input = document.getElementById("hc-search-input");
  var clearBtn = document.getElementById("hc-search-clear");

  if (!input) return;

  input.addEventListener("input", function() {
    var query = input.value;
    clearBtn.style.display = query.length > 0 ? "block" : "none";
    renderListaHC(query);
  });

  clearBtn.addEventListener("click", function() {
    input.value = "";
    clearBtn.style.display = "none";
    renderListaHC("");
    input.focus();
  });
}

/* ── Renderizar lista (todos ou filtrados) ── */
function renderListaHC(query) {
  var isSorting = activeHcSub === "hc-sorting";
  var dados;

  if (isSorting) {
    dados = parseSorting(dadosSortingRaw);
  } else {
    dados = parseCarregamento(dadosCarregRaw);
  }

  // Se não tem dados ainda
  if (!dados || dados.length === 0) {
    document.getElementById("hc-results").innerHTML =
      '<div class="hc-placeholder">' +
        '<div class="emoji">⏳</div>' +
        '<p>Carregando dados...</p>' +
      '</div>';
    return;
  }

  // Filtrar se tem query
  var filtrados;
  if (query && query.length >= 2) {
    var queryNorm = normalizarTexto(query);
    filtrados = [];
    for (var i = 0; i < dados.length; i++) {
      if (normalizarTexto(dados[i].nome).indexOf(queryNorm) !== -1) {
        filtrados.push(dados[i]);
      }
    }
  } else {
    filtrados = dados;
  }

  renderBusca(filtrados);
}

/* ══════════════════════════════════════════════════════════════════════
   MAPA VISUAL
   ══════════════════════════════════════════════════════════════════════ */
function abrirMapa() {
  var overlay = document.getElementById("hc-mapa-overlay");
  var titulo = document.getElementById("hc-mapa-titulo");
  var content = document.getElementById("hc-mapa-content");
  overlay.style.display = "flex";

  if (activeHcSub === "hc-sorting") {
    titulo.innerHTML = '<img src="assets/map.png" alt="" class="title-icon"> Mapa — Sorting';
    content.innerHTML = gerarMapaSorting();
  } else {
    titulo.innerHTML = '<img src="assets/map.png" alt="" class="title-icon"> Mapa — Carregamento';
    content.innerHTML = gerarMapaCarregamento();
  }
}

function fecharMapa() {
  document.getElementById("hc-mapa-overlay").style.display = "none";
}

/* ── Gerar HTML do mapa de Sorting ── */
function gerarMapaSorting() {
  var dados = parseSorting(dadosSortingRaw);
  if (dados.length === 0) return '<div class="hc-placeholder"><p>Sem dados de Sorting</p></div>';

  // Agrupar por posição
  var grupos = {};
  for (var i = 0; i < dados.length; i++) {
    var pos = dados[i].posicao;
    if (!grupos[pos]) grupos[pos] = [];
    grupos[pos].push(dados[i]);
  }

  var html = '<div class="mapa-grid">';

  // ── MESAS (bloco central) ──
  html += '<div class="mapa-secao mapa-mesas">';
  html += '<h3 class="mapa-secao-titulo">MESAS DE INDUÇÃO</h3>';
  html += '<div class="mapa-mesas-grid">';
  for (var m = 1; m <= 8; m++) {
    var key = "MESA " + m;
    html += '<div class="mapa-mesa-card">';
    html += '<div class="mapa-mesa-titulo">' + key + '</div>';
    if (grupos[key]) {
      for (var j = 0; j < grupos[key].length; j++) {
        html += '<div class="mapa-nome">' + grupos[key][j].nome;
        if (grupos[key][j].ldap) html += ' <span class="mapa-ldap">(' + grupos[key][j].ldap + ')</span>';
        html += '</div>';
      }
    }
    html += '</div>';
    // Flow rack ao lado
    var frKey = "FLOW RACK (" + key + ")";
    if (grupos[frKey]) {
      html += '<div class="mapa-mesa-card mapa-flowrack">';
      html += '<div class="mapa-mesa-titulo">FR</div>';
      for (var j = 0; j < grupos[frKey].length; j++) {
        html += '<div class="mapa-nome">' + grupos[frKey][j].nome + '</div>';
      }
      html += '</div>';
    }
  }
  html += '</div></div>';

  // ── RUAS ──
  html += '<div class="mapa-ruas-container">';
  // Esquerdo
  html += '<div class="mapa-secao mapa-rua-lado">';
  html += '<h3 class="mapa-secao-titulo">RUAS ESQUERDO</h3>';
  if (grupos["RUA ESQUERDO"]) {
    for (var j = 0; j < grupos["RUA ESQUERDO"].length; j++) {
      var d = grupos["RUA ESQUERDO"][j];
      html += '<div class="mapa-nome">' + d.nome;
      if (d.detalhe) html += ' <span class="mapa-detalhe">(' + d.detalhe + ')</span>';
      html += '</div>';
    }
  }
  html += '</div>';
  // Direito
  html += '<div class="mapa-secao mapa-rua-lado">';
  html += '<h3 class="mapa-secao-titulo">RUAS DIREITO</h3>';
  if (grupos["RUA DIREITO"]) {
    for (var j = 0; j < grupos["RUA DIREITO"].length; j++) {
      var d = grupos["RUA DIREITO"][j];
      html += '<div class="mapa-nome">' + d.nome;
      if (d.detalhe) html += ' <span class="mapa-detalhe">(' + d.detalhe + ')</span>';
      html += '</div>';
    }
  }
  html += '</div>';
  html += '</div>';

  // ── ÁREAS OPERACIONAIS ──
  html += '<div class="mapa-areas-container">';
  var areasNomes = ["LINE HAUL", "PALETEIRA ELET", "YMS LINE HAUL", "INDUÇÃO"];
  for (var a = 0; a < areasNomes.length; a++) {
    var key = areasNomes[a];
    if (grupos[key] && grupos[key].length > 0) {
      html += '<div class="mapa-secao mapa-area-card">';
      html += '<h3 class="mapa-secao-titulo">' + key + '</h3>';
      for (var j = 0; j < grupos[key].length; j++) {
        html += '<div class="mapa-nome">' + grupos[key][j].nome + '</div>';
      }
      html += '</div>';
    }
  }
  html += '</div>';

  html += '</div>';
  return html;
}

/* ── Gerar HTML do mapa de Carregamento ── */
/* ── Gerar HTML do mapa de Carregamento (layout visual compacto) ── */
/* ── Gerar HTML do mapa de Carregamento (layout visual compacto) ── */
function gerarMapaCarregamento() {
  var dados = parseCarregamento(dadosCarregRaw);
  if (dados.length === 0) return '<div class="hc-placeholder"><p>Sem dados de Carregamento</p></div>';

  var grupos = {};
  for (var i = 0; i < dados.length; i++) {
    var pos = dados[i].posicao;
    if (!grupos[pos]) grupos[pos] = [];
    grupos[pos].push(dados[i]);
  }

  function miniTabela(titulo, headers, linhas) {
    if (!linhas || linhas.length === 0) return "";
    var h = '<div class="mt-bloco">';
    h += '<div class="mt-titulo">' + titulo + '</div>';
    h += '<table class="mt-tabela"><thead><tr>';
    for (var i = 0; i < headers.length; i++) h += '<th>' + headers[i] + '</th>';
    h += '</tr></thead><tbody>';
    for (var i = 0; i < linhas.length; i++) {
      h += '<tr>';
      for (var j = 0; j < linhas[i].length; j++) h += '<td>' + (linhas[i][j] || "") + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    return h;
  }

  function extrairCampo(detalhe, campo) {
    if (!detalhe) return "";
    var partes = detalhe.split(" · ");
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].indexOf(campo + ":") === 0) return partes[i].substring(campo.length + 1).trim();
    }
    return "";
  }

  function grupoParaLinhas(secId, colunas) {
    var items = grupos[secId] || [];
    var linhas = [];
    for (var i = 0; i < items.length; i++) {
      var linha = [];
      for (var c = 0; c < colunas.length; c++) {
        if (colunas[c] === "NOME") linha.push(items[i].nome);
        else linha.push(extrairCampo(items[i].detalhe, colunas[c]));
      }
      linhas.push(linha);
    }
    return linhas;
  }

  var html = '<div class="mapa-hc">';
  html += '<div class="mapa-hc-data">' + (dataRef || new Date().toLocaleDateString("pt-BR")) + '</div>';

  // ═══ Layout em 2 linhas pra aproveitar espaço ═══
  
  // ── LINHA 1 (topo): Portaria/LinhaBranca | Carreg.Interno | Carreg.Ext 1ª | Líderes+Puxadores | Sacas ──
  html += '<div class="mapa-hc-row">';

  // Col 1: Portaria + Pátio + Entrada/Saída + Linha Branca
  html += '<div class="mapa-hc-col">';
  html += miniTabela("PORTARIA", ["NOME", "ALMOÇO"],
    grupoParaLinhas("PORTARIA", ["NOME", "ALMOÇO"])
    .concat(grupoParaLinhas("PORTARIA 2", ["NOME", "ALMOÇO"]))
  );
  html += miniTabela("PÁTIO", ["NOME", "ALMOÇO"], grupoParaLinhas("PÁTIO", ["NOME", "ALMOÇO"]));
  html += miniTabela("ENTRADA/SAÍDA", ["NOME", "ALMOÇO"],
    grupoParaLinhas("ENTRADA", ["NOME", "ALMOÇO"])
    .concat(grupoParaLinhas("SAÍDA", ["NOME", "ALMOÇO"]))
  );
  html += miniTabela("LINHA BRANCA", ["NOME", "ALMOÇO"], grupoParaLinhas("LINHA BRANCA", ["NOME", "ALMOÇO"]));
  html += '</div>';

  // Col 2: Carregamento Interno
  html += '<div class="mapa-hc-col">';
  html += miniTabela("CARREGAMENTO INTERNO", ["NOME", "ROTA", "VAGA", "SPR", "ALMOÇO"],
    grupoParaLinhas("CARREGAMENTO INTERNO", ["NOME", "ROTA", "VAGA", "SPR", "ALMOÇO"])
  );
  html += '</div>';

  // Col 3: Carregamento Externo 1ª + 2ª Onda
  html += '<div class="mapa-hc-col">';
  html += miniTabela("CARREG. EXTERNO - 1ª ONDA", ["NOME", "ROTA", "VAGA", "SPR", "ALMOÇO"],
    grupoParaLinhas("CARREGAMENTO EXTERNO 1ª ONDA", ["NOME", "ROTA", "VAGA", "SPR", "ALMOÇO"])
  );
  html += miniTabela("CARREG. EXTERNO - 2ª ONDA", ["NOME", "ROTA", "VAGA", "ALMOÇO"],
    grupoParaLinhas("CARREGAMENTO EXTERNO 2ª ONDA", ["NOME", "ROTA", "VAGA", "ALMOÇO"])
  );
  html += '</div>';

  // Col 4: Líderes + Puxadores + blocos menores
  html += '<div class="mapa-hc-col">';
  html += miniTabela("LÍDERES DE PUXADA", ["NOME", "VAGAS/LADO", "ALMOÇO"],
    grupoParaLinhas("LÍDER DE PUXADA", ["NOME", "VAGAS/LADO", "ALMOÇO"])
  );
  html += miniTabela("PUXADORES", ["NOME", "VAGAS/LADO", "ALMOÇO"],
    grupoParaLinhas("PUXADOR", ["NOME", "VAGAS/LADO", "ALMOÇO"])
  );
  html += '<div class="mapa-hc-pair">';
  html += miniTabela("CANCELA", ["NOME", "ALMOÇO"], grupoParaLinhas("CANCELA", ["NOME", "ALMOÇO"]));
  html += miniTabela("PALLET", ["NOME", "ALMOÇO"], grupoParaLinhas("PALLET", ["NOME", "ALMOÇO"]));
  html += '</div>';
  html += '<div class="mapa-hc-pair">';
  html += miniTabela("REEMBALAGEM", ["NOME", "ALMOÇO"], grupoParaLinhas("REEMBALAGEM", ["NOME", "ALMOÇO"]));
  html += miniTabela("RETIRADA DE ROTA", ["NOME", "ALMOÇO"], grupoParaLinhas("RETIRADA DE ROTA", ["NOME", "ALMOÇO"]));
  html += '</div>';
  html += miniTabela("PS", ["LOCAL", "NOME", "ALMOÇO"],
    grupoParaLinhas("PS", ["LOCAL", "NOME", "ALMOÇO"])
  );
  html += '</div>';

  // Col 5: Sacas
  html += '<div class="mapa-hc-col">';
  html += miniTabela("SACAS", ["NOME", "FUNÇÃO", "ALMOÇO"],
    grupoParaLinhas("SACAS", ["NOME", "FUNÇÃO", "ALMOÇO"])
  );
  html += '</div>';

  html += '</div>'; // fecha row

  // ── LINHA 2 (baixo): XPT dividido em 2 colunas pra caber ──
  var xptLinhas = grupoParaLinhas("XPT", ["FUNÇÃO", "NOME", "ALMOÇO"]);
  if (xptLinhas.length > 0) {
    var metade = Math.ceil(xptLinhas.length / 2);
    var xptEsq = xptLinhas.slice(0, metade);
    var xptDir = xptLinhas.slice(metade);
    html += '<div class="mapa-hc-row2">';
    html += miniTabela("XPT", ["FUNÇÃO", "NOME", "ALMOÇO"], xptEsq);
    html += miniTabela("XPT (cont.)", ["FUNÇÃO", "NOME", "ALMOÇO"], xptDir);
    html += '</div>';
  }
}