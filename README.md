# KPI Produtividade — SSP20

Dashboard de produtividade da operação (Sorting: Guarda e Indução), com as
páginas de Carregamento e Dimensionamento como placeholders.

## Estrutura

```
index.html              → estrutura da página, na raiz (exigido pelo Grid)
css/
  style.css              → todo o CSS (era um <style> inline)
js/
  config.js               → CONFIG: sheet id, urls de fonte de dados, mapeamento de colunas
  state.js                 → estado global em memória (DADOS, aba ativa, ciclo ativo)
  data-service.js          → busca de dados (Grid SDK → Apps Script → CSV) e parse das linhas
  render.js                → renderização do resumo e do ranking
  navigation.js             → cliques em abas/sub-abas/filtro de ciclo
  main.js                   → relógio do header + boot da aplicação (chama carregarDados)
  grid-state.js             → injetado pelo Grid (API de estado do documento) — não editar à mão
  grid-security.js          → injetado pelo Grid (allowlist de links/popups) — não editar à mão
  grid-url-sync.js          → injetado pelo Grid (sincroniza URL do iframe) — não editar à mão
assets/
  fotos/                    → fotos dos operadores (nome do arquivo = LDAP, ex: jsilva.jpg)
```

## Ordem de carregamento dos scripts

1. `grid-sdk.js` e PapaParse (CDN) — no `<head>`
2. `js/grid-state.js` — no `<head>`, precisa existir antes de tudo
3. No fim do `<body>`: `config.js` → `state.js` → `data-service.js` → `render.js`
   → `navigation.js` → `main.js` (ordem importa: cada um usa o anterior)
4. Por último, `grid-security.js` e `grid-url-sync.js`

Não são módulos ES (`type="module"`) — são scripts clássicos, na mesma ordem
do arquivo original, só separados por responsabilidade.

## O que mudou em relação ao arquivo único

- `CONFIG.PHOTO_FOLDER` passou de `"fotos/"` para `"assets/fotos/"`, refletindo
  a nova pasta de assets. Se você já tem fotos publicadas em outro caminho no
  Grid, ajuste esse valor em `js/config.js`.
- Os três blocos de script que o Grid injeta automaticamente (estado do
  documento, segurança de links, sync de URL) foram para arquivos próprios
  (`grid-*.js`), sinalizados como "não editar à mão" — se você recriar ou
  republicar o documento no Grid e ele reinjetar esse código, é só substituir
  o conteúdo desses três arquivos, sem mexer no resto.
- Todo o resto do comportamento é idêntico ao arquivo original.

## Publicar no Grid

Compacte a pasta inteira (com `index.html` na raiz) em `.zip` e faça upload
pelo Grid.
