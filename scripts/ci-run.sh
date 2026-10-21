#!/usr/bin/env bash
# Executa um comando no CI e, se falhar, publica as últimas linhas da saída
# como uma anotação de erro do GitHub Actions (visível no resumo da execução
# e pela API, sem precisar baixar o log completo).
#
# Uso: scripts/ci-run.sh "Título" comando [argumentos...]
set -uo pipefail

title="$1"
shift

output_file="$(mktemp)"
"$@" 2>&1 | tee "$output_file"
status="${PIPESTATUS[0]}"

if [ "$status" -ne 0 ]; then
  message="$(tail -n 200 "$output_file")"
  message="${message//'%'/'%25'}"
  message="${message//$'\r'/'%0D'}"
  message="${message//$'\n'/'%0A'}"
  echo "::error title=${title}::${message}"
fi

rm -f "$output_file"
exit "$status"
