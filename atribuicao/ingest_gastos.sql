-- ============================================================================
-- napan.ingest_gastos — grava um lote de gasto (Meta/Google) em atr_gastos.
-- Chamada pela Edge Function `sync-gastos` (service_role) quando o usuário
-- clica em "Atualizar dados" no painel. Upsert idempotente por (dia, canal,
-- ad_id, campaign_id) — mesmo conflito que os scripts locais usavam.
-- ============================================================================
CREATE OR REPLACE FUNCTION napan.ingest_gastos(p_canal text, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = napan
AS $$
DECLARE
  r jsonb;
  n int := 0;
BEGIN
  IF p_canal NOT IN ('meta','google') THEN
    RAISE EXCEPTION 'canal inválido: % (use meta|google)', p_canal;
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows deve ser um array jsonb';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO atr_gastos (dia, canal, campaign_id, campaign_name, adset_id, adset_name,
                            ad_id, ad_name, gasto, impressoes, cliques,
                            plataforma_compras, plataforma_receita)
    VALUES (
      (r->>'dia')::date, p_canal,
      NULLIF(r->>'campaign_id',''), NULLIF(r->>'campaign_name',''),
      NULLIF(r->>'adset_id',''),    NULLIF(r->>'adset_name',''),
      NULLIF(r->>'ad_id',''),       NULLIF(r->>'ad_name',''),
      coalesce((r->>'gasto')::numeric, 0),
      coalesce((r->>'impressoes')::bigint, 0),
      coalesce((r->>'cliques')::bigint, 0),
      coalesce((r->>'plataforma_compras')::numeric, 0),
      coalesce((r->>'plataforma_receita')::numeric, 0)
    )
    ON CONFLICT (dia, canal, coalesce(ad_id,''), coalesce(campaign_id,'')) DO UPDATE SET
      gasto              = EXCLUDED.gasto,
      impressoes         = EXCLUDED.impressoes,
      cliques            = EXCLUDED.cliques,
      plataforma_compras = EXCLUDED.plataforma_compras,
      plataforma_receita = EXCLUDED.plataforma_receita,
      ad_name            = EXCLUDED.ad_name,
      campaign_name      = EXCLUDED.campaign_name,
      adset_id           = EXCLUDED.adset_id,
      adset_name         = EXCLUDED.adset_name,
      atualizado_em      = now();
    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'canal', p_canal, 'linhas', n,
    'total', (select round(coalesce(sum(gasto),0),2) from atr_gastos where canal = p_canal)
  );
END $$;

-- só o service_role (dentro da Edge Function) executa; anon/authenticated não.
REVOKE ALL ON FUNCTION napan.ingest_gastos(text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION napan.ingest_gastos(text, jsonb) TO service_role;
