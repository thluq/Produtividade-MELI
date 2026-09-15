/* ══════════════════════════════════════════════════════════════════════
   GRID PLATFORM — sincroniza mudanças de URL do iframe com a barra de
   endereço do documento pai. Injetado pelo Grid. Evite editar à mão.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  function notifyParent(search, hash){
    if(!window.parent || window.parent === window) return;
    try{
      window.parent.postMessage(
        {type:"grid-url-sync", search:search, hash:hash},
        window.location.origin
      );
    }catch(_){}
  }
  function parseAndNotify(url){
    try{
      var p = new URL(String(url), window.location.href);
      notifyParent(p.search, p.hash);
    }catch(_){}
  }
  var _push = history.pushState.bind(history);
  var _replace = history.replaceState.bind(history);
  history.pushState = function(state, title, url){
    _push(state, title, url);
    if(url != null) parseAndNotify(url);
  };
  history.replaceState = function(state, title, url){
    _replace(state, title, url);
    if(url != null) parseAndNotify(url);
  };
  window.addEventListener("hashchange", function(){
    notifyParent(window.location.search, window.location.hash);
  });
})();
