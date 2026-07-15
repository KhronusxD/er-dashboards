#!/bin/bash
# ============================================================================
# Sync de GASTO por anúncio (Meta) → napan.atr_gastos
# ----------------------------------------------------------------------------
# Uso:  ./sync_gastos_meta.sh [SINCE] [UNTIL]     (datas YYYY-MM-DD)
#       default: do go-live da atribuição (2026-07-15) até hoje.
# Leitura-apenas na Graph API (insights). Upsert idempotente por (dia, ad).
# Requer: ~/.config/meta-ads/read.env (ACCESS_TOKEN) e .env.dump (banco).
# ============================================================================
set -euo pipefail

ACC="act_1068007256556528"                        # [NP] Atual Card Brasil
SINCE="${1:-2026-07-15}"                          # go-live da atribuição
UNTIL="${2:-$(date +%Y-%m-%d)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"           # raiz do napan-trafego
PSQL=/opt/homebrew/opt/libpq/bin/psql

# --- credenciais ---
set -a; source "$HOME/.config/meta-ads/read.env"; set +a
line=$(grep '^NUCLY_DB_URL=' "$DIR/.env.dump" | head -1); url=${line#NUCLY_DB_URL=\"}; url=${url%\"}
PW=${url#postgresql://postgres:}; PW=${PW%@db.dasbpktslyovikphwmrt.supabase.co:5432/postgres}
HOST=$(grep '^NUCLY_POOLER_HOST=' "$DIR/.env.dump" | sed 's/.*="//; s/"//')

echo "→ Meta insights $ACC: $SINCE a $UNTIL"

# --- baixa (com paginação) ---
URL="https://graph.facebook.com/v22.0/$ACC/insights"
: > /tmp/atr_gastos_rows.jsonl
NEXT=""
PAGE=0
while : ; do
  PAGE=$((PAGE+1))
  if [ -z "$NEXT" ]; then
    curl -s -m 60 -G "$URL" \
      --data-urlencode "level=ad" \
      --data-urlencode "fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks" \
      --data-urlencode "time_range={\"since\":\"$SINCE\",\"until\":\"$UNTIL\"}" \
      --data-urlencode "time_increment=1" \
      --data-urlencode "limit=500" \
      --data-urlencode "access_token=$ACCESS_TOKEN" -o /tmp/atr_gastos_page.json
  else
    curl -s -m 60 "$NEXT" -o /tmp/atr_gastos_page.json
  fi
  python3 - << 'PY' >> /tmp/atr_gastos_rows.jsonl
import json
d = json.load(open('/tmp/atr_gastos_page.json'))
if 'error' in d:
    raise SystemExit("ERRO Graph API: " + d['error'].get('message','?'))
for r in d.get('data', []):
    print(json.dumps(r, ensure_ascii=False))
PY
  NEXT=$(python3 -c "import json; d=json.load(open('/tmp/atr_gastos_page.json')); print(d.get('paging',{}).get('next',''))")
  [ -z "$NEXT" ] && break
  [ "$PAGE" -ge 20 ] && { echo "aviso: 20 páginas, parando"; break; }
done
N=$(wc -l < /tmp/atr_gastos_rows.jsonl | tr -d ' ')
echo "→ ${N} linhas anúncio-dia baixadas"

# --- gera SQL de upsert ---
python3 - << 'PY'
import json
def esc(s): return (s or '').replace("'", "''")
vals = []
for line in open('/tmp/atr_gastos_rows.jsonl'):
    r = json.loads(line)
    vals.append("('{}','meta','{}','{}','{}','{}','{}','{}',{},{},{})".format(
        r.get('date_start'), esc(r.get('campaign_id')), esc(r.get('campaign_name')),
        esc(r.get('adset_id')), esc(r.get('adset_name')),
        esc(r.get('ad_id')), esc(r.get('ad_name')),
        float(r.get('spend') or 0), int(r.get('impressions') or 0), int(r.get('clicks') or 0)))
if not vals:
    open('/tmp/atr_gastos_upsert.sql','w').write('select 1;')
else:
    sql = ("INSERT INTO napan.atr_gastos (dia, canal, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, gasto, impressoes, cliques)\nVALUES\n"
           + ",\n".join(vals)
           + "\nON CONFLICT (dia, canal, coalesce(ad_id,''), coalesce(campaign_id,'')) DO UPDATE SET\n"
           "  gasto = EXCLUDED.gasto, impressoes = EXCLUDED.impressoes, cliques = EXCLUDED.cliques,\n"
           "  ad_name = EXCLUDED.ad_name, campaign_name = EXCLUDED.campaign_name,\n"
           "  adset_id = EXCLUDED.adset_id, adset_name = EXCLUDED.adset_name, atualizado_em = now();")
    open('/tmp/atr_gastos_upsert.sql','w').write(sql)
print("→ SQL gerado")
PY

# --- aplica ---
PGPASSWORD="$PW" "$PSQL" -h "$HOST" -p 5432 -U postgres.dasbpktslyovikphwmrt -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/atr_gastos_upsert.sql -At | tail -2
PGPASSWORD="$PW" "$PSQL" -h "$HOST" -p 5432 -U postgres.dasbpktslyovikphwmrt -d postgres -At \
  -c "select '→ atr_gastos: '||count(*)||' linhas, R\$ '||round(sum(gasto),2)||' no total' from napan.atr_gastos;"
rm -f /tmp/atr_gastos_rows.jsonl /tmp/atr_gastos_page.json /tmp/atr_gastos_upsert.sql
echo "✓ sync concluído"
