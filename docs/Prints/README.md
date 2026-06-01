# Prints das telas — Destravaí

Mockups em formato de tela de celular (390×844, ~iPhone), gerados fielmente a
partir do design real do app (cores, layout, textos). Dados de exemplo, sem
informações sensíveis.

Cada tela tem versão **.png** (pronta para usar em edições/página de vendas) e
**.svg** (vetorial, editável e escalável sem perder qualidade).

| Arquivo | Tela |
|---------|------|
| `01-home` | Início — saudação, nível, constância dia-a-dia, check-in |
| `02-onboarding` | Boas-vindas / onboarding inicial |
| `03-criar-stories` | Geração de stories com IA |
| `04-biblioteca-de-ideias` | Biblioteca de conteúdos salvos |
| `05-teleprompter-gravador` | Gravador com teleprompter |
| `06-constancia-progresso` | Progresso, score e jornada de 7 dias |
| `07-planos-checkout` | Planos e checkout |
| `08-grupos-ranking` | Grupos e ranking de constância |
| `09-minha-essencia` | Minha Essência (posicionamento) |

## Como regenerar

Os mockups são gerados por script (cores e textos editáveis no próprio arquivo):

```bash
node scripts/generate-mockups.mjs
```

Para ajustar cores, textos ou adicionar telas, edite `scripts/generate-mockups.mjs`.
