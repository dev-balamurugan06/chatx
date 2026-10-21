import { useState } from "react";
import api, { getApiErrorMessage } from "../services/api";

export default function Signup({ onSignup }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event) => {
    event.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/signup", { username, email, password });
      onSignup();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not connect to the server. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSignup} aria-labelledby="signup-heading">
        <div className="auth-brand" aria-label="Chat X"><span className="auth-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v7.5A2.75 2.75 0 0 1 16.25 16H11l-4.5 3v-3.1A2.75 2.75 0 0 1 5 13.25v-7.5Z"/><path d="m9 7.5 6 6m0-6-6 6"/></svg></span><strong>Chat X</strong></div>
        <div className="auth-heading">
          <span className="auth-kicker">A FRESH START</span>
          <h1 id="signup-heading">Create your account</h1>
          <p>Your conversations, all in one place.</p>
        </div>
        <label className="auth-field">
          <span>Name</span>
          <input autoComplete="name" placeholder="What should we call you?" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" autoComplete="new-password" minLength={6} placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={loading}>
          <span>{loading ? "Creating account…" : "Create account"}</span>
          {!loading && <span className="auth-submit-arrow" aria-hidden="true">→</span>}
        </button>
        <p className="auth-switch">Already have an account? <button type="button" onClick={onSignup}>Sign in</button></p>
        <div className="auth-footnote"><span aria-hidden="true">✦</span> A calmer space for better conversations</div>
      </form>
    </main>
  );
}
