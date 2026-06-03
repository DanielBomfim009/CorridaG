# Arquitetura CorridaG

## Objetivo

O CorridaG deve parecer um personal cardio digital. O corredor não precisa saber quanto corre, quanto caminha ou qual pace deve seguir. O app estima, testa com segurança e ajusta com base no feedback.

## Fluxo Principal

Perfil fechado → Análise → Treino diagnóstico → Feedback → Reanálise → Decisão → Ajuste dos próximos treinos

## Perfil

As perguntas são fechadas para alimentar gatilhos do motor:

- objetivo;
- peso;
- altura;
- faixa de idade;
- nível percebido;
- rotina atual;
- horário;
- restrição principal;
- dor atual;
- energia;
- dias disponíveis.

Não há pergunta aberta para último pace, último treino, km que consegue correr ou km que consegue caminhar.

## Motor Cardio 2.0

Camadas do motor:

- `riskProfile`: calcula risco por IMC, idade, restrição, dor e energia.
- `readinessScore`: estima prontidão por nível e rotina atual.
- `chooseDiagnosticModel`: escolhe o modelo do treino diagnóstico.
- `chooseDiagnosticDistance`: define distância inicial segura.
- `weekStrategy`: monta a semana pela disponibilidade e distribuição de descanso.
- `evaluateFeedback`: compara planejado versus realizado.
- `applyDecisionToPending`: ajusta treinos pendentes.

## Decisões

`REDUZIR` quando:

- dor articular moderada ou forte;
- treino não concluído com esforço alto;
- distância muito abaixo com fadiga alta.

`MANTER` quando:

- treino concluído;
- distância dentro do esperado;
- esforço controlado;
- sem dor articular relevante.

`AUMENTAR` quando:

- treino concluído;
- sem dor;
- esforço leve/controlado;
- ritmo real melhor que o previsto;
- sensação final positiva.

## Modelos de Treino

- `caminhada_diagnostica`
- `caminhada_progressiva`
- `corrida_caminhada_curta`
- `corrida_caminhada_base`
- `corrida_leve_continua`
- `progressivo_controlado`
- `recuperacao`

Cada modelo gera blocos diferentes. O sistema não usa mais um único padrão fixo para todos os perfis.

## Disponibilidade

A disponibilidade do corredor é regra central.

- 1 dia: diagnóstico.
- 2 dias: diagnóstico + treino controlado.
- Dias seguidos: inclui recuperação.
- Objetivo 5 km ou 10 km com prontidão adequada: inclui base, progressivo e longo leve.
- Risco alto: prioriza recuperação e baixo impacto.

## Persistência

Tudo fica em `localStorage`, chave `corridag-motor-v2`.

## Fora do Escopo

- login;
- backend;
- IA externa;
- musculação;
- treino funcional;
- dashboard técnico;
- perguntas abertas para decisão do motor.
