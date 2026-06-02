# CorridaG V1

PWA mobile-first que funciona como um Personal Trainer Cardio Digital.

O CorridaG não é rastreador de corrida, dashboard fitness ou app para o usuário montar treino. O usuário informa perfil, objetivo e disponibilidade. O sistema analisa, explica a decisão, gera o treino da semana, recebe feedback e decide se mantém, reduz ou evolui.

## Estrutura da V1

- Perfil.
- Análise do Personal.
- Treino da Semana.
- Feedback.
- Água.
- Jejum.
- Histórico.

## Princípio

O usuário não escolhe distância, pace ou progressão. O motor de decisão cardio calcula esses pontos com base em perfil, IMC, nível, objetivo, restrições, disponibilidade e feedbacks reais.

## Motor de Decisão Cardio

Decisões possíveis:

- `REDUZIR`: dor articular >= 4, cansaço >= 8 ou treino não concluído.
- `MANTER`: treino concluído, cansaço <= 6 e dor articular <= 2.
- `EVOLUIR`: semana concluída, todos os treinos feitos, cansaço médio <= 5 e sem dor articular.

A evolução só entra na próxima semana. O plano não muda diariamente, exceto por segurança.

## Recursos

- Treino por blocos com pace recomendado.
- Marcação de blocos concluídos.
- Resposta textual do personal após feedback.
- Meta de água por peso.
- Orientação simples de jejum.
- Histórico resumido por semana, treino, resultado e decisão.
- Backup local por exportação/importação JSON.

## Como executar

Abra `index.html` no navegador. O app é estático e salva tudo em `localStorage`.
