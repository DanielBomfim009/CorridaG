# Arquitetura CorridaG V1

## Visão Geral

O CorridaG V1 é um PWA mobile-first que funciona como um Personal Trainer Cardio Digital. Ele não é rastreador de corrida, dashboard fitness ou app para o usuário montar treinos.

O usuário informa quem é, qual objetivo possui e quando pode treinar. O sistema calcula o restante: distância, pace, estrutura do treino, orientação de água, sugestão de jejum e decisão após feedback.

## Telas

- `Perfil`: coleta dados pessoais, objetivo, disponibilidade, restrições e experiência atual.
- `Análise do Personal`: explica em linguagem humana por que o plano foi escolhido.
- `Treino da Semana`: mostra o plano semanal por blocos, com pace guia e marcação de conclusão.
- `Feedback`: registra conclusão, distância, tempo, pace, cansaço e dores.
- `Água`: calcula a meta diária pelo peso e permite registro rápido.
- `Jejum`: orienta uma janela simples de 0h, 12h, 14h ou 16h.
- `Histórico`: mostra apenas semana, treino, resultado e decisão.

## Arquivos

- `index.html`: estrutura semântica das sete telas.
- `styles.css`: interface escura, mobile-first, cards, abas e navegação inferior.
- `app.js`: estado, renderização, eventos, persistência e Motor de Decisão Cardio.
- `manifest.json`: configuração PWA.
- `service-worker.js`: cache do shell estático.

## Motor de Decisão Cardio

O motor não usa IA externa. As decisões são baseadas em regras locais.

Entradas principais:

- idade;
- peso;
- altura;
- IMC;
- nível atual;
- objetivo principal;
- dias disponíveis;
- horário de treino;
- restrição principal;
- experiência atual de caminhada/corrida;
- último pace conhecido, quando informado;
- feedback do treino.

Saídas principais:

- análise textual do personal;
- distância inicial;
- frequência semanal;
- pace de caminhada, corrida leve e recuperação;
- treino semanal por blocos;
- resposta após feedback;
- decisão `MANTER`, `REDUZIR` ou `EVOLUIR`.

## Regras de Decisão

`REDUZIR` quando:

- dor articular >= 4;
- cansaço >= 8;
- treino não concluído.

`MANTER` quando:

- treino concluído;
- cansaço <= 6;
- dor articular <= 2.

`EVOLUIR` quando:

- semana concluída;
- todos os treinos feitos;
- sem dor articular;
- cansaço médio <= 5.

## Regra Principal

O treino permanece durante toda a semana. Ele não muda diariamente e não muda por qualquer feedback isolado.

Exceções de segurança:

- dor articular relevante;
- fadiga extrema;
- incapacidade de concluir.

Fora desses casos, o sistema mantém o plano. Evolução real entra apenas na próxima semana.

## Persistência

Tudo é salvo em `localStorage` usando a chave `corridag-v1-state`.

Dados salvos:

- perfil;
- análise atual;
- plano semanal;
- blocos concluídos;
- feedbacks;
- decisões;
- água do dia;
- histórico de água;
- opção de jejum.

Como não há login nem backend, o app mantém exportação e importação de JSON para backup.

## PWA e GitHub Pages

O projeto é estático, usa caminhos relativos e pode ser publicado diretamente no GitHub Pages sem etapa de build.
