-- ============================================================================
-- ATRIBUIÇÃO CRIATIVO → CLIENTE — Fase 0 (fundação)
-- ----------------------------------------------------------------------------
-- Plano completo: docs/PLANO-ATRIBUICAO-CRIATIVOS.md
--
-- PORTÁVEL: este arquivo é auto-contido. Para migrar para outro app/banco,
-- basta rodá-lo em qualquer Postgres/Supabase (ajustando o schema abaixo se
-- necessário) e repontar o GTM/backend para a nova URL. Nenhuma dependência
-- do restante do napan-trafego.
--
-- Endpoint: função napan.track(payload jsonb), exposta via PostgREST RPC:
--   POST {SUPABASE_URL}/rest/v1/rpc/track
--   headers: apikey: {anon}, Content-Profile: napan, Content-Type: application/json
--   body: {"payload": {"token": "...", "type": "touch|identify|purchase", ...}}
--
-- Segurança: escrita SÓ pela função (validada por token guardado em
-- atr_config, que NÃO é legível pela API). Leitura das tabelas atr_* liberada
-- pra anon (padrão do schema napan — dashboard lê direto).
-- ============================================================================

-- ---------- 1. Tabelas ----------

-- Config privada (token do track). SEM acesso via API.
CREATE TABLE IF NOT EXISTS napan.atr_config (
  chave text PRIMARY KEY,
  valor text NOT NULL
);
REVOKE ALL ON napan.atr_config FROM anon, authenticated;

-- Visitante anônimo (o "fio condutor")
CREATE TABLE IF NOT EXISTS napan.atr_visitantes (
  vid            uuid PRIMARY KEY,
  primeiro_visto timestamptz NOT NULL DEFAULT now(),
  primeira_lp    text,
  primeiro_ref   text,
  ua             text
);

-- Todo toque de campanha (append-only) — ISTO é o caminho do cliente
CREATE TABLE IF NOT EXISTS napan.atr_toques (
  id           bigserial PRIMARY KEY,
  vid          uuid NOT NULL,
  ocorrido_em  timestamptz NOT NULL DEFAULT now(),
  tipo         text,                 -- ad_click / organic / direct / referral
  source       text,                 -- utm_source
  medium       text,                 -- utm_medium
  campaign     text,                 -- utm_campaign
  content      text,                 -- utm_content (conjunto)
  term         text,                 -- utm_term → CRIATIVO (nome, p/ humanos)
  campaign_id  text,                 -- camp_id  → {{campaign.id}} (Meta)
  adset_id     text,                 -- adset_id → {{adset.id}}  (Meta)
  ad_id        text,                 -- ad_id    → {{ad.id}}     (Meta) — chave EXATA do criativo
  fbclid       text,
  gclid        text,
  landing_url  text,
  referrer     text,
  device       text
);
CREATE INDEX IF NOT EXISTS atr_toques_vid_idx  ON napan.atr_toques(vid, ocorrido_em);
CREATE INDEX IF NOT EXISTS atr_toques_term_idx ON napan.atr_toques(term);

-- Cliente (identidade determinística; e-mail = chave primária de identidade)
CREATE TABLE IF NOT EXISTS napan.atr_clientes (
  cliente_id     bigserial PRIMARY KEY,
  email          text UNIQUE NOT NULL,
  cnpj           text,
  cpf            text,
  nome           text,
  telefone       text,
  plataforma_id  text,               -- user_id do e-commerce (identidade mais estável que e-mail)
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- Costura vid ↔ cliente (multi-device / cookie resetado = vários vids, 1 cliente)
CREATE TABLE IF NOT EXISTS napan.atr_identidades (
  vid          uuid PRIMARY KEY,
  cliente_id   bigint NOT NULL REFERENCES napan.atr_clientes(cliente_id) ON DELETE CASCADE,
  vinculado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atr_identidades_cliente_idx ON napan.atr_identidades(cliente_id);

-- Pedido com 1º/último toque congelados (idempotente por pedido_id)
CREATE TABLE IF NOT EXISTS napan.atr_pedidos (
  pedido_id      text PRIMARY KEY,
  cliente_id     bigint REFERENCES napan.atr_clientes(cliente_id) ON DELETE SET NULL,
  valor          numeric,
  produto        text,
  ocorrido_em    timestamptz NOT NULL DEFAULT now(),
  vid_no_pedido  uuid,
  primeiro_toque jsonb,
  ultimo_toque   jsonb
);
CREATE INDEX IF NOT EXISTS atr_pedidos_cliente_idx ON napan.atr_pedidos(cliente_id);

-- Escrita nas atr_* SÓ pela função track (leitura fica liberada p/ dashboard)
REVOKE INSERT, UPDATE, DELETE ON napan.atr_visitantes, napan.atr_toques,
  napan.atr_clientes, napan.atr_identidades, napan.atr_pedidos FROM anon, authenticated;

-- ---------- 2. Função track (o endpoint) ----------

CREATE OR REPLACE FUNCTION napan.track(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = napan
AS $$
DECLARE
  v_token    text;
  v_type     text := payload->>'type';
  v_vid      uuid := NULLIF(payload->>'vid','')::uuid;
  v_email    text := lower(trim(coalesce(payload->>'email','')));
  v_cliente  bigint;
  v_pedido   text;
  v_primeiro jsonb;
  v_ultimo   jsonb;
BEGIN
  -- autenticação leve (token privado em atr_config, ilegível via API)
  SELECT valor INTO v_token FROM atr_config WHERE chave = 'track_token';
  IF v_token IS NULL OR (payload->>'token') IS DISTINCT FROM v_token THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- ===== TOUCH: um toque de campanha =====
  IF v_type = 'touch' THEN
    IF v_vid IS NULL THEN RAISE EXCEPTION 'vid requerido'; END IF;
    -- DEDUP: recarregar a landing (mesma origem, <30min) não é um toque novo
    IF EXISTS (
      SELECT 1 FROM atr_toques t
      WHERE t.vid = v_vid
        AND t.ocorrido_em > now() - interval '30 minutes'
        AND coalesce(t.term,'')     = coalesce(payload->>'term','')
        AND coalesce(t.campaign,'') = coalesce(payload->>'campaign','')
        AND coalesce(t.source,'')   = coalesce(payload->>'source','')
        AND coalesce(t.ad_id,'')    = coalesce(payload->>'ad_id','')
    ) THEN
      RETURN jsonb_build_object('ok', true, 'evento', 'touch', 'dedup', true);
    END IF;
    INSERT INTO atr_visitantes(vid, primeira_lp, primeiro_ref, ua)
    VALUES (v_vid, payload->>'landing', payload->>'referrer', payload->>'ua')
    ON CONFLICT (vid) DO NOTHING;
    INSERT INTO atr_toques(vid, tipo, source, medium, campaign, content, term,
                           campaign_id, adset_id, ad_id,
                           fbclid, gclid, landing_url, referrer, device)
    VALUES (v_vid, coalesce(payload->>'tipo','ad_click'),
            payload->>'source', payload->>'medium', payload->>'campaign',
            payload->>'content', payload->>'term',
            payload->>'campaign_id', payload->>'adset_id', payload->>'ad_id',
            payload->>'fbclid', payload->>'gclid',
            payload->>'landing', payload->>'referrer', payload->>'device');
    RETURN jsonb_build_object('ok', true, 'evento', 'touch');

  -- ===== IDENTIFY: costura vid → cliente (cadastro/login) =====
  ELSIF v_type = 'identify' THEN
    IF v_email = '' THEN RAISE EXCEPTION 'email requerido'; END IF;
    INSERT INTO atr_clientes(email, cnpj, cpf, nome, telefone, plataforma_id)
    VALUES (v_email, payload->>'cnpj', payload->>'cpf', payload->>'nome',
            payload->>'telefone', payload->>'plataforma_id')
    ON CONFLICT (email) DO UPDATE SET
      cnpj          = coalesce(EXCLUDED.cnpj, atr_clientes.cnpj),
      cpf           = coalesce(EXCLUDED.cpf,  atr_clientes.cpf),
      nome          = coalesce(EXCLUDED.nome, atr_clientes.nome),
      telefone      = coalesce(EXCLUDED.telefone, atr_clientes.telefone),
      plataforma_id = coalesce(EXCLUDED.plataforma_id, atr_clientes.plataforma_id)
    RETURNING cliente_id INTO v_cliente;
    IF v_vid IS NOT NULL THEN
      INSERT INTO atr_visitantes(vid) VALUES (v_vid) ON CONFLICT DO NOTHING;
      INSERT INTO atr_identidades(vid, cliente_id) VALUES (v_vid, v_cliente)
      ON CONFLICT (vid) DO UPDATE SET cliente_id = EXCLUDED.cliente_id, vinculado_em = now();
    END IF;
    RETURN jsonb_build_object('ok', true, 'evento', 'identify', 'cliente_id', v_cliente);

  -- ===== PURCHASE: pedido + snapshot do 1º/último toque =====
  ELSIF v_type = 'purchase' THEN
    v_pedido := payload->>'pedido_id';
    IF v_pedido IS NULL OR v_pedido = '' THEN RAISE EXCEPTION 'pedido_id requerido'; END IF;

    IF v_email <> '' THEN
      INSERT INTO atr_clientes(email, cnpj, cpf, nome, telefone, plataforma_id)
      VALUES (v_email, payload->>'cnpj', payload->>'cpf', payload->>'nome',
              payload->>'telefone', payload->>'plataforma_id')
      ON CONFLICT (email) DO UPDATE SET
        cnpj          = coalesce(EXCLUDED.cnpj, atr_clientes.cnpj),
        cpf           = coalesce(EXCLUDED.cpf,  atr_clientes.cpf),
        nome          = coalesce(EXCLUDED.nome, atr_clientes.nome),
        telefone      = coalesce(EXCLUDED.telefone, atr_clientes.telefone),
        plataforma_id = coalesce(EXCLUDED.plataforma_id, atr_clientes.plataforma_id)
      RETURNING cliente_id INTO v_cliente;
      IF v_vid IS NOT NULL THEN
        INSERT INTO atr_visitantes(vid) VALUES (v_vid) ON CONFLICT DO NOTHING;
        INSERT INTO atr_identidades(vid, cliente_id) VALUES (v_vid, v_cliente)
        ON CONFLICT (vid) DO UPDATE SET cliente_id = EXCLUDED.cliente_id;
      END IF;
    ELSIF v_vid IS NOT NULL THEN
      SELECT cliente_id INTO v_cliente FROM atr_identidades WHERE vid = v_vid;
    END IF;

    -- 1º e último toque considerando TODOS os vids do cliente (multi-device)
    WITH vids AS (
      SELECT vid FROM atr_identidades WHERE cliente_id = v_cliente
      UNION SELECT v_vid WHERE v_vid IS NOT NULL
    ), tq AS (
      -- só cliques de ANÚNCIO contam pra crédito de 1º/último toque;
      -- toques orgânicos/diretos ficam na jornada mas não levam atribuição paga
      SELECT t.source, t.medium, t.campaign, t.content, t.term,
             t.campaign_id, t.adset_id, t.ad_id, t.ocorrido_em
      FROM atr_toques t JOIN vids USING (vid)
      WHERE coalesce(t.tipo, 'ad_click') = 'ad_click'
    )
    SELECT
      (SELECT to_jsonb(a) FROM (SELECT * FROM tq ORDER BY ocorrido_em ASC  LIMIT 1) a),
      (SELECT to_jsonb(b) FROM (SELECT * FROM tq ORDER BY ocorrido_em DESC LIMIT 1) b)
    INTO v_primeiro, v_ultimo;

    INSERT INTO atr_pedidos(pedido_id, cliente_id, valor, produto, vid_no_pedido,
                            primeiro_toque, ultimo_toque)
    VALUES (v_pedido, v_cliente, NULLIF(payload->>'valor','')::numeric,
            payload->>'produto', v_vid, v_primeiro, v_ultimo)
    ON CONFLICT (pedido_id) DO NOTHING;  -- idempotente: recarregar a página não duplica
    RETURN jsonb_build_object('ok', true, 'evento', 'purchase',
                              'cliente_id', v_cliente,
                              'primeiro_toque', v_primeiro, 'ultimo_toque', v_ultimo);
  END IF;

  RAISE EXCEPTION 'type inválido: % (use touch|identify|purchase)', v_type;
END $$;

REVOKE ALL ON FUNCTION napan.track(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION napan.track(jsonb) TO anon, authenticated, service_role;

-- ---------- 3. Gasto por anúncio (alimentado pelo sync_gastos_meta.sh) ----------

CREATE TABLE IF NOT EXISTS napan.atr_gastos (
  id bigserial PRIMARY KEY,
  dia date NOT NULL,
  canal text NOT NULL DEFAULT 'meta',
  campaign_id text, campaign_name text,
  adset_id text, adset_name text,
  ad_id text, ad_name text,
  gasto numeric NOT NULL DEFAULT 0,
  impressoes bigint, cliques bigint,
  plataforma_compras bigint,      -- compras que a PLATAFORMA reporta (comparação)
  plataforma_receita numeric,     -- receita que a PLATAFORMA reporta
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS atr_gastos_unq ON napan.atr_gastos(dia, canal, coalesce(ad_id,''), coalesce(campaign_id,''));
GRANT SELECT ON napan.atr_gastos TO anon, authenticated;
GRANT ALL ON napan.atr_gastos TO service_role;
REVOKE INSERT, UPDATE, DELETE ON napan.atr_gastos FROM anon, authenticated;
