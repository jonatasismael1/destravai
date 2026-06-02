# Rubric de qualidade da Deby (IA) — avaliação por nicho

Critérios objetivos para avaliar se uma resposta da **Deby** (roteiro, ideia, legenda
ou CTA) está boa o suficiente para ir ao usuário. Use para revisar amostras, calibrar
prompts e medir regressões quando trocar de modelo.

## Como pontuar

Cada critério recebe **0, 1 ou 2**:

- **0 — Falha:** não atende; sozinho já reprova a resposta.
- **1 — Parcial:** atende em parte, dá pra usar com ajuste.
- **2 — Bom:** atende plenamente, pronto para postar.

**Aprovação:** total **≥ 8/10** *e* nenhum critério em **0**.
Qualquer 0 em "Específico", "Executável" ou "Respeito aos limites" **reprova** a amostra,
mesmo que a soma passe de 8.

## Os 5 critérios

### 1. Específico (não genérico)
A ideia parece feita **só para esta pessoa** — usa a área de atuação, o público e o
posicionamento dela. Reprova se serviria para "qualquer profissional".
- 2: cita contexto real do nicho (termo, dor, situação concreta do público).
- 1: tema certo, mas raso/clichê.
- 0: genérico ("poste com constância", "mostre seu trabalho").

### 2. Executável agora
Dá para gravar/postar **hoje**, sem produção complexa, dentro do tempo do check-in
(2/10 min etc.). Traz a **frase exata** a dizer ou escrever na tela.
- 2: passo a passo claro + fala pronta + respeita o tempo informado.
- 1: dá para fazer, mas falta a frase pronta ou pede esforço além do declarado.
- 0: vago ("fale sobre o assunto"), ou exige equipe/edição que a pessoa não tem.

### 3. Voz da pessoa
Soa como **ela falaria**: respeita tom de voz, bordão e palavras preferidas; evita as
palavras que ela pediu para evitar. Primeira pessoa, natural, sem "tom de robô".
- 2: dá para ler em voz alta e soa autêntico no tom declarado.
- 1: neutro — não destoa, mas não tem a "cara" dela.
- 0: tom errado (formal demais/informal demais) ou jargão de marketing genérico.

### 4. CTA natural
A chamada para ação fecha o conteúdo **sem soar forçada**, alinhada ao objetivo e aos
serviços. Vende ou engaja no tom da pessoa, não "compre já".
- 2: CTA conectado ao conteúdo e ao serviço, leve e claro.
- 1: CTA presente, mas genérico ("me segue").
- 0: sem CTA quando fazia sentido, ou CTA agressivo/desalinhado.

### 5. Respeito aos limites
Não usa temas/abordagens que a pessoa restringiu; respeita o nível de exposição
(aparecer ou não no vídeo) e regras de conduta do nicho.
- 2: dentro de todos os limites declarados.
- 1: tangencia um limite leve, ajustável.
- 0: viola restrição explícita, nível de exposição, ou regra do nicho (ver abaixo).

## Ajustes por nicho

O critério **5 (limites)** e o **3 (voz)** mudam de peso conforme o nicho. Pontos de
atenção ao revisar:

| Nicho | Atenção extra (reprovar em 0 se violar) |
|---|---|
| **Saúde / nutrição / medicina** | Nada de promessa de cura, diagnóstico, "resultado garantido" ou dosagem. Tom responsável; CTA = agendar/avaliar, nunca "milagre". |
| **Direito / advocacia** | Sem promessa de resultado de processo; respeitar publicidade da OAB (sem captação/sensacionalismo). |
| **Finanças / contabilidade** | Sem promessa de retorno, "fica rico", recomendação de investimento específico. Educar, não aconselhar caso a caso. |
| **Estética / beleza** | Sem antes/depois irreal nem promessa absoluta; respeitar exposição (muitos não querem aparecer). |
| **Educação / cursos** | CTA pode ser mais direto à venda; cuidar para não prometer "aprovação garantida". |
| **Serviços locais (pet, reforma, etc.)** | Específico ao serviço e à cidade; CTA = orçamento/WhatsApp; linguagem simples. |
| **Coach / desenvolvimento** | Evitar promessas vagas e "fórmulas mágicas"; pedir prova/contexto real. |

> Regra geral: quando o nicho é regulado (saúde, direito, finanças), **promessa de
> resultado** é reprovação automática no critério 5.

## Modelo de planilha (1 linha por amostra)

```
data | nicho | tipo (roteiro/ideia/legenda/cta) | modelo |
específico(0-2) | executável(0-2) | voz(0-2) | cta(0-2) | limites(0-2) |
total | aprovado? (sim/não) | observação
```

## Como usar na prática

1. Sorteie ~10 gerações reais por semana (variando nichos).
2. Pontue cada uma pelos 5 critérios.
3. Acompanhe a **taxa de aprovação** (% com ≥8 e sem zeros) ao longo do tempo.
4. Ao trocar de modelo/prompt, rode o mesmo conjunto e compare a taxa — é o sinal de
   regressão ou melhoria mais honesto que temos.
5. Padrões de falha recorrentes viram ajuste no `buildCheckinPrompt`
   ([src/lib/ai.ts](../src/lib/ai.ts)).
