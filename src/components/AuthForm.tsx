import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'motion/react';

export default function AuthForm() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState('');

  return (
    <div className="flex items-center justify-center p-4 min-h-[600px]">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full relative overflow-hidden">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
          {isForgotPassword ? 'Reset Password' : 'Sign in to Novalith'}
        </h2>
        
        {authError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
            {authError}
          </div>
        )}

        {!isForgotPassword ? (
          <>
            <button 
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({ 
                  provider: 'github',
                  options: {
                    scopes: 'user:email repo'
                  }
                });
                if (error) {
                  console.error('OAuth handshake error:', error);
                  setAuthError(error.message === 'Unsupported provider: provider is not enabled' ? 'GitHub OAuth is not enabled in your Supabase project. Please enable it in the Supabase Dashboard under Authentication -> Providers.' : error.message);
                }
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl transition-colors mb-4"
            >
              {isSignUp ? 'Sign up' : 'Sign in'} with GitHub
            </button>

            <div className="text-center text-sm text-slate-500 mb-4 flex items-center gap-2 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
              or use email
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setAuthError('');
              const form = e.target as HTMLFormElement;
              const email = (form.elements.namedItem('email') as HTMLInputElement).value;
              const password = (form.elements.namedItem('password') as HTMLInputElement).value;
              
              if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) setAuthError(error.message);
                else setAuthError('Please check your email for the verification link.');
              } else {
                 const { error } = await supabase.auth.signInWithPassword({ email, password });
                 if (error) {
                    setAuthError(error.message);
                 }
              }
            }} className="space-y-4">
              <input type="email" name="email" placeholder="Email address" className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <input type="password" name="password" placeholder="Password" className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              
              <div className="flex justify-between items-center text-sm">
                <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-600 hover:text-indigo-800 font-medium">
                  {isSignUp ? 'Already have an account?' : 'Need an account?'}
                </button>
                {!isSignUp && (
                  <button type="button" onClick={() => { setIsForgotPassword(true); setAuthError(''); setResetSent(false); }} className="text-indigo-600 hover:text-indigo-800 font-medium">
                    Forgot password?
                  </button>
                )}
              </div>
              
              {authError && authError.includes('Email not confirmed') && (
                 <button type="button" onClick={async () => {
                    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
                    if (emailInput && emailInput.value) {
                         const { error } = await supabase.auth.resend({ type: 'signup', email: emailInput.value });
                         if (error) setAuthError(error.message);
                         else setAuthError('Verification email resent. Please check your inbox.');
                    }
                 }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-4 rounded-xl transition-colors text-sm border border-slate-300">
                    Resend Verification Email
                 </button>
              )}

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setAuthError('');
            const form = e.target as HTMLFormElement;
            const email = (form.elements.namedItem('email') as HTMLInputElement).value;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin,
            });
            if (error) {
              setAuthError(error.message);
            } else {
              setResetSent(true);
            }
          }} className="space-y-4">
            {resetSent ? (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm border border-emerald-100 text-center mb-4">
                Password reset instructions have been sent to your email.
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 text-center mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <input type="email" name="email" placeholder="Email address" className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors">
                  Send Reset Link
                </button>
              </>
            )}
            
            <div className="flex justify-center mt-4">
              <button type="button" onClick={() => { setIsForgotPassword(false); setAuthError(''); }} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
                Back to Sign In
              </button>
            </div>
          </form>
        )}
        
        <p className="mt-8 text-xs text-center text-slate-400">
          Without correct environment variables, auth might fail.
        </p>
      </div>
    </div>
  );
}
