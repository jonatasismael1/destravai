# Plano de Redesign Visual - Destravai

Data: 02/06/2026  
Objetivo: deixar o Destravai com cara de app padrão de celular, natural em dark e light mode, com identidade visual própria aplicada de forma mais sutil e consistente.

## Veredito de Direção

O Destravai não precisa parecer uma landing, nem um painel SaaS cheio de cards chamativos. Ele deve parecer um app mobile instalado: limpo, previsível, confortável de usar todos os dias e com a marca aparecendo nos detalhes.

A identidade visual deve sair do excesso de gradientes, brilhos e orbs e passar para um sistema mais clássico:

- Dark mode preto natural, próximo de apps mobile premium.
- Light mode branco natural, sem fundo lilás dominante.
- Roxo do Destravai como cor de ação e foco, não como fundo permanente.
- Verde, coral e âmbar apenas para estados funcionais: sucesso, erro, alerta, progresso.
- Componentes mais nativos: barras, listas, botões, folhas inferiores, inputs e abas com menos decoração.

## Princípios

1. **App antes de marca**

   A primeira sensação deve ser: "isso é um app de celular confiável". A marca aparece no acento roxo, no ícone, em pequenos estados ativos e em momentos especiais, não em todo card.

2. **Dark e light clássicos**

   O dark deve ser preto/charcoal com contraste confortável. O light deve ser branco/off-white neutro. Evitar que o light mode pareça uma página lilás.

3. **Menos glow, mais hierarquia**

   Trocar sombra colorida e gradiente por espaçamento, tipografia, peso, borda sutil e estados claros.

4. **Uma ação principal por tela**

   Cada tela deve deixar claro qual é a ação natural: Hoje gera missão, Criar gera roteiro, Espaço organiza, Agenda planeja, Grupos conecta.

5. **Identidade visual funcional**

   Roxo significa ação, seleção ou inteligência da Deby. Não deve ser usado em excesso para qualquer fundo ou card.

## Problemas Atuais que o Redesign Resolve

- Uso dominante de roxo/gradiente em muitas telas.
- Orbs decorativos deixando o app com aparência mais "landing" do que app nativo.
- Cards grandes e muito destacados competindo entre si.
- Light mode com sensação lilás, menos clássico.
- Alguns emojis estruturais destoando dos ícones Lucide.
- Navbar com visual bonito, mas ainda mais "custom app" do que "app mobile padrão".
- Muitas cores inline em componentes, dificultando consistência.

## Paleta Proposta

### Dark Mode

Use como base:

```css
--bg-base: #0B0B0D;
--bg-elevated: #141416;
--bg-surface: #1C1C1F;
--bg-input: #202024;

--text-primary: #F5F5F7;
--text-secondary: #B7B7BD;
--text-muted: #777780;

--border-subtle: rgba(255,255,255,0.08);
--border-strong: rgba(255,255,255,0.14);
```

Leitura: preto clássico, com superfícies levemente elevadas. Menos azul/roxo no fundo.

### Light Mode

Use como base:

```css
--bg-base: #F8F8FA;
--bg-elevated: #FFFFFF;
--bg-surface: #F1F1F4;
--bg-input: #F2F2F5;

--text-primary: #161618;
--text-secondary: #555560;
--text-muted: #8A8A93;

--border-subtle: rgba(20,20,24,0.08);
--border-strong: rgba(20,20,24,0.14);
```

Leitura: branco clássico de app, próximo de iOS/Android moderno. Não usar fundo geral lilás.

### Marca

```css
--brand: #6D5DF6;
--brand-soft: rgba(109,93,246,0.10);
--brand-border: rgba(109,93,246,0.24);
--brand-strong: #5748D8;
```

Uso:

- Botão principal.
- Estado ativo da navbar.
- Focus ring de input.
- Destaques da Deby.
- Chips selecionados.
- Pequenas barras/progressos.

Evitar:

- Gradiente roxo em todo card.
- Fundo lilás em toda página.
- Glow roxo forte em botões comuns.

### Estados

```css
--success: #22C55E;
--warning: #F59E0B;
--danger: #EF4444;
--info: #0EA5E9;
```

Uso:

- Sucesso: missão feita, pagamento confirmado, salvo.
- Warning: assinatura pendente, QR expirando, atenção.
- Danger: erro, excluir, pagamento falhou.
- Info: ajuda, mensagens informativas.

## Tokens Visuais

### Radius

Hoje há muito `rounded-3xl` e cards muito arredondados. Para parecer app padrão:

- Botões: 12px a 14px.
- Inputs: 12px.
- Cards/list items: 14px a 16px.
- Bottom sheets/modais: 24px só no topo.
- Avatares: circular.

Regra: usar `rounded-2xl` apenas quando o elemento for grande. Evitar `rounded-3xl` como padrão.

### Sombras

Dark mode:

```css
--shadow-card: 0 1px 0 rgba(255,255,255,0.04), 0 12px 30px rgba(0,0,0,0.28);
```

Light mode:

```css
--shadow-card: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
```

Evitar sombras coloridas como padrão. Usar glow roxo só em momentos premium ou CTA principal.

### Tipografia

Manter Manrope se quiser preservar identidade, mas aplicar mais disciplina:

- Títulos de tela: 26-30px, peso 800.
- Títulos de seção: 15-17px, peso 800.
- Texto de card: 14px.
- Texto auxiliar: 12px.
- Navbar label: 10px, sem uppercase exagerado.
- Evitar letter-spacing negativo.
- Usar uppercase só para badges pequenos, não para labels principais.

## Layout Global

### Fundo

Trocar orbs permanentes por fundo plano:

- Dark: `#0B0B0D`.
- Light: `#F8F8FA`.

Se quiser manter um toque de marca:

- Usar um gradiente muito sutil só no topo da Home ou onboarding.
- Não usar orbs em todas as telas.
- Não usar ruído/fundo texturizado como base.

### App Shell

Manter mobile-first com `max-w-md`, mas deixar o app parecer um aparelho:

- Conteúdo centralizado.
- Fundo externo neutro em desktop.
- Em desktop, opcional: frame visual discreto simulando app, sem exagero.

### Espaçamento

Padrão por tela:

- Padding horizontal: 20px.
- Espaço entre seções: 20px.
- Espaço entre cards/list items: 10-12px.
- Header de tela: 24px top, 16px bottom.

Evitar muitos cards grandes empilhados com gradiente.

## Componentes

### Botão Primário

Direção:

- Roxo sólido ou gradiente muito sutil.
- Sem glow permanente.
- Altura 48-52px.
- Radius 12-14px.
- Texto claro e direto.

Exemplo:

```css
.btn-primary {
  background: var(--brand);
  color: #fff;
  border-radius: 14px;
  box-shadow: none;
}

.btn-primary:active {
  transform: scale(0.98);
}
```

### Botão Secundário

Direção:

- Fundo de superfície.
- Borda sutil.
- Texto primário.
- Sem gradiente.

### Cards

Tipos:

1. **Card de ação**

   Para "Gerar missão", "Criar grupo", "Planejar semana".

   Visual: superfície elevada, borda sutil, ícone à esquerda, texto e seta.

2. **Card de conteúdo**

   Para roteiro, item da biblioteca, item da agenda.

   Visual: mais informacional, menos decorativo. CTA embaixo.

3. **Card de status**

   Para progresso, assinatura, ranking.

   Visual: números claros, ícones pequenos, acentos funcionais.

Regra: card não deve depender de gradiente para parecer importante. Importância vem de posição, texto e ação.

### Inputs

Parecer nativo:

- Fundo `--bg-input`.
- Borda `--border-subtle`.
- Focus com ring roxo leve.
- Placeholder cinza.
- Evitar fundo roxo ao focar, usar apenas borda/ring.

### Chips e Tabs

Chips inativos:

- Fundo superfície.
- Borda sutil.
- Texto secundário.

Chips ativos:

- Fundo `--brand-soft`.
- Borda `--brand-border`.
- Texto `--brand`.

Evitar chip ativo com gradiente forte em todos os contextos.

### Bottom Sheets

Padronizar modais de baixo:

- Fundo `--bg-elevated`.
- Radius topo 24px.
- Overlay preto 50-60%.
- Header com título, subtítulo opcional e botão X.
- Ações no rodapé.

### Toast

Hoje os toasts estão escuros e funcionais. Ajustar para usar tokens:

- Fundo `--bg-elevated`.
- Borda por estado.
- Texto primário.
- Ícone do estado.

## Navbar

### Direção Visual

Deve parecer uma tab bar de app.

- Fundo com blur leve.
- Borda superior sutil.
- Ícone 22px.
- Label 10px.
- Estado ativo com ícone roxo e pequeno indicador, não com card roxo atrás.
- Sem uppercase pesado.
- Sem bolha ativa grande.

### Ordem Recomendada

Versão ideal com 5 itens:

1. Hoje
2. Criar
3. Espaço
4. Agenda
5. Grupos

Ajustes deve ficar:

- No topo de Home/Espaço como ícone de engrenagem.
- Ou dentro de uma tela Perfil/Ajustes.

Se mantiver 6 itens:

1. Hoje
2. Criar
3. Espaço
4. Agenda
5. Grupos
6. Ajustes

Trocar label "Ranking" para "Grupos". Ranking é uma função interna; Grupos é o lugar mental.

## Redesign por Tela

### 1. Login

Meta: parecer tela nativa de entrada.

Mudanças:

- Fundo plano dark/light.
- Logo menor.
- Card único ou formulário sem card, dependendo do tema.
- Botões sociais/senha com padrão limpo.
- Menos glow no logo.

### 2. Checkout

Meta: manter confiança, mas reduzir lilás no light mode.

Mudanças:

- Fundo branco clássico.
- Cards brancos com borda cinza clara.
- Roxo só no CTA, seleção Pix/cartão e pequenos selos.
- Remover orbs de fundo.
- Manter segurança, preço e benefícios.

### 3. Onboarding

Meta: parecer setup de app.

Mudanças:

- Fundo plano.
- Step indicator mais discreto.
- Cards de opção com borda e check.
- CTA fixo no rodapé.
- Context tip menos chamativo.

### 4. Home / Hoje

Meta: tela principal, limpa e acionável.

Estrutura ideal:

1. Header com saudação e data.
2. Bloco pequeno de progresso.
3. Pergunta principal: "O que você quer postar hoje?"
4. Grid de check-ins.
5. Missão gerada.
6. Atalhos pequenos: Agenda, Biblioteca, Progresso.

Mudanças:

- Reduzir cards decorativos.
- Deixar check-ins com cara de botões nativos.
- Missão gerada deve ser o maior bloco da tela.
- "Surpreenda-me" pode ser botão secundário, não card chamativo.

### 5. Criar

Meta: tela de ferramenta.

Mudanças:

- Tabs mais nativas no topo.
- Inputs em blocos simples.
- Deby como assistente contextual, não como brilho visual.
- CTA secundário para CTAs personalizados permanece.

### 6. Espaço

Meta: área pessoal e acervo.

Estrutura ideal:

- Segmented control: Meu espaço, Biblioteca, Progresso.
- Meu espaço mais diário/reflexivo.
- Biblioteca mais utilitária.
- Progresso mais gamificado.

Mudanças:

- Reduzir emojis estruturais.
- Transformar humor do dia em seleção com ícones/labels mais limpos.
- Biblioteca precisa parecer acervo, com listas densas e filtros claros.

### 7. Biblioteca

Meta: parecer lista de conteúdos salvos.

Mudanças:

- Cards mais compactos.
- Filtros em chips discretos.
- Favorito, editar, duplicar, agenda e gravar como ícones consistentes.
- Empty state com mensagem direta, sem muita decoração.

### 8. Agenda

Meta: calendário de app.

Mudanças:

- Semana em lista vertical simples.
- Dia atual com acento roxo.
- Status de item com bolinhas ou labels pequenos.
- Modais de mover/adicionar em bottom sheet.

### 9. Grupos

Meta: social leve, sem parecer jogo infantil.

Mudanças:

- Label da navbar: Grupos.
- Dentro: abas Ranking e Chat.
- Ranking com avatares, posição e XP limpos.
- Badges/conquistas discretos.
- Evitar excesso de troféus/emojis.

### 10. Studio / Teleprompter

Meta: pode continuar mais imersivo e escuro.

Essa é a exceção: como é câmera/gravação, faz sentido ser preto, com controles fortes e contraste alto.

Mudanças:

- Padronizar controles com ícones.
- Manter vermelho de gravação.
- Reduzir roxo onde não for ação.

## Ícones e Emojis

Regra:

- Ícones Lucide para estrutura, ações e navegação.
- Emojis apenas em texto humano, celebração ou microcopy pontual.

Trocar emojis estruturais por ícones:

- Humor: usar ícones/labels ou manter emojis só dentro da seleção, sem serem o estilo principal.
- Diário: `BookOpen` ou `NotebookPen`.
- Ideias: `Lightbulb`.
- Sugestões: `Sparkles`.
- Ranking: `Trophy`.
- Chat: `MessageSquare`.
- Missão: `Target` ou `Flame` quando for streak.

## Gradientes e Orbs

### Remover como padrão

Remover orbs permanentes em:

- Layout global.
- Checkout.
- Onboarding.
- Cards comuns.

### Manter com restrição

Gradiente pode existir em:

- Botão principal, de forma sutil.
- Logo/ícone do app.
- Tela de celebração ou conquista.
- Um pequeno detalhe da Deby.

Regra: se todo lugar tem gradiente, nada parece especial.

## Plano de Implementação

### Fase 1 - Tokens globais

Objetivo: mudar a base sem quebrar telas.

Arquivos principais:

- `src/index.css`
- `src/components/Layout.tsx`
- `src/context/ThemeContext.tsx`

Ações:

- Substituir tokens dark/light por paleta clássica.
- Criar tokens semânticos: `--bg-base`, `--bg-elevated`, `--bg-surface`, `--action-primary`, `--state-success`, etc.
- Reduzir sombras coloridas globais.
- Remover ou desativar orbs globais no `Layout`.
- Ajustar scrollbar, selection e focus.

Critério de pronto:

- App fica legível em dark e light.
- Nenhuma tela depende de fundo lilás para contraste.
- Navbar continua funcional.

### Fase 2 - Componentes-base

Objetivo: padronizar antes de mexer tela por tela.

Ações:

- Redefinir `.btn-primary`, `.btn-secondary`, `.input`, `.chip`, `.tag`, `.glass`, `.checkout-card`.
- Reduzir `border-radius` padrão.
- Remover glow de botão secundário e cards.
- Criar classes para:
  - `.app-card`
  - `.list-item`
  - `.bottom-sheet`
  - `.segmented-control`
  - `.status-pill`

Critério de pronto:

- Componentes básicos têm a mesma linguagem em todas as telas.
- Inputs, botões e chips parecem de um mesmo app.

### Fase 3 - Navbar e shell

Objetivo: deixar o app com cara de tab bar mobile.

Ações:

- Trocar "Ranking" para "Grupos".
- Decidir se remove "Ajustes" da navbar.
- Diminuir visual ativo: sem card roxo grande.
- Label sem uppercase ou com uppercase menos agressivo.
- Ícones maiores e labels mais legíveis.

Critério de pronto:

- A navbar parece natural em dark e light.
- Não há truncamento ou sensação de excesso.

### Fase 4 - Telas principais

Ordem recomendada:

1. Home
2. Criar
3. Espaço/Biblioteca
4. Agenda
5. Grupos
6. Onboarding
7. Login/Assinatura/Checkout

Motivo: Home, Criar e Espaço são o uso diário. Checkout pode ser refinado depois se já estiver vendendo.

Critério de pronto:

- Cada tela tem uma ação principal clara.
- Cards ficam mais limpos.
- Gradientes viram exceção.
- Emojis estruturais foram reduzidos.

### Fase 5 - QA visual

Testar:

- Dark mode mobile 390x844.
- Light mode mobile 390x844.
- Desktop 1280x800.
- Telas longas com scroll.
- Navbar com safe area.
- Inputs em foco.
- Modais/bottom sheets.
- Estados vazios.
- Estados de erro.
- Loading de IA.

Critério de pronto:

- Nenhum texto estoura.
- Contraste está confortável.
- Dark e light parecem versões naturais do mesmo app.
- O app não parece "landing dentro de app".

## Checklist de Decisão Visual

Use esta lista ao revisar qualquer tela:

- A tela parece um app de celular?
- O fundo é neutro ou está decorativo demais?
- Existe só uma ação principal clara?
- O roxo está guiando ação ou competindo com tudo?
- O card precisa mesmo de gradiente?
- O emoji é necessário ou um ícone resolve melhor?
- O light mode parece branco clássico ou lilás?
- O dark mode parece preto natural ou roxo/preto artificial?
- O texto principal está mais forte que elementos decorativos?
- A tela ficaria confortável de usar todo dia?

## Resultado Esperado

Depois do redesign, o Destravai deve parecer:

- Mais confiável.
- Mais maduro.
- Mais nativo.
- Mais leve para uso diário.
- Menos dependente de decoração.
- Ainda reconhecível pela cor roxa e pela Deby.

A identidade ideal é: **um app clássico de celular com acento roxo inteligente**, não um app roxo.

