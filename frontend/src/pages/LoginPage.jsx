import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const BACKEND_URL = 'https://notemixi.tail1a26d2.ts.net:8443';

function LoginPage() {
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const res = await fetch(`${BACKEND_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password })
    });

    const data = await res.json();

    if (res.ok) {
      // Odesláno správné heslo! Přesun na 2FA
      navigate(`/verify?email=${encodeURIComponent(data.email)}`);
    } else {
      setError(data.detail || 'Přihlášení selhalo');
    }
  };

  return (
    <div className="page-container text-center">
      <h2>Přihlášení</h2>
      
      {error && <p className="error-message">{error}</p>}
      
      <form onSubmit={handleLogin} className="form-column">
        <input 
          type="text" 
          placeholder="Uživatelské jméno" 
          value={usernameInput} 
          onChange={(e) => setUsernameInput(e.target.value)} 
          required 
          className="input-field"
        />
        
        <input
          type={showPassword ? "text" : "password"} 
          placeholder="Heslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field" 
        />

        <div className="show-password-container">
          <input
            type="checkbox"
            id="showPasswordCheckbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            className="show-password-checkbox"
          />
          <label htmlFor="showPasswordCheckbox" className="show-password-label">
            Zobrazit heslo
          </label>
        </div>
        <button type="submit" className="btn btn-primary">Pokračovat (Odeslat kód)</button>
      </form>
      
      <p>Nemáš účet? <Link to="/register" className="custom-link">Zaregistruj se zde</Link></p>
    </div>
  );
}

export default LoginPage;