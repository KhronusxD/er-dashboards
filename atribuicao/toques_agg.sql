-- ============================================================================
-- napan.atr_toques_agg — toques AGREGADOS por dia+dimensões, com contagem n.
-- Resolve o teto de carregamento do painel: em vez de baixar 170k+ linhas cruas
-- (que só cabiam ~2,5 dias), o painel baixa os combos agrupados (poucos milhares)
-- e reconstrói todas as contagens multiplicando por n. Histórico inteiro, rápido.
-- O "Feed de toques" (eventos individuais) segue com consulta crua pequena.
-- ============================================================================
CREATE OR REPLACE FUNCTION napan.atr_toques_agg(
  p_desde timestamptz DEFAULT NULL,
  p_ate   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  dia date, tipo text, source text, campaign text, campaign_id text,
  adset_id text, ad_id text, term text, content text,
  tem_gclid boolean, tem_fbclid boolean, n bigint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = napan
STABLE
AS $$
  SELECT
    ocorrido_em::date AS dia, tipo, source, campaign, campaign_id,
    adset_id, ad_id, term, content,
    (gclid IS NOT NULL)  AS tem_gclid,
    (fbclid IS NOT NULL) AS tem_fbclid,
    count(*)             AS n
  FROM atr_toques
  WHERE ocorrido_em >= coalesce(p_desde, '2000-01-01'::timestamptz)
    AND ocorrido_em <= coalesce(p_ate, now())
  GROUP BY 1,2,3,4,5,6,7,8,9,10,11
$$;

-- só usuário logado do painel (authenticated) e a service_role executam.
REVOKE ALL ON FUNCTION napan.atr_toques_agg(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION napan.atr_toques_agg(timestamptz, timestamptz) TO authenticated, service_role;
