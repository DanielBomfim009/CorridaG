# CorridaG

PWA mobile-first de cardio que simula a experiência de acompanhamento por um personal trainer digital.

O CorridaG não é tracker de corrida, relógio esportivo, dashboard fitness ou planilha de métricas. O usuário informa perfil, objetivo e disponibilidade. O sistema decide distância, pace, frequência e estrutura do treino.

## Direção de Produto

A nova versão usa como referência de experiência apps profissionais de personal trainer, como o MFIT Personal: poucos elementos por tela, cards grandes, navegação simples, anamnese, prescrição e feedback.

O objetivo não é copiar marca ou interface de outro app. O objetivo é aplicar a mesma lógica de produto: o usuário sente que existe um treinador acompanhando sua evolução.

## Menu Principal

- `Home`: análise do personal, treino de hoje, água, jejum e peso.
- `Treino`: treino do dia em destaque e etapas em cards.
- `Personal`: análise completa, justificativas e decisão atual.
- `Saúde`: água, jejum e peso de forma simples.
- `Perfil`: avaliação inicial e backup de dados.

## Motor de Decisão

O Motor de Decisão Cardio roda 100% no navegador, sem IA externa e sem backend.

Entradas analisadas:

- idade;
- peso;
- altura;
- IMC;
- nível atual;
- objetivo;
- horário;
- dias disponíveis;
- restrição principal;
- experiência atual;
- último pace conhecido;
- feedback de treino.

Decisões:

- `MANTER`: treino concluído, cansaço controlado e sem dor articular relevante.
- `REDUZIR`: dor articular, fadiga extrema ou treino não concluído.
- `EVOLUIR`: semana concluída, todos os treinos feitos, baixa fadiga e sem dor articular.

A evolução entra apenas na semana seguinte. O treino não muda diariamente.

## Execução

Abra `index.html` no navegador. O app é estático, salva tudo em `localStorage` e possui `manifest.json` + `service-worker.js` para uso como PWA.
