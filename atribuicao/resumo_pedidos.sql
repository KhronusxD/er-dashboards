-- ============================================================================
-- Agregação server-side dos PEDIDOS — mata o teto de carregar 12k+ linhas cruas.
-- napan._canal(src)     : replica o canalDe() do front (só por source).
-- napan.atr_resumo(...) : KPIs + receita/canal + série diária + atribuição por
--                          campanha/criativo, para AMBOS os modelos (1º/último),
--                          num único JSONB pequeno. As LISTAS (pedidos/clientes)
--                          seguem em consultas paginadas próprias (10/página).
-- ============================================================================
CREATE OR REPLACE FUNCTION napan._canal(src text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(src,'')) IN ('google','adwords','googleads','youtube','gads') THEN 'google'
    WHEN lower(coalesce(src,'')) IN ('facebook','fb','ig','an','msg','instagram','meta') THEN 'meta'
    WHEN lower(coalesce(src,'')) = 'teste' THEN 'teste'
    WHEN coalesce(src,'') = '' THEN 'direto'
    ELSE 'outros'
  END
$$;

CREATE OR REPLACE FUNCTION napan.atr_resumo(
  p_desde timestamptz DEFAULT NULL,
  p_ate   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = napan
STABLE
AS $$
DECLARE
  r jsonb;
BEGIN
  WITH ped AS (
    SELECT
      p.cliente_id, coalesce(p.valor,0) AS valor, p.ocorrido_em,
      p.primeiro_toque AS pt, p.ultimo_toque AS ut,
      (p.primeiro_toque IS NOT NULL) AS tem_origem,
      _canal(p.primeiro_toque->>'source') AS canal_pri,
      _canal(p.ultimo_toque->>'source')   AS canal_ult,
      NULLIF(p.primeiro_toque->>'ocorrido_em','')::timestamptz AS pt_em
    FROM atr_pedidos p
    WHERE p.ocorrido_em >= coalesce(p_desde,'2000-01-01'::timestamptz)
      AND p.ocorrido_em <= coalesce(p_ate, now())
  )
  SELECT jsonb_build_object(
    'totais', (SELECT jsonb_build_object(
        'pedidos', count(*),
        'receita', round(coalesce(sum(valor),0),2),
        'clientes', count(DISTINCT cliente_id),
        'com_origem', count(*) FILTER (WHERE tem_origem),
        'tempo_medio_dias', round(avg(EXTRACT(epoch FROM (ocorrido_em - pt_em))/86400)
                                  FILTER (WHERE pt_em IS NOT NULL)::numeric, 3)
      ) FROM ped),

    -- receita/pedidos por canal, para os DOIS modelos
    'por_canal', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
        SELECT 'primeiro' AS modelo, canal_pri AS canal, count(*) AS pedidos, round(sum(valor),2) AS receita
        FROM ped GROUP BY canal_pri
        UNION ALL
        SELECT 'ultimo', canal_ult, count(*), round(sum(valor),2)
        FROM ped GROUP BY canal_ult
      ) x),

    -- série diária de pedidos por canal (pelo 1º toque — igual ao gráfico atual)
    'serie_dia', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
        SELECT ocorrido_em::date AS dia, canal_pri AS canal, count(*) AS pedidos
        FROM ped GROUP BY 1,2
      ) x),

    -- atribuição por CAMPANHA (chaves do snapshot; o front casa com os gastos),
    -- só canais pagos, para os dois modelos
    'por_campanha', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
        SELECT 'primeiro' AS modelo, canal_pri AS canal,
               pt->>'campaign_id' AS campaign_id, pt->>'campaign' AS campaign,
               count(*) AS compras, round(sum(valor),2) AS receita
        FROM ped WHERE canal_pri IN ('meta','google')
        GROUP BY canal_pri, pt->>'campaign_id', pt->>'campaign'
        UNION ALL
        SELECT 'ultimo', canal_ult, ut->>'campaign_id', ut->>'campaign',
               count(*), round(sum(valor),2)
        FROM ped WHERE canal_ult IN ('meta','google')
        GROUP BY canal_ult, ut->>'campaign_id', ut->>'campaign'
      ) x),

    -- ranking de CRIATIVO/campanha (chaves do snapshot; o front traduz via dic):
    -- receita/pedidos/clientes por modelo + trouxe(1º)/fechou(último)
    'por_criativo', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
        SELECT 'primeiro' AS modelo, canal_pri AS canal,
               pt->>'ad_id' AS ad_id, pt->>'term' AS term,
               pt->>'campaign_id' AS campaign_id, pt->>'campaign' AS campaign,
               count(*) AS pedidos, round(sum(valor),2) AS receita,
               count(DISTINCT cliente_id) AS clientes
        FROM ped GROUP BY canal_pri, pt->>'ad_id', pt->>'term', pt->>'campaign_id', pt->>'campaign'
        UNION ALL
        SELECT 'ultimo', canal_ult, ut->>'ad_id', ut->>'term',
               ut->>'campaign_id', ut->>'campaign',
               count(*), round(sum(valor),2), count(DISTINCT cliente_id)
        FROM ped GROUP BY canal_ult, ut->>'ad_id', ut->>'term', ut->>'campaign_id', ut->>'campaign'
      ) x),

    -- papéis independentes do modelo (introdutor = 1º toque; fechador = último)
    'papeis', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
        SELECT 'trouxe' AS papel, canal_pri AS canal,
               pt->>'ad_id' AS ad_id, pt->>'term' AS term,
               pt->>'campaign_id' AS campaign_id, pt->>'campaign' AS campaign,
               count(*) AS n
        FROM ped WHERE pt IS NOT NULL
        GROUP BY canal_pri, pt->>'ad_id', pt->>'term', pt->>'campaign_id', pt->>'campaign'
        UNION ALL
        SELECT 'fechou', canal_ult, ut->>'ad_id', ut->>'term',
               ut->>'campaign_id', ut->>'campaign', count(*)
        FROM ped WHERE ut IS NOT NULL
        GROUP BY canal_ult, ut->>'ad_id', ut->>'term', ut->>'campaign_id', ut->>'campaign'
      ) x)
  ) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION napan.atr_resumo(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION napan.atr_resumo(timestamptz, timestamptz) TO authenticated, service_role;
