import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'motion/react';
import Logo from './Logo';

export default function AuthForm() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState('');

  return (
    <div className="flex flex-col p-8 w-full relative">
      <div className="flex justify-center mb-6 text-indigo-400">
        <Logo className="w-12 h-12" />
      </div>
      <h2 className="text-3xl font-black text-white mb-8 text-center tracking-tight">
        {isForgotPassword ? 'Reset Password' : 'Sign in to VantaOS'}
      </h2>
      
      {authError && (
        <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm mb-6 border border-red-500/20 text-center">
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
            className="w-full vanta-btn vanta-btn-ghost w-full py-3 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            {isSignUp ? 'Sign up' : 'Sign in'} with GitHub
          </button>

          <div className="text-center text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-3 before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">
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
            <input type="email" name="email" placeholder="Email address" className="w-full px-4 py-3 vanta-input" required />
            <input type="password" name="password" placeholder="Password" className="w-full px-4 py-3 vanta-input" required />
            
            <div className="flex justify-between items-center text-sm px-1">
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                {isSignUp ? 'Already have an account?' : 'Need an account?'}
              </button>
              {!isSignUp && (
                <button type="button" onClick={() => { setIsForgotPassword(true); setAuthError(''); setResetSent(false); }} className="text-slate-400 hover:text-slate-200 font-medium transition-colors">
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
               }} className="w-full vanta-btn vanta-btn-ghost w-full py-2.5 text-sm">
                  Resend Verification Email
               </button>
            )}

            <button type="submit" className="w-full vanta-btn vanta-btn-primary w-full py-3 mt-2">
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
            <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl text-sm border border-emerald-500/20 text-center mb-4">
              Password reset instructions have been sent to your email.
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-400 text-center mb-6 leading-relaxed">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <input type="email" name="email" placeholder="Email address" className="w-full px-4 py-3 vanta-input" required />
              <button type="submit" className="w-full vanta-btn vanta-btn-primary w-full py-3 mt-2">
                Send Reset Link
              </button>
            </>
          )}
          
          <div className="flex justify-center mt-6">
            <button type="button" onClick={() => { setIsForgotPassword(false); setAuthError(''); }} className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
              Back to Sign In
            </button>
          </div>
        </form>
      )}
      
      <p className="mt-8 text-xs text-center text-slate-400">
        Without correct environment variables, auth might fail.
      </p>
    </div>
  );
}
