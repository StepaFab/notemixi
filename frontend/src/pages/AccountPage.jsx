import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = 'https://notemixi.tail1a26d2.ts.net:8443';

function AccountPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
    avatar: ''
  });
  
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Přepínač pro zobrazení hesel

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username);
          setFormData(prev => ({
            ...prev,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || '',
            avatar: data.avatar || ''
          }));
        }
      } catch (err) {
        console.error("Chyba při načítání profilu:", err);
      }
    };
    fetchUserData();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Kontrola shodnosti nových hesel na frontendu
    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setError('Nová hesla se neshodují!');
      return;
    }

    const payload = {};
    if (formData.first_name) payload.first_name = formData.first_name;
    if (formData.last_name) payload.last_name = formData.last_name;
    if (formData.email) payload.email = formData.email;
    if (formData.avatar) payload.avatar = formData.avatar;
    
    // Pro heslo pošleme staré i nové
    if (formData.new_password) {
      payload.current_password = formData.current_password;
      payload.new_password = formData.new_password;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        if (data.email_changed) {
          alert("E-mail byl změněn. Z bezpečnostních důvodů tě odhlásíme a musíš svůj nový e-mail ověřit.");
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          // FIX: window.location.href natvrdo obnoví stránku a vyčistí paměť Reactu
          window.location.href = `/verify?email=${encodeURIComponent(formData.email)}`;
        } 
        else if (data.password_changed) {
          alert("Heslo bylo změněno. Z bezpečnostních důvodů se prosím znovu přihlas.");
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          // FIX: Totéž pro přihlášení
          window.location.href = '/login';
        } 
        else {
          setMessage('Změny byly úspěšně uloženy!');
          // Vyčistíme pole pro hesla, kdyby je uživatel vyplnil, ale nic neměnil
          setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
        }
      } else {
        setError(data.detail || 'Chyba při ukládání');
      }
    } catch (err) {
      setError('Nepodařilo se připojit k serveru.');
    }
  };

  return (
    <div className="page-container text-center">
      <h2>Nastavení účtu</h2>
      <p>Uprav si svůj profil, <b>{username}</b></p>
      
      {message && <p style={{color: '#30d158', backgroundColor: 'rgba(48, 209, 88, 0.1)', padding: '10px', borderRadius: '6px'}}>{message}</p>}
      {error && <p className="error-message">{error}</p>}
      
      <form onSubmit={handleSave} className="form-column">
        
        {/* Sekce pro Profilovku */}
        <div className="avatar-section">
          <div className="avatar-preview" onClick={() => fileInputRef.current.click()}>
            {formData.avatar ? (
              <img src={formData.avatar} alt="Avatar" />
            ) : (
              <span className="avatar-placeholder">👤</span>
            )}
            <div className="avatar-overlay">Změnit</div>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            style={{display: 'none'}} 
          />
        </div>

        <h4 style={{ color: '#fff', textAlign: 'left', margin: '10px 0 0 0' }}>Osobní údaje</h4>
        <input type="text" name="first_name" placeholder="Křestní jméno" value={formData.first_name} onChange={handleChange} className="input-field" />
        <input type="text" name="last_name" placeholder="Příjmení" value={formData.last_name} onChange={handleChange} className="input-field" />
        <input type="email" name="email" placeholder="E-mail" value={formData.email} onChange={handleChange} className="input-field" />
        
        <h4 style={{ color: '#fff', textAlign: 'left', margin: '10px 0 0 0' }}>Změna hesla</h4>
        <input type={showPassword ? "text" : "password"} name="current_password" placeholder="Aktuální heslo" value={formData.current_password} onChange={handleChange} className="input-field" />
        <input type={showPassword ? "text" : "password"} name="new_password" placeholder="Nové heslo" value={formData.new_password} onChange={handleChange} className="input-field" />
        <input type={showPassword ? "text" : "password"} name="confirm_password" placeholder="Potvrzení nového hesla" value={formData.confirm_password} onChange={handleChange} className="input-field" />
        
        <div className="show-password-container">
          <input
            type="checkbox"
            id="showAccPwd"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            className="show-password-checkbox"
          />
          <label htmlFor="showAccPwd" className="show-password-label">
            Zobrazit hesla
          </label>
        </div>

        <button type="submit" className="btn btn-primary" style={{marginTop: '15px'}}>Uložit změny</button>
      </form>
      
      <button onClick={() => navigate(-1)} className="btn-cancel" style={{marginTop: '10px'}}>← Zpět do editoru</button>
    </div>
  );
}

export default AccountPage;