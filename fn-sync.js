/*!
 * fn-sync.js - Integracao FinanceNan (v0.8.1)
 * ---------------------------------------------------------------------------
 * BANCO COMO FONTE DA VERDADE (usuario logado): cada alteracao do app e gravada
 * no backend e re-baixada a cada login (hydrate). Modo visitante = 100% local.
 *
 * Correcoes desta versao (0.7.0):
 *  - CORRIGE PERDA DE DADOS (POST 4xx silencioso): quando o app criava uma
 *    entidade nova (ex.: categoria) e logo referenciava ela (ex.: despesa),
 *    o id gerado pelo backend NAO voltava para o estado do app, entao o item
 *    dependente ia com um id-cliente invalido e o backend recusava (422).
 *    Agora mantemos um MAPA clientId->backendId (idMap) e um conjunto de ids
 *    conhecidos do backend; a sincronizacao virou SERIAL e ORDENADA por
 *    dependencia (contas/cartoes/categorias antes de receitas/despesas/fixos),
 *    resolvendo TODAS as chaves estrangeiras para o id real do backend.
 *  - hydrate NAO-DESTRUTIVO: se a carga do backend falhar, nao sobrescreve os
 *    dados locais com um banco vazio.
 *  - idMap e limpo a cada login (o hydrate ja traz ids reais do backend).
 *  - Coalescencia de gravacoes rapidas (pending) para evitar corridas.
 *  - LOADING SCREEN durante login/cadastro/validacao/carga inicial.
 *  - logout limpa a sessao (tokens) para isolar visitante x autenticado.
 *  - Mantido: mapeamento de campos, REAIS<->CENTAVOS, patch de auth em runtime,
 *    espelhamento automatico via Storage.setItem e CSS responsivo.
 *
 * API: URL estavel da Vercel do backend (pode ser trocada via window.FN_API_BASE).
 */
(function () {
  'use strict';
  var API = (typeof window !== 'undefined' && window.FN_API_BASE) || 'https://finance-nan-a8so.vercel.app';
  var K_TOK = 'fn_sync_tok', K_RT = 'fn_sync_rt', K_WHO = 'fn_sync_who', K_PW = 'fn_sync_pw';
  var LS = window.localStorage;
  var og = { get: LS.getItem.bind(LS), set: LS.setItem.bind(LS), del: LS.removeItem.bind(LS) };

  var CONTA_TO = { 'Conta bancária': 'conta_bancaria', 'Conta bancaria': 'conta_bancaria', 'Carteira digital': 'carteira_digital', 'Dinheiro físico': 'dinheiro_fisico', 'Dinheiro fisico': 'dinheiro_fisico', 'Investimento': 'investimento', 'Outro': 'outro' };
  var CONTA_FROM = { conta_bancaria: 'Conta bancária', carteira_digital: 'Carteira digital', dinheiro_fisico: 'Dinheiro físico', investimento: 'Investimento', outro: 'Outro' };
  var CAT_TO = { 'Receita': 'receita', 'Despesa': 'despesa', 'Investimento': 'investimento' };
  var CAT_FROM = { receita: 'Receita', despesa: 'Despesa', investimento: 'Investimento' };
  var N = function (v) { return Math.round(Number(v) || 0); };
  var C = function (v) { return Math.round((Number(v) || 0) * 100); }; // reais -> centavos
  var R = function (v) { return (Number(v) || 0) / 100; };            // centavos -> reais
  var log = function () { try { if (window.__FN_DEBUG) console.log.apply(console, ['[fn-sync]'].concat([].slice.call(arguments))); } catch (e) {} };

  // ---- mapa de ids clientId<->backendId e ids conhecidos do backend ---------
  // idMap: id gerado pelo app (uid, 8 chars)  ->  id gerado pelo backend (cuid).
  // known: conjunto de ids que EXISTEM no backend (hidratados ou recem-criados).
  var idMap = {};        // { clientId: backendId }
  var known = {};        // { backendId: true }
  function realId(id) { if (id == null) return id; return idMap[id] || id; }         // traduz p/ id do backend
  function isKnown(id) { return id != null && (known[id] === true); }                 // id existe no backend?
  function markKnown(id) { if (id != null) known[id] = true; }
  function resetIdState() { idMap = {}; known = {}; }

  // mapa categoria (catalogo) nome->idResolvido, preenchido no hydrate/sync
  var catByName = {}, catById = {};
  function catId(name) { return catByName[(name == null ? '' : name).toString()]; }

  function undef(v) { return (v === '' || v == null) ? undefined : v; }
  function formaToTarget(o, forma) {
    var f = (forma || '').toString();
    if (f.indexOf('k:') === 0) o.creditCardId = f.slice(2);
    else if (f.indexOf('a:') === 0) o.accountId = f.slice(2);
    else if (f) o.accountId = f;
    return o;
  }

  // Campos que sao chaves estrangeiras (precisam ser resolvidos p/ id do backend).
  // fkRefs = FKs que apontam para OUTRAS entidades (contas/cartoes/categorias/planCat).
  var MAP = {
    contas: { path: '/accounts', dep: false, fkRefs: [],
      to: function (x) { return { nome: x.nome, tipo: CONTA_TO[x.tipo] || 'outro', saldo: C(x.saldo), cor: x.cor, ativo: x.ativo !== false }; },
      from: function (x) { return { id: x.id, nome: x.nome, tipo: CONTA_FROM[x.tipo] || 'Outro', saldo: R(x.saldo), cor: x.cor, ativo: x.ativo }; } },
    catalogo: { path: '/categories', dep: false, fkRefs: [],
      to: function (x) { return { nome: x.nome, tipo: CAT_TO[x.tipo] || 'despesa', cor: x.cor, icone: x.icone || 'tag' }; },
      from: function (x) { return { id: x.id, nome: x.nome, tipo: CAT_FROM[x.tipo] || 'Despesa', cor: x.cor, icone: x.icone }; } },
    categorias: { path: '/plan-categories', dep: false, fkRefs: [],
      to: function (x) { return { nome: x.nome, pct: N(x.pct), abs: C(x.abs) }; },
      from: function (x) { return { id: x.id, nome: x.nome, pct: x.pct, abs: R(x.abs) }; } },
    fontes: { path: '/income-sources', dep: false, fkRefs: [],
      to: function (x) { return { nome: x.nome, valor: C(x.valor) }; },
      from: function (x) { return { id: x.id, nome: x.nome, valor: R(x.valor) }; } },
    cartoes: { path: '/credit-cards', dep: false, fkRefs: [],
      to: function (x) { return { nome: x.nome, bandeira: x.bandeira, diaFechamento: N(x.fecha), diaVencimento: N(x.vence), cor: x.cor, ativo: x.ativo !== false }; },
      from: function (x) { return { id: x.id, nome: x.nome, bandeira: x.bandeira, fecha: x.diaFechamento, vence: x.diaVencimento, cor: x.cor, ativo: x.ativo }; } },
    fixos: { path: '/fixed-expenses', dep: true, fkRefs: ['categoryId', 'contaPadraoId'],
      to: function (x) { return { descricao: x.desc, categoryId: catId(x.cat), contaPadraoId: undef(x.contaId), valor: C(x.valor), diaVencimento: N(x.venc), observacoes: undef(x.obs), ativo: x.ativo !== false }; },
      from: function (x) { return { id: x.id, desc: x.descricao, cat: catById[x.categoryId], contaId: x.contaPadraoId || '', valor: R(x.valor), venc: x.diaVencimento, obs: x.observacoes || '', ativo: x.ativo }; } },
    receitas: { path: '/incomes', dep: true, fkRefs: ['categoryId', 'accountId'],
      to: function (x) { return { descricao: x.desc, categoryId: catId(x.cat), accountId: x.contaId, data: x.data, valor: C(x.valor), recorrente: !!x.recorrente, recebida: !!x.recebida, observacoes: undef(x.obs) }; },
      from: function (x) { return { id: x.id, desc: x.descricao, cat: catById[x.categoryId], contaId: x.accountId, data: x.data, valor: R(x.valor), recorrente: !!x.recorrente, recebida: !!x.recebida, obs: x.observacoes || '' }; } },
    despesas: { path: '/expenses', dep: true, fkRefs: ['categoryId', 'accountId', 'creditCardId'],
      // O app salva a despesa com contaId/cartaoId (nao "forma"). O backend exige
      // EXATAMENTE um de accountId/creditCardId; por isso mapeamos direto desses campos.
      to: function (x) {
        var o = { descricao: x.desc, categoryId: catId(x.cat), dataCompra: x.data, valor: C(x.valor), paga: !!x.paga, observacoes: undef(x.obs) };
        if (x.cartaoId) o.creditCardId = x.cartaoId;
        else if (x.contaId) o.accountId = x.contaId;
        else if (x.forma) formaToTarget(o, x.forma); // fallback defensivo (drafts antigos)
        return o;
      },
      from: function (x) { return { id: x.id, desc: x.descricao, cat: catById[x.categoryId], contaId: x.accountId || null, cartaoId: x.creditCardId || null, data: x.dataCompra, venc: x.dataVencimento || null, valor: R(x.valor), paga: !!x.paga, obs: x.observacoes || '', fixoId: x.fixedExpenseId || null }; } },
    planejamentos: { path: '/plan-items', dep: false, fkRefs: ['planCategoryId'],
      // O app guarda o vinculo da meta no campo `catId` (id de uma categoria de
      // planejamento). Mapeamos catId <-> planCategoryId nas duas direcoes.
      to: function (x) { return { nome: x.nome, planCategoryId: x.catId || x.planCategoryId || x.categoriaId, valor: C(x.valor) }; },
      from: function (x) { return { id: x.id, catId: x.planCategoryId, nome: x.nome, valor: R(x.valor) }; } }
  };
  // ordem de sync: entidades "pai" antes das que dependem delas (nome->id / FKs)
  var ORDER = ['contas', 'catalogo', 'cartoes', 'categorias', 'fontes', 'planejamentos', 'fixos', 'receitas', 'despesas'];

  function tok() { return og.get(K_TOK); }
  function req(method, path, body) {
    var headers = { Authorization: 'Bearer ' + tok() };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) { return refresh().then(function (ok) { if (!ok) throw new Error('unauth'); return req(method, path, body); }); }
        return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} if (!r.ok) { log('req falhou', method, path, r.status, t && t.slice(0, 160)); throw new Error(path + ' ' + r.status); } return d; });
      });
  }
  function refresh() {
    var rt = og.get(K_RT); if (!rt) return Promise.resolve(false);
    return fetch(API + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.accessToken) { og.set(K_TOK, d.accessToken); if (d.refreshToken) og.set(K_RT, d.refreshToken); return true; } return false; }).catch(function () { return false; });
  }

  var prev = {}, currentEmail = null, syncing = false, pendingNext = null;
  // Controle de RETENTATIVA: quando um item depende de uma entidade "pai" que
  // ainda esta sincronizando (backend lento/cold start), ele e adiado. Sem
  // retentativa, esse item se perderia ate a proxima gravacao. Reexecutamos o
  // sync automaticamente ate nao haver mais nada pendente.
  var deferredThisPass = false, syncRetries = 0, retryTimer = null;

  // Reconstroi catByName / catById mapeando SEMPRE para o id REAL do backend.
  function rebuildCatMaps(catalogoRaw) {
    catByName = {}; catById = {};
    (catalogoRaw || []).forEach(function (c) {
      if (c && c.id != null && c.nome != null) {
        var rid = realId(c.id);
        if (catByName[c.nome] == null) catByName[c.nome] = rid; // nome -> id do backend
        catById[rid] = c.nome; catById[c.id] = c.nome;          // aceita ambos (backend e cliente)
      }
    });
  }

  // Resolve as FKs de um payload (categoryId/accountId/creditCardId/...) para o
  // id do backend. Retorna false se alguma FK obrigatoria ainda nao existe no
  // backend (nesse caso o item e adiado ate a entidade pai ser criada).
  function resolveFks(coll, payload) {
    var refs = MAP[coll].fkRefs || [];
    for (var i = 0; i < refs.length; i++) {
      var f = refs[i];
      if (payload[f] == null || payload[f] === '') continue;      // FK opcional ausente: ok
      var rid = realId(payload[f]);
      payload[f] = rid;
      // categoria e obrigatoria em fixos/receitas/despesas; conta/cartao tambem
      // precisam existir. Se o id resolvido ainda nao consta no backend, adia.
      if (!isKnown(rid)) return false;
    }
    return true;
  }

  function hydrate(email) {
    resetIdState();
    var db = { contas: [], receitas: [], despesas: [], cartoes: [], fixos: [], fontes: [], planejamentos: [], catalogo: [], categorias: [], config: { patrimonioExcl: [], reservaIds: [] } };
    // 1) categorias primeiro (para montar nome<->id). Se ESTA falhar, aborta
    //    sem sobrescrever os dados locais (hydrate nao-destrutivo).
    return req('GET', '/categories').then(function (cats) {
      var raw = cats || [];
      raw.forEach(function (c) { if (c && c.id != null) markKnown(c.id); });
      rebuildCatMaps(raw);
      db.catalogo = raw.map(MAP.catalogo.from);
      // 2) demais entidades (em paralelo; marcamos os ids como conhecidos)
      var rest = ORDER.filter(function (c) { return c !== 'catalogo'; });
      var jobs = rest.map(function (c) {
        return req('GET', MAP[c].path).then(function (a) {
          var arr = a || [];
          arr.forEach(function (o) { if (o && o.id != null) markKnown(o.id); });
          db[c] = arr.map(MAP[c].from);
        }).catch(function () {});
      });
      jobs.push(req('GET', '/settings').then(function (s) { if (s) db.config = { patrimonioExcl: s.patrimonioExcludedAccountIds || [], reservaIds: s.reservaAccountIds || [] }; }).catch(function () {}));
      return Promise.all(jobs).then(function () {
        prev = JSON.parse(JSON.stringify(db));
        og.set('fn_db_' + email, JSON.stringify(db));
        log('hidratado', email, db);
        return db;
      });
    }).catch(function (e) {
      // Falha de rede/credencial: NAO apaga o que ja existe localmente.
      log('hydrate falhou (mantendo dados locais)', e && e.message);
      var localRaw = og.get('fn_db_' + email);
      var localDb = null; try { localDb = localRaw ? JSON.parse(localRaw) : null; } catch (e2) {}
      var out = localDb || db;
      prev = JSON.parse(JSON.stringify(out));
      return out;
    });
  }

  // Sincronizacao SERIAL e ORDENADA por dependencia. Cada POST espera o anterior,
  // garantindo que a entidade "pai" ja exista (com id do backend) antes do filho.
  function syncDiff(email, next) {
    if (syncing) { pendingNext = next; return Promise.resolve(); } // coalesce gravacoes rapidas
    syncing = true;
    deferredThisPass = false;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    // catByName precisa refletir os ids ja conhecidos
    rebuildCatMaps(next.catalogo || prev.catalogo || []);

    var chain = Promise.resolve();
    ORDER.forEach(function (coll) {
      chain = chain.then(function () {
        var oldArr = (prev[coll] || []), newArr = (next[coll] || []);
        var oldByCid = {}; oldArr.forEach(function (o) { oldByCid[o.id] = o; });
        var seen = {};
        var step = Promise.resolve();

        newArr.forEach(function (it) {
          seen[it.id] = 1;
          step = step.then(function () {
            var payload = MAP[coll].to(it);
            // Resolve FKs para ids do backend; adia se algum pai ainda nao existe.
            if (!resolveFks(coll, payload)) { deferredThisPass = true; log('adiado', coll, it.id, '(FK pendente)'); return; }
            // Item obrigatorio dependente de categoria sem categoryId: nao envia.
            if (MAP[coll].dep && !payload.categoryId) { deferredThisPass = true; log('skip', coll, 'sem categoryId', it.cat); return; }

            var backendId = idMap[it.id];
            var existsOld = oldByCid[it.id];
            if (!backendId && !existsOld) {
              // CRIACAO
              return req('POST', MAP[coll].path, payload).then(function (cr) {
                if (cr && cr.id) {
                  idMap[it.id] = cr.id; markKnown(cr.id);
                  if (coll === 'catalogo') rebuildCatMaps(next.catalogo || []);
                }
              }).catch(function (e) { log('POST falhou', coll, e && e.message); });
            }
            // ATUALIZACAO (se mudou)
            var rid = backendId || realId(it.id);
            var oldPayload = existsOld ? MAP[coll].to(existsOld) : null;
            if (oldPayload) resolveFks(coll, oldPayload);
            if (!oldPayload || JSON.stringify(oldPayload) !== JSON.stringify(payload)) {
              return req('PATCH', MAP[coll].path + '/' + rid, payload).catch(function (e) { log('PATCH falhou', coll, e && e.message); });
            }
          });
        });

        // EXCLUSOES
        step = step.then(function () {
          var delChain = Promise.resolve();
          oldArr.forEach(function (o) {
            if (!seen[o.id]) {
              delChain = delChain.then(function () {
                var rid = realId(o.id);
                return req('DELETE', MAP[coll].path + '/' + rid).then(function () { delete idMap[o.id]; }).catch(function (e) { log('DELETE falhou', coll, e && e.message); });
              });
            }
          });
          return delChain;
        });
        return step;
      });
    });

    return chain.then(function () {
      var cf = next.config || {};
      return req('PATCH', '/settings', { patrimonioExcludedAccountIds: (cf.patrimonioExcl || []).map(realId), reservaAccountIds: (cf.reservaIds || []).map(realId) }).catch(function () {});
    }).then(function () {
      prev = JSON.parse(JSON.stringify(next));
    }).catch(function () {}).then(function () {
      syncing = false;
      // 1) Ha gravacao mais recente enfileirada -> processa ela (zera retentativas).
      if (pendingNext) { var p = pendingNext; pendingNext = null; syncRetries = 0; return syncDiff(email, p); }
      // 2) Algo ficou adiado (pai ainda sincronizando) -> reexecuta em breve, ate
      //    tudo entrar. Rele o db mais recente do proprio app a cada tentativa.
      if (deferredThisPass && syncRetries < 12) {
        syncRetries++;
        retryTimer = setTimeout(function () {
          retryTimer = null;
          if (!tok() || og.get(K_WHO) !== email) return; // sessao mudou: aborta
          var raw = og.get('fn_db_' + email); var d = null; try { d = raw ? JSON.parse(raw) : null; } catch (e) {}
          if (d) syncDiff(email, d);
        }, 1500);
      } else {
        syncRetries = 0; // nada pendente: encerra o ciclo de retentativas
      }
    });
  }

  // ---- sessao / shadow local -------------------------------------------------
  function saveSession(email, password, d) {
    og.set(K_TOK, d.accessToken || '');
    og.set(K_RT, d.refreshToken || '');
    og.set(K_WHO, email);
    og.set(K_PW, JSON.stringify({ e: email, p: password }));
    try {
      var arr = JSON.parse(og.get('fn_users') || '[]'); if (!Array.isArray(arr)) arr = [];
      arr = arr.filter(function (x) { return x && x.email !== email; });
      arr.push({ name: (d.user && d.user.name) || email, email: email, pass: password });
      og.set('fn_users', JSON.stringify(arr));
    } catch (e) { log('shadow err', e && e.message); }
    currentEmail = email;
  }
  function clearSession() {
    og.del(K_TOK); og.del(K_RT); og.del(K_WHO); og.del(K_PW);
    currentEmail = null; resetIdState(); prev = {}; pendingNext = null;
  }

  function postJson(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} return { status: r.status, ok: r.ok, data: d }; }); });
  }

  function authLogin(email, password) {
    email = (email || '').trim().toLowerCase();
    return postJson('/auth/login', { email: email, password: password })
      .then(function (res) {
        if (res.ok && res.data && res.data.accessToken) {
          saveSession(email, password, res.data);
          syncing = true;
          return hydrate(email)
            .then(function () { syncing = false; return { ok: true, status: 200, user: res.data.user || { name: email, email: email } }; })
            .catch(function () { syncing = false; return { ok: true, status: 200, user: res.data.user || { name: email, email: email } }; });
        }
        return { ok: false, status: res.status };
      })
      .catch(function () { return { ok: false, status: 0 }; });
  }
  function authRegister(name, email, password) {
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    return postJson('/auth/register', { name: name, email: email, password: password })
      .then(function (res) {
        if (res.ok && res.data && res.data.accessToken) {
          saveSession(email, password, res.data);
          syncing = true;
          return hydrate(email)
            .then(function () { syncing = false; return { ok: true, status: 201, user: res.data.user || { name: name, email: email } }; })
            .catch(function () { syncing = false; return { ok: true, status: 201, user: res.data.user || { name: name, email: email } }; });
        }
        if (res.status === 409) return { ok: false, status: 409, message: 'Este e-mail já possui cadastro.' };
        if (res.status === 422 || res.status === 400) return { ok: false, status: res.status, message: 'Dados inválidos. Verifique nome, e-mail e senha (mín. 6 caracteres).' };
        return { ok: false, status: res.status };
      })
      .catch(function () { return { ok: false, status: 0 }; });
  }

  window.FNAuth = {
    login: authLogin,
    register: authRegister,
    logout: clearSession
  };

  // ---- espelhamento automatico das gravacoes do app -------------------------
  Storage.prototype.setItem = function (key, val) {
    try {
      if (String(key).indexOf('fn_db_') === 0) {
        og.set(key, val);
        var email = key.slice(6); var data = null; try { data = JSON.parse(val); } catch (e) {}
        // SEMPRE chama syncDiff: se ja houver um sync em andamento, o proprio
        // syncDiff enfileira esta gravacao como pendingNext (nao a descarta).
        // Antes havia um "&& !syncing" aqui que fazia gravacoes feitas durante
        // um sync serem PERDIDAS (ex.: criar conta e, logo apos, uma receita).
        if (data && tok() && og.get(K_WHO) === email) { syncDiff(email, data); }
        return;
      }
    } catch (e) { log('setItem err', e && e.message); }
    return og.set(key, val);
  };

  // ---- LOADING SCREEN --------------------------------------------------------
  var FN_LOADER_CSS = [
    '#fn-loading{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
    'flex-direction:column;gap:18px;background:var(--bg,#151019);color:var(--text,#e9e4ef);',
    'font-family:Manrope,system-ui,sans-serif;opacity:1;transition:opacity .35s ease}',
    '#fn-loading.fn-hide{opacity:0;pointer-events:none}',
    '#fn-loading .fn-spin{width:46px;height:46px;border-radius:50%;border:4px solid rgba(140,110,200,.25);',
    'border-top-color:var(--accent,#8c6ec8);animation:fn-spin 0.9s linear infinite}',
    '#fn-loading .fn-msg{font-size:15px;font-weight:600;letter-spacing:.2px;opacity:.85}',
    '@keyframes fn-spin{to{transform:rotate(360deg)}}'
  ].join('');
  function ensureLoaderStyle() {
    if (!document.getElementById('fn-loading-style')) {
      var st = document.createElement('style'); st.id = 'fn-loading-style'; st.textContent = FN_LOADER_CSS;
      (document.head || document.documentElement).appendChild(st);
    }
  }
  function showLoader(msg) {
    try {
      ensureLoaderStyle();
      var el = document.getElementById('fn-loading');
      if (!el) {
        el = document.createElement('div'); el.id = 'fn-loading';
        el.innerHTML = '<div class="fn-spin"></div><div class="fn-msg"></div>';
        (document.body || document.documentElement).appendChild(el);
      }
      el.classList.remove('fn-hide');
      el.querySelector('.fn-msg').textContent = msg || 'Carregando seus dados…';
    } catch (e) { log('loader err', e && e.message); }
  }
  function hideLoader() {
    try {
      var el = document.getElementById('fn-loading');
      if (el) { el.classList.add('fn-hide'); setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400); }
    } catch (e) { log('loader err', e && e.message); }
  }

  // ---- PATCH em tempo de execucao dos metodos de auth do app React ----------
  function patchAuth(inst) {
    if (!inst || inst.__fnAuthPatched) return false;
    inst.__fnAuthPatched = true;

    inst.doLogin = function () {
      var self = inst;
      var email = (self.state.authEmail || '').trim().toLowerCase();
      var pass = self.state.authPass || '';
      if (!email.indexOf || email.indexOf('@') < 0 || !pass) { self.setState({ authError: 'Informe e-mail e senha.' }); return; }
      self.setState({ authError: '', authMsg: '', loading: true });
      showLoader('Entrando…');
      authLogin(email, pass).then(function (res) {
        self.setState({ loading: false });
        if (res && res.ok) { self.enter({ name: res.user.name, email: email, visitor: false }, self.loadDB(email)); hideLoader(); return; }
        hideLoader();
        if (res && res.status === 401) { self.setState({ authError: 'E-mail ou senha inválidos.' }); return; }
        var u = (self.getUsers() || []).find(function (x) { return x.email === email; });
        if (u && u.pass === pass) { self.enter({ name: u.name, email: email, visitor: false }, self.loadDB(email)); return; }
        self.setState({ authError: 'Sem conexão com o servidor. Tente novamente.' });
      });
    };

    inst.doCadastro = function () {
      var self = inst;
      var name = (self.state.authName || '').trim();
      var email = (self.state.authEmail || '').trim().toLowerCase();
      var pass = self.state.authPass || '';
      if (!name || email.indexOf('@') < 0 || pass.length < 6) { self.setState({ authError: 'Preencha nome, e-mail válido e senha com ao menos 6 caracteres.' }); return; }
      self.setState({ authError: '', authMsg: '', loading: true });
      showLoader('Criando sua conta…');
      authRegister(name, email, pass).then(function (res) {
        self.setState({ loading: false });
        if (res && res.ok) { self.enter({ name: res.user.name, email: email, visitor: false }, self.loadDB(email)); hideLoader(); return; }
        hideLoader();
        if (res && res.status === 409) { self.setState({ authError: 'Este e-mail já possui cadastro.' }); return; }
        if (res && res.status === 0) { self.setState({ authError: 'Sem conexão com o servidor. Tente novamente.' }); return; }
        self.setState({ authError: (res && res.message) || 'Não foi possível concluir o cadastro.' });
      });
    };

    // logout: alem de voltar para a tela de auth, limpa a sessao/tokens para
    // que um proximo modo visitante nao herde credenciais nem dispare sync.
    if (typeof inst.sair === 'function' && !inst.__fnSairPatched) {
      var origSair = inst.sair.bind(inst);
      inst.sair = function () { try { clearSession(); } catch (e) {} return origSair(); };
      inst.__fnSairPatched = true;
    }

    // ENTER envia o formulario de auth (login/cadastro/recuperar), sem precisar
    // clicar no botao. So age na tela de auth e quando o foco esta num input.
    if (!inst.__fnEnterPatched) {
      inst.__fnEnterPatched = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        try {
          var st = inst.state || {};
          if (st.view !== 'auth') return;
          var el = e.target;
          if (el && el.tagName === 'TEXTAREA') return;
          var inField = el && (el.tagName === 'INPUT');
          if (!inField) return;
          e.preventDefault();
          if (st.authTab === 'cadastro') inst.doCadastro();
          else if (st.authTab === 'recuperar' && typeof inst.doRecuperar === 'function') inst.doRecuperar();
          else inst.doLogin();
        } catch (err) { log('enter err', err && err.message); }
      }, true);
    }

    try { if (typeof inst.setState === 'function') inst.setState({}); } catch (e) {}
    log('patch de auth aplicado');
    return true;
  }

  function findReactRootFiber() {
    var candidates = [];
    ['dc-root', 'root', 'app'].forEach(function (id) { var e = document.getElementById(id); if (e) candidates.push(e); });
    for (var i = 0; i < document.body.children.length; i++) candidates.push(document.body.children[i]);
    for (var j = 0; j < candidates.length; j++) {
      var el = candidates[j]; if (!el) continue;
      var k = Object.keys(el).find(function (kk) { return kk.indexOf('__reactContainer$') === 0; });
      if (k) return el[k];
    }
    return null;
  }
  function isAuthController(o) {
    return o && typeof o.doLogin === 'function' && typeof o.doCadastro === 'function' &&
      typeof o.setState === 'function' && o.state && ('authEmail' in o.state || 'authTab' in o.state);
  }
  function findAuthInstance(rootFiber) {
    if (!rootFiber) return null;
    var start = rootFiber.current || rootFiber;
    var stack = [start], seen = 0;
    while (stack.length && seen < 40000) {
      var f = stack.pop(); seen++;
      if (!f) continue;
      var sn = f.stateNode;
      if (sn) { if (isAuthController(sn)) return sn; if (sn.logic && isAuthController(sn.logic)) return sn.logic; }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    return null;
  }

  var patched = false, tries = 0;
  function tryPatch() {
    if (patched) return true;
    try { var root = findReactRootFiber(); var inst = findAuthInstance(root); if (inst) { patched = patchAuth(inst); return patched; } } catch (e) { log('tryPatch err', e && e.message); }
    return false;
  }
  var iv = setInterval(function () { tries++; if (tryPatch() || tries > 120) clearInterval(iv); }, 400);
  if (document.readyState !== 'loading') tryPatch();
  document.addEventListener('DOMContentLoaded', tryPatch);

  // ---- RESPONSIVO ----------------------------------------------------------
  var FN_RESP_CSS = [
    // Tela de autenticacao: empilha o painel de marketing acima do formulario.
    'html.fn-mobile [style*="linear-gradient(160deg"][style*="flex: 1.1"]{display:none!important}',
    // Tela de LOGIN: empilha o painel de marketing acima do formulario (escopo restrito).
    'html.fn-mobile .auth-wrap{flex-direction:column!important;min-height:auto!important}',
    // App shell: mantem layout em LINHA no mobile; a sidebar vira um trilho compacto de icones.
    // (Sem isso, a <aside> com height:100vh ocupava a tela inteira e so o menu aparecia.)
    'html.fn-mobile .app-sidebar{width:64px!important;padding:14px 8px!important}',
    'html.fn-mobile .app-sidebar .sb-logo{justify-content:center!important;padding:6px 0!important}',
    'html.fn-mobile .app-sidebar .sb-logo-text{display:none!important}',
    'html.fn-mobile .app-sidebar nav button{justify-content:center!important;padding:11px 0!important}',
    'html.fn-mobile .app-sidebar nav button span{display:none!important}',
    'html.fn-mobile .app-sidebar .sb-toggle{justify-content:center!important;padding:11px 0!important}',
    'html.fn-mobile .app-sidebar .sb-toggle span{display:none!important}',
    // Grids multi-coluna viram 1 coluna no celular.
    'html.fn-mobile [style*="repeat(3,1fr)"],',
    'html.fn-mobile [style*="repeat(3, 1fr)"],',
    'html.fn-mobile [style*="repeat(2,1fr)"],',
    'html.fn-mobile [style*="repeat(2, 1fr)"],',
    'html.fn-mobile [style*="5fr 4fr"],',
    'html.fn-mobile [style*="2fr 3fr"],',
    'html.fn-mobile [style*="1fr 1fr"]{grid-template-columns:1fr!important}',
    // Tabelas em grid (despesas/receitas) JA rolam sozinhas: o app usa um wrapper
    // com overflow-x:auto e min-width. Nao mexer nelas para preservar esse comportamento.
    // Paddings grandes encolhem.
    'html.fn-mobile [style*="padding: 64px"],',
    'html.fn-mobile [style*="padding: 48px"],',
    'html.fn-mobile [style*="padding: 40px"]{padding:18px!important}',
    'html.fn-mobile [style*="max-width: 1240px"]{max-width:100%!important}',
    // Evita overflow horizontal e permite rolagem de tabelas largas.
    'html.fn-mobile,html.fn-mobile body{overflow-x:hidden!important;max-width:100vw}',
    'html.fn-mobile table{display:block;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}',
    // Modais: nunca estourar a largura da tela (restrito a dialogs para nao afetar chrome fixo).
    'html.fn-mobile [role="dialog"]{max-width:96vw!important}',
    'html.fn-tablet [style*="repeat(3,1fr)"],html.fn-tablet [style*="repeat(3, 1fr)"]{grid-template-columns:1fr 1fr!important}'
  ].join('\n');
  function applyResponsive() {
    try {
      if (!document.getElementById('fn-responsive-style')) {
        var st = document.createElement('style'); st.id = 'fn-responsive-style'; st.textContent = FN_RESP_CSS;
        (document.head || document.documentElement).appendChild(st);
      }
      var w = window.innerWidth;
      document.documentElement.classList.toggle('fn-mobile', w <= 820);
      document.documentElement.classList.toggle('fn-tablet', w > 820 && w <= 1100);
    } catch (e) { log('responsive err', e && e.message); }
  }
  applyResponsive();
  window.addEventListener('resize', applyResponsive);
  window.addEventListener('orientationchange', applyResponsive);
  document.addEventListener('DOMContentLoaded', applyResponsive);

  window.__FN_SYNC_VER = '0.8.1';
  log('carregado v0.8.1, API=', API);
})();
