# redesign_pagina_vendas_checkout

# Guia Mestre de Redesign — Página de Vendas + Checkout Destravaí

Este documento reúne, em um único guia, as orientações finais para o redesign da **página de vendas** e da **página de checkout** do Destravaí.

Ele deve ser usado como referência principal para implementação no Codex.

---

## 1. Objetivo Geral

Redesenhar a experiência comercial do Destravaí, contemplando:

1. Página de vendas;
2. Fluxo visual até o checkout;
3. Página de checkout;
4. Identidade visual;
5. Copy de conversão;
6. Responsividade;
7. Microinterações;
8. Critérios técnicos para implementação.

O objetivo é transformar a experiência atual em algo mais:

- moderno;
- leve;
- estratégico;
- humano;
- confiável;
- premium;
- claro;
- voltado para conversão.

A sensação desejada ao abrir o Destravaí é:

> “Agora eu sei o que fazer.”

A interface deve reduzir ansiedade, não aumentar tarefas.

---

## 2. Referência Visual

O estilo do Filmly pode ser usado como **referência de fluidez, atmosfera, sofisticação visual e efeitos de scroll**, mas **não deve ser copiado literalmente**.

A identidade final precisa ser do Destravaí.

Use a referência apenas para:

- sensação premium;
- movimento suave;
- scroll mais envolvente;
- uso de cards visuais;
- seções com ritmo;
- atmosfera moderna;
- mockups bem apresentados.

Não copiar:

- identidade visual;
- composição exata;
- animações exageradas;
- estrutura que não faça sentido para o Destravaí.

---

## 3. Direção Visual do Destravaí

O Destravaí deve parecer:

- moderno;
- leve;
- estratégico;
- humano;
- tecnológico;
- criativo;
- direto;
- confiável;
- fácil de usar.

A estética deve equilibrar:

**tecnologia + criatividade + movimento + sofisticação + clareza + acolhimento.**

A marca não deve parecer:

- ferramenta genérica de IA;
- app frio demais;
- produto complexo;
- ferramenta apenas para creators;
- visual infantil;
- interface de produtividade comum.

O Destravaí é um app para quem quer aparecer com mais constância, criar conexão com o público e vender melhor, sem perder horas pensando no que postar.

---

## 4. Identidade Visual

### 4.1. Nome

**Destravaí**

### 4.2. Logo

Usar a logo atual do Destravaí, com o conceito de:

- destrave;
- abertura;
- conteúdo;
- ação;
- ideia saindo do bloqueio;
- presença digital.

A logo atual possui um ícone visual de abertura/destrave/conteúdo com a mão e o wordmark “Destravaí”.

Evitar tratar o símbolo principal como apenas um raio ou `Zap`, a menos que isso já esteja implementado em alguma área interna do produto.

### 4.3. Cor principal

A identidade principal deve continuar sendo **roxa**.

O verde/mint deve ser usado apenas como cor de apoio, especialmente para:

- check;
- progresso;
- status positivo;
- confirmação;
- sucesso;
- conclusão;
- gamificação.

Não usar verde como cor principal da marca.

---

## 5. Design System

### 5.1. Fonte

Usar **Manrope** como fonte principal.

Pesos recomendados:

- 400;
- 500;
- 600;
- 700;
- 800.

Caso a fonte já exista no projeto, reaproveitar.  
Caso não exista, implementar via Google Fonts ou import equivalente.

### 5.2. Cores de Marca

| Token | Hex | Uso |
|---|---|---|
| Pulse Purple | `#6D5DF6` | Cor principal, botões, elementos ativos |
| Electric Lilac | `#9B8CFF` | Destaques, hover, elementos de IA, gradientes |
| Coral Action | `#FF7A6B` | Destaques pontuais, energia, alertas leves |
| Mint Signal | `#53D6A1` | Checks, progresso, status positivo |
| Amber Note | `#F7B955` | Avisos, atenção, tempo estimado |

### 5.3. Gradientes

Gradiente principal:

```css
linear-gradient(135deg, #6D5DF6 0%, #9B8CFF 100%)
```

Gradiente coral:

```css
linear-gradient(135deg, #FF7A6B 0%, #F7B955 100%)
```

Gradiente suave de fundo claro:

```css
linear-gradient(180deg, #FAF8FF 0%, #F6F2FF 45%, #FFFFFF 100%)
```

### 5.4. Tema Escuro

```css
:root {
  --bg-base: #0D0B14;
  --bg-card: rgba(255,255,255,0.04);
  --bg-card-bright: rgba(255,255,255,0.08);
  --bg-input: rgba(255,255,255,0.05);
  --text-primary: #F0EEF8;
  --text-secondary: rgba(240,238,248,0.55);
  --text-muted: rgba(240,238,248,0.32);
  --border-color: rgba(255,255,255,0.08);
  --border-bright: rgba(255,255,255,0.14);
  --nav-bg: rgba(13,11,20,0.75);
}
```

### 5.5. Tema Claro

O tema claro deve ser usado principalmente para checkout e pode ser usado em áreas comerciais específicas.

```css
.light-theme {
  --bg-base: #FAF8FF;
  --bg-soft: #F6F2FF;
  --bg-card: rgba(255,255,255,0.72);
  --bg-card-bright: rgba(255,255,255,0.92);
  --bg-input: rgba(255,255,255,0.88);
  --text-primary: #111027;
  --text-secondary: rgba(17,16,39,0.62);
  --text-muted: rgba(17,16,39,0.42);
  --border-color: rgba(109,93,246,0.14);
  --border-bright: rgba(109,93,246,0.24);
  --shadow-soft: 0 18px 60px rgba(109,93,246,0.12);
}
```

### 5.6. Regra de Ouro

Não usar cores hardcoded de fundo, texto e borda nos componentes principais.

Sempre usar tokens para:

- fundo;
- texto;
- bordas;
- cards;
- inputs.

As cores de marca podem ser usadas diretamente quando fizer sentido.

---

## 6. Tipografia

| Nível | Peso | Tamanho sugerido | Uso |
|---|---|---|---|
| Display / H1 | 800 | 44px–64px no desktop | Hero e chamadas principais |
| H2 | 800 | 32px–44px | Títulos de seção |
| H3 | 700–800 | 20px–24px | Subtítulos e cards |
| Body | 400–500 | 15px–18px | Texto corrente |
| Small | 500–600 | 13px–14px | Texto secundário |
| Microcopy / Label | 700 uppercase | 10px–12px | Labels, tags, eyebrows |

Regras:

- Inputs sempre com `font-size: 16px` para evitar zoom automático no iOS;
- Títulos com `tracking-tight`;
- Labels com `tracking-widest` e `uppercase` quando fizer sentido;
- Evitar blocos longos demais;
- Priorizar frases curtas e claras.

---

## 7. Espaçamento, Bordas e Sombras

### 7.1. Escala de Espaçamento

Usar escala baseada em 4px:

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`

### 7.2. Border Radius

| Elemento | Radius |
|---|---|
| Cards grandes/glass | 24px–28px |
| Cards médios | 18px–20px |
| Botões | 14px–18px |
| Inputs | 14px–16px |
| Chips/tags | 999px |
| Ícones quadrados | 12px–16px |

### 7.3. Sombras

Cards no tema escuro:

```css
0 8px 32px rgba(0,0,0,0.4)
```

Cards no tema claro:

```css
0 18px 60px rgba(109,93,246,0.12)
```

Glow roxo ativo:

```css
0 0 24px rgba(109,93,246,0.45)
```

Botão principal:

```css
0 16px 38px rgba(109,93,246,0.35)
```

---

## 8. Componentes

### 8.1. Cards

Criar ou reaproveitar classes como:

- `.glass`;
- `.glass-sm`;
- `.glass-bright`;
- `.glass-active`.

Características:

- fundo translúcido;
- borda suave;
- blur sutil;
- sombra leve;
- cantos arredondados;
- contraste suficiente para leitura.

### 8.2. Botões

Classes sugeridas:

- `.btn-primary`;
- `.btn-secondary`;
- `.btn-ghost`.

O botão primário deve usar o gradiente roxo.

Estados:

- hover: brilho sutil;
- active: `scale(0.98)`;
- focus: borda/outline acessível;
- disabled: opacidade reduzida e cursor adequado.

### 8.3. Inputs

Inputs devem ter:

- altura confortável;
- borda suave;
- radius entre 14px e 16px;
- fundo claro no checkout;
- ícone à esquerda quando possível;
- foco com borda roxa;
- glow sutil no focus;
- font-size mínimo de 16px.

### 8.4. Chips e Tags

Usar para:

- profissões;
- categorias;
- status;
- benefícios;
- público-alvo.

Classes sugeridas:

- `.chip`;
- `.chip-active`;
- `.chip-inactive`;
- `.tag-purple`;
- `.tag-coral`;
- `.tag-mint`;
- `.tag-amber`.

---

## 9. Animações e Microinterações

Animações devem ser suaves e leves.

Usar:

| Animação | Uso |
|---|---|
| `animate-fade-up` | Entrada de seções, cards e textos |
| `animate-float` | Mockups, ícones e elementos decorativos |
| `animate-pulse` | Indicadores de IA, gravação e status |
| `animate-orb-pulse` | Orbs de fundo |
| `animate-spin` | Carregamentos |

Transições padrão:

```css
transition: all 200ms ease;
```

ou

```css
transition: all 300ms ease;
```

Evitar:

- animações pesadas;
- excesso de movimento;
- scroll confuso;
- efeitos que prejudiquem performance;
- paralaxe exagerado.

Respeitar `prefers-reduced-motion`.

---

# Parte 1 — Página de Vendas

## 10. Estrutura Geral da Página de Vendas

Seções principais:

1. Header;
2. Hero;
3. Dor;
4. Virada/Solução;
5. Como funciona;
6. Recursos;
7. Para quem é;
8. Diferencial;
9. Planos;
10. Dúvidas;
11. CTA final;
12. Footer.

---

## 11. Header

### Objetivo

Ser simples, premium, fixo e funcional.

### Visual

- Header sticky;
- Glassmorphism sutil;
- Fundo com blur;
- Redução leve de padding ao rolar;
- Logo à esquerda;
- Links no centro ou à direita;
- CTA de entrada.

### Links

- Como funciona;
- Recursos;
- Planos;
- Dúvidas.

### Botão

**Entrar**

### Comportamento no scroll

Ao rolar:

- diminuir levemente o padding vertical;
- aumentar opacidade do fundo;
- manter leitura clara;
- evitar efeito pesado.

---

## 12. Hero Section

### Objetivo

Explicar rapidamente a promessa do produto.

### Eyebrow

**Presença no Instagram sem travar**

### Headline

**Você sabe o que faz. Só não sabe o que postar hoje.**

### Subheadline

**Transforme seu conhecimento em conteúdo diário.**  
O Destravaí gera ideias prontas de stories e reels, com roteiro, legenda e teleprompter, tudo no app. Menos esforço, mais presença.

### CTAs

Primário:

**Quero destravar agora**

Secundário:

**Ver como funciona**

### Trust Builder

**Primeiro mês por R$29,90. Depois R$49,90/mês. Sem fidelidade. Cancele quando quiser.**

### Visual

- Mockup de celular ou interface do app;
- Fundo atmosférico com orbs roxos;
- Elementos flutuantes sutis;
- Destaques em gradiente roxo;
- Se possível, demonstrar algo como “missão do dia”, roteiro e teleprompter.

### Animações

- Eyebrow entra primeiro;
- Headline entra depois;
- Subheadline entra em seguida;
- CTAs entram por último;
- Mockup pode ter `animate-float`.

---

## 13. Seção de Dor

### Label

**O problema**

### Headline

**Não é falta de criatividade. É falta de direção.**

### Lead

**Você já sentiu isso:**

### Cards

- Abre o Instagram pra postar e **não sabe o que falar.**
- Tem medo de aparecer e parecer forçado.
- Sabe que precisa vender, mas não quer soar vendedor.
- O dia passa e você **esquece de gravar.**
- As ferramentas de IA te dão ideias genéricas, com a sua cara zero.
- Tem mil ideias soltas e **nenhum plano pra semana.**

### Fechamento

O problema nunca foi você. Foi não ter um sistema que entende o **seu** jeito e te diz, todo dia, exatamente o que fazer.

### Visual

- Cards glass;
- Ícones simples;
- Hover com glow roxo sutil;
- Entrada em stagger via scroll.

---

## 14. Seção Virada/Solução

### Label

**Conheça o Destravaí**

### Headline

**Um app que aprende a sua essência.**

### Texto

Seu tom de voz, seus temas, seus serviços, a sua rotina e até o quanto você topa aparecer.

Com isso, ele te entrega — todo dia — ideias de conteúdo possíveis de gravar em minutos.

Não é mais um gerador de textos. É um **destravador de presença.**

### Citação

> Você não precisa virar influenciador. Precisa transformar quem você já é em presença.

### Visual

- Seção mais emocional, mas sem sentimentalismo;
- Pode usar card grande com mockup do onboarding “Minha Essência”;
- Mostrar ideia de personalização;
- Reforçar que não é conteúdo genérico.

---

## 15. Seção Como Funciona

### Label

**Como funciona**

### Headline

**Do "não sei o que postar" ao "publicado" em 3 passos**

### Passo 01

**Conte quem você é**  
Em minutos, o app traça o mapa da sua essência: área, tom de voz, temas e rotina.

### Passo 02

**Receba sua missão do dia**  
Com base no seu dia — “tenho 2 minutos”, “quero vender”, “estou em casa” — receba uma ideia pronta, com roteiro e CTA.

### Passo 03

**Grave ali mesmo**  
Use o Studio com teleprompter, gere legenda e hashtags, e salve direto na galeria. Pronto para postar.

### Visual

- Desktop: layout em duas colunas;
- Esquerda: passos;
- Direita: mockup do telefone/app;
- O mockup pode ficar sticky;
- Conforme o usuário rola, os passos podem ativar estados visuais no mockup.

### Animações

- Passos entram com fade-up;
- Mockup flutua suavemente;
- Elementos internos podem simular roteiro, CTA, legenda e gravação.

---

## 16. Seção Recursos

### Label

**O que você ganha**

### Headline

**Tudo que você precisa pra aparecer com constância**

### Recursos

#### Missão do dia
Chega de página em branco. Todo dia, uma ação clara.

#### Studio com teleprompter
Grave lendo o roteiro, sem decorar nada.

#### Roteiros no seu tom
A IA escreve como você falaria, não como um robô.

#### Legenda + hashtags
Prontas para copiar e colar no post.

#### CTAs personalizados
Chamadas para ação com a sua cara, que vendem sem forçar.

#### Calendário da semana
Planeje e nunca mais fique sem o que postar.

#### Biblioteca de conteúdos
Salve, edite e favorite suas melhores ideias.

#### Progresso e constância
Acompanhe sua sequência e o equilíbrio do conteúdo.

### Visual

- Grid de cards glass;
- Ícones Lucide;
- Hover com glow roxo;
- Checks/status com mint;
- Layout responsivo.

---

## 17. Seção Para Quem É

### Label

**Pra quem é**

### Headline

**Feito pra quem vive de ser visto — em qualquer área**

### Público

Preferir:

- Médicos e profissionais da saúde;
- Psicólogos;
- Nutricionistas;
- Advogados;
- Consultores;
- Arquitetos;
- Personal trainers;
- Fotógrafos;
- Terapeutas;
- Pequenos negócios;
- Profissionais autônomos.

Evitar dar muito destaque a “coaches” como público principal, para não enfraquecer a percepção premium do produto.

### Fechamento

Se você precisa aparecer para crescer, o Destravaí foi feito para você.

### Visual

- Chips;
- Grid visual;
- Carrossel horizontal suave se fizer sentido;
- Não deixar poluído.

---

## 18. Seção Diferencial

### Label

**Por que não é só mais um app de IA**

### Headline

**A diferença entre uma ideia e uma ação**

### Lead

A maioria das ferramentas para na ideia. O Destravaí vai até o post publicado.

### Tabela

| Característica | App genérico de IA | Destravaí |
|---|---|---|
| Conteúdo com a sua cara | Texto genérico | No seu tom e nicho |
| Até onde vai | Para na ideia | Até a gravação e a legenda |
| Quem decide o que postar | Você, sozinho | Missão do dia pronta |
| No dia seguinte | Esquece de você | Te diz o que fazer |

### Visual

- Tabela premium;
- Fundo escuro ou glass;
- Coluna Destravaí com destaque roxo/lilás;
- Checks em mint;
- Diferença clara sem parecer agressiva.

---

## 19. Seção Planos

### Objetivo

Apresentar a oferta de forma transparente e simples.

### Plano Principal

**Destravaí Completo**

Preço:

**R$29,90 no primeiro mês**  
Depois **R$49,90/mês**.

Subtexto:

**Sem fidelidade. Cancele quando quiser.**

### Benefícios

- Ideias e roteiros com IA;
- Missão do dia;
- Studio com teleprompter;
- Legendas e hashtags;
- CTAs personalizados;
- Calendário editorial;
- Biblioteca de conteúdos;
- Progresso de constância.

### CTA

**Começar meu primeiro mês por R$29,90**

### Observação importante

A informação de recorrência deve ser clara.  
Não esconder que depois passa para R$49,90/mês.

---

## 20. Seção Dúvidas

Adicionar FAQ com perguntas como:

### O Destravaí posta por mim?

Não. Ele te ajuda a saber o que postar, gerar roteiro, legenda e gravar com mais facilidade.

### Preciso aparecer todos os dias?

Não. O app pode sugerir conteúdos com fala, sem fala, bastidores, fotos, textos e ideias rápidas.

### O conteúdo fica com a minha cara?

Sim. O Destravaí usa as informações da sua essência, tom de voz, temas e rotina para gerar ideias mais alinhadas com você.

### Posso cancelar?

Sim. Não existe fidelidade. Você pode cancelar quando quiser.

### Quanto custa?

O primeiro mês custa R$29,90. Depois, o plano continua por R$49,90/mês.

### O acesso é liberado como?

Após a confirmação do pagamento, o acesso é liberado pelo e-mail informado no checkout.

---

## 21. CTA Final

### Headline

**Pronto para parar de travar na hora de postar?**

### Texto

Comece com ideias claras, roteiros no seu tom e um caminho simples para aparecer com mais constância.

### CTA

**Quero destravar agora**

### Microcopy

**Primeiro mês por R$29,90. Depois R$49,90/mês. Sem fidelidade.**

---

# Parte 2 — Checkout

## 22. Objetivo do Checkout

Transformar a página `/checkout` em uma tela mais:

- premium;
- clara;
- confiável;
- objetiva;
- visualmente integrada à página de vendas;
- forte em conversão.

A página atual é funcional, mas não deve parecer apenas um formulário solto.

O checkout precisa continuar simples, mas também precisa reforçar:

- o que a pessoa está comprando;
- por que vale a pena;
- quanto custa;
- quando o acesso será liberado;
- que o cancelamento é simples;
- que o pagamento é seguro.

---

## 23. Regras Técnicas para o Checkout

Não alterar:

- lógica de pagamento;
- integração com Asaas;
- Supabase;
- autenticação;
- criação de assinatura;
- webhooks;
- regras de backend;
- validações obrigatórias;
- funcionamento do Pix;
- funcionamento do Cartão;
- fluxo atual de liberação de acesso.

Alterar principalmente:

- layout;
- hierarquia;
- espaçamento;
- visual;
- copy;
- responsividade;
- experiência de compra.

---

## 24. Visual do Checkout

### Direção

Usar tema claro premium.

O checkout deve ter:

- fundo off-white/lavanda;
- orbs roxos suaves;
- cards brancos/glass;
- bordas lilás claras;
- sombras suaves;
- roxo como cor principal;
- mint para checks;
- bastante espaço em branco;
- layout limpo e confiável.

Não usar:

- página escura;
- verde como cor principal;
- excesso de animação;
- poluição visual;
- elementos que tirem foco do pagamento.

---

## 25. Layout Desktop do Checkout

### Topo

- Logo Destravaí centralizada;
- Espaçamento confortável;
- Header discreto, sem navegação pesada.

### Container principal

- Largura máxima aproximada: 1180px a 1240px;
- Layout em duas colunas;
- Gap entre colunas: 24px a 32px;
- Coluna esquerda: resumo da oferta e benefícios;
- Coluna direita: formulário e pagamento.

---

## 26. Fundo do Checkout

Usar fundo claro com leve gradiente:

```css
background:
  radial-gradient(circle at 10% 20%, rgba(155,140,255,0.18), transparent 28%),
  radial-gradient(circle at 90% 55%, rgba(109,93,246,0.14), transparent 30%),
  linear-gradient(180deg, #FAF8FF 0%, #F6F2FF 45%, #FFFFFF 100%);
```

Os orbs devem ser suaves e não atrapalhar leitura.

---

## 27. Coluna Esquerda do Checkout

Criar um card grande com aparência premium.

### Badge

**✦ Acesso completo**

### Headline

**Finalize seu acesso  
ao Destravaí**

A palavra “Destravaí” deve ter destaque roxo.

### Subheadline

**Primeiro mês por R$ 29,90. Depois R$ 49,90/mês. Sem fidelidade.**

### Box de Benefícios

Título:

**Você está levando:**

Checklist:

- Ideias e roteiros com IA;
- Missão do dia para postar sem travar;
- Studio com teleprompter;
- Legendas e CTAs personalizados;
- Biblioteca de conteúdos;
- Calendário editorial;
- Progresso de constância.

Cada item deve ter check circular em mint.

### Elemento Decorativo

Dentro do box de benefícios, se possível, adicionar um elemento visual decorativo à direita:

- cadeado;
- brilho;
- cristal;
- ícone de segurança;
- elemento abstrato roxo/lilás.

Se não houver ilustração disponível, usar um card decorativo com ícone Lucide, como `Lock`, `Sparkles` ou `ShieldCheck`.

### Faixa de Confiança

Abaixo do checklist, criar uma faixa com 3 itens:

#### Pagamento seguro
Seus dados protegidos

#### Cancelamento fácil
Cancele quando quiser

#### Acesso por e-mail
Rápido e automático

Ícones sugeridos:

- `ShieldCheck`;
- `RefreshCw`;
- `Mail`.

### Box Final

Adicionar um box com ícone de coração/brilho e o texto:

**Feito para quem quer aparecer com constância sem perder horas pensando no que postar.**

---

## 28. Coluna Direita do Checkout

Criar card principal do formulário.

### Card do Plano

No topo do formulário, criar um box de resumo:

À esquerda:

- Ícone quadrado roxo com letra “D” ou logo simplificada;
- **Destravaí Completo**
- **Acesso total a todas as ferramentas**

À direita:

- **R$ 29,90**
- **primeiro mês**

### Campos

Manter os campos necessários:

#### Nome completo
Placeholder:

**Digite seu nome completo**

#### E-mail
Placeholder:

**seu@email.com**

#### WhatsApp
Placeholder:

**(00) 00000-0000**

Microcopy:

**Enviaremos informações importantes no seu WhatsApp.**

#### CPF ou CNPJ
Placeholder:

**Somente números**

### Estilo dos inputs

- Altura confortável;
- Borda suave;
- Radius entre 14px e 16px;
- Ícone à esquerda, se simples implementar;
- Focus com borda roxa;
- Glow sutil;
- Font-size mínimo 16px.

---

## 29. Forma de Pagamento

Título:

**Forma de pagamento**

Opções:

### Pix
Subtexto:

**Aprovação imediata**

### Cartão
Subtexto:

**Crédito**

O Pix deve aparecer selecionado por padrão, com:

- borda roxa;
- leve fundo lilás;
- ícone;
- check de seleção no canto direito.

Cartão deve ficar neutro com borda clara.

Manter a lógica real atual de seleção de pagamento.

---

## 30. CTA do Checkout

Botão principal:

**Começar meu primeiro mês por R$ 29,90 →**

Estilo:

- largura 100%;
- altura entre 56px e 64px;
- gradiente roxo;
- texto branco;
- radius entre 14px e 18px;
- sombra/glow roxo sutil;
- hover com brilho;
- active com `scale(0.98)`.

O botão deve continuar chamando o fluxo real de pagamento.

---

## 31. Microcopy do Checkout

Abaixo do botão, adicionar:

### Linha 1

Com ícone de e-mail:

**Acesso liberado no e-mail informado após a confirmação do pagamento.**

### Linha 2

Com check verde:

**Sem fidelidade • Cancele quando quiser**

---

## 32. Responsividade do Checkout

No mobile:

- Layout deve virar uma coluna;
- Evitar largura estourada;
- Manter inputs com 16px;
- Botão deve ser bem visível;
- Espaçamentos confortáveis;
- Coluna do formulário deve aparecer cedo na tela;
- Card de benefícios pode vir antes ou depois, desde que não dificulte a compra;
- Evitar textos pequenos demais;
- Reduzir elementos decorativos no mobile.

Sugestão de ordem mobile:

1. Logo;
2. Headline curta;
3. Card do plano;
4. Formulário;
5. CTA;
6. Benefícios;
7. Segurança/cancelamento.

---

# Parte 3 — Implementação Técnica

## 33. Instrução Geral para o Codex

O Codex deve:

1. Ler a estrutura atual da página de vendas;
2. Ler a estrutura atual do checkout;
3. Identificar componentes já existentes;
4. Reaproveitar o máximo possível;
5. Criar componentes novos apenas quando necessário;
6. Não alterar lógica crítica de pagamento;
7. Não alterar backend sem necessidade;
8. Implementar visual e responsividade;
9. Rodar lint/build/testes disponíveis;
10. Corrigir erros encontrados;
11. Informar arquivos alterados.

---

## 34. Restrições

Não fazer:

- Não alterar webhooks;
- Não alterar tokens de API;
- Não alterar regras do Asaas;
- Não alterar Supabase auth;
- Não alterar fluxo de criação de assinatura;
- Não remover campos obrigatórios;
- Não esconder o preço recorrente;
- Não criar promessas falsas;
- Não usar verde como principal;
- Não transformar tudo em página escura;
- Não copiar literalmente o Filmly;
- Não deixar animações pesadas;
- Não quebrar mobile.

---

## 35. Critérios de Aceite — Página de Vendas

A página de vendas será aprovada se:

1. Mantiver a identidade roxa do Destravaí;
2. Tiver aparência mais premium e moderna;
3. Explicar rapidamente a promessa;
4. Deixar claro que o produto ajuda a postar com constância;
5. Mostrar benefícios reais;
6. Mostrar como funciona em 3 passos;
7. Diferenciar o Destravaí de uma IA genérica;
8. Mostrar preço com transparência;
9. Levar naturalmente para o checkout;
10. Estiver responsiva;
11. Tiver boa performance;
12. Não tiver animações excessivas.

---

## 36. Critérios de Aceite — Checkout

O checkout será aprovado se:

1. A página `/checkout` tiver layout em duas colunas no desktop;
2. O visual estiver semelhante à referência aprovada;
3. O formulário continuar funcionando;
4. Pix e Cartão seguirem a lógica atual;
5. O botão continuar chamando o fluxo real de pagamento;
6. O layout estiver responsivo no mobile;
7. A oferta de R$29,90 no primeiro mês e R$49,90 depois estiver clara;
8. A identidade roxa estiver preservada;
9. O checkout parecer premium, moderno e confiável;
10. Nenhuma funcionalidade existente for quebrada.

---

## 37. Checklist Final para QA

Antes de finalizar, verificar:

- [ ] Página de vendas abre sem erro;
- [ ] Checkout abre sem erro;
- [ ] Layout desktop está correto;
- [ ] Layout mobile está correto;
- [ ] CTA da página de vendas leva para o checkout;
- [ ] CTA do checkout aciona pagamento;
- [ ] Pix funciona;
- [ ] Cartão funciona;
- [ ] Validações continuam funcionando;
- [ ] Campos obrigatórios continuam obrigatórios;
- [ ] Preço está transparente;
- [ ] Textos estão em português correto;
- [ ] Não existem textos genéricos em inglês;
- [ ] Não existem dados falsos;
- [ ] Build passa;
- [ ] Lint passa, se existir;
- [ ] Não foram alteradas chaves, tokens ou webhooks.

---

## 38. Prompt Único para Implementação no Codex

Copie e cole no Codex:

```txt
Você é um desenvolvedor front-end sênior com olhar de UI/UX, conversão e cuidado técnico.

Quero que você implemente o redesign da página de vendas e da página de checkout do Destravaí usando como guia principal o arquivo `redesign_pagina_vendas_checkout.md`.

Antes de alterar qualquer coisa:
1. Leia a estrutura atual da página de vendas.
2. Leia a estrutura atual da página `/checkout`.
3. Entenda o fluxo atual de pagamento.
4. Identifique quais componentes já existem e podem ser reaproveitados.
5. Não altere backend, webhooks, Supabase, Asaas, autenticação ou regras de assinatura sem necessidade explícita.

Objetivo:
- Deixar a página de vendas mais premium, moderna e persuasiva.
- Deixar o checkout mais confiável, claro e forte para conversão.
- Manter a identidade roxa do Destravaí.
- Usar o Filmly apenas como referência de fluidez e sofisticação, sem copiar literalmente.
- Manter o checkout funcional e integrado ao fluxo atual.

Regras:
- Não remover campos obrigatórios.
- Não quebrar Pix.
- Não quebrar Cartão.
- Não esconder que o primeiro mês é R$29,90 e depois R$49,90/mês.
- Não usar verde como cor principal.
- Não criar promessas falsas.
- Não alterar tokens, chaves, webhooks ou integrações.
- Não fazer animações pesadas.
- Garantir responsividade no mobile.

Visual:
- Usar Manrope.
- Usar roxo #6D5DF6 como cor principal.
- Usar lilás #9B8CFF como apoio.
- Usar mint #53D6A1 para checks e status.
- Usar glassmorphism suave.
- Usar cards arredondados.
- Usar sombras leves.
- Usar orbs/glows sutis.
- Usar bom espaçamento.
- Manter legibilidade.

Checkout:
- Criar layout de duas colunas no desktop.
- Coluna esquerda com resumo da oferta, benefícios e confiança.
- Coluna direita com card do plano, formulário, forma de pagamento e CTA.
- Botão: “Começar meu primeiro mês por R$ 29,90 →”
- Microcopy: “Acesso liberado no e-mail informado após a confirmação do pagamento.”
- Microcopy: “Sem fidelidade • Cancele quando quiser”

Ao finalizar:
1. Rode lint/build/testes disponíveis.
2. Corrija erros.
3. Entregue um resumo do que foi alterado.
4. Liste os arquivos modificados.
5. Informe qualquer ponto que ficou pendente ou que precisa de decisão minha.
```

---

## 39. Observação Final

Este guia substitui os materiais anteriores sobre o redesign da página de vendas e do checkout.

A prioridade é criar uma experiência comercial mais coerente:

**anúncio/página de vendas → desejo → clareza → checkout confiável → pagamento.**

O Destravaí não deve parecer só uma ferramenta de IA.  
Ele deve parecer um sistema simples para transformar rotina, conhecimento e intenção de venda em conteúdo publicável.
