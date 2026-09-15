var CONFIG = {
  SHEET_ID: "1I2SVLXeAadCfSSoMMufb2QoK-4maM14yCmyrPKGEAxk",

  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiTrlOykjxt059T_o4cIYutuyNZc7zhF8xnxUvagHJdDS63ZRYv__P5hewdA6afICss-6Sz43R_yT1/pub?gid=0&single=true&output=csv",

  APPS_SCRIPT_URL: "https://script.google.com/a/macros/mercadolivre.com/s/AKfycbygt19JAN5eAXLw7bzhYlPZKQXXG8dIbphH8OFD3yUkIyM4l28cy7ufyfIE5iFY5Aek/exec",

  ORDER: ["grid", "appsscript", "csv"],

  MINIMO_ATIVO_PCT: 0.30,  // 30% da duração do ciclo

  META: {
    facilityRow: 1, facilityCol: 1,
    dataRow: 2, dataCol: 1
  },

  // ── GUARDA: D-M (3-12) — tem duração individual por operador ──
COLS_GUARDA: {
    operatorId: 3, ldap: 4, ciclo: 5, total: 6,
    inicioOp: 7, fimBruto: 8,
    duracaoBrutaMin: 9, duracaoAtivaMin: 10,
    tempoInativoMin: 11, pacotesPorMin: 12
  },
  // ── MESA/INDUÇÃO: O-Y (14-24) — COM duração individual por operador ──
  COLS_INDUCAO: {
    operatorId: 14, ldap: 15, ciclo: 16, total: 17, amostraId: 18,
    inicioOp: 19, fimBruto: 20,
    duracaoBrutaMin: 21, duracaoAtivaMin: 22,
    tempoInativoMin: 23, pacotesPorMin: 24
  },

  // ── DURAÇÃO MESA P/CICLO: AA-AJ (26-35) — coluna Z(25) vazia ──
  COLS_DURACAO_INDUCAO: {
    ciclo: 26, inicio: 27, fimAjustado: 28, fimBruto: 29,
    duracaoAjustadaMin: 30, duracaoAjustadaHms: 31,
    duracaoBrutaMin: 32, duracaoBrutaHms: 33,
    totalPacotes: 34, qtdOperadores: 35
  },

 // ── DURAÇÃO GUARD P/CICLO: AL-AU (37-46) — coluna AK(36) vazia ──
  COLS_DURACAO_GUARDA: {
    ciclo: 37, inicio: 38, fimAjustado: 39, fimBruto: 40,
    duracaoAjustadaMin: 41, duracaoAjustadaHms: 42,
    duracaoBrutaMin: 43, duracaoBrutaHms: 44,
    totalPacotes: 45, qtdOperadores: 46
  },

  METAS: {
    guarda: { porMinuto: 5, porHora: 300 },
    inducao: { porMinuto: 33.33, porHora: 2000 }
  },

  STATUS: {
    verde: 1.0,
    amarelo: 0.8
  },

DATA_START_ROW: 2,
  PHOTO_FOLDER: "assets/fotos/",
  AUTO_REFRESH_MS: 120000,

  // ══════════════════════════════════════════════════
  // DIMENSIONAMENTO — Mapeamento das abas SORTING e CARREGAMENTO
  // Ranges são {startRow, endRow, startCol, endCol} (0-based)
  // Convertidos do mapeamento do Gemini (1-based letras → 0-based índices)
  // ══════════════════════════════════════════════════
  DIM_SORTING: {
    // RUAS — cols A-B (esquerdo), D-E (direito)
    // Linhas 1-93, headers em padrão "RUA N" + "NOME / FUNÇÃO"
    ESQUERDO: { startCol: 0, endCol: 1, startRow: 0, endRow: 92, label: "ESQUERDO" },
    DIREITO:  { startCol: 3, endCol: 4, startRow: 0, endRow: 92, label: "DIREITO" },

    // MESAS — cada mesa tem NOME, LDAP e FLOW RACK ao lado
    MESAS: [
      { id: "MESA 1", nome: 6, ldap: 7, flowRack: 8, startRow: 1, endRow: 3 },
      { id: "MESA 2", nome: 10, ldap: 11, flowRack: 12, startRow: 1, endRow: 3 },
      { id: "MESA 3", nome: 14, ldap: 15, flowRack: 16, startRow: 1, endRow: 3 },
      { id: "MESA 4", nome: 18, ldap: 19, flowRack: 20, startRow: 1, endRow: 3 },
      { id: "MESA 5", nome: 6, ldap: 7, flowRack: 8, startRow: 8, endRow: 10 },
      { id: "MESA 6", nome: 10, ldap: 11, flowRack: 12, startRow: 8, endRow: 10 },
      { id: "MESA 7", nome: 14, ldap: 15, flowRack: 16, startRow: 8, endRow: 10 },
      { id: "MESA 8", nome: 18, ldap: 19, flowRack: 20, startRow: 8, endRow: 10 }
    ],

    // ÁREAS OPERACIONAIS — col W (index 22)
    AREAS: [
      { id: "LINE HAUL",      col: 22, startRow: 1, endRow: 5 },
      { id: "PALETEIRA ELET", col: 22, startRow: 7, endRow: 10 },
      { id: "YMS LINE HAUL",  col: 22, startRow: 13, endRow: 15 },
      { id: "INDUÇÃO",        col: 22, startRow: 17, endRow: 20 }
    ]
  },

  DIM_CARREGAMENTO: {
    // Cada seção: {id, startCol, endCol, startRow, endRow, colNome, colExtra}
    // colNome = índice da coluna com o nome do operador
    // colExtra = colunas adicionais relevantes {label, col}
    SECOES: [
      {
        id: "CARREGAMENTO INTERNO", startCol: 0, endCol: 4, startRow: 1, endRow: 38,
        colNome: 0,
        extras: [
          { label: "ROTA", col: 1 },
          { label: "VAGA", col: 2 },
          { label: "SPR", col: 3 },
          { label: "ALMOÇO", col: 4 }
        ]
      },
      {
        id: "CARREGAMENTO EXTERNO 1ª ONDA", startCol: 6, endCol: 10, startRow: 1, endRow: 20,
        colNome: 6,
        extras: [
          { label: "ROTA", col: 7 },
          { label: "VAGA", col: 8 },
          { label: "SPR", col: 9 },
          { label: "ALMOÇO", col: 10 }
        ]
      },
      {
        id: "XPT", startCol: 12, endCol: 14, startRow: 1, endRow: 21,
        colNome: 12,
        extras: [
          { label: "FUNÇÃO", col: 13 },
          { label: "SAÍDA", col: 14 }
        ]
      },
      {
        id: "SACAS", startCol: 15, endCol: 17, startRow: 1, endRow: 30,
        colNome: 15,
        extras: [
          { label: "FUNÇÃO", col: 16 },
          { label: "ALMOÇO", col: 17 }
        ]
      },
      {
        id: "PUXADOR", startCol: 18, endCol: 20, startRow: 1, endRow: 6,
        colNome: 18,
        extras: [
          { label: "VAGAS/LADO", col: 19 },
          { label: "ALMOÇO", col: 20 }
        ]
      },
      {
        id: "LÍDER DE PUXADA", startCol: 22, endCol: 24, startRow: 1, endRow: 3,
        colNome: 22,
        extras: [
          { label: "VAGAS/LADO", col: 23 },
          { label: "ALMOÇO", col: 24 }
        ]
      },
      {
        id: "CANCELA", startCol: 27, endCol: 28, startRow: 1, endRow: 2,
        colNome: 27,
        extras: [{ label: "ALMOÇO", col: 28 }]
      },
      {
        id: "PALLET", startCol: 30, endCol: 31, startRow: 1, endRow: 3,
        colNome: 30,
        extras: [{ label: "ALMOÇO", col: 31 }]
      },
      {
        id: "RETIRADA DE ROTA", startCol: 33, endCol: 34, startRow: 1, endRow: 3,
        colNome: 33,
        extras: [{ label: "ALMOÇO", col: 34 }]
      },
      {
        id: "PS", startCol: 36, endCol: 41, startRow: 1, endRow: 6,
        colNome: 37,
        extras: [
          { label: "LOCAL", col: 36 },
          { label: "ALMOÇO", col: 41 }
        ]
      },
      {
        id: "REEMBALAGEM", startCol: 43, endCol: 44, startRow: 1, endRow: 3,
        colNome: 43,
        extras: [{ label: "ALMOÇO", col: 44 }]
      },
      {
        id: "PORTARIA", startCol: 46, endCol: 47, startRow: 1, endRow: 2,
        colNome: 46,
        extras: [{ label: "ALMOÇO", col: 47 }]
      },
      {
        id: "PORTARIA 2", startCol: 49, endCol: 50, startRow: 1, endRow: 1,
        colNome: 49,
        extras: [{ label: "SAÍDA", col: 50 }]
      },
      {
        id: "PÁTIO", startCol: 52, endCol: 53, startRow: 1, endRow: 1,
        colNome: 52,
        extras: [{ label: "SAÍDA", col: 53 }]
      },
      {
        id: "ENTRADA", startCol: 55, endCol: 56, startRow: 1, endRow: 1,
        colNome: 55,
        extras: [{ label: "SAÍDA", col: 56 }]
      },
      {
        id: "SAÍDA", startCol: 58, endCol: 59, startRow: 1, endRow: 1,
        colNome: 58,
        extras: [{ label: "SAÍDA", col: 59 }]
      },
      {
        id: "LINHA BRANCA", startCol: 61, endCol: 62, startRow: 1, endRow: 5,
        colNome: 61,
        extras: [{ label: "SAÍDA", col: 62 }]
      },
      {
        id: "CARREGAMENTO EXTERNO 2ª ONDA", startCol: 64, endCol: 69, startRow: 1, endRow: 15,
        colNome: 64,
        extras: [
          { label: "ROTA", col: 65 },
          { label: "VAGA", col: 66 },
          { label: "SPR", col: 67 },
          { label: "ALMOÇO", col: 68 }
        ]
      }
    ]
  }
};

