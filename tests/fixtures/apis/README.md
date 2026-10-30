# Respostas reais das APIs (amostras)

Respostas gravadas em 30/10/2026 a partir das APIs públicas, usadas nos testes
unitários e no servidor simulado dos testes E2E. Não são conteúdo do catálogo:
servem apenas para garantir que o código entende o formato real das respostas.

- WoRMS REST: https://www.marinespecies.org/rest/
- GBIF Species API v1: https://api.gbif.org/v1/species/match

Quando não encontra nada, o WoRMS responde HTTP 204 sem corpo; o GBIF responde
200 com `"matchType": "NONE"`.

Recortes: `worms-carcharodon-parcial.json`, `gbif-match-carcharodon.json` e
`worms-sinonimo.json` guardam só alguns campos de cada registro (os demais foram
removidos ao gravar). Os outros arquivos são as respostas completas.
