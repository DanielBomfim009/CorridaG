# CorridaG

PWA mobile-first focado exclusivamente em cardio. O aplicativo usa um motor local
de regras para gerar planos semanais, interpretar feedbacks e orientar a evolução
com segurança.

## O que foi entregue

- Arquitetura documentada em `docs/ARQUITETURA.md`.
- Interface mobile-first em HTML, CSS e JavaScript puro.
- Onboarding, dashboard, plano semanal, feedback, saúde, histórico, análises e backup.
- Persistência completa em `localStorage`.
- Motor inteligente com pontuação de risco e sinais de recuperação.
- Plano semanal baseado em perfil, objetivos, restrições, histórico e disponibilidade.
- Registro de treino concluído ou incompleto.
- Gráficos com Chart.js.
- Exportação e importação de backup JSON.
- `manifest.json` e `service-worker.js` para PWA.

## Motor inteligente

O app foi desenhado para uso geral, não para um único perfil. O motor avalia IMC,
idade, nível, objetivos, horário, dias disponíveis, restrições, prática atual,
sono, aderência, dor articular, dor muscular, cansaço, pace, queda de desempenho,
hidratação e jejum.

A saída não é uma escolha manual do usuário. O sistema decide distância,
intensidade, estrutura e progressão semanal com prioridade em segurança,
constância e evolução.

## Como executar

1. Abra `index.html` no navegador.
2. Preencha o perfil na tela de avaliação.
3. Gere o plano semanal.
4. Registre água, jejum, peso e feedbacks.
5. Exporte o JSON quando quiser manter um backup local.

## GitHub Pages

Como o projeto é 100% estático, basta publicar o conteúdo desta pasta em um
repositório e habilitar o GitHub Pages apontando para a branch principal.
