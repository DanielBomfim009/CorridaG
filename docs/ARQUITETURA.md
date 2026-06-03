# Arquitetura CorridaG

## Visão

O CorridaG é um Personal Trainer Cardio Digital. A aplicação deve parecer uma consultoria de cardio e emagrecimento, não um dashboard esportivo.

O fluxo central é:

Perfil → Análise → Treino → Execução → Feedback → Decisão → Nova análise

## Interface

A interface foi redesenhada com 5 abas fixas no menu inferior:

- `Home`
- `Treino`
- `Personal`
- `Saúde`
- `Perfil`

### Home

Resumo vivo do acompanhamento:

- análise curta do personal;
- treino do dia;
- água;
- jejum;
- peso.

### Treino

Tela focada em execução:

- dia selecionado;
- distância do treino;
- tipo do treino;
- progresso;
- etapas em cards;
- botão de finalizar treino;
- feedback pós-treino.

### Personal

Tela de explicação:

- análise completa;
- justificativa da distância;
- justificativa do pace;
- justificativa da frequência;
- decisão atual.

### Saúde

Controles simples:

- água;
- jejum;
- peso.

### Perfil

Avaliação inicial:

- nome;
- idade;
- peso;
- altura;
- meta de peso;
- nível;
- objetivo;
- horário;
- restrições;
- dias disponíveis;
- experiência atual;
- último pace conhecido;
- backup JSON.

## Arquivos

- `index.html`: estrutura das 5 abas.
- `styles.css`: visual mobile premium, cards grandes e navegação simples.
- `app.js`: estado, renderização, motor de decisão e persistência.
- `manifest.json`: instalação PWA.
- `service-worker.js`: cache do app shell.

## Persistência

Tudo é local.

Chave principal:

- `corridag-personal-v1`

Dados salvos:

- perfil;
- análise;
- plano semanal;
- feedbacks;
- decisão atual;
- água;
- jejum;
- peso;
- backup importado.

## Motor de Decisão Cardio

O motor usa regras locais e linguagem humana. Ele calcula:

- risco do perfil;
- distância inicial;
- frequência semanal;
- tipo de treino;
- pace de caminhada;
- pace de corrida leve;
- pace de recuperação;
- resposta pós-feedback.

## Regras

Segurança vem antes de evolução.

`REDUZIR` quando:

- dor articular >= 4;
- cansaço >= 8;
- treino não concluído.

`MANTER` quando:

- treino concluído;
- cansaço <= 6;
- dor articular <= 2.

`EVOLUIR` quando:

- todos os treinos da semana foram concluídos;
- cansaço médio <= 5;
- sem dor articular relevante.

## Fora do Escopo

- login;
- backend;
- IA externa;
- dashboard técnico;
- excesso de gráficos;
- musculação;
- funcional;
- treino de força.
