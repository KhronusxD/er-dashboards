# Plano do Projeto — Atribuição Criativo → Cliente (mini-CDP)

> **Objetivo:** saber, com nome e sobrenome, **qual criativo trouxe cada cliente** —
> o primeiro toque, o último toque, o caminho completo e o tempo até a compra —
> e transformar isso em CAC/ROAS real por criativo dentro do dashboard.
>
> **Status:** planejamento (pré-implementação). Nada ainda no ar.
> **Escopo:** e-commerce web (checkout no site). WhatsApp fora do escopo.
> **Chave de cliente:** e-mail (primária) + CNPJ/CPF (secundária).
> **Onde vive:** Supabase do nucly (`dasbpktslyovikphwmrt`), schema `napan` — mesmo do dashboard.

---

## 1. Por que não dá pra usar só o painel do Meta/Google

Meta e Google entregam atribuição **agregada e modelada** ("esse anúncio trouxe ~12 compras"),
nunca o cliente nominal. Por privacidade (iOS/LGPD) e por design. Para saber o cliente
**exato**, o dado precisa ser **nosso**: capturamos a "digital" do clique no nosso site e
**colamos no nosso pedido**. É atribuição *first-party*.

---

## 2. Visão geral da arquitetura

```
[Anúncio c/ UTM+click-id]
        │ clique
        ▼
[Site] ──(1) toque anônimo──▶ endpoint /track ──▶ Supabase (napan)
   │        (GTM, todo pageview c/ utm)                 · atr_toques
   │
   │  cliente navega, volta por outros anúncios (mais toques)
   │
   ├──(2) cadastro/login ─────▶ /track (identify) ────▶ · atr_clientes + atr_identidades
   │        (vid ↔ e-mail/CNPJ)                          (costura tudo do vid ao cliente)
   │
   └──(3) compra ─────────────▶ /track (purchase) ────▶ · atr_pedidos
            (pedido + valor + cliente)                   (grava 1º e último toque)
                                                                 │
                                                                 ▼
                                                   [Dashboard napan-trafego]
                                                   aba "Atribuição / Criativos"
```

Três eventos, um endpoint (`/track`), um banco. O relatório lê do banco.

---

## 3. O conceito central: `vid` (fio condutor) + costura na identidade

- **`vid`** = identificador anônimo do visitante (sem dado pessoal), criado no 1º acesso.
- Cada **toque de campanha** (chegou com `utm`/`fbclid`/`gclid`) vira **uma linha** em `atr_toques`,
  enviada **na hora** para o backend — não depende do cookie sobreviver muito tempo.
- No **cadastro/login e na compra**, amarramos `vid → cliente` (e-mail/CNPJ). A partir daí,
  **todos os toques daquele `vid` pertencem ao cliente**.

Como no e-commerce **o cadastro é obrigatório antes de comprar**, todo **conversor** é
identificado de forma **determinística** — independente de cookie. Esse é o trunfo que
resolve o iPhone (ver §6).

---

## 4. Modelo de dados (schema `napan`) — esboço

> DDL ilustrativa; tipos/índices finais no momento do build. Padrão napan: sem RLS, servido via API.

```sql
-- Visitante anônimo (o "fio")
CREATE TABLE napan.atr_visitantes (
  vid            uuid PRIMARY KEY,
  primeiro_visto timestamptz NOT NULL DEFAULT now(),
  primeira_lp    text,
  primeiro_ref   text,
  ua             text
);

-- Todo toque (append-only) — ISTO é o "caminho"
CREATE TABLE napan.atr_toques (
  id           bigserial PRIMARY KEY,
  vid          uuid NOT NULL,
  ocorrido_em  timestamptz NOT NULL DEFAULT now(),
  tipo         text,                 -- ad_click / organic / direct / referral
  source       text,                 -- utm_source (facebook, google...)
  medium       text,                 -- utm_medium (paid...)
  campaign     text,                 -- utm_campaign
  content      text,                 -- utm_content  → conjunto/anúncio
  term         text,                 -- utm_term     → CRIATIVO (nome do ad)
  fbclid       text,
  gclid        text,
  landing_url  text,
  referrer     text,
  device       text
);
CREATE INDEX ON napan.atr_toques (vid, ocorrido_em);

-- Cliente (identidade determinística)
CREATE TABLE napan.atr_clientes (
  cliente_id     bigserial PRIMARY KEY,
  email          text UNIQUE,        -- chave primária de identidade
  cnpj           text,
  cpf            text,
  nome           text,
  primeiro_visto timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- Costura vid ↔ cliente (vários vids podem virar o mesmo cliente: multi-device, cookie resetado)
CREATE TABLE napan.atr_identidades (
  vid          uuid PRIMARY KEY,
  cliente_id   bigint NOT NULL REFERENCES napan.atr_clientes(cliente_id),
  vinculado_em timestamptz NOT NULL DEFAULT now()
);

-- Pedido, com 1º e último toque "congelados" na hora da compra (relatório rápido e estável)
CREATE TABLE napan.atr_pedidos (
  pedido_id      text PRIMARY KEY,   -- idempotente: mesmo pedido não duplica
  cliente_id     bigint REFERENCES napan.atr_clientes(cliente_id),
  valor          numeric,
  produto        text,
  ocorrido_em    timestamptz NOT NULL DEFAULT now(),
  vid_no_pedido  uuid,
  primeiro_toque jsonb,              -- snapshot {source,campaign,content,term,ocorrido_em}
  ultimo_toque   jsonb
);
```

**Por que "congelar" 1º/último toque no pedido:** o caminho completo fica em `atr_toques`
(sempre consultável), mas gravar o snapshot no pedido deixa o relatório rápido e imune a
mudanças posteriores.

---

## 5. Os três eventos do endpoint `/track`

| Evento | Quando dispara | Payload (essencial) | O que faz no banco |
|---|---|---|---|
| `touch` | Todo pageview com `utm`/click-id | `vid, ts, source, medium, campaign, content, term, fbclid, gclid, landing, referrer` | upsert `atr_visitantes` + insert `atr_toques` |
| `identify` | Cadastro **e** login | `vid, email, cnpj?, cpf?, nome?` | upsert `atr_clientes` (por e-mail) + link `atr_identidades` |
| `purchase` | Página de "pedido confirmado" | `vid, pedido_id, valor, produto, email/cnpj, ts` | garante cliente → calcula 1º/último toque → insert `atr_pedidos` |

**`/track`** = função (Supabase Edge Function) que valida um token leve + origem, é
**idempotente** por `pedido_id`, e aceita chamadas tanto do **GTM (navegador)** quanto do
**backend (servidor)**.

---

## 6. Blindagem contra bloqueio de navegador (iPhone/Safari, ad blocker)

O problema: Safari/ITP corta cookie feito por JavaScript para **~7 dias**. Cookie sozinho no
navegador **perde iPhone**. Solução em camadas (da mais forte pra mais leve):

1. **Captura no backend no login/compra (determinística).** Como o cadastro é obrigatório,
   o servidor — que já tem e-mail/CNPJ — manda `identify` e `purchase` para o `/track`.
   Imune a cookie e ad blocker. **É o que garante o iPhone.**
2. **Coleta first-party no nosso domínio** — um subdomínio (ex.: `t.atualcard.com.br`) com
   **server-side GTM**. Ad blocker/ITP não bloqueiam porque não é "tracker de terceiro".
   Config de infra, uma vez. *(Fase 2 — blindagem total.)*
3. **Cookie do `vid` setado pelo servidor** (não por JS) → vida mais longa que os 7 dias.

**Consequência honesta:** o cookie curto do Safari só prejudica **não-conversores** e
**toques muito antigos antes de qualquer login**. Quem **compra** loga → é medido.

---

## 7. Primeiro toque, último toque e caminho — como cada cenário é resolvido

| Cenário | Resolve? | Como |
|---|---|---|
| Clica hoje, compra em 7 dias | ✅ | toque no dia 0 fica em `atr_toques`; compra liga pelo `vid` |
| Compra em 27 dias, clicando **outro** anúncio no meio | ✅ | **todos** os toques ficam; relatório mostra 1º, último e o caminho; tempo = 27d |
| Ver o caminho completo | ✅ | `atr_toques` ordenado por `ocorrido_em` **é** o caminho |
| Tempo médio até a compra | ✅ | `compra − primeiro_toque`, geral e por criativo |
| Cliente recorrente / LTV por criativo | ✅ | vários `atr_pedidos` no mesmo `cliente_id` |
| Introdutor vs fechador | ✅ | participação do criativo como **1º toque** (trouxe) vs **último** (fechou) |

---

## 8. Camada de captura — o que é GTM e o que toca o site

**100% no GTM (dev-free):**
- Gerar/ler o `vid`.
- Disparar `touch` em todo pageview com `utm`/click-id.
- Disparar `purchase` na página de sucesso (se ela expor os dados do pedido).
- De brinde: Pixel/CAPI (Meta) e Enhanced Conversions (Google) melhor alimentados.

**Mínimo que depende do site (uma vez):**
1. **GTM instalado** no e-commerce (snippet no `<head>`). — *a confirmar*
2. **Página de "pedido confirmado" expor pedido + e-mail** (id, valor, e-mail) para o GTM ler.
   Se já mostra na tela → zero dev. Se não → devs adicionam ~5 linhas de `dataLayer.push`.
3. **(Blindagem iPhone, recomendado)** backend dispara `identify` no cadastro/login e
   `purchase` na compra para o `/track`. É **uma chamada** bem especificada por evento.

---

## 9. A aba "Atribuição / Criativos" no napan-trafego

Nova seção no dashboard (mesmo estilo das outras abas), lendo do schema `napan`:

- **Ranking de criativos:** por criativo (`term`), nº de clientes, receita, **CAC real**
  (gasto do criativo ÷ clientes trazidos), ROAS, participação 1º-toque vs último-toque.
- **Lista nominal:** clicou num criativo → vê **quais clientes/pedidos** ele trouxe.
- **Jornada do cliente:** linha do tempo dos toques de um cliente (viu anúncio X → voltou por Y → comprou).
- **Tempo médio de venda:** do 1º toque até o pedido — geral e por criativo/campanha.
- **Recompra / LTV por criativo de aquisição.**
- **Filtro por cliente (gráfica)** e período, como nas outras abas.

O gasto por criativo vem das planilhas/MCPs de Meta e Google já conectados.

---

## 10. Privacidade / LGPD

- Dados são do **próprio cliente**, no **nosso sistema** (somos o controlador) — uso legítimo
  para análise de negócio.
- Para enviar às plataformas (CAPI/Enhanced Conversions), os dados pessoais vão **hasheados** (SHA-256).
- Respeitar o **banner de consentimento** do site: sem consentimento, não dispara os toques.
- `atr_toques` não guarda nome/e-mail — só o `vid` anônimo até a costura.

---

## 11. Roadmap em fases

- **Fase 0 — Fundação (nosso lado, sem depender de ninguém):** tabelas `atr_*` + função `/track`
  (aceita `touch`/`identify`/`purchase`). Testes com dados fake.
- **Fase 1 — Captura + relatório básico:** GTM (toque + purchase) + (se preciso) `dataLayer` na
  página de sucesso + aba "Atribuição" v1 (ranking de criativos + lista nominal).
- **Fase 2 — Blindagem iPhone + jornada:** `identify`/`purchase` pelo backend + server-side GTM no
  subdomínio + visão de caminho/tempo-médio no dashboard.
- **Fase 3 — LTV & recompra:** LTV por criativo de aquisição, recompra, coortes.
  *(Opcional futuro: ingerir engajamento de e-mail do HubSpot/ActiveCampaign na mesma jornada.)*

---

## 12. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Safari/ITP corta cookie (iPhone) | Identidade determinística no login/compra (§6) |
| Ad blocker bloqueia tracker | Coleta first-party no nosso subdomínio (sGTM) |
| Cross-device sem login | Costura no login reduz; nunca zera (limite de mercado) |
| Sem histórico retroativo | Contagem começa no go-live — comunicar expectativa |
| Endpoint público recebe lixo | Token leve + origem + idempotência por `pedido_id` |
| Dados pessoais expostos | `atr_toques` anônimo; hashing p/ plataformas; respeitar consentimento |

---

## 13. Responsabilidades

| Parte | Quem |
|---|---|
| Tabelas + função `/track` + aba do dashboard | **Nós** (eu implemento no Supabase napan + napan-trafego) |
| Passo a passo do GTM (tags/triggers/variáveis) | **Nós** entregamos pronto p/ importar |
| Instalar GTM (se não tiver) | Devs — uma vez |
| Expor pedido+e-mail na página de sucesso | Devs — ~5 linhas (se necessário) |
| Chamadas `identify`/`purchase` do backend (blindagem) | Devs — spec pronta, 1 chamada por evento |
| Subdomínio + server-side GTM (Fase 2) | Infra — conduzido por nós |

---

## 14. A confirmar antes de subir

1. **GTM já está instalado** no e-commerce?
2. **Página de "pedido confirmado":** qual a URL, e ela já mostra **nº do pedido + valor + e-mail**?
3. Confirmar **e-mail como chave primária** + CNPJ/CPF como secundária (assumido).
4. Existe **banner de consentimento**? Como ler o estado dele no GTM?
5. Os devs conseguem fazer as **2 chamadas de backend** (`identify` no login, `purchase` na compra)?

---

*Documento-base do projeto de Atribuição. Próximo passo sugerido: executar a **Fase 0**
(tabelas `atr_*` + função `/track`), que não depende de nenhuma resposta externa.*
