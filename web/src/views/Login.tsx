import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowLeft,
  Smartphone,
  ShieldAlert,
  QrCode,
  ArrowBigUp,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';

export const Login: React.FC = () => {
  const { login, verify2FA } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [companyName, setCompanyName] = useState('Racklyt');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [step, setStep] = useState<'credentials' | '2fa_setup' | '2fa_challenge'>('credentials');
  const [tempToken, setTempToken] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Fetch configured company/instance name from backend
  useEffect(() => {
    ApiClient.getSetupStatus()
      .then((res) => {
        if (res?.instance_name && res.instance_name.toLowerCase() !== 'testsetup') {
          setCompanyName(res.instance_name);
        } else {
          setCompanyName('Racklyt');
        }
      })
      .catch(() => {
        setCompanyName('Racklyt');
      });
  }, []);

  useEffect(() => {
    if (otpauthUri) {
      QRCode.toDataURL(otpauthUri, {
        width: 170,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [otpauthUri]);

  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login({ username, password });
      if (res?.status === 'requires_2fa_setup') {
        setTempToken(res.temp_token);
        setTotpSecret(res.totp_secret || '');
        setOtpauthUri(res.otpauth_uri || '');
        setStep('2fa_setup');
      } else if (res?.status === 'requires_2fa') {
        setTempToken(res.temp_token);
        setStep('2fa_challenge');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verify2FA({
        temp_token: tempToken,
        code: twoFactorCode,
      });
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (totpSecret) {
      navigator.clipboard.writeText(totpSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleReEnroll = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await ApiClient.reEnroll2FA({ temp_token: tempToken });
      if (res.status === 'requires_2fa_setup') {
        setTempToken(res.temp_token);
        setTotpSecret(res.totp_secret || '');
        setOtpauthUri(res.otpauth_uri || '');
        setTwoFactorCode('');
        setStep('2fa_setup');
      }
    } catch (err: any) {
      setError(err.message || 'Failed initiating 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen min-h-screen overflow-hidden flex flex-col md:flex-row bg-[#0b0c0e] text-primaryText select-none animate-fadeIn font-sans">
      
      {/* ====================================================
          LEFT COLUMN: FULL-HEIGHT HERO IMAGE & WELCOME
          - Sharp rectangular full-bleed edges
          - Clean modern elegant typography
          - Dynamic Company Name underneath WELCOME
          ==================================================== */}
      <div className="w-full md:w-1/2 h-72 md:h-full relative overflow-hidden flex flex-col justify-center items-center select-none bg-[#05070a]">
        {/* Pixel Art Datacenter Image - sharp full bleed */}
        <img
          src="/login-8bit.jpg"
          alt="Datacenter Infrastructure"
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
        />

        {/* Cinematic dark gradient overlay for optimal text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/60 pointer-events-none" />

        {/* Center WELCOME Typography */}
        <div className="relative z-10 text-center px-6 max-w-lg">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-[0.3em] uppercase drop-shadow-lg select-none">
            WELCOME
          </h2>
          <div className="w-12 h-0.5 bg-[var(--racklyt-orange)] mx-auto mt-4 mb-3 opacity-90 rounded-full" />
          <p className="text-xs sm:text-sm font-mono tracking-[0.22em] text-zinc-300 uppercase truncate">
            {companyName}
          </p>
        </div>
      </div>

      {/* ====================================================
          RIGHT COLUMN: FULL-HEIGHT MODERN LOGIN FORM
          - Clean, modern typography
          - Underline inputs with Caps Lock detection
          - Software version and company provisioning notice
          ==================================================== */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-between p-8 sm:p-12 md:p-16 lg:p-24 bg-[var(--racklyt-bg-panel)] relative overflow-y-auto">
        <div className="w-full max-w-sm mx-auto my-auto">
          {/* Header */}
          <div className="mb-8 md:mb-10">
            <h1 className="text-3xl sm:text-4xl font-semibold text-primaryText tracking-tight">
              {step === 'credentials' ? 'Login' : step === '2fa_setup' ? '2-Phase Setup' : 'Security Code'}
            </h1>
            <p className="text-xs text-mutedText mt-1.5 truncate">
              {step === 'credentials'
                ? `Sign in to access ${companyName}`
                : step === '2fa_setup'
                ? 'Scan the QR code to pair your authenticator app'
                : `Enter the 6-digit code for ${username}`}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === 'credentials' && (
            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Email / Username Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold text-zinc-200 tracking-wide"
                >
                  Email or Username
                </label>
                <div className="border-b-2 border-zinc-600 focus-within:border-[var(--racklyt-orange)] transition-colors pb-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                    className="w-full bg-transparent py-1.5 text-base font-medium text-white !text-white caret-[var(--racklyt-orange)] focus:outline-none focus:ring-0 font-sans selection:bg-[var(--racklyt-orange)] selection:text-black"
                  />
                </div>
              </div>

              {/* Password Field with Caps Lock Warning */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-zinc-200 tracking-wide"
                >
                  Password
                </label>
                <div className="border-b-2 border-zinc-600 focus-within:border-[var(--racklyt-orange)] transition-colors pb-1 flex items-center">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handlePasswordKeyEvent}
                    onKeyUp={handlePasswordKeyEvent}
                    onBlur={() => setCapsLockActive(false)}
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                    className="w-full bg-transparent py-1.5 text-base font-medium text-white !text-white caret-[var(--racklyt-orange)] focus:outline-none focus:ring-0 font-sans pr-8 selection:bg-[var(--racklyt-orange)] selection:text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-400 hover:text-white p-1 transition focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Caps Lock Warning Banner */}
                {capsLockActive && (
                  <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-medium pt-1.5 animate-fadeIn">
                    <ArrowBigUp className="w-3.5 h-3.5 shrink-0 fill-amber-400/20 text-amber-400" />
                    <span>Caps Lock is ON</span>
                  </div>
                )}
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-4 rounded-xl bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] disabled:opacity-50 text-black font-semibold text-sm transition-all shadow-lg shadow-[var(--racklyt-orange)]/20 active:scale-[0.99] flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Signing in...' : 'Login'}</span>
              </button>
            </form>
          )}

          {/* STEP 2: MANDATORY 2FA SETUP (FIRST LOGIN) */}
          {step === '2fa_setup' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-2 border-b border-[var(--racklyt-border-weak)] text-xs font-medium text-amber-400">
                <ShieldAlert className="w-4 h-4" />
                <span>2-Phase Login Required</span>
              </div>

              <p className="text-[11.5px] text-mutedText leading-relaxed">
                Scan this QR code with Google Authenticator, Authy, or 1Password to activate 2FA:
              </p>

              {/* QR Code */}
              {qrCodeDataUrl ? (
                <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-xl border border-[var(--racklyt-border-medium)] shadow-md my-2">
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan with Authenticator App"
                    className="w-32 h-32 select-none"
                  />
                </div>
              ) : null}

              {/* Secret Key */}
              <div className="bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-mutedText font-semibold uppercase">
                  <span>Manual Key</span>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="flex items-center space-x-1 text-[var(--racklyt-orange)] hover:underline"
                  >
                    {copiedSecret ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedSecret ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-primaryText font-bold tracking-wider select-all break-all">
                  {totpSecret}
                </div>
              </div>

              <form onSubmit={handleVerify2FA} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-200">
                    6-Digit Code
                  </label>
                  <div className="border-b-2 border-zinc-600 focus-within:border-[var(--racklyt-orange)] pb-1">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      autoFocus
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                      style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                      className="w-full bg-transparent py-1.5 text-center text-xl tracking-[0.3em] font-medium text-white !text-white font-mono caret-[var(--racklyt-orange)] focus:outline-none"
                      placeholder="000 000"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length < 6}
                  className="w-full py-3.5 rounded-xl bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] disabled:opacity-50 text-black font-semibold text-sm transition shadow-lg shadow-[var(--racklyt-orange)]/20"
                >
                  <span>{loading ? 'Verifying...' : 'Enroll & Sign In'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError('');
                  }}
                  className="w-full py-1 text-xs text-mutedText hover:text-primaryText flex items-center justify-center space-x-1 transition"
                >
                  <ArrowLeft size={12} />
                  <span>Back to Credentials</span>
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: SUBSEQUENT 2FA CHALLENGE */}
          {step === '2fa_challenge' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center space-x-2 pb-2 border-b border-[var(--racklyt-border-weak)] text-xs font-medium text-emerald-400">
                <Smartphone className="w-4 h-4" />
                <span>Phase 2 Security Verification</span>
              </div>

              <p className="text-[11.5px] text-mutedText">
                Enter the 6-digit code currently displayed in your authenticator app for <strong className="text-primaryText">{username}</strong>:
              </p>

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div className="border-b-2 border-zinc-600 focus-within:border-[var(--racklyt-orange)] pb-1">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                    className="w-full bg-transparent py-1.5 text-center text-2xl tracking-[0.3em] font-medium text-white !text-white font-mono caret-[var(--racklyt-orange)] focus:outline-none"
                    placeholder="000 000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length < 6}
                  className="w-full py-3.5 rounded-xl bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] disabled:opacity-50 text-black font-semibold text-sm transition shadow-lg shadow-[var(--racklyt-orange)]/20"
                >
                  <span>{loading ? 'Authenticating...' : 'Verify Code'}</span>
                </button>

                <div className="pt-2 text-center border-t border-[var(--racklyt-border-weak)]">
                  <button
                    type="button"
                    onClick={handleReEnroll}
                    disabled={loading}
                    className="text-xs text-[var(--racklyt-orange)] hover:underline flex items-center justify-center space-x-1 mx-auto transition"
                  >
                    <QrCode size={13} />
                    <span>Re-scan Authenticator QR code &rarr;</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError('');
                  }}
                  className="w-full py-1 text-xs text-mutedText hover:text-primaryText flex items-center justify-center space-x-1 transition"
                >
                  <ArrowLeft size={12} />
                  <span>Back to Credentials</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Bottom Notice: Self-hosted company instance & Software Version */}
        {step === 'credentials' && (
          <div className="mt-8 text-center text-xs text-mutedText/70 tracking-wide space-y-1">
            <p>Accounts are provisioned by your system administrator</p>
            <p className="text-[11px] text-zinc-500 font-mono tracking-wider">Racklyt Hub v0.1.0</p>
          </div>
        )}
      </div>

    </div>
  );
};
