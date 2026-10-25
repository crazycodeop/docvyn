import React, { useState, useRef, useLayoutEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Lock, Mail, User, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleWidth, setGoogleWidth] = useState(null);
  const googleContainerRef = useRef(null);

  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const updateWidth = () => {
      if (googleContainerRef.current) {
        const w = googleContainerRef.current.offsetWidth;
        if (w > 0) {
          setGoogleWidth(Math.min(400, Math.max(200, Math.floor(w))));
        }
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      if (!credentialResponse?.credential) {
        throw new Error('No credential received from Google.');
      }
      await googleLogin(credentialResponse.credential);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Google sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, fullName);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-white animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Create your account
        </h2>
        <p className="font-sans mt-2 text-xs sm:text-sm text-[#8e8e8e] leading-relaxed">
          Get started with document search and chat on docvyn
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
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              icon={User}
              required
            />

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

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              Create Account
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

          <div ref={googleContainerRef} className="flex justify-center w-full min-h-[44px]">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-up failed. Please try again.')}
              theme="filled_black"
              shape="rectangular"
              size="large"
              width={googleWidth ? String(googleWidth) : '280'}
              text="signup_with"
            />
          </div>

          <div className="mt-6 pt-5 border-t border-[#262626] text-center text-xs">
            <span className="text-[#8e8e8e]">Already have an account? </span>
            <Link to="/login" className="text-white hover:underline font-semibold">
              Sign in &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
