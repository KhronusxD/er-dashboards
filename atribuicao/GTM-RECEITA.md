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

**Acionador:** All Pages (a própria tag decide se envia — só envia quando a
URL tem `utm_*`/`fbclid`/`gclid`, ou seja, só no pageview de chegada de campanha).

```html
<script>
(function () {
  function getCookie(n){var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');return m?m.pop():''}
  function uuid(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var s=[],h='0123456789abcdef';for(var i=0;i<36;i++)s[i]=h[Math.floor(Math.random()*16)];
    s[14]='4';s[19]=h[(parseInt(s[19],16)&3)|8];s[8]=s[13]=s[18]=s[23]='-';return s.join('');
  }
  // 1) garante o vid (fio condutor) — renova a validade a cada visita
  var vid = getCookie('nap_vid') || uuid();
  var d = new Date(); d.setTime(d.getTime() + 365*24*60*60*1000);
  document.cookie = 'nap_vid=' + vid + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax; Secure';

  // 2) só registra TOQUE quando chegou por campanha
  var p = new URLSearchParams(window.location.search);
  var temCampanha = p.get('utm_source') || p.get('fbclid') || p.get('gclid');
  if (!temCampanha) return;

  var payload = {
    token: '{{ATRIB · token}}',
    type: 'touch',
    vid: vid,
    source: p.get('utm_source') || (p.get('gclid') ? 'google' : 'facebook'),
    medium: p.get('utm_medium'),
    campaign: p.get('utm_campaign'),
    content: p.get('utm_content'),
    term: p.get('utm_term'),
    fbclid: p.get('fbclid'),
    gclid: p.get('gclid'),
    landing: location.href.split('#')[0].substring(0, 500),
    referrer: (document.referrer || '').substring(0, 300),
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

## 4. Tag 2 — "ATRIB · purchase" (Custom HTML)

**Acionador:** a página/evento de pedido confirmado. Duas opções — usar a que
casar com o site:
- **Opção A (evento do dataLayer):** acionador *Evento personalizado* =
  `purchase` (se o site já dá `dataLayer.push({event:'purchase', ...})` — comum
  quando há GA4 e-commerce). **Preferível.**
- **Opção B (URL):** acionador *Page View* com filtro
  `Page Path contém /pedido-confirmado` (⚠️ PREENCHER a URL real).

Antes, criar **variáveis de dataLayer** (tipo *Variável de camada de dados*):

| Variável GTM | Nome no dataLayer (⚠️ PREENCHER com os reais) |
|---|---|
| `DL · pedido_id` | ex.: `ecommerce.transaction_id` |
| `DL · valor` | ex.: `ecommerce.value` |
| `DL · email` | ex.: `customer.email` |
| `DL · cnpj` (se houver) | ex.: `customer.cnpj` |
| `DL · produto` (opcional) | ex.: `ecommerce.items.0.item_name` |

```html
<script>
(function () {
  function getCookie(n){var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');return m?m.pop():''}
  var payload = {
    token: '{{ATRIB · token}}',
    type: 'purchase',
    vid: getCookie('nap_vid') || null,
    pedido_id: String({{DL · pedido_id}} || ''),
    valor: String({{DL · valor}} || ''),
    email: {{DL · email}} || '',
    cnpj: {{DL · cnpj}} || null,
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

## 5. O que precisamos do site (só olhar, não codar)

Abrir o **GTM Preview** numa compra de teste (ou pegar com os devs o snippet
documentado) e anotar:
1. O **nome do evento** que dispara na confirmação (ex.: `purchase`).
2. Os **caminhos exatos** no dataLayer de: id do pedido, valor, e-mail (e CNPJ
   se existir).
3. *(Bônus p/ Fase 2 light)*: existe push no **login/cadastro** com o e-mail?
   Se sim, dá pra fazer o `identify` via GTM também (mesma tag, `type:'identify'`).

## 6. Tag 3 (opcional) — "ATRIB · identify" via GTM

Se o dataLayer expõe o e-mail no login/cadastro (§5.3), duplicar a Tag 2
trocando o payload por `{ type:'identify', vid, email, cnpj?, nome? }` com o
acionador do evento de login. Isso adianta a costura sem backend. A versão
**backend** (Fase 2) continua recomendada por ser imune a bloqueio.

## 7. Teste de aceitação (antes de publicar o contêiner)

1. Abrir o site com `?utm_source=teste&utm_term=AD-TESTE&utm_campaign=receita`
   → conferir na tabela `atr_toques` (dashboard/SQL) que o toque entrou.
2. Fazer um pedido de teste → conferir `atr_pedidos` com `primeiro_toque.term = 'AD-TESTE'`.
3. Recarregar a página de confirmação → conferir que **não** duplicou.
4. Publicar o contêiner.

---

*Depois do GTM no ar: Fase 2 = chamadas de backend (identify/purchase) p/
blindar iPhone + sGTM em subdomínio; e a aba "Atribuição" no dashboard.*
