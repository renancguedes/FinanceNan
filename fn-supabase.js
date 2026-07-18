/*!
 * fn-supabase.js - Camada de dados do FinanceNan via Supabase (v1.0.1)
 * ---------------------------------------------------------------------------
 * Substitui o backend Fastify: o front fala DIRETO com o Supabase
 * (supabase-js + Supabase Auth + RLS). Sem API própria.
 *  - Auth: signUp / signInWithPassword / signOut (sessão persistida pelo SDK).
 *  - Dados: cada coleção do app vira uma tabela fn_* (ids do app como PK).
 *  - RLS garante que cada usuário só acessa as próprias linhas.
 *  - Mantém: espelhamento via Storage.setItem, loading screen, patch de auth
 *    em runtime, conversão REAIS<->CENTAVOS e o CSS responsivo (drawer mobile).
 *
 * CONFIG: defina window.FN_SUPABASE_URL e window.FN_SUPABASE_ANON no index.html.
 */
(function () {
  'use strict';
  var URL = (typeof window !== 'undefined' && window.FN_SUPABASE_URL) || '';
  var ANON = (typeof window !== 'undefined' && window.FN_SUPABASE_ANON) || '';
  var LS = window.localStorage;
  var og = { get: LS.getItem.bind(LS), set: LS.setItem.bind(LS), del: LS.removeItem.bind(LS) };
  var log = function () { try { if (window.__FN_DEBUG) console.log.apply(console, ['[fn-supabase]'].concat([].slice.call(arguments))); } catch (e) {} };

  if (!window.supabase || !window.supabase.createClient) { console.error('[fn-supabase] supabase-js nao carregou (verifique o <script> do CDN).'); return; }
  if (!URL || !ANON) { console.error('[fn-supabase] Faltam window.FN_SUPABASE_URL / window.FN_SUPABASE_ANON no index.html.'); }
  var sb = window.supabase.createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  var N = function (v) { return Math.round(Number(v) || 0); };
  var C = function (v) { return Math.round((Number(v) || 0) * 100); }; // reais -> centavos
  var R = function (v) { return (Number(v) || 0) / 100; };            // centavos -> reais
  var nn = function (v) { return (v === '' || v == null) ? null : v; };

  // coleção do app -> tabela + mapeadores (app<->linha). Dinheiro em centavos.
  var MAP = {
    contas: { table: 'fn_contas',
      to: function (x) { return { id: x.id, nome: x.nome, tipo: x.tipo, saldo: C(x.saldo), cor: x.cor, ativo: x.ativo !== false }; },
      from: function (r) { return { id: r.id, nome: r.nome, tipo: r.tipo, saldo: R(r.saldo), cor: r.cor, ativo: r.ativo }; } },
    catalogo: { table: 'fn_catalogo',
      to: function (x) { return { id: x.id, nome: x.nome, tipo: x.tipo, cor: x.cor, icone: x.icone }; },
      from: function (r) { return { id: r.id, nome: r.nome, tipo: r.tipo, cor: r.cor, icone: r.icone }; } },
    cartoes: { table: 'fn_cartoes',
      to: function (x) { return { id: x.id, nome: x.nome, bandeira: x.bandeira, fecha: N(x.fecha), vence: N(x.vence), cor: x.cor, ativo: x.ativo !== false }; },
      from: function (r) { return { id: r.id, nome: r.nome, bandeira: r.bandeira, fecha: r.fecha, vence: r.vence, cor: r.cor, ativo: r.ativo }; } },
    categorias: { table: 'fn_categorias',
      to: function (x) { return { id: x.id, nome: x.nome, pct: N(x.pct), abs: C(x.abs) }; },
      from: function (r) { return { id: r.id, nome: r.nome, pct: r.pct, abs: R(r.abs) }; } },
    fontes: { table: 'fn_fontes',
      to: function (x) { return { id: x.id, nome: x.nome, valor: C(x.valor) }; },
      from: function (r) { return { id: r.id, nome: r.nome, valor: R(r.valor) }; } },
    planejamentos: { table: 'fn_planejamentos',
      to: function (x) { return { id: x.id, catId: nn(x.catId || x.planCategoryId || x.categoriaId), nome: x.nome, valor: C(x.valor) }; },
      from: function (r) { return { id: r.id, catId: r.catId, nome: r.nome, valor: R(r.valor) }; } },
    fixos: { table: 'fn_fixos',
      to: function (x) { return { id: x.id, desc: x.desc, cat: x.cat, contaId: nn(x.contaId), valor: C(x.valor), venc: N(x.venc), obs: nn(x.obs), ativo: x.ativo !== false }; },
      from: function (r) { return { id: r.id, desc: r.desc, cat: r.cat, contaId: r.contaId || '', valor: R(r.valor), venc: r.venc, obs: r.obs || '', ativo: r.ativo }; } },
    receitas: { table: 'fn_receitas',
      to: function (x) { return { id: x.id, desc: x.desc, cat: x.cat, contaId: nn(x.contaId), data: x.data, valor: C(x.valor), recorrente: !!x.recorrente, recebida: !!x.recebida, obs: nn(x.obs) }; },
      from: function (r) { return { id: r.id, desc: r.desc, cat: r.cat, contaId: r.contaId, data: r.data, valor: R(r.valor), recorrente: !!r.recorrente, recebida: !!r.recebida, obs: r.obs || '' }; } },
    despesas: { table: 'fn_despesas',
      to: function (x) { return { id: x.id, desc: x.desc, cat: x.cat, contaId: nn(x.contaId), cartaoId: nn(x.cartaoId), data: x.data, venc: nn(x.venc), valor: C(x.valor), paga: !!x.paga, obs: nn(x.obs), fixoId: nn(x.fixoId) }; },
      from: function (r) { return { id: r.id, desc: r.desc, cat: r.cat, contaId: r.contaId || null, cartaoId: r.cartaoId || null, data: r.data, venc: r.venc || null, valor: R(r.valor), paga: !!r.paga, obs: r.obs || '', fixoId: r.fixoId || null }; } }
  };
  var ORDER = ['contas', 'catalogo', 'cartoes', 'categorias', 'fontes', 'planejamentos', 'fixos', 'receitas', 'despesas'];

  var currentEmail = null, currentUid = null, prev = {}, syncing = false, pendingNext = null;
  var K_WHO = 'fn_sb_who';

  // ---- hydrate: baixa todas as coleções do Supabase para o estado do app ----
  function emptyDb() { return { contas: [], receitas: [], despesas: [], cartoes: [], fixos: [], fontes: [], planejamentos: [], catalogo: [], categorias: [], config: { patrimonioExcl: [], reservaIds: [] } }; }

  function hydrate(email) {
    var db = emptyDb();
    var jobs = ORDER.map(function (coll) {
      return sb.from(MAP[coll].table).select('*').then(function (res) {
        if (res.error) { log('select falhou', coll, res.error.message); return; }
        db[coll] = (res.data || []).map(MAP[coll].from);
      });
    });
    jobs.push(sb.from('fn_settings').select('*').limit(1).then(function (res) {
      if (!res.error && res.data && res.data[0]) db.config = { patrimonioExcl: res.data[0].patrimonioExcl || [], reservaIds: res.data[0].reservaIds || [] };
    }));
    return Promise.all(jobs).then(function () {
      prev = JSON.parse(JSON.stringify(db));
      og.set('fn_db_' + email, JSON.stringify(db));
      log('hidratado', email, db);
      return db;
    }).catch(function (e) {
      // Falha de rede: NAO sobrescreve dados locais.
      log('hydrate falhou (mantendo local)', e && e.message);
      var raw = og.get('fn_db_' + email); var local = null; try { local = raw ? JSON.parse(raw) : null; } catch (e2) {}
      var out = local || db; prev = JSON.parse(JSON.stringify(out)); return out;
    });
  }

  // ---- syncDiff: grava as diferenças (upsert/delete) por coleção -------------
  function collDiff(coll, oldArr, newArr) {
    var table = MAP[coll].table, m = MAP[coll];
    var oldById = {}; (oldArr || []).forEach(function (o) { oldById[o.id] = o; });
    var newById = {}; (newArr || []).forEach(function (o) { newById[o.id] = o; });
    var ups = [], dels = [];
    (newArr || []).forEach(function (it) {
      var o = oldById[it.id]; var p = m.to(it);
      if (!o || JSON.stringify(m.to(o)) !== JSON.stringify(p)) ups.push(p);
    });
    (oldArr || []).forEach(function (o) { if (!newById[o.id]) dels.push(o.id); });
    var jobs = [];
    if (ups.length) jobs.push(sb.from(table).upsert(ups).then(function (r) { if (r.error) log('upsert falhou', coll, r.error.message); }));
    if (dels.length) jobs.push(sb.from(table).delete().in('id', dels).then(function (r) { if (r.error) log('delete falhou', coll, r.error.message); }));
    return Promise.all(jobs);
  }

  function syncDiff(email, next) {
    if (syncing) { pendingNext = next; return Promise.resolve(); }
    syncing = true;
    var jobs = ORDER.map(function (coll) { return collDiff(coll, prev[coll] || [], next[coll] || []); });
    var cf = next.config || {};
    jobs.push(sb.from('fn_settings').upsert({ user_id: currentUid, patrimonioExcl: (cf.patrimonioExcl || []), reservaIds: (cf.reservaIds || []) }).then(function (r) { if (r.error) log('settings falhou', r.error.message); }));
    return Promise.all(jobs).then(function () {
      prev = JSON.parse(JSON.stringify(next));
    }).catch(function (e) { log('sync erro', e && e.message); }).then(function () {
      syncing = false;
      if (pendingNext) { var p = pendingNext; pendingNext = null; return syncDiff(email, p); }
    });
  }

  // ---- espelhamento automatico das gravacoes do app -------------------------
  Storage.prototype.setItem = function (key, val) {
    try {
      if (String(key).indexOf('fn_db_') === 0) {
        og.set(key, val);
        var email = key.slice(6); var data = null; try { data = JSON.parse(val); } catch (e) {}
        if (data && currentUid && og.get(K_WHO) === email) { syncDiff(email, data); }
        return;
      }
    } catch (e) { log('setItem err', e && e.message); }
    return og.set(key, val);
  };

  // ---- AUTH (Supabase) ------------------------------------------------------
  function metaName(u) { return (u && u.user_metadata && u.user_metadata.name) || (u && u.email) || ''; }

  function authLogin(email, password) {
    email = (email || '').trim().toLowerCase();
    return sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error || !res.data || !res.data.user) return { ok: false, status: 401, message: 'E-mail ou senha inválidos.' };
      currentEmail = email; currentUid = res.data.user.id; og.set(K_WHO, email);
      syncing = true;
      return hydrate(email).then(function () { syncing = false; return { ok: true, status: 200, user: { name: metaName(res.data.user), email: email } }; })
        .catch(function () { syncing = false; return { ok: true, status: 200, user: { name: email, email: email } }; });
    }).catch(function () { return { ok: false, status: 0 }; });
  }

  function authRegister(name, email, password) {
    name = (name || '').trim(); email = (email || '').trim().toLowerCase();
    return sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } }).then(function (res) {
      if (res.error) {
        var m = res.error.message || '';
        if (/registered|already/i.test(m)) return { ok: false, status: 409, message: 'Este e-mail já possui cadastro.' };
        return { ok: false, status: 400, message: m || 'Não foi possível concluir o cadastro.' };
      }
      if (!res.data.session) { // confirmação de e-mail ligada no Supabase
        return { ok: false, status: 200, message: 'Enviamos um e-mail de confirmação. Confirme para ativar a conta e então entre.' };
      }
      currentEmail = email; currentUid = res.data.user.id; og.set(K_WHO, email);
      syncing = true;
      return hydrate(email).then(function () { syncing = false; return { ok: true, status: 201, user: { name: name, email: email } }; })
        .catch(function () { syncing = false; return { ok: true, status: 201, user: { name: name, email: email } }; });
    }).catch(function () { return { ok: false, status: 0 }; });
  }

  function logout() { try { sb.auth.signOut(); } catch (e) {} currentEmail = null; currentUid = null; prev = {}; pendingNext = null; og.del(K_WHO); }

  window.FNAuth = { login: authLogin, register: authRegister, logout: logout };

  // ---- LOADING SCREEN --------------------------------------------------------
  var FN_LOADER_CSS = '#fn-loading{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;background:var(--bg,#151019);color:var(--text,#e9e4ef);font-family:Manrope,system-ui,sans-serif;opacity:1;transition:opacity .35s ease}#fn-loading.fn-hide{opacity:0;pointer-events:none}#fn-loading .fn-spin{width:46px;height:46px;border-radius:50%;border:4px solid rgba(140,110,200,.25);border-top-color:var(--accent,#8c6ec8);animation:fn-spin .9s linear infinite}#fn-loading .fn-msg{font-size:15px;font-weight:600;opacity:.85}@keyframes fn-spin{to{transform:rotate(360deg)}}';
  function ensureLoaderStyle() { if (!document.getElementById('fn-loading-style')) { var st = document.createElement('style'); st.id = 'fn-loading-style'; st.textContent = FN_LOADER_CSS; (document.head || document.documentElement).appendChild(st); } }
  function showLoader(msg) { try { ensureLoaderStyle(); var el = document.getElementById('fn-loading'); if (!el) { el = document.createElement('div'); el.id = 'fn-loading'; el.innerHTML = '<div class="fn-spin"></div><div class="fn-msg"></div>'; (document.body || document.documentElement).appendChild(el); } el.classList.remove('fn-hide'); el.querySelector('.fn-msg').textContent = msg || 'Carregando…'; } catch (e) {} }
  function hideLoader() { try { var el = document.getElementById('fn-loading'); if (el) { el.classList.add('fn-hide'); setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400); } } catch (e) {} }

  // ---- PATCH de auth do app React -------------------------------------------
  function patchAuth(inst) {
    if (!inst || inst.__fnAuthPatched) return false;
    inst.__fnAuthPatched = true;
    inst.doLogin = function () {
      var self = inst; var email = (self.state.authEmail || '').trim().toLowerCase(); var pass = self.state.authPass || '';
      if (email.indexOf('@') < 0 || !pass) { self.setState({ authError: 'Informe e-mail e senha.' }); return; }
      self.setState({ authError: '', authMsg: '', loading: true }); showLoader('Entrando…');
      authLogin(email, pass).then(function (res) {
        self.setState({ loading: false }); hideLoader();
        if (res && res.ok) { self.enter({ name: res.user.name, email: email, visitor: false }, self.loadDB(email)); return; }
        if (res && res.status === 401) { self.setState({ authError: 'E-mail ou senha inválidos.' }); return; }
        self.setState({ authError: (res && res.message) || 'Sem conexão. Tente novamente.' });
      });
    };
    inst.doCadastro = function () {
      var self = inst; var name = (self.state.authName || '').trim(); var email = (self.state.authEmail || '').trim().toLowerCase(); var pass = self.state.authPass || '';
      if (!name || email.indexOf('@') < 0 || pass.length < 6) { self.setState({ authError: 'Preencha nome, e-mail válido e senha (mín. 6).' }); return; }
      self.setState({ authError: '', authMsg: '', loading: true }); showLoader('Criando sua conta…');
      authRegister(name, email, pass).then(function (res) {
        self.setState({ loading: false }); hideLoader();
        if (res && res.ok) { self.enter({ name: res.user.name, email: email, visitor: false }, self.loadDB(email)); return; }
        if (res && res.status === 409) { self.setState({ authError: 'Este e-mail já possui cadastro.' }); return; }
        if (res && res.message) { self.setState({ authMsg: res.message, authError: '' }); return; }
        self.setState({ authError: 'Não foi possível concluir o cadastro.' });
      });
    };
    if (typeof inst.sair === 'function' && !inst.__fnSairPatched) { var origSair = inst.sair.bind(inst); inst.sair = function () { try { logout(); } catch (e) {} return origSair(); }; inst.__fnSairPatched = true; }
    if (!inst.__fnEnterPatched) {
      inst.__fnEnterPatched = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        try { var st = inst.state || {}; if (st.view !== 'auth') return; var el = e.target; if (!el || el.tagName !== 'INPUT') return; e.preventDefault();
          if (st.authTab === 'cadastro') inst.doCadastro(); else if (st.authTab === 'recuperar' && typeof inst.doRecuperar === 'function') inst.doRecuperar(); else inst.doLogin();
        } catch (err) {}
      }, true);
    }
    try { inst.setState({}); } catch (e) {}
    log('patch de auth aplicado'); return true;
  }
  function findReactRootFiber() { var c = []; ['dc-root', 'root', 'app'].forEach(function (id) { var e = document.getElementById(id); if (e) c.push(e); }); for (var i = 0; i < document.body.children.length; i++) c.push(document.body.children[i]); for (var j = 0; j < c.length; j++) { var el = c[j]; if (!el) continue; var k = Object.keys(el).find(function (kk) { return kk.indexOf('__reactContainer$') === 0; }); if (k) return el[k]; } return null; }
  function isAuthController(o) { return o && typeof o.doLogin === 'function' && typeof o.doCadastro === 'function' && typeof o.setState === 'function' && o.state && ('authEmail' in o.state || 'authTab' in o.state); }
  function findAuthInstance(root) { if (!root) return null; var stack = [root.current || root], seen = 0; while (stack.length && seen < 40000) { var f = stack.pop(); seen++; if (!f) continue; var sn = f.stateNode; if (sn) { if (isAuthController(sn)) return sn; if (sn.logic && isAuthController(sn.logic)) return sn.logic; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); } return null; }
  var patched = false, tries = 0;
  function tryPatch() { if (patched) return true; try { var inst = findAuthInstance(findReactRootFiber()); if (inst) { patched = patchAuth(inst); return patched; } } catch (e) {} return false; }
  var iv = setInterval(function () { tries++; if (tryPatch() || tries > 120) clearInterval(iv); }, 400);
  if (document.readyState !== 'loading') tryPatch(); document.addEventListener('DOMContentLoaded', tryPatch);

  // ---- RESPONSIVO + DRAWER (mobile) — portado do fn-sync v0.9.0 --------------
  var FN_RESP_CSS = [
    'html.fn-mobile [style*="linear-gradient(160deg"][style*="flex: 1.1"]{display:none!important}',
    'html.fn-mobile .auth-wrap{flex-direction:column!important;min-height:auto!important}',
    'html.fn-mobile .app-sidebar{position:fixed!important;top:0!important;left:0!important;height:100vh!important;width:262px!important;max-width:84vw!important;z-index:1000!important;transform:translateX(-100%);transition:transform .28s ease;box-shadow:0 10px 44px rgba(0,0,0,.4)}',
    'html.fn-drawer-open .app-sidebar{transform:translateX(0)!important}',
    'html.fn-mobile .app-sidebar .sb-logo-text,html.fn-mobile .app-sidebar nav button span{display:inline!important}',
    'html.fn-mobile .app-sidebar .sb-toggle{display:none!important}',
    '#fn-drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999;opacity:0;visibility:hidden;transition:opacity .25s}',
    'html.fn-drawer-open #fn-drawer-backdrop{opacity:1;visibility:visible}',
    '#fn-hamb{display:none;position:fixed;top:9px;left:10px;z-index:1001;width:44px;height:44px;border-radius:12px;align-items:center;justify-content:center;background:#7c5cbf;border:none;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.28);cursor:pointer;padding:0}',
    'html.fn-mobile.fn-app #fn-hamb{display:flex}',
    'html.fn-mobile.fn-app .app-header{padding-left:62px!important}',
    // Menu: itens alinhados a esquerda (sobrepoe o center do CSS antigo <=760).
    'html.fn-mobile .app-sidebar nav button{justify-content:flex-start!important;padding:10px 14px!important;gap:12px!important;text-align:left!important}',
    'html.fn-mobile .app-sidebar .sb-logo{justify-content:flex-start!important;padding:6px 10px!important}',
    // Header reorganizado: titulo + toggle na 1a linha, mes/ano centralizado na 2a; user vai pro menu.
    'html.fn-mobile.fn-app .app-header{flex-wrap:wrap!important;row-gap:10px!important;align-items:center!important}',
    'html.fn-mobile .app-header .app-title{order:0!important;flex:1 1 auto!important;min-width:0!important}',
    'html.fn-mobile .app-header .fn-theme{order:1!important}',
    'html.fn-mobile .app-header .fn-month{order:2!important;flex:1 1 100%!important;justify-content:center!important}',
    'html.fn-mobile .app-header .fn-user-block{display:none!important}',
    // Rodape do menu: nome do usuario + Sair.
    '#fn-drawer-user{display:none}',
    'html.fn-mobile .app-sidebar #fn-drawer-user{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding:12px 8px;border-top:1px solid var(--border)}',
    '#fn-drawer-user .fn-du-name{font-weight:700;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#fn-drawer-user .fn-du-sair{background:none;border:1px solid var(--border);border-radius:9px;padding:7px 14px;color:var(--text2);font-weight:700;font-size:12px;cursor:pointer;flex:none}',
    'html.fn-mobile [style*="font-size: 30px"]{font-size:24px!important}',
    'html.fn-mobile [style*="font-size: 26px"]{font-size:22px!important}',
    'html.fn-mobile [style*="font-size: 24px"]{font-size:21px!important}',
    'html.fn-mobile [style*="repeat(3,1fr)"],html.fn-mobile [style*="repeat(3, 1fr)"],html.fn-mobile [style*="repeat(2,1fr)"],html.fn-mobile [style*="repeat(2, 1fr)"],html.fn-mobile [style*="5fr 4fr"],html.fn-mobile [style*="2fr 3fr"],html.fn-mobile [style*="1fr 1fr"]{grid-template-columns:1fr!important}',
    'html.fn-mobile [style*="padding: 64px"],html.fn-mobile [style*="padding: 48px"],html.fn-mobile [style*="padding: 40px"]{padding:18px!important}',
    'html.fn-mobile [style*="max-width: 1240px"]{max-width:100%!important}',
    'html.fn-mobile,html.fn-mobile body{overflow-x:hidden!important;max-width:100vw}',
    'html.fn-mobile table{display:block;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}',
    'html.fn-mobile [role="dialog"]{max-width:96vw!important}',
    'html.fn-tablet [style*="repeat(3,1fr)"],html.fn-tablet [style*="repeat(3, 1fr)"]{grid-template-columns:1fr 1fr!important}'
  ].join('\n');
  var HTML = document.documentElement;
  function openDrawer() { HTML.classList.add('fn-drawer-open'); }
  function closeDrawer() { HTML.classList.remove('fn-drawer-open'); }
  function toggleDrawer() { HTML.classList.toggle('fn-drawer-open'); }
  function ensureDrawerEls() {
    try { if (!document.body) return;
      if (!document.getElementById('fn-drawer-backdrop')) { var bd = document.createElement('div'); bd.id = 'fn-drawer-backdrop'; bd.addEventListener('click', closeDrawer); document.body.appendChild(bd); }
      if (!document.getElementById('fn-hamb')) { var h = document.createElement('button'); h.id = 'fn-hamb'; h.type = 'button'; h.setAttribute('aria-label', 'Abrir menu'); h.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"></path></svg>'; h.addEventListener('click', function (e) { e.stopPropagation(); toggleDrawer(); }); document.body.appendChild(h); }
    } catch (e) {} }
  function syncAppState() { var hasApp = !!document.querySelector('.app-sidebar'); HTML.classList.toggle('fn-app', hasApp); if (!hasApp) closeDrawer(); }

  function themeAccent() { try { var root = document.querySelector('[data-theme]'); if (root) { var a = getComputedStyle(root).getPropertyValue('--accent'); if (a && a.trim()) return a.trim(); } } catch (e) {} return '#7c5cbf'; }
  function applyHambColor() { var h = document.getElementById('fn-hamb'); if (h) { h.style.background = themeAccent(); h.style.color = '#fff'; } }
  function headerSairBtn() { var hdr = document.querySelector('.app-header'); if (!hdr) return null; return [].slice.call(hdr.querySelectorAll('button')).filter(function (b) { return /^sair$/i.test((b.textContent || '').trim()); })[0] || null; }
  function tagHeader() {
    try {
      var header = document.querySelector('.app-header'); if (!header) return;
      var tt = header.querySelector('button[title="Alternar tema"]'); if (tt) tt.classList.add('fn-theme');
      var sair = headerSairBtn();
      if (sair) { var blk = sair; while (blk.parentElement && blk.parentElement !== header) blk = blk.parentElement; if (blk !== header) blk.classList.add('fn-user-block'); }
      [].slice.call(header.children).forEach(function (c) { if (c.classList && (c.classList.contains('app-title') || c.classList.contains('fn-user-block') || c.classList.contains('fn-theme'))) return; if (/\b(19|20)\d{2}\b/.test(c.textContent || '')) c.classList.add('fn-month'); });
    } catch (e) {}
  }
  function drawerUser() {
    try {
      var sidebar = document.querySelector('.app-sidebar'); if (!sidebar) return;
      var sair = headerSairBtn(); var name = '';
      if (sair && sair.parentElement) { var nd = sair.parentElement.querySelector('div'); if (nd) name = (nd.textContent || '').trim(); }
      var f = document.getElementById('fn-drawer-user');
      if (!f) {
        f = document.createElement('div'); f.id = 'fn-drawer-user';
        var nm = document.createElement('div'); nm.className = 'fn-du-name';
        var bt = document.createElement('button'); bt.className = 'fn-du-sair'; bt.type = 'button'; bt.textContent = 'Sair';
        bt.addEventListener('click', function () { closeDrawer(); var sb = headerSairBtn(); if (sb) { sb.click(); } else { try { if (window.FNAuth) window.FNAuth.logout(); } catch (e) {} setTimeout(function () { location.reload(); }, 60); } });
        f.appendChild(nm); f.appendChild(bt); sidebar.appendChild(f);
      }
      var nmEl = f.querySelector('.fn-du-name'); if (nmEl) nmEl.textContent = name || 'Minha conta';
    } catch (e) {}
  }
  document.addEventListener('click', function (e) { var t = e.target; if (t && t.closest && t.closest('.app-sidebar nav button')) setTimeout(closeDrawer, 20); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  function applyResponsive() {
    try { if (!document.getElementById('fn-responsive-style')) { var st = document.createElement('style'); st.id = 'fn-responsive-style'; st.textContent = FN_RESP_CSS; (document.head || document.documentElement).appendChild(st); }
      var w = window.innerWidth; HTML.classList.toggle('fn-mobile', w <= 820); HTML.classList.toggle('fn-tablet', w > 820 && w <= 1100);
      if (w > 820) closeDrawer(); ensureDrawerEls(); syncAppState(); applyHambColor(); tagHeader(); drawerUser();
    } catch (e) {} }
  applyResponsive();
  window.addEventListener('resize', applyResponsive);
  window.addEventListener('orientationchange', applyResponsive);
  document.addEventListener('DOMContentLoaded', function () { ensureDrawerEls(); applyResponsive(); });
  var _sq = false; function queueSync() { if (_sq) return; _sq = true; requestAnimationFrame(function () { _sq = false; ensureDrawerEls(); syncAppState(); applyHambColor(); tagHeader(); drawerUser(); }); }
  try { new MutationObserver(queueSync).observe(HTML, { childList: true, subtree: true }); } catch (e) {}

  window.__FN_SUPABASE_VER = '1.0.1';
  log('carregado v1.0.1, url=', URL);
})();
