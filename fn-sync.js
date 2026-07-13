/*!
 * fn-sync.js - Integracao FinanceNan (v0.4.0)
 * ---------------------------------------------------------------------------
 * ALEM da integracao com o backend, este arquivo tambem injeta um CSS responsivo
 * (secao "RESPONSIVO" no final) que adapta o layout para celular/tablet sem
 * precisar editar o index.html gerado.
 *
 * O QUE MUDOU (login):
 *  - O login/cadastro passam a ser validados NO BACKEND (fonte da verdade), e nao
 *    mais so no localStorage do navegador. Assim funciona em qualquer navegador/
 *    dispositivo, resolvendo o "login invalido apos atualizar a pagina".
 *  - Este script corrige o app EM TEMPO DE EXECUCAO (faz patch dos metodos
 *    doLogin/doCadastro do componente React), entao NAO e preciso editar o
 *    index.html gerado.
 *  - Em caso de falha de rede, ha fallback para a validacao local (offline).
 *  - Mantem o espelhamento de dados (fn_db_<email>) para o backend.
 *
 * API: aponta para o backend atual (https://finance.renanguedes.com), que ja funciona,
 * para nao depender de mudanca de DNS. Quando voce mover o app para
 * finance.renanguedes.com e o backend para api.finance.renanguedes.com, troque a
 * constante API abaixo (ou defina window.FN_API_BASE antes de carregar este script).
 */
(function () {
  'use strict';
  var API = (typeof window !== 'undefined' && window.FN_API_BASE) || 'https://finance.renanguedes.com';
  var K_TOK = 'fn_sync_tok', K_RT = 'fn_sync_rt', K_WHO = 'fn_sync_who', K_PW = 'fn_sync_pw';
  var LS = window.localStorage;
  var og = { get: LS.getItem.bind(LS), set: LS.setItem.bind(LS), del: LS.removeItem.bind(LS) };

  var CONTA_TO = { 'Conta bancária': 'conta_bancaria', 'Conta bancaria': 'conta_bancaria', 'Carteira digital': 'carteira_digital', 'Dinheiro físico': 'dinheiro_fisico', 'Dinheiro fisico': 'dinheiro_fisico', 'Investimento': 'investimento', 'Outro': 'outro' };
  var CONTA_FROM = { conta_bancaria: 'Conta bancária', carteira_digital: 'Carteira digital', dinheiro_fisico: 'Dinheiro físico', investimento: 'Investimento', outro: 'Outro' };
  var CAT_TO = { 'Receita': 'receita', 'Despesa': 'despesa', 'Investimento': 'investimento' };
  var CAT_FROM = { receita: 'Receita', despesa: 'Despesa', investimento: 'Investimento' };
  var N = function (v) { return Math.round(Number(v) || 0); };
  var log = function () { try { if (window.__FN_DEBUG) console.log.apply(console, ['[fn-sync]'].concat([].slice.call(arguments))); } catch (e) {} };

  var MAP = {
    contas: { path: '/accounts', to: function (x) { return { nome: x.nome, tipo: CONTA_TO[x.tipo] || 'outro', saldo: N(x.saldo), cor: x.cor, ativo: x.ativo !== false }; }, from: function (x) { return { id: x.id, nome: x.nome, tipo: CONTA_FROM[x.tipo] || 'Outro', saldo: x.saldo, cor: x.cor, ativo: x.ativo }; } },
    catalogo: { path: '/categories', to: function (x) { return { nome: x.nome, tipo: CAT_TO[x.tipo] || 'despesa', cor: x.cor, icone: x.icone }; }, from: function (x) { return { id: x.id, nome: x.nome, tipo: CAT_FROM[x.tipo] || 'Despesa', cor: x.cor, icone: x.icone }; } },
    categorias: { path: '/plan-categories', to: function (x) { return { nome: x.nome, pct: N(x.pct), abs: N(x.abs) }; }, from: function (x) { return { id: x.id, nome: x.nome, pct: x.pct, abs: x.abs }; } },
    fontes: { path: '/income-sources', to: function (x) { return { nome: x.nome, valor: N(x.valor) }; }, from: function (x) { return x; } },
    cartoes: { path: '/credit-cards', to: function (x) { return { nome: x.nome, bandeira: x.bandeira, diaFechamento: N(x.diaFechamento), diaVencimento: N(x.diaVencimento), cor: x.cor, ativo: x.ativo !== false }; }, from: function (x) { return x; } },
    fixos: { path: '/fixed-expenses', to: function (x) { return { descricao: x.descricao, valor: N(x.valor), diaVencimento: N(x.diaVencimento), categoryId: x.categoryId || x.catId, contaPadraoId: x.contaPadraoId || undefined, observacoes: x.observacoes || undefined, ativo: x.ativo !== false }; }, from: function (x) { return x; } },
    receitas: { path: '/incomes', to: function (x) { return { descricao: x.descricao, valor: N(x.valor), data: x.data, accountId: x.accountId || x.contaId, categoryId: x.categoryId || x.catId, recebida: !!x.recebida, recorrente: !!x.recorrente, observacoes: x.observacoes || undefined }; }, from: function (x) { return x; } },
    despesas: { path: '/expenses', to: function (x) { return { descricao: x.descricao, valor: N(x.valor), dataCompra: x.dataCompra || x.data, categoryId: x.categoryId || x.catId, accountId: x.accountId || x.contaId || undefined, creditCardId: x.creditCardId || x.cartaoId || undefined, paga: !!x.paga, observacoes: x.observacoes || undefined }; }, from: function (x) { return x; } },
    planejamentos: { path: '/plan-items', to: function (x) { return { nome: x.nome, planCategoryId: x.planCategoryId || x.categoriaId, valor: N(x.valor) }; }, from: function (x) { return x; } }
  };
  var ORDER = ['contas', 'catalogo', 'categorias', 'fontes', 'cartoes', 'fixos', 'receitas', 'despesas', 'planejamentos'];

  function tok() { return og.get(K_TOK); }
  function req(method, path, body) {
    return fetch(API + path, { method: method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) { return refresh().then(function (ok) { if (!ok) throw new Error('unauth'); return req(method, path, body); }); }
        return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} if (!r.ok) throw new Error(path + ' ' + r.status); return d; });
      });
  }
  function refresh() {
    var rt = og.get(K_RT); if (!rt) return Promise.resolve(false);
    return fetch(API + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.accessToken) { og.set(K_TOK, d.accessToken); if (d.refreshToken) og.set(K_RT, d.refreshToken); return true; } return false; }).catch(function () { return false; });
  }

  var prev = {}, currentEmail = null, syncing = false;

  function hydrate(email) {
    var db = { contas: [], receitas: [], despesas: [], cartoes: [], fixos: [], fontes: [], planejamentos: [], catalogo: [], categorias: [], config: { patrimonioExcl: [], reservaIds: [] } };
    var jobs = ORDER.map(function (c) { return req('GET', MAP[c].path).then(function (a) { db[c] = (a || []).map(MAP[c].from); }).catch(function () {}); });
    jobs.push(req('GET', '/settings').then(function (s) { if (s) db.config = { patrimonioExcl: s.patrimonioExcludedAccountIds || [], reservaIds: s.reservaAccountIds || [] }; }).catch(function () {}));
    return Promise.all(jobs).then(function () { prev = JSON.parse(JSON.stringify(db)); og.set('fn_db_' + email, JSON.stringify(db)); log('hidratado', email); return db; });
  }

  function syncDiff(email, next) {
    if (syncing) return;
    ORDER.forEach(function (c) {
      var oldArr = (prev[c] || []), newArr = (next[c] || []), oldById = {}; oldArr.forEach(function (o) { oldById[o.id] = o; }); var seen = {};
      newArr.forEach(function (it) {
        seen[it.id] = 1; var p = MAP[c].to(it);
        if (!it.id || !oldById[it.id]) { req('POST', MAP[c].path, p).then(function (cr) { if (cr && cr.id && cr.id !== it.id) { it.id = cr.id; og.set('fn_db_' + email, JSON.stringify(next)); } }).catch(function () {}); }
        else if (JSON.stringify(MAP[c].to(oldById[it.id])) !== JSON.stringify(p)) { req('PATCH', MAP[c].path + '/' + it.id, p).catch(function () {}); }
      });
      oldArr.forEach(function (o) { if (o.id && !seen[o.id]) req('DELETE', MAP[c].path + '/' + o.id).catch(function () {}); });
    });
    var cf = next.config || {}; req('PATCH', '/settings', { patrimonioExcludedAccountIds: cf.patrimonioExcl || [], reservaAccountIds: cf.reservaIds || [] }).catch(function () {});
    prev = JSON.parse(JSON.stringify(next));
  }

  // ---- sessao / shadow local -------------------------------------------------
  function saveSession(email, password, d) {
    og.set(K_TOK, d.accessToken || '');
    og.set(K_RT, d.refreshToken || '');
    og.set(K_WHO, email);
    og.set(K_PW, JSON.stringify({ e: email, p: password }));
    // Copia local em fn_users para o modo offline do app continuar funcionando.
    try {
      var arr = JSON.parse(og.get('fn_users') || '[]'); if (!Array.isArray(arr)) arr = [];
      arr = arr.filter(function (x) { return x && x.email !== email; });
      arr.push({ name: (d.user && d.user.name) || email, email: email, pass: password });
      og.set('fn_users', JSON.stringify(arr));
    } catch (e) { log('shadow err', e && e.message); }
    currentEmail = email;
  }

  function postJson(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} return { status: r.status, ok: r.ok, data: d }; }); });
  }

  // Retornam Promise<{ok, status, user?, message?}>. status 0 = falha de rede.
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
    logout: function () { og.del(K_TOK); og.del(K_RT); og.del(K_WHO); og.del(K_PW); currentEmail = null; }
  };

  // ---- espelhamento automatico das gravacoes do app -------------------------
  Storage.prototype.setItem = function (key, val) {
    try {
      if (String(key).indexOf('fn_db_') === 0) {
        og.set(key, val);
        var email = key.slice(6); var data = null; try { data = JSON.parse(val); } catch (e) {}
        if (data && tok() && og.get(K_WHO) === email && !syncing) { syncDiff(email, data); }
        return;
      }
    } catch (e) { log('setItem err', e && e.message); }
    return og.set(key, val);
  };

  // ---- PATCH em tempo de execucao dos metodos de auth do app React ----------
  function patchAuth(inst) {
    if (!inst || inst.__fnAuthPatched) return false;
    inst.__fnAuthPatched = true;

    inst.doLogin = function () {
      var self = this;
      var email = (self.state.authEmail || '').trim().toLowerCase();
      var pass = self.state.authPass || '';
      if (!email.indexOf || email.indexOf('@') < 0 || !pass) { self.setState({ authError: 'Informe e-mail e senha.' }); return; }
      self.setState({ authError: '', authMsg: '' });
      authLogin(email, pass).then(function (res) {
        if (res && res.ok) { self.enter({ name: res.user.name, email: email, visitor: false }, self.loadDB(email)); return; }
        if (res && res.status === 401) { self.setState({ authError: 'E-mail ou senha inválidos.' }); return; }
        // offline / servidor fora do ar -> validacao local
        var u = (self.getUsers() || []).find(function (x) { return x.email === email; });
        if (u && u.pass === pass) { self.enter({ name: u.name, email: email, visitor: false }, self.loadDB(email)); return; }
        self.setState({ authError: 'E-mail ou senha inválidos.' });
      });
    };

    inst.doCadastro = function () {
      var self = this;
      var name = (self.state.authName || '').trim();
      var email = (self.state.authEmail || '').trim().toLowerCase();
      var pass = self.state.authPass || '';
      if (!name || email.indexOf('@') < 0 || pass.length < 6) { self.setState({ authError: 'Preencha nome, e-mail válido e senha com ao menos 6 caracteres.' }); return; }
      self.setState({ authError: '', authMsg: '' });
      authRegister(name, email, pass).then(function (res) {
        if (res && res.ok) { self.enter({ name: res.user.name, email: email, visitor: false }, self.loadDB(email)); return; }
        if (res && res.status === 409) { self.setState({ authError: 'Este e-mail já possui cadastro.' }); return; }
        if (res && res.status === 0) { self.setState({ authError: 'Sem conexão com o servidor. Tente novamente.' }); return; }
        self.setState({ authError: (res && res.message) || 'Não foi possível concluir o cadastro.' });
      });
    };

    try { if (typeof inst.setState === 'function') inst.setState({}); } catch (e) {} // forca re-render p/ religar o onClick
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
  // O controller do app (com doLogin/state) fica em fiber.stateNode.logic no dc-runtime.
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
      if (sn) {
        if (isAuthController(sn)) return sn;
        if (sn.logic && isAuthController(sn.logic)) return sn.logic;
      }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    return null;
  }

  var patched = false, tries = 0;
  function tryPatch() {
    if (patched) return true;
    try {
      var root = findReactRootFiber();
      var inst = findAuthInstance(root);
      if (inst) { patched = patchAuth(inst); return patched; }
    } catch (e) { log('tryPatch err', e && e.message); }
    return false;
  }
  var iv = setInterval(function () { tries++; if (tryPatch() || tries > 120) clearInterval(iv); }, 400);
  if (document.readyState !== 'loading') tryPatch();
  document.addEventListener('DOMContentLoaded', tryPatch);

  // ---- RESPONSIVO ----------------------------------------------------------
  // O app usa estilos inline; por isso sobrescrevemos via [style*=] + !important.
  // As regras so valem quando <html> tem a classe fn-mobile (largura <= 820px).
  var FN_RESP_CSS = [
    // esconde o painel de marketing (hero) no login em telas pequenas
    'html.fn-mobile [style*="linear-gradient(160deg"][style*="flex: 1.1"]{display:none!important}',
    // container de tela cheia em flex (login/estrutura) empilha na vertical
    'html.fn-mobile [style*="min-height: 100vh"][style*="display: flex"]{flex-direction:column!important;min-height:auto!important}',
    // grids fixos de varias colunas viram 1 coluna (os grids auto-fit/auto-fill ja sao responsivos)
    'html.fn-mobile [style*="repeat(3,1fr)"],',
    'html.fn-mobile [style*="5fr 4fr"],',
    'html.fn-mobile [style*="2fr 3fr"],',
    'html.fn-mobile [style*="1fr 1fr"],',
    'html.fn-mobile [style*="34px minmax(200px,1fr)"]{grid-template-columns:1fr!important}',
    // reduz margens/paddings grandes
    'html.fn-mobile [style*="padding: 64px"],',
    'html.fn-mobile [style*="padding: 48px"],',
    'html.fn-mobile [style*="padding: 40px"]{padding:18px!important}',
    // container principal ocupa a largura toda
    'html.fn-mobile [style*="max-width: 1240px"]{max-width:100%!important}',
    // evita rolagem horizontal indesejada
    'html.fn-mobile{overflow-x:hidden!important}'
  ].join('\n');

  function applyResponsive() {
    try {
      if (!document.getElementById('fn-responsive-style')) {
        var st = document.createElement('style'); st.id = 'fn-responsive-style'; st.textContent = FN_RESP_CSS;
        (document.head || document.documentElement).appendChild(st);
      }
      document.documentElement.classList.toggle('fn-mobile', window.innerWidth <= 820);
    } catch (e) { log('responsive err', e && e.message); }
  }
  applyResponsive();
  window.addEventListener('resize', applyResponsive);
  window.addEventListener('orientationchange', applyResponsive);
  document.addEventListener('DOMContentLoaded', applyResponsive);

  log('carregado v0.4.0, API=', API);
})();
