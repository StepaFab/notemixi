import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const BACKEND_URL = 'https://notemixi.tail1a26d2.ts.net:8443';

function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirm_password) {
      setError('Hesla se neshodují!');
      return;
    }

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      username: formData.username,
      email: formData.email,
      password: formData.password
    };

    const res = await fetch(`${BACKEND_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      navigate(`/verify?email=${encodeURIComponent(formData.email)}`);
    } else {
      const data = await res.json();
      setError(data.detail || 'Registrace selhala');
    }
  };

  return (
    <div className="page-container text-center">
      <h2>Vytvořit účet</h2>
      
      {error && <p className="error-message">{error}</p>}
      
      <form onSubmit={handleRegister} className="form-column">
        <input type="text" name="first_name" placeholder="Jméno" onChange={handleChange} required className="input-field" />
        <input type="text" name="last_name" placeholder="Příjmení" onChange={handleChange} required className="input-field" />
        <input type="text" name="username" placeholder="Uživatelské jméno" onChange={handleChange} required className="input-field" />
        <input type="email" name="email" placeholder="E-mail" onChange={handleChange} required className="input-field" />
        
        {/* 1. První políčko: Heslo */}
        <input
          type={showPassword ? "text" : "password"} 
          name="password"
          placeholder="Heslo"
          value={formData.password}
          onChange={handleChange}
          required
          className="input-field"
        />

        {/* 2. Druhé políčko: Potvrzení hesla */}
        <input
          type={showPassword ? "text" : "password"} 
          name="confirm_password"
          placeholder="Potvrzení hesla"
          value={formData.confirm_password} 
          onChange={handleChange}
          required
          className="input-field"
        />

        {/* 3. Checkbox "Zobrazit hesla" pod oběma políčky */}
        <div className="show-password-container">
          <input
            type="checkbox"
            id="showRegisterPasswordCheckbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            className="show-password-checkbox"
          />
          <label htmlFor="showRegisterPasswordCheckbox" className="show-password-label">
            Zobrazit hesla
          </label>
        </div>
        
        <button type="submit" className="btn btn-primary">Zaregistrovat se</button>
      </form>
      
      <p>Už máš účet? <Link to="/login" className="custom-link">Přihlas se zde</Link></p>
    </div>
  );
}

export default RegisterPage;