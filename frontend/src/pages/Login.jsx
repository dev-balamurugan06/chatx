import { useState } from "react";
import api, { getApiErrorMessage } from "../services/api";

export default function Login({ onLogin, onSwitchSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not connect to the server. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="auth-brand"><strong>Chat X</strong></div>
        <div className="auth-heading">
          <h1>Welcome back</h1>
          <p>Sign in to continue your conversations.</p>
        </div>
        <label className="auth-field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        <p className="auth-switch">New here? <button type="button" onClick={onSwitchSignup}>Create an account</button></p>
      </form>
    </main>
  );
}
