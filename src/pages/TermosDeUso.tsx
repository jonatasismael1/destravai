import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermosDeUso() {
  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold mb-8" style={{ color: 'var(--brand)' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Termos de Uso</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>Última atualização: 13/06/2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>1. Objeto</h2>
            <p>O Destravaí é uma plataforma (SaaS) que ajuda profissionais e criadores a transformar suas rotinas e ideias em stories e conteúdos prontos para gravar e publicar, com auxílio de inteligência artificial. Ao criar uma conta e assinar, você concorda com estes Termos. Você declara ter 18 anos ou mais (ou estar autorizado por um responsável) e capacidade para contratar.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>2. Assinatura, preços e forma de pagamento</h2>
            <p className="mb-3">O Destravaí é oferecido em modelo de <strong>assinatura recorrente mensal</strong>. Ao contratar, você adquire acesso completo às funcionalidades do plano vigente.</p>
            <p className="mb-3"><strong>Oferta de lançamento:</strong> o <strong>primeiro mês</strong> custa <strong>R$9,90 (nove reais e noventa centavos)</strong>, cobrado no ato da contratação. <strong>A partir do 2º mês</strong>, a assinatura é renovada automaticamente pelo valor de <strong>R$49,90 (quarenta e nove reais e noventa centavos) por mês</strong>.</p>
            <p className="mb-3">O pagamento é aceito <strong>exclusivamente por cartão de crédito</strong>. Não há cobrança por Pix ou boleto, uma vez que a recorrência automática depende de cartão.</p>
            <p>As cobranças são processadas pela <strong>Asaas</strong> (Asaas Gestão Financeira Instituição de Pagamento S.A.). Os dados do cartão são tratados pelo Asaas conforme os padrões de segurança aplicáveis (PCI-DSS); o Destravaí <strong>não armazena o número completo do cartão</strong> em seus servidores.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>3. Autorização de cobrança recorrente</h2>
            <p className="mb-3">Ao concluir a contratação, você <strong>autoriza expressamente</strong> o Destravaí e o Asaas a realizarem, no cartão de crédito informado: (i) uma cobrança de <strong>R$9,90 na data da contratação</strong>; e (ii) cobranças mensais de <strong>R$49,90, de forma automática e sucessiva</strong>, a partir de <strong>30 (trinta) dias</strong> após a contratação, enquanto a assinatura permanecer ativa.</p>
            <p className="mb-3">Você reconhece que a <strong>renovação é automática</strong> e ocorre <strong>independentemente de novo aviso, notificação ou confirmação individual</strong> a cada ciclo. Esta cláusula, somada à informação exibida na tela de checkout, constitui a comunicação prévia da recorrência.</p>
            <p>Não há fidelidade nem multa por cancelamento. Você pode encerrar a assinatura a qualquer momento, conforme a cláusula de cancelamento.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>4. Garantia de 7 dias</h2>
            <p>Você tem <strong>garantia incondicional de 7 (sete) dias</strong>, contados a partir da contratação. Se cancelar dentro desse prazo e solicitar reembolso, o Destravaí <strong>devolve o valor pago</strong> (inclusive o R$9,90 do primeiro mês). Cancelamentos após o prazo de garantia interrompem as cobranças futuras, mas não geram reembolso de valores já cobrados no ciclo corrente.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>5. Cancelamento e reajuste</h2>
            <p className="mb-3">O cancelamento é <strong>self-service</strong> e pode ser feito a qualquer momento por você, na área "Minha Assinatura" dentro da plataforma, sem necessidade de contato com o suporte. Após o cancelamento, <strong>não há novas cobranças</strong>; o acesso permanece disponível até o fim do ciclo já pago, salvo no caso de reembolso previsto na garantia. Em caso de falha ou atraso no pagamento, o acesso pode ser suspenso até a regularização.</p>
            <p>Eventuais reajustes do valor mensal serão <strong>comunicados previamente</strong>, e você poderá cancelar antes da vigência do novo valor caso não concorde.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>6. Uso da plataforma</h2>
            <p>Você se compromete a usar o Destravaí de forma lícita e a não compartilhar suas credenciais. O conteúdo gerado pela Deby AI é uma sugestão e deve ser revisado por você antes de publicar. Você é o único responsável pelo conteúdo que publica em suas redes.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>7. Propriedade intelectual</h2>
            <p>A marca, a interface e a tecnologia do Destravaí pertencem aos seus criadores. O conteúdo que você gera a partir da plataforma é seu para usar livremente.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>8. Limitação de responsabilidade</h2>
            <p>O Destravaí é uma ferramenta de apoio à criação de conteúdo e não garante resultados específicos de audiência, vendas ou engajamento. Não nos responsabilizamos por decisões tomadas com base nas sugestões geradas.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>9. Alterações</h2>
            <p>Podemos atualizar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas pelo app ou e-mail. O uso continuado após as alterações representa concordância.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>10. Contato</h2>
            <p>Dúvidas sobre estes Termos: assessoriadbe@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
