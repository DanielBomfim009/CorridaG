# Arquitetura CorridaG

## Visão Geral

O CorridaG é um PWA mobile-first de cardio com decisão local baseada em regras.
Toda a inteligência roda no navegador com persistência em `localStorage`, sem
backend, sem login e sem dependências de IA externa.

## Camadas

### 1. Interface

- `index.html`: estrutura semântica do app, telas, abas e formulários.
- `styles.css`: design mobile-first, tema visual, navegação inferior e responsividade.

### 2. Aplicação

- `app.js`: orquestração principal do estado, renderização, eventos e regras.

Responsabilidades principais:

- Inicializar o estado.
- Hidratar dados persistidos.
- Reagir a formulários, abas e botões.
- Recalcular indicadores.
- Gerar treinos semanais.
- Gerar análises do personal.
- Alimentar os gráficos.

### 3. Motor Inteligente

Implementado em `app.js` por funções puras e regras declarativas.

Entradas analisadas:

- Perfil.
- IMC.
- Faixa etária.
- Restrições.
- Risco ortopédico.
- Risco cardiometabólico.
- Disponibilidade semanal.
- Objetivo primário.
- Objetivo secundário.
- Prática atual de caminhada e corrida.
- Histórico recente.
- Aderência.
- Tendência de pace.
- Hidratação.
- Jejum.
- Sono.
- Regularidade.
- Fadiga.
- Dor muscular.
- Dor articular.

Saídas geradas:

- Plano semanal.
- Treino do dia.
- Decisão semanal.
- Análise do personal.
- Recomendações de segurança.
- Risco do perfil.
- Intensidade por treino.
- Regras aplicadas no plano.

O motor não tenta ser uma lista fechada de casos. Ele usa uma matriz expansível
de sinais, pesos, redutores e gatilhos. Cada pessoa passa por uma avaliação de
risco antes da montagem do plano, e cada semana passa por uma nova avaliação de
resposta ao treino.

### 4. Persistência

Persistência local em `localStorage` com um único snapshot versionado:

- `corridag-state`

Coleções salvas:

- Perfil.
- Metas.
- Treinos semanais.
- Histórico de treinos.
- Feedbacks.
- Peso.
- Água.
- Jejum.
- Decisões.

### 5. Visualização

- Dashboard para resumo diário.
- Plano semanal em blocos.
- Feedback pós-treino.
- Saúde com água, jejum e peso.
- Histórico com análises, treinos e backup.
- Gráficos com Chart.js.

### 6. PWA

- `manifest.json`
- `service-worker.js`
- Cache do shell do app para uso repetido.

## Fluxo Principal

1. Usuário passa pelo onboarding e cadastra perfil/disponibilidade.
2. Sistema calcula IMC, risco do perfil e sugestão-base.
3. Motor gera um plano semanal estável.
4. Usuário executa o treino e registra feedback.
5. Sistema classifica a semana como `MANTER`, `REDUZIR` ou `EVOLUIR`.
6. A alteração real do treino só entra na semana seguinte, salvo risco imediato.

## Regras-Chave

- Segurança tem prioridade máxima.
- Impacto reduz ao detectar dor articular relevante.
- Perfis com IMC alto, restrição articular ou risco cardiometabólico recebem carga mais conservadora.
- Usuários iniciantes ou pouco ativos passam por fase de adaptação antes de progressão.
- Treinos incompletos, fadiga alta, queda de pace, sono baixo ou jejum longo reduzem a prontidão.
- O treino só muda semanalmente, salvo risco.
- Evolução depende de regularidade, baixa fadiga, ausência de dor articular e recuperação suficiente.
- Hidratação, sono e jejum modulam a análise, mas não substituem os sinais de segurança.

## Preparação Para GitHub Pages

O projeto usa apenas arquivos estáticos e caminhos relativos, então pode ser
publicado diretamente no GitHub Pages sem etapa de build.
