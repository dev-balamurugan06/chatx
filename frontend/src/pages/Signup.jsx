import { useState } from "react";
import api from "../services/api";

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
      setError(err.response?.data?.error || "Could not connect to the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSignup}>
        <div className="auth-brand"><strong>Chat X</strong></div>
        <div className="auth-heading">
          <h1>Create your account</h1>
          <p>Your conversations, all in one place.</p>
        </div>
        <label className="auth-field">
          <span>Name</span>
          <input autoComplete="name" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
        <p className="auth-switch">Already have an account? <button type="button" onClick={onSignup}>Sign in</button></p>
      </form>
    </main>
  );
}
