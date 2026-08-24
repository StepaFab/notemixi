import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const BACKEND_URL = 'https://notemixi.tail1a26d2.ts.net:8443';

// Zde přijímáme funkce pro nastavení stavu aplikace z App.jsx
function VerifyPage({ setToken, setUsername }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  const handleVerify = async (e) => {
    e.preventDefault();
    const res = await fetch(`${BACKEND_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });

    const data = await res.json();

    if (res.ok) {
      // Úspěšné 2FA ověření - ukládáme token a jdeme do poznámek!
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      setToken(data.token);
      setUsername(data.username);
      navigate(`/notes/${data.username}`);
    } else {
      setError(data.detail || "Chyba při ověření kódu");
    }
  };

  return (
    <div className="page-container text-center">
      <h2>Ověření dvoufázovým kódem</h2>
      <p>Kód byl odeslán na: <b>{email}</b></p>
      
      {error && <p className="error-message">{error}</p>}
      
      <form onSubmit={handleVerify} className="form-column">
        <input 
          type="text" 
          placeholder="000000" 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          maxLength="6"
          required 
          className="input-field verify-input"
        />
        <button type="submit" className="btn btn-primary">Ověřit a přihlásit se</button>
      </form>
    </div>
  );
}

export default VerifyPage;