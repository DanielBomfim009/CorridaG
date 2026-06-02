# Arquitetura CorridaG

## Visao geral

O CorridaG e um PWA mobile-first de cardio com decisao local baseada em regras.
Toda a inteligencia roda no navegador com persistencia em `localStorage`, sem backend,
sem login e sem dependencias de IA externa.

## Camadas

### 1. Interface

- `index.html`: estrutura semantica do app, secoes e formularios.
- `styles.css`: design mobile-first, sistema visual e responsividade.

### 2. Aplicacao

- `app.js`: orquestracao principal do estado, renderizacao, eventos e regras.

Responsabilidades principais:

- inicializar o estado
- hidratar dados persistidos
- reagir a formularios e botoes
- recalcular indicadores
- gerar treinos semanais
- gerar analises do personal
- alimentar os graficos

### 3. Motor inteligente

Implementado em `app.js` por funcoes puras e regras declarativas.

Entradas analisadas:

- perfil
- IMC
- faixa etaria
- restricoes
- risco ortopedico
- risco cardiometabolico
- disponibilidade semanal
- objetivo primario
- objetivo secundario
- historico recente
- aderencia
- tendencia de pace
- hidratacao
- jejum
- regularidade
- fadiga
- dor muscular
- dor articular

Saidas geradas:

- plano semanal
- treino do dia
- decisao semanal
- analise do personal
- recomendacoes de seguranca
- risco do perfil
- intensidade por treino
- regras aplicadas no plano

O motor nao tenta ser uma lista fechada de casos. Ele usa uma matriz expansivel
de sinais, pesos, redutores e gatilhos. Cada pessoa passa por uma avaliacao de
risco antes da montagem do plano, e cada semana passa por uma nova avaliacao de
resposta ao treino.

### 4. Persistencia

Persistencia local em `localStorage` com um unico snapshot versionado:

- `corridag-state`

Colecoes salvas:

- perfil
- metas
- treinos semanais
- historico de treinos
- feedbacks
- peso
- agua
- jejum
- decisoes

### 5. Visualizacao

- cards para resumo diario
- timeline de treino em blocos
- tabelas de historico
- graficos com Chart.js

### 6. PWA

- `manifest.json`
- `service-worker.js`
- cache de shell do app para uso repetido

## Fluxo principal

1. Usuario cadastra perfil e disponibilidade.
2. Sistema calcula IMC, perfil de risco e sugestao-base.
3. Motor gera um plano semanal estavel.
4. Usuario executa o treino e registra feedback.
5. Sistema classifica a semana como `MANTER`, `REDUZIR` ou `EVOLUIR`.
6. A alteracao real do treino so entra na semana seguinte.

## Regras-chave

- seguranca tem prioridade maxima
- impacto reduz ao detectar dor articular relevante
- perfis com IMC alto, restricao articular ou risco cardiometabolico recebem carga mais conservadora
- usuarios iniciantes ou pouco ativos passam por fase de adaptacao antes de progressao
- treinos incompletos, fadiga alta, queda de pace ou jejum longo reduzem a prontidao
- treino so muda semanalmente, salvo risco
- evolucao depende de regularidade + baixa fadiga + ausencia de dor articular + recuperacao suficiente
- hidratacao e jejum modulam a analise, nao substituem os sinais de seguranca

## Preparacao para GitHub Pages

O projeto usa apenas arquivos estaticos e caminhos relativos, entao pode ser publicado
diretamente no GitHub Pages sem etapa de build.
