import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

/** @type {import('react').ReactNode} */
function ToastItem({ id, message, type, onRemove }) {
  const isSuccess = type === 'success'
  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl backdrop-blur-md
        animate-fade-in-up max-w-sm w-full
        ${isSuccess
          ? 'bg-fin-card/90 border-fin-up/35 text-fin-up'
          : 'bg-fin-card/90 border-fin-down/35 text-fin-down'
        }`}
    >
      {isSuccess
        ? <CheckCircle size={15} className="shrink-0" />
        : <AlertCircle size={15} className="shrink-0" />
      }
      <span className="flex-1 text-fin-text/90">{message}</span>
      <button
        onClick={() => onRemove(id)}
        className="text-fin-muted hover:text-fin-text transition-colors shrink-0 p-0.5"
        aria-label="Bildirimi kapat"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
  }, [])

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    timersRef.current[id] = setTimeout(() => remove(id), duration)
  }, [remove])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Portal: fixed top-right */}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem id={t.id} message={t.message} type={t.type} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
