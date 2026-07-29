'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabaseClient } from '@/utils/supabase/client'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    const verificarSesionActiva = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // 🚀 Cambiamos el recargo de página duro por la navegación nativa y fluida de Next.js
        router.push('/');
      }
    };

    verificarSesionActiva();
  }, [router, supabase]); // Añadimos las dependencias limpias de React

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const { error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (supabaseError) {
      console.log("🔍 Error crudo de Supabase:", supabaseError)

      const msg = supabaseError.message.toLowerCase()

      // 💡 Traducimos los errores típicos de la White List y credenciales
      if (msg.includes('email not allowed') || msg.includes('not authorized') || supabaseError.status === 415) {
        setError('Este correo electrónico no está autorizado en la lista blanca de FinanSaas.')
      } else if (msg.includes('invalid login credentials') || msg.includes('user not found')) {
        setError('El correo o la contraseña son incorrectos.')
      } else {
        setError('Error al iniciar sesión: ' + supabaseError.message)
      }
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-2xl w-full max-w-md border border-slate-100">
        <h3 className="text-2xl font-bold text-center text-slate-900 mb-6">Iniciar Sesión</h3>

        <form onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
            <input
              type="email"
              placeholder="nombre@correo.com"
              suppressHydrationWarning={true}
              className="w-full px-4 py-2 mt-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 bg-slate-50 text-slate-900 transition-all text-sm"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              suppressHydrationWarning={true}
              className="w-full px-4 py-2 mt-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 bg-slate-50 text-slate-900 transition-all text-sm"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm mt-3 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}

          <button
            type="submit"
            suppressHydrationWarning={true}
            className="w-full px-6 py-2.5 mt-6 text-white bg-slate-900 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-sm active:scale-[0.99]"
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <LoginContent />
    </Suspense>
  )
}
