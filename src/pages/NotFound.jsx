import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-fin-bg flex items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm">
        <p className="text-7xl font-bold font-mono text-fin-accent/30">404</p>
        <h1 className="text-xl font-bold text-fin-text">{t('notFound.title')}</h1>
        <p className="text-sm text-fin-muted leading-relaxed">{t('notFound.desc')}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowLeft size={14} />
            {t('notFound.goBack')}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Home size={14} />
            {t('notFound.goHome')}
          </button>
        </div>
      </div>
    </div>
  )
}
