#!/bin/bash
# ============================================================================
# Sync de GASTO por campanha (Google Ads) → napan.atr_gastos
# ----------------------------------------------------------------------------
# Uso:  ./sync_gastos_google.sh [SINCE] [UNTIL]    (YYYY-MM-DD)
#       default: go-live da atribuição (2026-07-15) até hoje.
# Nível CAMPANHA de propósito: cobre Search/Shopping/PMax uniformemente
# (PMax não tem ads; nível misto duplicaria gasto na agregação).
# Obs.: o Google atrasa ~1 dia os dados — rodar diariamente pega o dia anterior.
# Requer: ~/.config/google-ads/credentials-mcc.env e .env.dump (banco).
# ============================================================================
set -euo pipefail

CID="7178430422"                                   # Atual Card
SINCE="${1:-2026-07-15}"
UNTIL="${2:-$(date +%Y-%m-%d)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=/opt/homebrew/opt/libpq/bin/psql

set -a; source "$HOME/.config/google-ads/credentials-mcc.env"; set +a
line=$(grep '^NUCLY_DB_URL=' "$DIR/.env.dump" | head -1); url=${line#NUCLY_DB_URL=\"}; url=${url%\"}
PW=${url#postgresql://postgres:}; PW=${PW%@db.dasbpktslyovikphwmrt.supabase.co:5432/postgres}
HOST=$(grep '^NUCLY_POOLER_HOST=' "$DIR/.env.dump" | sed 's/.*="//; s/"//')

echo "→ Google Ads $CID: $SINCE a $UNTIL"
TOK=$(curl -s -m 20 -X POST https://oauth2.googleapis.com/token \
  -d client_id="$CLIENT_ID" -d client_secret="$CLIENT_SECRET" \
  -d refresh_token="$REFRESH_TOKEN" -d grant_type=refresh_token \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or exit('ERRO oauth: '+str(d)[:200]))")

curl -s -m 60 "https://googleads.googleapis.com/v22/customers/$CID/googleAds:searchStream" \
  -H "Authorization: Bearer $TOK" -H "developer-token: $DEVELOPER_TOKEN" \
  -H "login-customer-id: $LOGIN_CUSTOMER_ID" -H "Content-Type: application/json" \
  -d "{\"query\": \"SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '$SINCE' AND '$UNTIL' AND metrics.cost_micros > 0\"}" \
  -o /tmp/gads_rows.json

python3 - << 'PY'
import json
d = json.load(open('/tmp/gads_rows.json'))
if isinstance(d, dict) and 'error' in d:
    raise SystemExit("ERRO Google Ads API: " + str(d['error'].get('message',''))[:300])
def esc(s): return (s or '').replace("'", "''")
vals = []
for b in d:
    for r in b.get('results', []):
        c, m, s = r['campaign'], r['metrics'], r['segments']
        vals.append("('{}','google','{}','{}',NULL,NULL,NULL,NULL,{},{},{},{},{})".format(
            s['date'], c['id'], esc(c.get('name','')),
            int(m.get('costMicros',0))/1e6, int(m.get('impressions',0)), int(m.get('clicks',0)),
            round(float(m.get('conversions',0))), float(m.get('conversionsValue',0))))
if not vals:
    open('/tmp/gads_upsert.sql','w').write("select 'sem linhas (Google atrasa ~1 dia)';")
else:
    sql = ("INSERT INTO napan.atr_gastos (dia, canal, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, gasto, impressoes, cliques, plataforma_compras, plataforma_receita)\nVALUES\n"
           + ",\n".join(vals)
           + "\nON CONFLICT (dia, canal, coalesce(ad_id,''), coalesce(campaign_id,'')) DO UPDATE SET\n"
           "  gasto = EXCLUDED.gasto, impressoes = EXCLUDED.impressoes, cliques = EXCLUDED.cliques,\n"
           "  plataforma_compras = EXCLUDED.plataforma_compras, plataforma_receita = EXCLUDED.plataforma_receita,\n"
           "  campaign_name = EXCLUDED.campaign_name, atualizado_em = now();")
    open('/tmp/gads_upsert.sql','w').write(sql)
print(f"→ {len(vals)} linhas campanha-dia")
PY

PGPASSWORD="$PW" "$PSQL" -h "$HOST" -p 5432 -U postgres.dasbpktslyovikphwmrt -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/gads_upsert.sql -At | tail -1
PGPASSWORD="$PW" "$PSQL" -h "$HOST" -p 5432 -U postgres.dasbpktslyovikphwmrt -d postgres -At \
  -c "select '→ atr_gastos google: '||count(*)||' linhas, R\$ '||coalesce(round(sum(gasto),2),0) from napan.atr_gastos where canal='google';"
rm -f /tmp/gads_rows.json /tmp/gads_upsert.sql
echo "✓ sync google concluído"
