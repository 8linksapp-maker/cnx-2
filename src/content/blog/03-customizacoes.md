---
title: "10 customizações que transformam o scaffold no seu blog"
description: "Não é sobre código. É sobre os 10 ajustes do admin que mudam mais o resultado final. Faça nessa ordem."
pubDate: 2026-05-23
category: "Conteúdo"
author: "Scaffold MSIA"
order: 3
---

Esta lista é o caminho mais curto entre "scaffold acabado de clonar" e "blog que parece seu". Cada item é feito 100% pelo admin, sem código, em menos de 5 minutos.

A ordem importa — os 3 primeiros mudam a primeira impressão visual; do 4 ao 7 são identidade e SEO; do 8 ao 10 são vantagens que poucos blogs usam mas todos deveriam.

<div class="listicle-item"></div>

### 01. Trocar a cor primária

**Onde:** `/admin/config` → seção Tema → campo *Cor primária*

**Por quê:** controla todos os accents do scaffold. Mesmo deixando as 5 cores de categoria intactas, mudar a primária já reposiciona o tom do blog.

<div class="listicle-item"></div>

### 02. Subir o logo

**Onde:** `/admin/config` → seção Identidade → campo *Logo*

**Por quê:** logo SVG no header substitui o nome em tipografia. Em scaffold sem logo, o nome aparece em Switzer — bom default, mas logo seu é melhor.

<div class="listicle-item"></div>

### 03. Definir o favicon

**Onde:** `/admin/config` → seção Identidade → campo *Favicon*

**Por quê:** aba do navegador, bookmark, ícone em mobile. Detalhe pequeno que sinaliza "blog cuidado". SVG ideal.

<div class="listicle-item"></div>

### 04. Configurar contato e endereço

**Onde:** `/admin/config` → seção Contato

**Por quê:** email aparece no footer, página `/contato`, schema.org de organização (Google Business Profile reconhece). Endereço (mesmo virtual) ajuda SEO local se você atende região.

<div class="listicle-item"></div>

### 05. Conectar redes sociais

**Onde:** `/admin/config` → seção Social

**Por quê:** ícones aparecem no footer. Schema.org `sameAs` aponta as redes pro Google entender que aquele blog é a mesma entidade. Importante pro Knowledge Graph.

<div class="listicle-item"></div>

### 06. Personalizar menu principal

**Onde:** `/admin/menu`

**Por quê:** scaffold vem com menu default que não é o seu. Apague itens irrelevantes, adicione os seus. Use `showCategories: true` em um item pra ele exibir dropdown automático com todas suas categorias.

<div class="listicle-item"></div>

### 07. Criar/editar categorias

**Onde:** `/admin/categories`

**Por quê:** scaffold vem com 5 categorias didáticas (Comece aqui, Configuração, etc). Cada uma tem cor própria. Você pode renomear ou criar suas — só lembre que `src/lib/categoryColors.ts` precisa ser editado pra mapear nova categoria → cor.

<div class="listicle-item"></div>

### 08. Configurar SEO básico

**Onde:** `/admin/seo`

**Por quê:** plugin SEO está enabled por default. Mas você precisa preencher: nome da organização, logo da empresa (separado do logo do site), e `sameAs` (redes sociais e perfis externos relevantes).

<div class="listicle-item"></div>

### 09. Validar no Search Console

**Onde:** `/admin/search-console`

**Por quê:** coloque a tag de verificação (`<meta name="google-site-verification">`) ou cole o HTML inteiro que o Google forneceu. Scaffold injeta automaticamente no head. Depois disso, em 24-48h o Google começa a indexar.

<div class="listicle-item"></div>

### 10. Configurar a página /sobre

**Onde:** `/admin/sobre`

**Por quê:** página estática mais importante depois da home. É onde leitores decidem se confiam em você. Use a primeira pessoa, conte história real, mostre rosto se for blog pessoal. Não use copy genérico de "missão e valores".

---

Não tem mais. Estes 10 são o suficiente pra deixar o scaffold com cara de blog real. Tudo o que vem depois — plugins, integrações, automações — é otimização. Mas otimização sem base bem-configurada é tempo perdido.
