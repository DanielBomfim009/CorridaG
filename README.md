# CorridaG

PWA mobile-first focado exclusivamente em cardio, com motor de regras local para gerar
treinos semanais, acompanhar feedbacks e orientar a progressao com seguranca.

## O que foi entregue

- arquitetura documentada em `docs/ARQUITETURA.md`
- interface mobile-first em HTML, CSS e JavaScript puro
- persistencia completa em `localStorage`
- motor inteligente por regras, pontuacao de risco e sinais de recuperacao
- geracao de plano semanal baseada em perfil, objetivo, restricoes, historico e disponibilidade
- dashboard com peso, agua, jejum, treino do dia e analise do personal
- feedback de treino e historico de decisoes
- registro de treino concluido ou incompleto
- graficos com Chart.js
- exportacao e importacao de backup JSON
- `manifest.json` e `service-worker.js` para PWA

## Motor inteligente

O app foi desenhado para uso geral, nao para um unico perfil. O motor avalia
IMC, idade, nivel, objetivo primario, objetivo secundario, horario, dias
disponiveis, restricoes, aderencia, dor articular, dor muscular, cansaco, pace,
queda de desempenho, hidratacao e jejum.

A saida nao e uma escolha manual do usuario. O sistema decide distancia,
intensidade, estrutura e progressao semanal com prioridade em seguranca,
constancia e evolucao.

## Caso de teste obrigatorio

O botao `Carregar caso Daniel` preenche o usuario exigido na especificacao e injeta o
feedback real:

- Daniel
- 22 anos
- 120,5 kg
- 1,80 m
- pouco ativo
- emagrecimento
- correr 5 km
- apos 18h
- 4,4 km em 39:54
- pace 9:03
- cansaco controlado
- dor muscular leve
- sem dor articular

Resultado esperado no historico de decisoes:

`MANTER` com a justificativa de que o treino foi bem executado, com cansaco controlado
e sem necessidade de alterar o plano da semana.

## Como executar

1. Abra `index.html` no navegador.
2. Salve o perfil ou carregue o caso Daniel.
3. Gere o plano semanal.
4. Registre agua, jejum, peso e feedbacks.
5. Exporte o JSON se quiser manter um backup local.

## GitHub Pages

Como o projeto e 100% estatico, basta publicar o conteudo desta pasta em um repositorio
e habilitar o GitHub Pages apontando para a branch principal.
