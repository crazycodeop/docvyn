import React, { useState, useRef, useLayoutEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleWidth, setGoogleWidth] = useState(null);
  const googleContainerRef = useRef(null);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useLayoutEffect(() => {
    const updateWidth = () => {
      if (googleContainerRef.current) {
        const w = googleContainerRef.current.clientWidth;
        if (w > 0) {
          setGoogleWidth(Math.min(380, Math.max(200, Math.floor(w))));
        }
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      if (!credentialResponse?.credential) {
        throw new Error('No credential received from Google.');
      }
      await googleLogin(credentialResponse.credential);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo@cortex.ai');
    setPassword('demo123456');
  };

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-white animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Sign in to docvyn
        </h2>
        <p className="font-sans mt-2 text-xs sm:text-sm text-[#8e8e8e] leading-relaxed">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-slide-up">
        <div className="bg-[#1a1a1a] py-8 px-6 shadow-2xl border border-[#282828] rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 bg-[#251717] border border-[#3e2222] rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              icon={Mail}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={Lock}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#282828]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1a1a1a] px-3 text-[#8e8e8e]">Or continue with</span>
            </div>
          </div>

          <div ref={googleContainerRef} className="w-full flex justify-center items-center min-h-[44px] overflow-hidden rounded-xl">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
              theme="filled_black"
              shape="rectangular"
              size="large"
              width={googleWidth ? String(googleWidth) : '280'}
              text="signin_with"
            />
          </div>

          {/* Demo helper */}
          <div className="mt-6 pt-5 border-t border-[#262626] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="text-white/80 hover:text-white font-medium hover:underline transition cursor-pointer"
            >
              Fill demo account
            </button>
            <Link
              to="/register"
              className="text-[#8e8e8e] hover:text-white font-medium"
            >
              Create account &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
