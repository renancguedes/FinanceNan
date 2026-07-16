# Changelog

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
