---
title: "14 plugins inclusos: o que cada um faz"
description: "O scaffold vem com 14 plugins prontos. Todos desativados por default. Aqui está o que cada um faz e quando vale a pena ligar."
pubDate: 2026-05-22
category: "Plugins"
author: "Scaffold MSIA"
order: 4
---

O sistema de plugins é o que separa um scaffold de um boilerplate genérico. Cada plugin é um módulo opcional que adiciona uma funcionalidade — SEO, AI, monetização, captação de email, redirects — sem que você precise mexer no código central.

Todos os 14 plugins do scaffold ficam em `/admin/plugins`. Cada um tem sua página de configuração própria. Você liga e desliga conforme precisa.

## Os 14 plugins, agrupados por função

### SEO e schema

**Plugin SEO** — Schema.org de Article, Breadcrumb, Website. Liga por default. Configure organização e logo em `/admin/seo`.

**Google Search Console** — Injeção da meta de verificação no head. Indispensável. Configure em `/admin/search-console`.

**Google Tag (GA4)** — Injeta script do GA4 com seu measurement ID. Configure em `/admin/google-tag`.

**Meta Pixel** — Para quem faz tráfego pago no Meta. Configure em `/admin/meta-pixel`.

### Captação e email

**Email List (Brevo)** — Captura de email com 3 modalidades: popup, inline (no meio do post), sidebar widget. Integração com Brevo. Configure em `/admin/email-list`.

**Cookie Consent (LGPD/GDPR)** — Banner de aceite de cookies. Configure em `/admin/cookie-consent`. Desligado por default — ligue quando entrar GA4 ou Pixel.

### Monetização

**Affiliates** — Sistema de produtos de afiliado com cards completos (foto, descrição, prós/contras, badges, botão Amazon). Configure em `/admin/affiliates`.

**AdSense** — Header injection do AdSense. Configure em `/admin/adsense`.

### Conteúdo e UX

**Related Posts** — Bloco automático no fim de cada post com 3 artigos relacionados. Liga por default.

**Social Share** — Botões de compartilhamento nas plataformas configuradas. Configure em `/admin/social-share`.

**Redirects** — Tabela de redirects 301 sem mexer em código. Útil quando você migra URLs. Configure em `/admin/redirects`.

### Produtividade

**AI Generator** — Gera posts a partir de tópico/keyword usando OpenAI + Pexels (imagens). Pra blogs de volume. Configure em `/admin/ai`.

**WordPress Importer** — Importa posts de XML do WordPress. Útil se você está migrando blog antigo. Configure em `/admin/import-wp`.

### Layout

**Slots Plugins** — Sistema interno que permite plugins injetarem conteúdo em pontos específicos do layout (head, body end, post bottom, etc). Não tem configuração visível — é o esqueleto que os outros plugins usam.

## Em que ordem ativar

A maioria das pessoas erra ativando tudo de uma vez. Não funciona — você sobrecarrega o leitor e dilui o foco do conteúdo.

**Semana 1:** SEO + Google Search Console. Só.

**Semana 2-4:** Google Tag (GA4) + Cookie Consent. Você precisa coletar dados pra saber o que está funcionando.

**Mês 2:** Related Posts (já liga por default) + Social Share. Conteúdo começa a circular.

**Mês 3:** Email List inline OU sidebar (não os dois ao mesmo tempo). Só ligue o popup se você já tem audiência — pra blog novo, popup só afasta.

**Mês 6+:** AdSense ou Affiliates. Monetização vem por último, depois que o blog tem tráfego que justifique.

## O plugin mais polêmico

**AI Generator** divide opiniões. Pode gerar 50 posts por mês com qualidade razoável, com imagens, schema, tudo pronto. Funciona pra blogs de comparação, listicles, glossários, FAQ — formatos que respondem perguntas de busca de cauda longa.

Não funciona pra blogs de autor, ensaio, opinião — onde a voz humana é o produto.

A regra é simples: se o seu diferencial competitivo é o conteúdo único, não use. Se o seu diferencial é cobertura ampla de um nicho específico, use com cuidado e edição humana.

## Como adicionar plugin novo

O sistema de plugins é extensível. Cada plugin vive em `src/plugins/<nome>/` com:

- Configuração admin (`Settings<Nome>.tsx`)
- Componente Astro pra injetar no layout (opcional)
- Registro em `src/data/pluginRegistry.json`

Documentação completa do sistema está em `PLUGIN_SYSTEM.md` na raiz do projeto. Mas pra 95% dos usos, os 14 plugins inclusos já cobrem.
