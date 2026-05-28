import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: '#0B0B12', color: 'var(--text-secondary)' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold mb-8" style={{ color: '#A78BFA' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Política de Privacidade</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>Última atualização: 28/05/2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>1. Dados que coletamos</h2>
            <p>Coletamos: (a) dados de cadastro (nome, e-mail); (b) informações que você fornece no onboarding e na sua Essência (área de atuação, público, tom de voz, objetivos etc.); (c) dados de uso da plataforma; e (d) dados necessários ao pagamento (nome, e-mail e CPF/CNPJ), processados pelo Asaas. <strong>Não armazenamos dados do seu cartão de crédito.</strong></p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>2. Como usamos seus dados</h2>
            <p>Usamos seus dados para: criar e personalizar seu conteúdo com IA; operar sua assinatura e liberar o acesso; melhorar a plataforma; e nos comunicar com você sobre o serviço.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>3. Compartilhamento</h2>
            <p>Compartilhamos dados apenas com provedores essenciais à operação: <strong>Supabase</strong> (banco de dados e autenticação), <strong>Asaas</strong> (pagamentos) e <strong>Google Gemini</strong> (geração de conteúdo por IA). Não vendemos seus dados.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>4. Base legal (LGPD)</h2>
            <p>Tratamos seus dados com base na execução do contrato (sua assinatura), no consentimento e no legítimo interesse de operar e melhorar o serviço, conforme a Lei nº 13.709/2018 (LGPD).</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>5. Seus direitos</h2>
            <p>Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados, além de revogar consentimentos. Para isso, entre em contato pelo e-mail abaixo.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>6. Retenção e segurança</h2>
            <p>Mantemos seus dados enquanto sua conta estiver ativa e pelo tempo exigido por lei. Adotamos medidas técnicas para proteger suas informações, incluindo controle de acesso e criptografia em trânsito.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>7. Contato</h2>
            <p>Encarregado de dados / contato: assessoriadbe@gmail.com</p>
          </section>

          <p className="text-xs pt-4" style={{ color: 'var(--text-muted)' }}>
            Este documento é um modelo inicial. Recomendamos revisão por um advogado para adequação à LGPD e ao seu caso.
          </p>
        </div>
      </div>
    </div>
  )
}
