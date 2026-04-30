'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Lock, Mail, ShieldCheck, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()

  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      // Success, middleware will handle the redirect based on role
      router.push('/olcutler')
      router.refresh()

    } catch (err: unknown) {
      const error = err as Error
      setMessage({ type: 'error', text: error.message || 'Giriş başarısız oldu.' })
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Lütfen kayıt için e-posta ve şifrenizi girin.' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }

      // Automatically create a profile for demo purposes (if RLS allows, else backend trigger should do it)
      // Usually users are registered successfully but email confirmation might be needed.
      if (data.user) {
        // Attempt to insert a default role (if it fails due to RLS, it's fine, we try)
        await supabase.from('profiller').insert({
          id: data.user.id,
          rol: 'BirimSorumlusu'
        })
      }

      setMessage({ type: 'success', text: 'Kayıt başarılı! E-postanızı doğrulamanız gerekmiyorsa giriş yapabilirsiniz.' })
      
    } catch (err: unknown) {
      const error = err as Error
      let errText = error.message;
      if (errText.toLowerCase().includes('rate limit')) {
        errText = "Çok fazla kayıt emaili gönderildi. Supabase panelinden 'Rate Limit / Email Confirm' ayarını kapatmalısınız.";
      }
      setMessage({ type: 'error', text: errText || 'Kayıt olurken bir hata oluştu.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">BKY Sistemine Giriş</h1>
            <p className="text-slate-400 text-sm mt-2">Lütfen devam etmek için bilgilerinizi girin.</p>
          </div>
        </div>

        <div className="p-8">
          {message && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${
              message.type === 'error' 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">E-posta Adresi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pt-0.5 pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                  placeholder="isim@universite.edu.tr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Şifre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pt-0.5 pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3 rounded-xl font-medium transition-all shadow-sm shadow-blue-500/30 disabled:opacity-70 disabled:active:scale-100"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Giriş Yap
              </button>
              
              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">veya</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleSignUp}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 active:scale-[0.98] text-slate-700 py-3 rounded-xl font-medium transition-all disabled:opacity-70 disabled:active:scale-100"
              >
                Kayıt Ol (Test)
              </button>
            </div>

          </form>
        </div>
        
      </div>
    </div>
  )
}
