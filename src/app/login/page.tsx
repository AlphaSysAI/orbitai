// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const authCallbackFailed = searchParams.get('error') === 'auth_callback_failed';

  const supabase = createClient();

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
    else router.push('/'); 
  };

  // Pas d'inscription libre : les comptes sont créés uniquement par
  // l'administration OrbitAll (provisioning admin).

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 text-white">
      <div className="bg-[#0f172a] p-4 sm:p-8 rounded-2xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <div className="flex justify-center mb-4">
           <div className="bg-purple-600 p-2 rounded-lg">
             {/* Tu peux remettre ton icône Orbit ici si tu veux */}
             <span className="text-white font-bold">OA</span>
           </div>
        </div>
        <h1 className="text-2xl font-bold mb-6 text-center text-purple-400">Accès OrbitAll</h1>
        {authCallbackFailed && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            La connexion a échoué. Réessayez ou contactez le support.
          </p>
        )}
        <input 
          type="email" placeholder="Email" 
          className="w-full p-3 mb-4 bg-slate-900 border border-slate-700 rounded-lg outline-none focus:border-purple-500 text-white"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="password" placeholder="Mot de passe" 
          className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg outline-none focus:border-purple-500 text-white"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleSignIn} className="w-full bg-purple-600 p-3 rounded-lg font-bold hover:bg-purple-500 transition">
          Se connecter
        </button>
        <p className="mt-4 text-center text-[11px] text-slate-600">
          Accès réservé. Les comptes sont créés par l&apos;administration OrbitAll.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#020617] flex items-center justify-center text-white">
        Chargement…
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}