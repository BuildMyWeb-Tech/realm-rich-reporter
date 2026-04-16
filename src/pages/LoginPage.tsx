/**
 * LoginPage.tsx
 * Family Finance login — clean, warm, Indian family finance aesthetic.
 * Dark olive/cream theme with gold accents.
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password) {
      setError('Please enter both User ID and Password');
      return;
    }
    setLoading(true);
    setError('');

    // Small delay for UX feel
    await new Promise(r => setTimeout(r, 600));

    const result = login(userId, password);
    if (!result.success) {
      setError(result.error || 'Invalid credentials');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setLoading(false);
  };

  return (
    <div style={styles.root}>
      {/* Background pattern */}
      <div style={styles.bgPattern} />

      <div style={{ ...styles.card, ...(shake ? styles.shake : {}) }}>
        {/* Logo area */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>₹</div>
          <h1 style={styles.appName}>Family Finance Tracker</h1>
          {/* <p style={styles.tagline}>குடும்ப நிதி · Your money, together</p> */}
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>Sign In</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>User ID</label>
            <input
              ref={inputRef}
              type="text"
              value={userId}
              onChange={e => { setUserId(e.target.value); setError(''); }}
              placeholder="Enter user ID"
              style={styles.input}
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter password"
              style={styles.input}
              autoComplete="current-password"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e as any)}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{ ...styles.button, ...(loading ? styles.buttonLoading : {}) }}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.loadingDots}>
                <span style={{ ...styles.dot, animationDelay: '0ms' }} />
                <span style={{ ...styles.dot, animationDelay: '150ms' }} />
                <span style={{ ...styles.dot, animationDelay: '300ms' }} />
              </span>
            ) : (
              'Enter App →'
            )}
          </button>
        </form>

        {/* Footer */}
        {/* <p style={styles.footer}>
          Shared family account · All data synced to cloud
        </p> */}
      </div>

      {/* Members row */}
      {/* <div style={styles.membersRow}>
        {['Appa', 'Amma', 'Ajai', 'Mauli'].map((name, i) => (
          <div key={name} style={{ ...styles.memberChip, animationDelay: `${i * 100}ms` }}>
            <span style={styles.memberAvatar}>{name[0]}</span>
            <span style={styles.memberName}>{name}</span>
          </div>
        ))}
      </div> */}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes chipIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const gold = '#C9A84C';
const darkBg = '#1A1F16';
const cardBg = '#232918';
const cream = '#F5EDDA';
const mutedCream = '#A89F8C';
const green = '#4CAF73';

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: darkBg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"DM Sans", sans-serif',
    padding: '20px',
    gap: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(circle at 20% 20%, rgba(201,168,76,0.06) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(76,175,115,0.05) 0%, transparent 50%)`,
    pointerEvents: 'none',
  },
  card: {
    background: cardBg,
    borderRadius: '20px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '380px',
    border: `1px solid rgba(201,168,76,0.2)`,
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
    animation: 'fadeUp 0.6s ease forwards',
    position: 'relative',
    zIndex: 1,
  },
  shake: {
    animation: 'shake 0.4s ease',
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    background: `linear-gradient(135deg, ${gold}, #A07830)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    color: '#1A1F16',
    fontWeight: '700',
    margin: '0 auto 14px',
    boxShadow: `0 8px 24px rgba(201,168,76,0.3)`,
  },
  appName: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '26px',
    fontWeight: '700',
    color: cream,
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  tagline: {
    fontSize: '12px',
    color: mutedCream,
    margin: 0,
    letterSpacing: '0.3px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '24px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(201,168,76,0.15)',
  },
  dividerText: {
    fontSize: '11px',
    color: mutedCream,
    fontWeight: '500',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: mutedCream,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '15px',
    color: cream,
    outline: 'none',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: '"DM Sans", sans-serif',
  },
  errorBox: {
    background: 'rgba(220,60,60,0.12)',
    border: '1px solid rgba(220,60,60,0.3)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#E88',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorIcon: {
    fontSize: '14px',
  },
  button: {
    background: `linear-gradient(135deg, ${gold}, #A07830)`,
    color: '#1A1F16',
    border: 'none',
    borderRadius: '12px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: '"DM Sans", sans-serif',
    cursor: 'pointer',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '48px',
    transition: 'opacity 0.2s, transform 0.1s',
    letterSpacing: '0.3px',
  },
  buttonLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  loadingDots: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#1A1F16',
    display: 'inline-block',
    animation: 'bounce 1.2s infinite ease-in-out',
  },
  footer: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'rgba(168,159,140,0.6)',
    marginTop: '20px',
    marginBottom: 0,
    letterSpacing: '0.2px',
  },
  membersRow: {
    display: 'flex',
    gap: '10px',
    animation: 'chipIn 0.8s ease forwards',
    animationDelay: '0.4s',
    opacity: 0,
    position: 'relative',
    zIndex: 1,
  },
  memberChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  memberAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.12)',
    border: '1px solid rgba(201,168,76,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    color: gold,
  },
  memberName: {
    fontSize: '10px',
    color: mutedCream,
    letterSpacing: '0.2px',
  },
};