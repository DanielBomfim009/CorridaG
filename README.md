# CorridaG

PWA mobile-first de cardio que funciona como um Personal Trainer Digital.

O corredor não escolhe distância, pace, progressão ou modelo de treino. Ele responde perguntas fechadas, o app avalia o perfil e gera um treino diagnóstico personalizado. Depois, cada feedback recalibra os próximos treinos.

## Princípio

O CorridaG foi criado para pessoas que não sabem por onde começar ou que precisam de um plano seguro para evoluir.

Fluxo:

1. Perfil com respostas fechadas.
2. Treino diagnóstico baseado no perfil.
3. Feedback estruturado após o treino.
4. Reanálise automática.
5. Decisão: `MANTER`, `REDUZIR` ou `AUMENTAR`.

## Motor Cardio 2.0

O motor considera:

- objetivo;
- peso e altura;
- IMC;
- faixa de idade;
- nível percebido;
- rotina atual;
- horário;
- restrição principal;
- dor atual;
- energia;
- dias disponíveis;
- resultado real do treino;
- esforço;
- dor;
- sensação final.

## Modelos de Treino

O app pode escolher modelos diferentes:

- Caminhada diagnóstica.
- Caminhada progressiva.
- Corrida e caminhada curta.
- Corrida e caminhada base.
- Corrida leve contínua.
- Progressivo controlado.
- Recuperação ativa.

Assim, uma pessoa com objetivo de emagrecimento e alto impacto não recebe o mesmo treino de alguém acostumado a correr e buscando 10 km.

## Interface

Abas principais:

- `Home`
- `Treino`
- `Personal`
- `Saúde`
- `Perfil`

## Execução

Abra `index.html` no navegador. O app é estático, salva dados em `localStorage` e possui suporte PWA com `manifest.json` e `service-worker.js`.
