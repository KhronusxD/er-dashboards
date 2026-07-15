# Spec pros devs — 2 chamadas de backend (Fase 2 da Atribuição)

> Objetivo: blindar a atribuição contra iPhone/Safari (ITP) e ad blockers.
> O GTM já cobre o grosso; estas 2 chamadas server-side garantem que **todo
> usuário logado/comprador** seja costurado, independente de cookie/JS.
> Esforço estimado: ~1h. Sem dependência nova (é um POST HTTP).

## Endpoint (único, já no ar)

```
POST https://dasbpktslyovikphwmrt.supabase.co/rest/v1/rpc/track
Headers:
  apikey: <ANON_KEY>            (público — mesmo do GTM)
  Content-Profile: napan
  Content-Type: application/json
Body: {"payload": { "token": "<TRACK_TOKEN>", ... }}
```

- `TRACK_TOKEN`: guardar em variável de ambiente do backend (pedir ao Ed).
  No servidor ele fica secreto de verdade (diferente do GTM).
- Resposta: `{"ok": true, ...}`. **Falha do track NUNCA pode quebrar o fluxo**
  do usuário — engolir erro e logar (fire-and-forget, timeout curto ~3s).

## Chamada 1 — `identify` (no LOGIN e no CADASTRO)

Dispara logo após autenticar/criar a conta, no servidor:

```json
{"payload": {
  "token": "<TRACK_TOKEN>",
  "type": "identify",
  "vid": "<valor do cookie nap_vid, se presente no request>",
  "email": "<email da conta>",
  "cnpj": "<cnpj, se tiver>",
  "cpf": "<cpf, se tiver>",
  "nome": "<nome>",
  "telefone": "<telefone>",
  "plataforma_id": "<user_id interno>"
}}
```

- O `vid` vem do cookie `nap_vid` que o GTM cria (ler do header Cookie do
  request). Se não existir, mandar sem `vid` — ainda vale (atualiza cadastro).
- É idempotente: repetir não duplica (upsert por e-mail).

## Chamada 2 — `purchase` (na CONFIRMAÇÃO do pedido, server-side)

Dispara quando o pedido é confirmado/pago, no servidor:

```json
{"payload": {
  "token": "<TRACK_TOKEN>",
  "type": "purchase",
  "vid": "<cookie nap_vid, se presente>",
  "pedido_id": "<id do pedido>",
  "valor": "<total, ex: 148.50>",
  "email": "<email do comprador>",
  "nome": "<nome>",
  "telefone": "<telefone>",
  "plataforma_id": "<user_id interno>",
  "produto": "<nome do 1º item>"
}}
```

- **Idempotente por `pedido_id`** — o GTM também envia esse evento no browser;
  quem chegar primeiro grava, o outro é ignorado. Mandar dos dois lados é o
  desenho correto (o server-side é o garantidor).

## Critério de aceite

1. Compra feita num iPhone/Safari com cookie apagado → pedido aparece em
   `napan.atr_pedidos` mesmo assim (via chamada server-side).
2. Nenhum fluxo de login/checkout falha se o endpoint estiver fora do ar.
3. Token não aparece em código client-side nem em repositório.
