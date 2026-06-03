import { useNavigate } from 'react-router-dom'
import { XCircle, RefreshCw } from 'lucide-react'

export default function PagamentoErro() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <XCircle size={30} style={{ color: 'var(--danger)' }} />
      </div>

      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
        Não conseguimos confirmar seu pagamento
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        Tente novamente ou escolha outra forma de pagamento. Se o valor foi cobrado,
        ele será confirmado automaticamente assim que o provedor processar.
      </p>

      <button onClick={() => navigate('/assinatura')} className="btn-primary px-8 py-3.5">
        <RefreshCw size={18} /> Tentar de novo
      </button>
    </div>
  )
}
