# CorridaG

PWA mobile-first para acompanhamento de treinos cardio importados. Esta versão não gera treinos automaticamente: o app importa um treino semanal em JSON, organiza os blocos, registra feedback pós-treino e mostra a evolução do corredor.

## Fluxo principal

1. Importar treino em JSON.
2. Abrir a aba `Treinos`.
3. Marcar cada bloco como concluído.
4. Tocar em `Finalizar treino`.
5. Registrar distância realizada, tempo total, pace médio, sensação, cansaço, dores e observações.
6. Acompanhar os registros na aba `Evolução`.

## Abas

- `Início`
- `Treinos`
- `Evolução`
- `Perfil`

Feedback e importação são telas auxiliares, abertas a partir do treino, do perfil ou do botão rápido.

## JSON oficial

O arquivo oficial precisa conter:

- `app`: deve ser `CorridaG`.
- `version`: versão do formato.
- `week`: nome da semana.
- `athlete`: dados básicos do atleta.
- `workouts`: lista de treinos.
- `blocks`: blocos de cada treino.

Veja `sample-workout.json` e `corridag-semana-01.json`.

## PWA

O projeto inclui `manifest.json`, `service-worker.js`, `.nojekyll` e ícones em SVG para publicação no GitHub Pages.
