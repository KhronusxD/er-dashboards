# Receita GTM — Atribuição Criativo → Cliente (Fase 1)

> Pré-requisito: Fase 0 aplicada (`fase0.sql`) — ✅ feita em 15/07/2026.
> Este guia monta a captura no Google Tag Manager. Nenhum código no site.
>
> **Falta preencher:** os nomes das variáveis do dataLayer da página de
> "pedido confirmado" (marcados com `⚠️ PREENCHER`). Ver §5.

---

## 1. Constantes (Variáveis GTM → tipo "Constante")

| Nome da variável | Valor |
|---|---|
| `ATRIB · url` | `https://dasbpktslyovikphwmrt.supabase.co/rest/v1/rpc/track` |
| `ATRIB · anon` | `sb_publishable_Y2J3_HkrtokpW8wI4GfB5Q__CsnAAWd` |
| `ATRIB · token` | *(o TRACK_TOKEN — pegar com o Ed/Claude, não commitar aqui)* |

> Nota honesta: token no navegador é visível pra quem inspecionar (como
> qualquer pixel). Ele barra lixo/robô casual, não atacante dedicado. A
> blindagem forte vem na Fase 2 (backend + sGTM).

## 2. Variável de cookie

- **`ATRIB · vid`** → tipo *Cookie primário*, nome do cookie: `nap_vid`

## 3. Tag 1 — "ATRIB · vid + touch" (Custom HTML)

**Acionador:** All Pages. A tag decide o que envia:
- chegada por **campanha** (`utm`/`fbclid`/`gclid`) → toque `ad_click` (sempre);
- chegada **orgânica/direta** → 1 toque por sessão (`referral`/`direct`) — são
  as "pistas" de onde vêm os clientes sem anúncio (Google orgânico, Instagram
  bio, ChatGPT, direto...). Não levam crédito de atribuição paga (o servidor
  só considera `ad_click` no 1º/último toque do pedido).

**v3 (15/07):** + decodificação de UTMs com duplo-encoding (`%5B`→`[`, `+`→espaço)
e captura de orgânico/direto.
**v5 (19/08):** ⚠️ **para de gravar `direct`** — tráfego direto/interno era ~60%
do volume (226k toques em 5 semanas → estourava o painel e inchava o Supabase) e
não tem valor de atribuição. Mantém `ad_click` + `referral` externo. O cookie
`nap_vid` continua sendo plantado em toda página (só o POST do toque é filtrado).

```html
<script>
(function () {
  // v4: fora do www NÃO entra na atribuição — vira evento de MONITOR de revendas
  // (confirma se campanhas NOSSAS estão levando tráfego/compra pras lojas white-label)
  var MONITOR = location.hostname !== 'www.atualcard.com.br';
  function getCookie(n){var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');return m?m.pop():''}
  function uuid(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var s=[],h='0123456789abcdef';for(var i=0;i<36;i++)s[i]=h[Math.floor(Math.random()*16)];
    s[14]='4';s[19]=h[(parseInt(s[19],16)&3)|8];s[8]=s[13]=s[18]=s[23]='-';return s.join('');
  }
  // conserta UTM com duplo-encoding (plataformas às vezes mandam %5B, '+', etc.)
  function deco(v){ if(!v) return v; try { v = v.replace(/\+/g,' '); return v.indexOf('%') > -1 ? decodeURIComponent(v) : v; } catch(e){ return v; } }

  // 1) garante o vid (fio condutor)
  var vid = getCookie('nap_vid') || uuid();
  var d = new Date(); d.setTime(d.getTime() + 365*24*60*60*1000);
  document.cookie = 'nap_vid=' + vid + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax; Secure';

  // 2) decide o tipo do toque
  var p = new URLSearchParams(window.location.search);
  var temCampanha = p.get('utm_source') || p.get('fbclid') || p.get('gclid');

  if (MONITOR) {
    if (!temCampanha) return;   // na revenda só interessa chegada de CAMPANHA
    var pm = {
      token: '{{ATRIB · token}}', type: 'monitor', evento: 'touch',
      host: location.hostname, vid_local: vid,
      source: deco(p.get('utm_source')) || (p.get('gclid') ? 'google' : (p.get('fbclid') ? 'facebook' : null)),
      medium: deco(p.get('utm_medium')), campaign: deco(p.get('utm_campaign')),
      content: deco(p.get('utm_content')), term: deco(p.get('utm_term')),
      campaign_id: p.get('camp_id'), adset_id: p.get('adset_id'), ad_id: p.get('ad_id'),
      fbclid: p.get('fbclid'), gclid: p.get('gclid'),
      landing: location.href.split('#')[0].substring(0, 500),
      referrer: (document.referrer || '').substring(0, 300),
      device: /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    };
    try { fetch('{{ATRIB · url}}', { method: 'POST', headers: { 'apikey': '{{ATRIB · anon}}', 'Content-Profile': 'napan', 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: pm }), keepalive: true }); } catch (e) {}
    return;
  }

  var jaNaSessao = false; try { jaNaSessao = sessionStorage.getItem('nap_t') === '1'; } catch(e) {}
  var ref = document.referrer || '';
  var refExterno = ref !== '' && ref.indexOf('atualcard.com.br') === -1;
  // v5 (19/08): NÃO gravar toque 'direct'. Tráfego direto/interno era ~60% do
  // volume e não tem valor de atribuição (o servidor só credita 'ad_click').
  // O cookie nap_vid já foi plantado acima pra TODOS; aqui só decidimos o POST.
  // Mantém: ad_click (sempre) + referral externo (1x/sessão, pista de origem).
  if (!temCampanha) {
    if (!refExterno) return;              // direto/interno → não grava (corta o ruído)
    if (jaNaSessao) return;               // referral → só o 1º pageview da sessão
  }
  try { sessionStorage.setItem('nap_t', '1'); } catch(e) {}
  var tipo = temCampanha ? 'ad_click' : 'referral';
  var refHost = ''; try { refHost = ref ? new URL(ref).hostname.replace(/^www\./,'') : ''; } catch(e) {}

  var payload = {
    token: '{{ATRIB · token}}',
    type: 'touch',
    vid: vid,
    tipo: tipo,
    source: deco(p.get('utm_source')) || (p.get('gclid') ? 'google' : (p.get('fbclid') ? 'facebook' : (refHost || null))),
    medium: deco(p.get('utm_medium')) || (temCampanha ? null : (refExterno ? 'referral' : 'direct')),
    campaign: deco(p.get('utm_campaign')),
    content: deco(p.get('utm_content')),
    term: deco(p.get('utm_term')),
    campaign_id: p.get('camp_id'),
    adset_id: p.get('adset_id'),
    ad_id: p.get('ad_id'),
    fbclid: p.get('fbclid'),
    gclid: p.get('gclid'),
    landing: location.href.split('#')[0].substring(0, 500),
    referrer: ref.substring(0, 300),
    device: /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    ua: navigator.userAgent.substring(0, 200)
  };
  try {
    fetch('{{ATRIB · url}}', {
      method: 'POST',
      headers: { 'apikey': '{{ATRIB · anon}}', 'Content-Profile': 'napan', 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payload }),
      keepalive: true
    });
  } catch (e) {}
})();
</script>
```

## 4. Tag 2 — "ATRIB · purchase" (Custom HTML) — ✅ FINAL (dataLayer real, 15/07/2026)

**Acionador:** *Evento personalizado* → nome do evento: **`purchase`**
(confirmado no dataLayer real do e-commerce). **JÁ EXISTE no contêiner**
(acionador nº 10, "purchase") — reusar, não criar outro.

**Variáveis de dataLayer** (tipo *Variável de camada de dados*, versão 2) —
nomes CONFIRMADOS no dump real:

| Variável GTM | Nome no dataLayer |
|---|---|
| `DL · pedido_id` | `ecommerce.purchase.transaction_id` |
| `DL · valor` | `ecommerce.purchase.value` |
| `DL · email` | `user_data.email` |
| `DL · telefone` | `user_data.phone_number` |
| `DL · nome` | `user_data.address.first_name` |
| `DL · sobrenome` | `user_data.address.last_name` |
| `DL · produto` | `ecommerce.purchase.items.0.item_name` |
| `DL · user_id` | `user_id` |

> O `user_id` da plataforma vira `plataforma_id` no banco — identidade mais
> estável que e-mail. O `user_data` presente na compra faz a compra
> **identificar sozinha** (não precisa de tag de login pra quem converte).

Código FINAL da tag (colar como está):

```html
<script>
(function () {
  // v4: compra em REVENDA vira evento de MONITOR (sem dados pessoais do cliente da revenda)
  var MONITOR = location.hostname !== 'www.atualcard.com.br';
  function getCookie(n){var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');return m?m.pop():''}
  if (MONITOR) {
    var pm = {
      token: '{{ATRIB · token}}', type: 'monitor', evento: 'purchase',
      host: location.hostname, vid_local: getCookie('nap_vid') || null,
      pedido_id: String({{DL · pedido_id}} || ''), valor: String({{DL · valor}} || ''),
      landing: location.href.split('#')[0].substring(0, 300),
      referrer: (document.referrer || '').substring(0, 300),
      device: /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    };
    if (!pm.pedido_id) return;
    try { fetch('{{ATRIB · url}}', { method: 'POST', headers: { 'apikey': '{{ATRIB · anon}}', 'Content-Profile': 'napan', 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: pm }), keepalive: true }); } catch (e) {}
    return;
  }
  var nome = [{{DL · nome}}, {{DL · sobrenome}}].filter(Boolean).join(' ');
  var payload = {
    token: '{{ATRIB · token}}',
    type: 'purchase',
    vid: getCookie('nap_vid') || null,
    pedido_id: String({{DL · pedido_id}} || ''),
    valor: String({{DL · valor}} || ''),
    email: {{DL · email}} || '',
    nome: nome || null,
    telefone: {{DL · telefone}} || null,
    plataforma_id: String({{DL · user_id}} || '') || null,
    produto: {{DL · produto}} || null
  };
  if (!payload.pedido_id) return; // sem pedido, não envia
  try {
    fetch('{{ATRIB · url}}', {
      method: 'POST',
      headers: { 'apikey': '{{ATRIB · anon}}', 'Content-Profile': 'napan', 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payload }),
      keepalive: true
    });
  } catch (e) {}
})();
</script>
```

> O endpoint é **idempotente por pedido_id** — se a pessoa recarregar a página
> de confirmação, não duplica.

## 4b. Template de URL nos anúncios (Meta) — nome p/ humanos + ID p/ máquina

Usar nos **Parâmetros de URL** do anúncio (nível ad, campo "URL parameters"):

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&camp_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

Por quê (decisão 15/07 — IDs-first):
- **Só IDs pra rastreio.** Macros de NOME congelam na criação (renomear/clonar
  deixa valor velho e ENGANOSO). ID é imutável — nunca quebra.
- **Nomes legíveis vêm do dicionário**: o sync de gasto traz `ad_id → nome
  atual` diariamente; o dashboard traduz sozinho, sempre fresco.
- `utm_campaign={{campaign.name}}` é a única exceção — mantido só pra
  legibilidade do GA4 (campanha raramente é renomeada; se for, é cosmético,
  os IDs carregam a verdade).
- **Anúncios ativos que performam: NÃO editar** (volta pra revisão / mexe no
  aprendizado). Aplicar em anúncios novos; pros antigos o casamento por nome
  (`{{ad.name}}` no template anterior) segue funcionando.
- **Não usamos `utm_id`** de propósito: o GA4 reserva esse parâmetro pra ID de
  campanha — usar pra ad quebraria o GA de vocês. `camp_id`/`adset_id`/`ad_id`
  são ignorados pelo GA.
- Google Ads: ver §4c (template no nível da CONTA, resolve todas as campanhas de uma vez).

## 4c. Template de URL no Google Ads (nível da conta)

Diagnóstico (15/07): toques do Google chegam com `gclid` mas sem `term`/IDs —
as campanhas não têm template consistente. Corrigir UMA vez no nível da conta:

**Google Ads → Administrador/Configurações da conta → Sufixo do URL final:**

```
utm_source=google&utm_medium=paid&utm_campaign={campaignid}&camp_id={campaignid}&adset_id={adgroupid}&ad_id={creative}&utm_term={keyword}
```

- `{creative}` = ID do anúncio no Google → cai na MESMA coluna `ad_id` que o
  Meta usa. `{keyword}` = termo de busca comprado → `utm_term`.
- ValueTrack não expõe NOMES (só IDs) — os nomes a gente resolve depois via
  API na hora do relatório (IDs são estáveis; nomes mudam).
- Vale pra toda a conta; campanhas com template próprio (mais específico)
  continuam prevalecendo.

## 5. O que precisamos do site (só olhar, não codar)

Abrir o **GTM Preview** numa compra de teste (ou pegar com os devs o snippet
documentado) e anotar:
1. O **nome do evento** que dispara na confirmação (ex.: `purchase`).
2. Os **caminhos exatos** no dataLayer de: id do pedido, valor, e-mail (e CNPJ
   se existir).
3. *(Bônus p/ Fase 2 light)*: existe push no **login/cadastro** com o e-mail?
   Se sim, dá pra fazer o `identify` via GTM também (mesma tag, `type:'identify'`).

## 6. Tag 3 — "ATRIB · identify" (Custom HTML) — DESTRAVA O META

**Por quê:** o clique do Meta (83% mobile/in-app) quase nunca compartilha cookie
com a compra → 0% de atribuição. A solução é **identidade determinística**, e o
dataLayer real do AtualCard (confirmado 21/07) dá DUAS portas:

- **Login "fresco"** (passa pela tela de login) → dispara o evento `login` com
  `user_data.email` **+** `user_id`. Costura por e-mail.
- **Já logado** (sessão salva, só entra) → o dataLayer **não** traz e-mail, só
  `userId` (número, camelCase). Costura por `user_id`.

O 2º caso é o mais valioso pro Meta (quem volta logado pra comprar). E funciona
de imediato: **os 1154 clientes já têm `plataforma_id` gravado** (vem da compra),
então casar o cookie novo pelo `user_id` acha o cliente na hora.

> **Banco:** a função `track` foi ampliada (21/07) — `identify` agora aceita
> **e-mail OU `plataforma_id`**. Sem e-mail, ela vincula o vid ao cliente que já
> tiver aquele `plataforma_id`; se ainda não conhecer esse usuário, responde
> `pendente:true` (não cria cliente vazio). ✅ aplicado em produção.

**Acionadores (os DOIS na mesma tag):**
1. **Evento personalizado** `login` — pega o login fresco (e-mail).
2. **DOM disponível** (*DOM Ready*) → Todas as páginas — pega o já-logado (userId
   em toda página). A tag só dispara de verdade **1x por sessão** (dedup via
   sessionStorage), então os dois juntos não geram flood.

**Variáveis de dataLayer** (tipo *Variável da camada de dados*, versão 2):

| Variável GTM | Nome no dataLayer | Observação |
|---|---|---|
| `DL · email` | `user_data.email` | JÁ EXISTE (da Tag de compra). Reusar. |
| `DL · user_id` | `user_id` | JÁ EXISTE. Presente no evento `login`. |
| `DL · userId` | `userId` | **CRIAR** — é o do usuário já-logado (camelCase). |

```html
<script>
(function () {
  if (location.hostname !== 'www.atualcard.com.br') return;
  function getCookie(n){var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');return m?m.pop():''}
  var email = ({{DL · email}} || '').toString().trim().toLowerCase();
  if (email.indexOf('@') === -1) email = '';                 // sem e-mail válido → ignora e-mail
  var uid = ({{DL · user_id}} || {{DL · userId}} || '').toString().trim();  // login OU já-logado
  if (!email && !uid) return;                                // nada pra identificar
  var vid = getCookie('nap_vid'); if (!vid) return;          // precisa do cookie do visitante
  var chave = email || ('uid:' + uid);
  // dispara no máx. 1x por sessão por identidade (evita flood do DOM Ready)
  try { if (sessionStorage.getItem('nap_id') === chave) return; sessionStorage.setItem('nap_id', chave); } catch (e) {}
  var payload = {
    token: '{{ATRIB · token}}', type: 'identify', vid: vid,
    email: email || null,
    plataforma_id: uid || null
  };
  try {
    fetch('{{ATRIB · url}}', {
      method: 'POST',
      headers: { 'apikey': '{{ATRIB · anon}}', 'Content-Profile': 'napan', 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payload }), keepalive: true
    });
  } catch (e) {}
})();
</script>
```

> ⚠️ As **três** variáveis (`DL · email`, `DL · user_id`, `DL · userId`) precisam
> existir no contêiner, senão o GTM deixa o literal `{{...}}` no código e quebra a
> tag. As duas primeiras já existem; crie só `DL · userId`.

## 6b. Caminhos confirmados no dataLayer real (21/07)

- **Login fresco** (evento `login`): `user_data.email` = e-mail, `user_id` = ID.
- **Já logado** (qualquer página): só `userId` (número). Sem e-mail.
- **Compra** (evento `purchase`): `user_data.email` + `user_id` (a compra já
  identifica sozinha — ver §3/§5).

Nada a adivinhar aqui; só criar a variável `DL · userId` e publicar.

## 7. Teste de aceitação (antes de publicar o contêiner)

1. Abrir o site com `?utm_source=teste&utm_term=AD-TESTE&utm_campaign=receita`
   → conferir na tabela `atr_toques` (dashboard/SQL) que o toque entrou.
2. Fazer um pedido de teste → conferir `atr_pedidos` com `primeiro_toque.term = 'AD-TESTE'`.
3. Recarregar a página de confirmação → conferir que **não** duplicou.
4. Publicar o contêiner.

---

*Depois do GTM no ar: Fase 2 = chamadas de backend (identify/purchase) p/
blindar iPhone + sGTM em subdomínio; e a aba "Atribuição" no dashboard.*
