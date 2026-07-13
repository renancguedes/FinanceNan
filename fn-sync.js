/*!
 * fn-sync.js  -  Integracao FinanceNan (Caminho 1: hibrido)
 * ---------------------------------------------------------------------------
 * NAO altera visual, configuracoes nem usabilidade do app.
 * - Registro: cria conta REAL no backend (/auth/register) e mantem copia local
 *   em fn_users (para o doLogin do app continuar validando como hoje).
 * - Login: o app valida localmente (igual hoje); em paralelo este script
 *   autentica no backend, obtem token e BAIXA os dados do banco para fn_db_<email>.
 * - Toda gravacao do app em fn_db_<email> e espelhada no backend (POST/PATCH/DELETE).
 * - Modo VISITANTE (email "visitante"/sem conta real): permanece 100% local.
 * Falhas de rede nunca quebram o app: em erro, cai no comportamento local.
 */
(function () {
  'use strict';
  var API='https://finance.renanguedes.com';
  var K_TOK='fn_sync_tok', K_RT='fn_sync_rt', K_WHO='fn_sync_who', K_PW='fn_sync_pw';
  var LS=window.localStorage;
  var og={get:LS.getItem.bind(LS), set:LS.setItem.bind(LS), del:LS.removeItem.bind(LS)};

  var CONTA_TO={'Conta bancária':'conta_bancaria','Conta bancaria':'conta_bancaria','Carteira digital':'carteira_digital','Dinheiro físico':'dinheiro_fisico','Dinheiro fisico':'dinheiro_fisico','Investimento':'investimento','Outro':'outro'};
  var CONTA_FROM={conta_bancaria:'Conta bancária',carteira_digital:'Carteira digital',dinheiro_fisico:'Dinheiro físico',investimento:'Investimento',outro:'Outro'};
  var CAT_TO={'Receita':'receita','Despesa':'despesa','Investimento':'investimento'};
  var CAT_FROM={receita:'Receita',despesa:'Despesa',investimento:'Investimento'};
  var N=function(v){return Math.round(Number(v)||0);};
  var log=function(){ try{ if(window.__FN_DEBUG) console.log.apply(console,['[fn-sync]'].concat([].slice.call(arguments))); }catch(e){} };

  var MAP={
    contas:{path:'/accounts',to:function(x){return{nome:x.nome,tipo:CONTA_TO[x.tipo]||'outro',saldo:N(x.saldo),cor:x.cor,ativo:x.ativo!==false};},from:function(x){return{id:x.id,nome:x.nome,tipo:CONTA_FROM[x.tipo]||'Outro',saldo:x.saldo,cor:x.cor,ativo:x.ativo};}},
    catalogo:{path:'/categories',to:function(x){return{nome:x.nome,tipo:CAT_TO[x.tipo]||'despesa',cor:x.cor,icone:x.icone};},from:function(x){return{id:x.id,nome:x.nome,tipo:CAT_FROM[x.tipo]||'Despesa',cor:x.cor,icone:x.icone};}},
    categorias:{path:'/plan-categories',to:function(x){return{nome:x.nome,pct:N(x.pct),abs:N(x.abs)};},from:function(x){return{id:x.id,nome:x.nome,pct:x.pct,abs:x.abs};}},
    fontes:{path:'/income-sources',to:function(x){return{nome:x.nome,valor:N(x.valor)};},from:function(x){return x;}},
    cartoes:{path:'/credit-cards',to:function(x){return{nome:x.nome,bandeira:x.bandeira,diaFechamento:N(x.diaFechamento),diaVencimento:N(x.diaVencimento),cor:x.cor,ativo:x.ativo!==false};},from:function(x){return x;}},
    fixos:{path:'/fixed-expenses',to:function(x){return{descricao:x.descricao,valor:N(x.valor),diaVencimento:N(x.diaVencimento),categoryId:x.categoryId||x.catId,contaPadraoId:x.contaPadraoId||undefined,observacoes:x.observacoes||undefined,ativo:x.ativo!==false};},from:function(x){return x;}},
    receitas:{path:'/incomes',to:function(x){return{descricao:x.descricao,valor:N(x.valor),data:x.data,accountId:x.accountId||x.contaId,categoryId:x.categoryId||x.catId,recebida:!!x.recebida,recorrente:!!x.recorrente,observacoes:x.observacoes||undefined};},from:function(x){return x;}},
    despesas:{path:'/expenses',to:function(x){return{descricao:x.descricao,valor:N(x.valor),dataCompra:x.dataCompra||x.data,categoryId:x.categoryId||x.catId,accountId:x.accountId||x.contaId||undefined,creditCardId:x.creditCardId||x.cartaoId||undefined,paga:!!x.paga,observacoes:x.observacoes||undefined};},from:function(x){return x;}},
    planejamentos:{path:'/plan-items',to:function(x){return{nome:x.nome,planCategoryId:x.planCategoryId||x.categoriaId,valor:N(x.valor)};},from:function(x){return x;}}
  };
  var ORDER=['contas','catalogo','categorias','fontes','cartoes','fixos','receitas','despesas','planejamentos'];

  function tok(){return og.get(K_TOK);}
  function req(method,path,body){
    return fetch(API+path,{method:method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok()},body:body?JSON.stringify(body):undefined})
      .then(function(r){ if(r.status===401){ return refresh().then(function(ok){ if(!ok) throw new Error('unauth'); return req(method,path,body); }); }
        return r.text().then(function(t){ var d=null; try{d=t?JSON.parse(t):null;}catch(e){} if(!r.ok) throw new Error(path+' '+r.status); return d; }); });
  }
  function refresh(){ var rt=og.get(K_RT); if(!rt) return Promise.resolve(false);
    return fetch(API+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:rt})})
      .then(function(r){return r.ok?r.json():null;}).then(function(d){ if(d&&d.accessToken){og.set(K_TOK,d.accessToken); if(d.refreshToken)og.set(K_RT,d.refreshToken); return true;} return false;}).catch(function(){return false;}); }

  var prev={}, currentEmail=null, syncing=false;

  function hydrate(email){
    var db={contas:[],receitas:[],despesas:[],cartoes:[],fixos:[],fontes:[],planejamentos:[],catalogo:[],categorias:[],config:{patrimonioExcl:[],reservaIds:[]}};
    var jobs=ORDER.map(function(c){return req('GET',MAP[c].path).then(function(a){db[c]=(a||[]).map(MAP[c].from);}).catch(function(){});});
    jobs.push(req('GET','/settings').then(function(s){if(s)db.config={patrimonioExcl:s.patrimonioExcludedAccountIds||[],reservaIds:s.reservaAccountIds||[]};}).catch(function(){}));
    return Promise.all(jobs).then(function(){ prev=JSON.parse(JSON.stringify(db)); og.set('fn_db_'+email,JSON.stringify(db)); log('hidratado',email); return db; });
  }

  function syncDiff(email,next){
    if(syncing) return;
    ORDER.forEach(function(c){
      var oldArr=(prev[c]||[]), newArr=(next[c]||[]), oldById={}; oldArr.forEach(function(o){oldById[o.id]=o;}); var seen={};
      newArr.forEach(function(it){ seen[it.id]=1; var p=MAP[c].to(it);
        if(!it.id||!oldById[it.id]){ req('POST',MAP[c].path,p).then(function(cr){ if(cr&&cr.id&&cr.id!==it.id){ it.id=cr.id; og.set('fn_db_'+email,JSON.stringify(next)); } }).catch(function(){}); }
        else if(JSON.stringify(MAP[c].to(oldById[it.id]))!==JSON.stringify(p)){ req('PATCH',MAP[c].path+'/'+it.id,p).catch(function(){}); } });
      oldArr.forEach(function(o){ if(o.id&&!seen[o.id]) req('DELETE',MAP[c].path+'/'+o.id).catch(function(){}); });
    });
    var cf=next.config||{}; req('PATCH','/settings',{patrimonioExcludedAccountIds:cf.patrimonioExcl||[],reservaAccountIds:cf.reservaIds||[]}).catch(function(){});
    prev=JSON.parse(JSON.stringify(next));
  }

  function backendLogin(email,password){
    if(!email||!password) return;
    fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:password})})
      .then(function(r){return r.ok?r.json():null;}).then(function(d){ if(!d||!d.accessToken){log('login backend falhou'); return;}
        og.set(K_TOK,d.accessToken); og.set(K_RT,d.refreshToken||''); og.set(K_WHO,email); currentEmail=email;
        syncing=true; hydrate(email).then(function(){ syncing=false; }).catch(function(){syncing=false;}); }).catch(function(){log('login erro rede');});
  }

  function backendRegister(u){
    if(!u||!u.email||!u.pass) return;
    fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:u.name,email:u.email,password:u.pass})})
      .then(function(r){ if(r.status===409||r.status===400){ backendLogin(u.email,u.pass); return null;} return r.ok?r.json():null; })
      .then(function(d){ if(d&&d.accessToken){ og.set(K_TOK,d.accessToken); og.set(K_RT,d.refreshToken||''); og.set(K_WHO,u.email); currentEmail=u.email; syncing=true; hydrate(u.email).then(function(){syncing=false;}); } }).catch(function(){});
  }

  Storage.prototype.setItem=function(key,val){
    try{
      if(key==='fn_users'){
        og.set(key,val);
        var arr=[]; try{arr=JSON.parse(val)||[];}catch(e){}
        var last=arr[arr.length-1];
        if(last&&last.email&&last.pass){ og.set(K_PW,JSON.stringify({e:last.email,p:last.pass})); backendRegister(last); }
        return;
      }
      if(String(key).indexOf('fn_db_')===0){
        og.set(key,val);
        var email=key.slice(6); var data=null; try{data=JSON.parse(val);}catch(e){}
        if(data && tok() && og.get(K_WHO)===email && !syncing){ syncDiff(email,data); }
        return;
      }
    }catch(e){ log('setItem err',e&&e.message); }
    return og.set(key,val);
  };

  document.addEventListener('submit', function(ev){
    try{
      var f=ev.target; if(!f||!f.querySelector) return;
      var pw=f.querySelector('input[type=password]'); var em=f.querySelector('input[type=email], input[placeholder*="email" i], input[placeholder*="@"]');
      if(pw&&pw.value){ var pass=pw.value; var email=em&&em.value?em.value.trim().toLowerCase():(og.get(K_WHO)||''); if(email){ setTimeout(function(){ backendLogin(email,pass); },300); } }
    }catch(e){}
  }, true);

  log('carregado');
})();
