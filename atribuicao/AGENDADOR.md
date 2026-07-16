# Agendador dos syncs de gasto (Meta + Google)

Roda `sync_gastos_meta.sh` + `sync_gastos_google.sh` automaticamente **3x/dia:
06h, 12h, 21h** (horário local), atualizando `napan.atr_gastos`.

## Como está montado

- **Executor:** `launchd` do macOS (agente de usuário) — o dashboard é site
  estático (Cloudflare), não tem servidor pra cron; o agendador vive no Mac.
- **Plist:** `~/Library/LaunchAgents/com.napan.atribuicao.sync.plist`
  (template versionado em `atribuicao/agendador/com.napan.atribuicao.sync.plist`).
- **⚠️ Gotcha macOS (TCC):** o launchd **não** consegue executar scripts em
  `~/Documents` (proteção de privacidade → "Operation not permitted"). Por isso
  a **cópia executável** dos scripts fica FORA do Documents:
  `~/.napan-atribuicao/atribuicao/*.sh` + `~/.napan-atribuicao/.env.dump` (600).
  Os scripts continuam versionados aqui no repo; a pasta executável é um espelho.
- **Log:** `~/Library/Logs/napan-atribuicao-sync.log` (fora do iCloud).

## Limites honestos

- Só roda com o **Mac ligado/acordado**. Se dormir na hora, o launchd executa a
  tarefa perdida ao acordar (uma vez). Se estiver desligado, pula aquele horário.
- Google atrasa ~1 dia — o gasto de "hoje" é sempre prévia; consolida no dia
  seguinte. Meta é quase tempo real.
- Robustez 24/7 real = migrar pra cron na nuvem (GitHub Actions com os tokens
  como secrets). Não feito — o agendador local cobre horário comercial.

## Reinstalar / atualizar (após mudar os scripts no repo)

```bash
# 1) re-espelhar os scripts pra pasta executável (fora do Documents)
mkdir -p ~/.napan-atribuicao/atribuicao
cp atribuicao/sync_gastos_meta.sh atribuicao/sync_gastos_google.sh atribuicao/sync_all.sh ~/.napan-atribuicao/atribuicao/
cp .env.dump ~/.napan-atribuicao/.env.dump && chmod 600 ~/.napan-atribuicao/.env.dump
chmod +x ~/.napan-atribuicao/atribuicao/*.sh

# 2) (re)carregar o agendador
cp atribuicao/agendador/com.napan.atribuicao.sync.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.napan.atribuicao.sync.plist 2>/dev/null
launchctl load -w ~/Library/LaunchAgents/com.napan.atribuicao.sync.plist

# rodar agora (teste):  launchctl start com.napan.atribuicao.sync
# ver log:              tail -f ~/Library/Logs/napan-atribuicao-sync.log
# desligar:             launchctl unload -w ~/Library/LaunchAgents/com.napan.atribuicao.sync.plist
```
