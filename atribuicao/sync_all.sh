#!/bin/bash
# ============================================================================
# Roda os dois syncs de gasto (Meta + Google) → napan.atr_gastos.
# Chamado pelo agendador (launchd) 3x/dia: 06h, 12h, 21h.
# Log em ~/Library/Logs/napan-atribuicao-sync.log (fora do iCloud).
# ============================================================================
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$HOME/Library/Logs/napan-atribuicao-sync.log"
# PATH mínimo do launchd não tem homebrew/libpq — garantir aqui
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/libpq/bin:/usr/bin:/bin:/usr/sbin:/sbin"

{
  echo "════════ $(date '+%Y-%m-%d %H:%M:%S') — sync automático ════════"
  "$DIR/sync_gastos_meta.sh"   || echo "!! sync Meta falhou (exit $?)"
  "$DIR/sync_gastos_google.sh" || echo "!! sync Google falhou (exit $?)"
  echo ""
} >> "$LOG" 2>&1
