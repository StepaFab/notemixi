import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotesPage from './pages/NotesPage';
import VerifyPage from './pages/VerifyPage';
import AccountPage from './pages/AccountPage';
import { useState } from 'react';
import Logo from './Logo';
import './styles.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  return (
    <Router>
      <Logo />
      <Routes>
        {/* LoginPage už token nenastavuje */}
        <Route path="/login" element={!token ? <LoginPage /> : <Navigate to={`/notes/${username}`} />} />
        <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to={`/notes/${username}`} />} />
        
        {/* VerifyPage se teď stará o přihlášení a uložení tokenu */}
        <Route path="/verify" element={!token ? <VerifyPage setToken={setToken} setUsername={setUsername} /> : <Navigate to={`/notes/${username}`} />} />
        
        <Route path="/notes/:username" element={token ? <NotesPage /> : <Navigate to="/login" />} />
        <Route path="/account" element={token ? <AccountPage /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;