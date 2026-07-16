-- ============================================================================
-- BLINDAGEM DE SEGURANÇA — Atribuição (schema napan)
-- ----------------------------------------------------------------------------
-- Problema: as tabelas atr_* tinham GRANT SELECT p/ anon (chave pública, que
-- vai no HTML do site) → qualquer um listava e-mail/nome/telefone/CNPJ dos
-- clientes. Correção:
--   • REVOGAR toda leitura anônima das tabelas de dados.
--   • Ligar RLS e permitir SELECT só p/ 'authenticated' (usuário logado no
--     dashboard). A escrita continua SÓ pela função track (SECURITY DEFINER,
--     que roda como owner e ignora RLS) — nada muda no rastreamento do site.
-- Idempotente. Rodar no banco (pooler).
-- ============================================================================

-- 1) Tira QUALQUER privilégio de anon nas tabelas de dados (inclui a de PII)
REVOKE ALL ON napan.atr_visitantes, napan.atr_toques, napan.atr_clientes,
  napan.atr_identidades, napan.atr_pedidos, napan.atr_gastos,
  napan.atr_revenda_eventos, napan.atr_config
  FROM anon;

-- 2) Liga RLS em tudo (sem policy p/ anon = anon não lê nada, nem com grant residual)
ALTER TABLE napan.atr_visitantes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_toques         ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_identidades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_pedidos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_gastos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_revenda_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE napan.atr_config         ENABLE ROW LEVEL SECURITY;

-- 3) Leitura só p/ usuário LOGADO (o dashboard autentica via signInWithPassword)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['atr_visitantes','atr_toques','atr_clientes',
    'atr_identidades','atr_pedidos','atr_gastos','atr_revenda_eventos'] LOOP
    EXECUTE format('GRANT SELECT ON napan.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS sel_auth ON napan.%I', t);
    EXECUTE format('CREATE POLICY sel_auth ON napan.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- 4) atr_config (token do track): NUNCA legível por app. Só a função (owner) enxerga.
REVOKE ALL ON napan.atr_config FROM anon, authenticated;
-- (sem policy = ninguém via API; a função track é SECURITY DEFINER e lê como owner)

-- 5) A função track continua executável por anon (é ela que o site chama),
--    mas ela roda como owner e valida o token — escrita segue funcionando.
GRANT EXECUTE ON FUNCTION napan.track(jsonb) TO anon, authenticated;
