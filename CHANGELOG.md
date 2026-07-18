# Changelog

## v1.2.1 - 2026-07-18
- corrige o cadastro que "não mostrava nenhuma mensagem": a mensagem de sucesso/pendência (`authMsg`) só era renderizada na aba "Recuperar senha". Nas abas Entrar e Criar conta só existia a caixa de erro. Agora a caixa verde de `authMsg` também aparece na tela principal, então o usuário vê "Solicitação de cadastro enviada ao administrador" ao se cadastrar e "aguardando aprovação" ao tentar logar sem liberação. (A lógica já funcionava — signUp, perfil pendente e signOut; só faltava exibir o retorno.)

## v1.2.0 - 2026-07-18
- controle de acesso e admin: cadastro deixa de ser aberto. Ao se cadastrar, o usuário recebe "Solicitação de cadastro enviada ao administrador" e fica bloqueado até aprovação (login retorna `pending` e faz signOut enquanto não aprovado)
- nova tabela `fn_profiles` (name, email, role, approved, created_at, last_login) + função `fn_is_admin()` (security definer) + trigger `fn_profiles_guard()` que impede não-admins de se auto-aprovarem/promoverem; RLS por usuário e admin. Bootstrap do admin: renanguedesrdg@gmail.com (role=admin, approved=true)
- nova opção de menu "Admin" (só visível para admin): lista solicitações pendentes (Permitir acesso / Recusar) e todos os usuários com nome, e-mail, data de cadastro e último login, com botões "Resetar senha" e "Excluir"
- pop-up ao admin logar quando há solicitações pendentes
- ações privilegiadas (resetar senha real / excluir conta em auth.users) via Supabase Edge Function `admin-actions` (Deno, usa service_role no servidor; valida se o chamador é admin; nunca expõe a service_role no front)
- nova opção de menu "Alterar senha" para o usuário trocar a própria senha
- `fn-supabase.js`: `ensureProfile`, gate de aprovação no login, cadastro como solicitação, `edgeCall` e `window.FNAdmin` (isAdmin/listUsers/pendingCount/approve/resetPassword/deleteUser/changeMyPassword)

## v1.1.0 - 2026-07-18
- planejamento: novo botão "Metas padrão" que cadastra/ajusta as 6 metas recomendadas (Liberdade Financeira 25%, Custos Fixos 30%, Conforto 15%, Metas 15%, Prazeres 10%, Conhecimento 5%) — não apaga categorias personalizadas, só garante essas com o % correto
- planejamento: ao alternar a visualização Percentual <-> Valor, os números agora se convertem acompanhando a renda (ex.: 25% de R$7.900 vira R$1.975 em "Valor"; ao editar o valor e voltar para "%", o percentual é recalculado). Sem perda de precisão ao alternar

## v1.0.2 - 2026-07-18
- corrige o index.html que estava TRUNCADO no fim (o dc-script perdeu o fechamento do bloco `else`, `return vals`, e as tags de fechamento) — causava "Root: Unexpected token ')'" e o app não abria. Fim restaurado a partir da history do GitHub; dc-script com chaves/parênteses equilibrados novamente. (A truncagem veio de uma edição in-place na pasta sincronizada; a anon key e o restante ficaram intactos.)

## v1.0.1 - 2026-07-18
- mobile: botão do menu (☰) passa a usar o roxo da identidade do app (lido do tema, funciona em light/dark) — antes ficava escuro por estar fora do container temático
- mobile: itens do menu alinhados à esquerda (corrige o `justify-content:center` herdado do CSS antigo)
- mobile: header reorganizado — título e o toggle de tema na 1ª linha, seletor de mês/ano centralizado na 2ª; nome do usuário e botão "Sair" movidos para o rodapé do menu (drawer)

## v1.0.0 - 2026-07-18
- migra a camada de dados do app para o **Supabase direto** (supabase-js + Supabase Auth + RLS), aposentando a API Fastify/Vercel: o front passa a ler/gravar direto no banco, com políticas de segurança por usuário
- novo `fn-supabase.js` (substitui o `fn-sync.js`): login/cadastro via Supabase Auth, hydrate e gravação (upsert/delete) por coleção usando os ids do próprio app como PK, conversão reais↔centavos, tela de carregamento e o drawer mobile v0.9.0 portados
- novo `supabase-schema.sql`: 10 tabelas `fn_*` com `user_id uuid default auth.uid()` e RLS + política por usuário
- `index.html`: carrega o supabase-js (CDN) + config (URL do projeto e anon key) e passa a usar `fn-supabase.js?v=1.0.0`

## v0.9.0 - 2026-07-18
- menu lateral vira um DRAWER no celular: fica oculto por padrão e abre por cima ao tocar no botão ☰ (flutuante, canto superior esquerdo), com backdrop escurecido
- o drawer fecha automaticamente ao escolher uma opção do menu, ao tocar fora (backdrop) ou com ESC — liberando a largura inteira da tela para o conteúdo (resolve a sensação de layout "apertado")
- rótulos do menu ficam sempre visíveis no drawer; o botão "Recolher" (desktop) é ocultado no mobile
- ajuste de tamanhos: números grandes do dashboard encolhem em telas pequenas (30→24, 26→22, 24→21px)
- implementado 100% no fn-sync.js (CSS + JS com MutationObserver para detectar login/logout), sem tocar na lógica do app; cache-buster do index.html para ?v=0.9.0

## v0.8.1 - 2026-07-18
- corrige regressão de responsividade no celular: a regra de empilhamento do fn-sync (`min-height:100vh` + `display:flex` → coluna) atingia também o shell do app, fazendo a sidebar (`height:100vh`) ocupar a tela inteira e esconder o conteúdo (só o menu aparecia)
- o empilhamento agora fica restrito à tela de login (`.auth-wrap`); no app o layout permanece em linha e a sidebar vira um trilho compacto de ícones no mobile
- atualiza o cache-buster do fn-sync.js no index.html para ?v=0.8.1

## v0.8.0 - 2026-07-17
- responsividade completa para celular e tablet, sem alterar a identidade visual nem a lógica do app
- tablet (<=900px): os grids de 2 colunas do Dashboard (reserva/fluxo de caixa) e do Planejamento passam a empilhar em 1 coluna
- celular (<=760px): a barra lateral vira um trilho estreito só com ícones (rótulos ocultos), o cabeçalho quebra em duas linhas (título em cima, controles embaixo), o conteúdo ganha espaçamento reduzido e o modal de formulário passa a 1 coluna
- tela de login (<=760px): o painel decorativo é ocultado e o formulário ocupa a largura toda, centralizado
- implementado com media queries + classes dedicadas (app-sidebar, app-header, app-title, app-content, auth-wrap, auth-hero, auth-form, fn-grid-3/11/23/54), sem tocar em fn-sync.js
- atualiza o cache-buster do fn-sync.js no index.html para ?v=0.8.0

## v0.7.3 - 2026-07-16
- corrige a CAUSA-RAIZ da perda de dados: o interceptador de gravação (Storage.setItem) só disparava a sincronização quando NÃO havia outro sync em andamento (`&& !syncing`). Assim, toda gravação feita durante um sync (ex.: criar uma conta e, logo em seguida, uma receita/despesa) era simplesmente descartada — nunca chegava ao banco
- agora o setItem SEMPRE chama o syncDiff, que já enfileira a gravação (pendingNext) quando há sync em andamento e a processa em seguida; combinado com a retentativa da 0.7.2, garante que nada se perca mesmo com ações rápidas e backend lento
- atualiza o cache-buster do fn-sync.js no index.html para ?v=0.7.3

## v0.7.2 - 2026-07-16
- corrige PERDA de itens que dependem de uma entidade recém-criada (ex.: criar uma conta e logo em seguida uma receita/despesa): com o backend lento (cold start), o item filho era "adiado" enquanto o pai ainda sincronizava e nunca era reenviado, se perdendo
- adiciona RETENTATIVA automática: enquanto houver item adiado por dependência pendente, o sync reexecuta sozinho (a cada 1,5s, até 12 vezes) relendo o estado mais recente, garantindo que tudo acabe gravado no banco
- Enter agora envia o formulário de login/cadastro/recuperação (não é mais preciso clicar no botão)
- atualiza o cache-buster do fn-sync.js no index.html para ?v=0.7.2

## v0.7.1 - 2026-07-16
- corrige o bug que impedia QUALQUER despesa de ser salva no banco (HTTP 422): o app grava a despesa nos campos contaId/cartaoId, mas o fn-sync lia um campo "forma" inexistente, enviando o item sem accountId nem creditCardId e violando a regra "exatamente um" do backend
- mapeamento de despesas reescrito nos dois sentidos (contaId/cartaoId <-> accountId/creditCardId), com fallback defensivo para drafts antigos e trazendo vencimento/fixoId no hydrate
- validado ao vivo contra o backend: POST /expenses passou de 422 para 201
- atualiza o cache-buster do fn-sync.js no index.html para ?v=0.7.1

## v0.7.0 - 2026-07-16
- CORRIGE PERDA DE DADOS (bug de persistência): itens que referenciavam uma entidade criada na mesma sessão (ex.: despesa/receita/gasto fixo usando uma categoria recém-criada) eram enviados com um id-cliente inválido e o backend recusava (HTTP 422), fazendo o item aparecer na tela mas nunca ser gravado no banco — sumindo no próximo login
- o fn-sync agora mantém um mapa clientId→backendId e um conjunto de ids conhecidos; a sincronização virou serial e ordenada por dependência (contas/cartões/categorias antes de receitas/despesas/fixos), resolvendo todas as chaves estrangeiras para o id real do backend
- hydrate não-destrutivo: se a carga do backend falhar, os dados locais não são mais sobrescritos por um banco vazio
- limpa o mapa de ids a cada login e coalesce gravações rápidas para evitar corridas
- adiciona tela de carregamento (loading screen) que bloqueia interações durante login/cadastro/validação de sessão/carga inicial dos dados
- logout passa a limpar a sessão (tokens), isolando por completo os fluxos visitante e autenticado (visitante = só LocalStorage; autenticado = só banco)
- responsividade: corrige as classes fn-mobile/fn-tablet, mantém o comportamento nativo de rolagem horizontal das tabelas, colapsa grids de 2/3 colunas no celular e reforça o combate a overflow horizontal, sem alterar a identidade visual
- atualiza o cache-buster do fn-sync.js no index.html para ?v=0.7.0

## v0.6.1 - 2026-07-14
- corrige cache: index.html passa a carregar fn-sync.js?v=0.6.1, forçando o navegador a baixar o sync corrigido (v0.5.1 ficava preso em cache, por isso os dados não persistiam)
- adiciona marcador window.__FN_SYNC_VER para diagnóstico da versão em execução

## v0.6.0 - 2026-07-13
- banco como fonte da verdade: reescreve o mapeamento do fn-sync para casar com os campos reais do app (desc, venc, cat, contaId, forma, fecha, vence)
- converte valores reais<->centavos (x100 ao enviar, /100 ao receber)
- resolve categoria por nome->id do backend; forma "a:"/"k:" -> conta/cartão
- hydrate carrega categorias primeiro e o sync não recria categorias existentes (evita duplicatas)
- corrige DELETE de sincronização (não enviava corpo mas mandava Content-Type, causando 400)
- adiciona indicador de "carregando" no login/cadastro

## v0.5.1 - 2026-07-13
- corrige os botões de entrar/cadastrar que não respondiam ao clique (o patch de auth perdia o contexto do `this`; agora a instância é capturada pelo closure)

## v0.5.0 - 2026-07-13
- aponta o fn-sync para a URL estável da Vercel do backend (finance-nan-a8so.vercel.app), liberando finance.renanguedes.com para servir o app
- prepara a publicação do app no domínio próprio (frontend hospedado na Vercel)

## v0.4.0 - 2026-07-13
- deixa o app responsivo para celular e tablet (o layout se adapta abaixo de 820px de largura)
- adiciona cache-busting do fn-sync.js no index.html (`?v=0.4.0`)
- adiciona versionamento do projeto na raiz (VERSION) e este CHANGELOG

## v0.3.0 - 2026-07-13
- login e cadastro passam a autenticar no backend (JWT), corrigindo o "login inválido após atualizar a página"
- adiciona fallback offline e sincronização de sessão no fn-sync
