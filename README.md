# CorridaG

PWA mobile-first focado exclusivamente em cardio, com motor de regras local para gerar
treinos semanais, acompanhar feedbacks e orientar a progressao com seguranca.

## O que foi entregue

- arquitetura documentada em `docs/ARQUITETURA.md`
- interface mobile-first em HTML, CSS e JavaScript puro
- persistencia completa em `localStorage`
- geracao de plano semanal baseada em perfil, objetivo e restricoes
- dashboard com peso, agua, jejum, treino do dia e analise do personal
- feedback de treino e historico de decisoes
- graficos com Chart.js
- exportacao e importacao de backup JSON
- `manifest.json` e `service-worker.js` para PWA

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
