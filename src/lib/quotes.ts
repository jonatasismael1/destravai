export interface Quote {
  text: string
  author: string
}

export const DAILY_QUOTES: Quote[] = [
  { text: 'A melhor propaganda é feita por clientes satisfeitos.', author: 'Philip Kotler' },
  { text: 'Não é a mais forte das espécies que sobrevive, nem a mais inteligente, mas a que melhor se adapta.', author: 'Charles Darwin' },
  { text: 'Se você não está disposto a arriscar o usual, precisará se contentar com o ordinário.', author: 'Jim Rohn' },
  { text: 'O sucesso é a soma de pequenos esforços repetidos dia após dia.', author: 'Robert Collier' },
  { text: 'Você não pode construir uma reputação com base no que está planejando fazer.', author: 'Henry Ford' },
  { text: 'A criatividade é a inteligência se divertindo.', author: 'Albert Einstein' },
  { text: 'Feito é melhor do que perfeito.', author: 'Sheryl Sandberg' },
  { text: 'O único lugar onde o sucesso vem antes do trabalho é no dicionário.', author: 'Vidal Sassoon' },
  { text: 'Seu tempo é limitado. Não o desperdice vivendo a vida de outra pessoa.', author: 'Steve Jobs' },
  { text: 'O mundo pertence a quem aparece.', author: 'Woody Allen' },
  { text: 'Confiança não vem de ter todas as respostas. Vem de estar aberta a todas as perguntas.', author: 'Earl Gray Stevens' },
  { text: 'A autenticidade é uma coleção de escolhas que tomamos todos os dias.', author: 'Brené Brown' },
  { text: 'Não espere. Nunca haverá o momento perfeito.', author: 'Napoleon Hill' },
  { text: 'A persistência é o caminho do êxito.', author: 'Charles Chaplin' },
  { text: 'Comunicar é tornar comum. É compartilhar.', author: 'Domenico De Masi' },
  { text: 'A historia não se repete, mas rima.', author: 'Mark Twain' },
  { text: 'Cuide da sua reputação como se fosse seu bem mais precioso — porque é.', author: 'Warren Buffett' },
  { text: 'O maior risco é não correr nenhum risco.', author: 'Mark Zuckerberg' },
  { text: 'Inspire antes de expirar. Apareça antes de sumir.', author: 'Gary Vaynerchuk' },
  { text: 'A simplicidade é a sofisticação máxima.', author: 'Leonardo da Vinci' },
  { text: 'Pessoas não compram o que você faz; compram o porquê você faz.', author: 'Simon Sinek' },
  { text: 'Em algum lugar alguém está treinando enquanto você não está, e quando vocês se encontrarem, ela vencerá.', author: 'Nike' },
  { text: 'A disciplina é a ponte entre metas e realização.', author: 'Jim Rohn' },
  { text: 'Visibilidade cria possibilidade.', author: 'Marie Forleo' },
  { text: 'Você não precisa ser excelente para começar, mas precisa começar para ser excelente.', author: 'Zig Ziglar' },
  { text: 'Tudo que você quer está do outro lado do medo.', author: 'Jack Canfield' },
  { text: 'Marketing é contar histórias que conectam.', author: 'Seth Godin' },
  { text: 'Sua marca é o que as pessoas falam sobre você quando você não está na sala.', author: 'Jeff Bezos' },
  { text: 'Prefira ser autêntico a ser aprovado.', author: 'Brené Brown' },
  { text: 'O melhor marketing não parece marketing.', author: 'Tom Fishburne' },
  { text: 'Uma voz encontra audiência. Silêncio não.', author: 'Paulo Coelho' },
  { text: 'O que você compartilha forma quem você é para os outros.', author: 'Herminia Ibarra' },
]

export function getQuoteOfDay(): Quote {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}
