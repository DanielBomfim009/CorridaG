# CorridaG

PWA mobile-first para acompanhamento cardio. Esta versão não gera treinos automaticamente: ela importa um treino semanal em JSON, organiza os blocos, registra feedbacks e acompanha evolução, água, jejum e peso no próprio aparelho.

## O que o app faz

- Importa treino semanal em JSON.
- Permite navegar entre Início, Treinos, Evolução, Saúde, Importação e Perfil.
- Marca blocos do treino como concluídos.
- Registra feedback pós-treino com distância, tempo, pace, cansaço e dores.
- Acompanha água, jejum e peso com salvamento local.
- Exporta backup JSON com os dados do aparelho.
- Funciona como PWA com `manifest.json` e `service-worker.js`.

## O que o app não faz

- Não cria plano de treino sozinho.
- Não usa login, servidor, Firebase, Supabase ou API externa.
- Não altera o treino automaticamente após o feedback.

## Como testar

1. Abra `index.html` em um servidor local ou pelo GitHub Pages.
2. Toque em `Importar treino`.
3. Selecione `sample-workout.json` ou toque em `Carregar exemplo`.
4. Navegue pelas abas e registre um feedback de treino.

## Estrutura do JSON de treino

O arquivo precisa conter:

- `app`: deve ser `CorridaG`.
- `week`: nome da semana.
- `athlete`: dados básicos do atleta.
- `workouts`: lista de treinos com dia, título, distância e blocos.

Veja o arquivo `sample-workout.json` como referência.
