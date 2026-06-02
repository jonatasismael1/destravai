import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermosDeUso() {
  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: '#0B0B12', color: 'var(--text-secondary)' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold mb-8" style={{ color: '#A78BFA' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Termos de Uso</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>Última atualização: 29/05/2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>1. Objeto</h2>
            <p>O Destravaí é uma plataforma (SaaS) que ajuda profissionais e criadores a transformar suas rotinas e ideias em stories e conteúdos prontos para gravar e publicar, com auxílio de inteligência artificial. Ao criar uma conta e assinar, você concorda com estes Termos. Você declara ter 18 anos ou mais (ou estar autorizado por um responsável) e capacidade para contratar.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>2. Assinatura e pagamento</h2>
            <p>O acesso é mediante assinatura mensal recorrente, cobrada por meio do provedor de pagamentos <strong>Asaas</strong>. O pagamento é processado imediatamente na contratação e o acesso é liberado após a confirmação do pagamento. Os planos e preços vigentes são exibidos na página de assinatura. Não armazenamos dados do seu cartão — eles são tratados diretamente pelo Asaas.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>3. Garantia de 7 dias</h2>
            <p>Você tem <strong>7 (sete) dias corridos</strong>, contados a partir da confirmação do pagamento, para testar a plataforma. Se cancelar dentro desse prazo, a assinatura é encerrada e o valor cobrado é reembolsado. Após os 7 dias, o cancelamento interrompe as cobranças futuras, sem reembolso do ciclo já pago.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>4. Renovação e cancelamento</h2>
            <p>A assinatura renova automaticamente a cada ciclo mensal até que seja cancelada. Você pode cancelar a qualquer momento pela área "Minha Assinatura". Em caso de falha ou atraso no pagamento, o acesso pode ser suspenso até a regularização.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>5. Uso da plataforma</h2>
            <p>Você se compromete a usar o Destravaí de forma lícita e a não compartilhar suas credenciais. O conteúdo gerado pela Deby AI é uma sugestão e deve ser revisado por você antes de publicar. Você é o único responsável pelo conteúdo que publica em suas redes.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>6. Propriedade intelectual</h2>
            <p>A marca, a interface e a tecnologia do Destravaí pertencem aos seus criadores. O conteúdo que você gera a partir da plataforma é seu para usar livremente.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>7. Limitação de responsabilidade</h2>
            <p>O Destravaí é uma ferramenta de apoio à criação de conteúdo e não garante resultados específicos de audiência, vendas ou engajamento. Não nos responsabilizamos por decisões tomadas com base nas sugestões geradas.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>8. Alterações</h2>
            <p>Podemos atualizar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas pelo app ou e-mail. O uso continuado após as alterações representa concordância.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>9. Contato</h2>
            <p>Dúvidas sobre estes Termos: assessoriadbe@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
