/* ══════════════════════════════════════════════════════════════════════
   ESTADO GLOBAL DA APLICAÇÃO
   ══════════════════════════════════════════════════════════════════════ */

var activeSub = "guarda";      // sub-aba ativa: "guarda" ou "inducao"
var activeCycle = "TODOS";     // filtro de ciclo: "TODOS", "AM1", "PM1", "SD"
var dadosGuarda = [];          // array de objetos {operatorId, ldap, ciclo, total}
var dadosInducao = [];         // array de objetos {operatorId, ldap, ciclo, total}
var duracaoGuarda = [];        // array de objetos {ciclo, inicio, fimAjustado, fimBruto, duracaoMin, duracaoHms}
var duracaoInducao = [];       // array de objetos {ciclo, inicio, fimAjustado, fimBruto, duracaoMin, duracaoHms}
var facilityName = "";         // ex: "SSP20"
var dataRef = "";              // ex: "29/08/2026"
var lastUpdate = null;         // Date do último carregamento
var fonteDados = "";           // "grid", "appsscript" ou "csv"
var mapaNomes = {};         // { ldap: { nome: "...", foto: "..." } }
var dadosSortingRaw = [];      // dados brutos da aba SORTING
var dadosCarregRaw = [];       // dados brutos da aba CARREGAMENTO
var activeHcSub = "hc-sorting"; // sub-aba ativa da Divisão HC
var mesaDuplas = {};            // { ldap: { mesa: "MESA 1", parceiroLdap: "xxx" } }
var tvAtivo = false;            // modo TV ligado/desligado
var tvScrollTimer = null;       // timer do auto-scroll
var tvTrocaTimer = null;        // timer da troca de aba
var tvAbaAtual = "guarda";      // aba atual no modo TV