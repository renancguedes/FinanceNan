# Changelog

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
