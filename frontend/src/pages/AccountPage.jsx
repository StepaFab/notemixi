import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL || '/api';

const sections = [
  { id: 'profile', label: 'Profil', hint: 'Fotka a osobní údaje' },
  { id: 'security', label: 'Zabezpečení', hint: 'Přihlašovací údaje' },
  { id: 'danger', label: 'Nebezpečná zóna', hint: 'Odstranění účtu' },
];

function AccountPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', current_password: '',
    new_password: '', confirm_password: '', avatar: '',
  });
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setUsername(data.username || '');
        setFormData(prev => ({
          ...prev,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          avatar: data.avatar || '',
        }));
      } catch {
        setError('Nepodařilo se načíst údaje účtu. Zkontroluj připojení a zkus to znovu.');
      }
    };
    fetchUserData();
  }, [token]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData(prev => ({ ...prev, avatar: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setError('Nová hesla se neshodují.');
      return;
    }

    const payload = {};
    if (formData.first_name) payload.first_name = formData.first_name;
    if (formData.last_name) payload.last_name = formData.last_name;
    if (formData.email) payload.email = formData.email;
    if (formData.avatar) payload.avatar = formData.avatar;
    if (formData.new_password) {
      payload.current_password = formData.current_password;
      payload.new_password = formData.new_password;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Změny se nepodařilo uložit.');
        return;
      }

      if (data.email_changed) {
        alert('E-mail byl změněn. Z bezpečnostních důvodů se odhlásíš a ověříš novou adresu.');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = `/verify?email=${encodeURIComponent(formData.email)}`;
      } else if (data.password_changed) {
        alert('Heslo bylo změněno. Přihlas se prosím znovu.');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/login';
      } else {
        setMessage(data.message === 'Žádné změny k uložení'
          ? 'Nebyly provedeny žádné změny.'
          : 'Změny byly úspěšně uloženy.');
        setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
      }
    } catch {
      setError('Nepodařilo se připojit k serveru. Změny nebyly uloženy.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Opravdu chceš smazat svůj účet a všechny poznámky? Tuto akci nelze vrátit.')) return;
    setIsDeleting(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Účet se nepodařilo smazat.');
        return;
      }
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      navigate('/login', { replace: true });
    } catch {
      setError('Nepodařilo se připojit k serveru. Účet nebyl smazán.');
    } finally {
      setIsDeleting(false);
    }
  };

  const goToSection = (id) => {
    setActiveSection(id);
    document.getElementById(`account-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-heading">
          <div className="account-heading-copy">
            <span className="account-eyebrow">PREFERENCE</span>
            <h1>Nastavení účtu</h1>
            <p>Spravuj svůj profil a zabezpečení účtu NoteMixi.</p>
          </div>
          <button type="button" className="account-back" onClick={() => navigate(-1)}>
            <span aria-hidden="true">←</span> Zpět do poznámek
          </button>
        </header>

        {(message || error) && (
          <div className={`account-notice ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
            <span className="account-notice-mark" aria-hidden="true">{error ? '!' : '✓'}</span>
            <span>{error || message}</span>
            <button type="button" aria-label="Zavřít oznámení" onClick={() => { setError(''); setMessage(''); }}>×</button>
          </div>
        )}

        <div className="account-layout">
          <nav className="account-nav" aria-label="Sekce nastavení">
            <span className="account-nav-label">ÚČET</span>
            {sections.map((section, index) => (
              <button
                type="button"
                key={section.id}
                className={`account-nav-item ${activeSection === section.id ? 'is-active' : ''} ${section.id === 'danger' ? 'is-danger' : ''}`}
                onClick={() => goToSection(section.id)}
                aria-current={activeSection === section.id ? 'location' : undefined}
              >
                <span className="account-nav-index">0{index + 1}</span>
                <span className="account-nav-text"><strong>{section.label}</strong><small>{section.hint}</small></span>
                <span className="account-nav-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </nav>

          <form className="account-content" onSubmit={handleSave}>
            <section className="account-section" id="account-profile" aria-labelledby="profile-heading">
              <div className="account-section-heading">
                <div><span className="account-section-kicker">01 / PROFIL</span><h2 id="profile-heading">Osobní údaje</h2></div>
                <p>Informace, které používáš v NoteMixi.</p>
              </div>

              <div className="account-profile-card">
                <div className="account-avatar-wrap">
                  <button type="button" className="account-avatar" onClick={() => fileInputRef.current?.click()} aria-label="Změnit profilový obrázek">
                    {formData.avatar ? <img src={formData.avatar} alt="Profilový obrázek" /> : <span>{username ? username.slice(0, 1).toUpperCase() : 'N'}</span>}
                    <span className="account-avatar-edit" aria-hidden="true">↗</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} hidden />
                </div>
                <div className="account-profile-copy"><strong>{username || 'Tvůj profil'}</strong><span>{formData.email || 'Nastav si e-mailovou adresu'}</span><small>Profilový obrázek je viditelný ve tvém účtu.</small></div>
                <button type="button" className="account-secondary-button" onClick={() => fileInputRef.current?.click()}>Změnit fotku</button>
              </div>

              <div className="account-fields-grid">
                <label className="account-field"><span>Jméno</span><input name="first_name" value={formData.first_name} onChange={handleChange} autoComplete="given-name" placeholder="Tvoje jméno" /></label>
                <label className="account-field"><span>Příjmení</span><input name="last_name" value={formData.last_name} onChange={handleChange} autoComplete="family-name" placeholder="Tvoje příjmení" /></label>
                <label className="account-field account-field-wide"><span>E-mailová adresa</span><input type="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" placeholder="ty@example.com" /><small>Změna e-mailu vyžaduje nové ověření.</small></label>
              </div>
            </section>

            <section className="account-section" id="account-security" aria-labelledby="security-heading">
              <div className="account-section-heading">
                <div><span className="account-section-kicker">02 / ZABEZPEČENÍ</span><h2 id="security-heading">Změna hesla</h2></div>
                <p>Pro změnu hesla nejdřív potvrď to současné.</p>
              </div>
              <div className="account-fields-grid">
                <label className="account-field account-field-wide"><span>Aktuální heslo</span><input type={showPassword ? 'text' : 'password'} name="current_password" value={formData.current_password} onChange={handleChange} autoComplete="current-password" placeholder="Zadej současné heslo" /></label>
                <label className="account-field"><span>Nové heslo</span><input type={showPassword ? 'text' : 'password'} name="new_password" value={formData.new_password} onChange={handleChange} autoComplete="new-password" placeholder="Zadej nové heslo" /></label>
                <label className="account-field"><span>Potvrzení nového hesla</span><input type={showPassword ? 'text' : 'password'} name="confirm_password" value={formData.confirm_password} onChange={handleChange} autoComplete="new-password" placeholder="Zopakuj nové heslo" /></label>
              </div>
              <label className="account-show-password"><input type="checkbox" checked={showPassword} onChange={() => setShowPassword(value => !value)} /><span className="account-check" aria-hidden="true">✓</span><span>Zobrazit hesla</span></label>
            </section>

            <section className="account-section account-danger-section" id="account-danger" aria-labelledby="danger-heading">
              <div className="account-section-heading">
                <div><span className="account-section-kicker">03 / NEBEZPEČNÁ ZÓNA</span><h2 id="danger-heading">Odstranění účtu</h2></div>
                <p>Trvalá akce ovlivní celý účet.</p>
              </div>
              <div className="account-danger-row"><div><strong>Smazat účet a poznámky</strong><span>Účet i všechny uložené poznámky budou trvale odstraněny.</span></div><button type="button" className="account-delete-button" onClick={handleDeleteAccount} disabled={isDeleting}>{isDeleting ? 'Mažu…' : 'Smazat účet'}</button></div>
            </section>

            <div className="account-savebar"><span>Změny uložíš jedním potvrzením.</span><button type="submit" className="account-save-button">Uložit změny <span aria-hidden="true">→</span></button></div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default AccountPage;
