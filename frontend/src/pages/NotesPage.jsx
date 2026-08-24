import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';

// NOVÉ IMPORTY PRO PROFESIONÁLNÍ PDF EXPORT
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';

import Logo from '../Logo';

const BACKEND_URL = 'https://notemixi.tail1a26d2.ts.net:8443';

// --- STYLING OBSIDIANU UVNITŘ EDITORU ---
const obsidianHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "2.4em", fontWeight: "bold", color: "#ffffff" },
  { tag: t.heading2, fontSize: "1.8em", fontWeight: "bold", color: "#ffffff" },
  { tag: t.heading3, fontSize: "1.5em", fontWeight: "bold", color: "#ffffff" },
  { tag: t.strong, fontWeight: "bold", color: "#ffffff" },
  { tag: t.emphasis, fontStyle: "italic", color: "#cccccc" },
  { tag: t.link, color: "#a882ff", textDecoration: "underline" },
  { tag: t.list, color: "#a882ff", fontWeight: "bold" },
  { tag: [t.processingInstruction, t.meta, t.punctuation], class: "cm-formatting-mark", color: "#555555" }
]);

// --- PLUGIN PRO [[ODKAZY]] ---
let globalLinkClickHandler = () => {};
const wikiLinkDecorator = new MatchDecorator({
  regexp: /\[\[(.*?)\]\]/g,
  decoration: Decoration.mark({ class: "cm-wikilink" })
});

const wikiLinkPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = wikiLinkDecorator.createDeco(view); }
  update(update) { this.decorations = wikiLinkDecorator.updateDeco(update, this.decorations); }
}, {
  decorations: v => v.decorations,
  eventHandlers: {
    click(e, view) {
      const target = e.target;
      const wikiLinkElem = target.closest(".cm-wikilink");
      if (wikiLinkElem) {
        e.preventDefault();
        e.stopPropagation();
        const rawText = wikiLinkElem.textContent;
        const cleanTitle = rawText.replace("[[", "").replace("]]", "").trim();
        globalLinkClickHandler(cleanTitle);
        return true;
      }
      return false;
    }
  }
});

function NotesPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [avatar, setAvatar] = useState(null);

  // --- STAVY PRO HROMADNÝ EXPORT ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState([]);
  const [exportFormat, setExportFormat] = useState('md'); // Výchozí formát: md
  
  const token = localStorage.getItem('token');

  const fetchNotes = async (selectFirst = false) => {
    try {
      const res = await fetch(`${BACKEND_URL}/notes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
        if (selectFirst && data.length > 0) {
          handleSelectNote(data[0]);
        }
      }
    } catch (err) {
      console.error("Chyba při načítání:", err);
    }
  };

  useEffect(() => {
    fetchNotes(true);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAvatar(data.avatar);
        }
      } catch (err) {
        console.error("Chyba při načítání profilu:", err);
      }
    };
    if (token) fetchUserProfile();
  }, [token]);

  useEffect(() => {
    globalLinkClickHandler = async (linkedTitle) => {
      const targetNote = notes.find(n => n.title.toLowerCase() === linkedTitle.toLowerCase());
      if (targetNote) {
        handleSelectNote(targetNote);
      } else {
        if (window.confirm(`Poznámka "${linkedTitle}" neexistuje. Chceš ji vytvořit?`)) {
          await handleCreateNewNote(linkedTitle);
        }
      }
    };
  }, [notes]);

  const handleSelectNote = (note) => {
    setActiveNote(note);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleCreateNewNote = async (customTitle = 'Bez názvu') => {
    try {
      const res = await fetch(`${BACKEND_URL}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: customTitle, content: '' })
      });
      
      if (res.ok) {
        const newNoteData = await res.json();
        setNotes(prev => [newNoteData, ...prev]);
        handleSelectNote(newNoteData);
      }
    } catch (err) {
      console.error("Chyba:", err);
    }
  };

  const handleSaveChanges = async (updatedTitle, updatedContent) => {
    if (!activeNote) return;
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, title: updatedTitle, content: updatedContent } : n));

    try {
      await fetch(`${BACKEND_URL}/notes/${activeNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: updatedTitle, content: updatedContent })
      });
    } catch (err) {
      console.error("Chyba při ukládání:", err);
    }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Opravdu chceš smazat tuto poznámku?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (activeNote && activeNote.id === id) {
          setActiveNote(null);
          setTitle('');
          setContent('');
        }
        fetchNotes(false);
      }
    } catch (err) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setActiveNote(null);
    setNotes([]);
    navigate('/login', { replace: true }); 
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("⚠️ Opravdu chceš smazat svůj účet a všechny poznámky?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/users/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Účet smazán.");
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error("Chyba při mazání účtu:", err);
    }
  };

  // --- LOGIKA HROMADNÉHO EXPORTU ---
  const toggleNoteSelection = (noteId) => {
    setSelectedForExport(prev => 
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  };

  const handleProcessExport = () => {
    if (selectedForExport.length === 0) {
      alert("Vyber alespoň jednu poznámku k exportu!");
      return;
    }

    selectedForExport.forEach((noteId, index) => {
      const noteToExport = notes.find(n => n.id === noteId);
      if (!noteToExport) return;

      // Zpoždění 1 sekundy mezi každým souborem (generování PDF trvá déle)
      setTimeout(() => {
        const safeTitle = noteToExport.title.replace(/[\s\/\\:*?"<>|]/g, '_') || 'Bez_nazvu';

        if (exportFormat === 'md' || exportFormat === 'txt') {
          // Export pro Markdown (.md) a Text (.txt)
          const element = document.createElement("a");
          const file = new Blob([noteToExport.content], { type: 'text/plain;charset=utf-8' });
          element.href = URL.createObjectURL(file);
          element.download = `${safeTitle}.${exportFormat}`;
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);

        } else if (exportFormat === 'pdf') {
          // Export pro PDF - Převod Markdownu na formátovaný vzhled
          const tempElement = document.createElement('div');
          
          // Přeložíme markdown (mřížky, odrážky) do HTML
          const htmlContent = marked.parse(noteToExport.content);
          
          // Nabarvíme PDF jako čistý dokument s formátovanými nadpisy
          tempElement.innerHTML = `
            <div style="padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a;">
              <h1 style="font-size: 32px; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; margin-bottom: 20px;">
                ${noteToExport.title || 'Bez názvu'}
              </h1>
              <div style="line-height: 1.6; font-size: 14px;">
                ${htmlContent}
              </div>
            </div>
          `;

          // Možnosti generátoru PDF
          const opt = {
            margin:       10,
            filename:     `${safeTitle}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          // Vygenerování a stažení
          html2pdf().set(opt).from(tempElement).save();
        }
      }, index * 1000); 
    });

    setIsExportModalOpen(false);
    setSelectedForExport([]);
  };

  return (
    <div className="obsidian-container" onClick={() => setIsDropdownOpen(false)}> 
      
      {/* VYSKAKOVACÍ OKNO PRO HROMADNÝ EXPORT */}
      {isExportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📥 Exportovat poznámky</h3>
            <p>Vyber, které poznámky chceš stáhnout, a zvol si požadovaný formát.</p>
            
            <div className="export-format-selector">
              <label>
                <input type="radio" value="md" checked={exportFormat === 'md'} onChange={() => setExportFormat('md')} />
                Markdown (.md)
              </label>
              <label>
                <input type="radio" value="txt" checked={exportFormat === 'txt'} onChange={() => setExportFormat('txt')} />
                Čistý text (.txt)
              </label>
              <label>
                <input type="radio" value="pdf" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} />
                PDF Dokument (.pdf)
              </label>
            </div>

            <div className="export-notes-list">
              {notes.map(note => (
                <label key={note.id} className="export-note-label">
                  <input 
                    type="checkbox" 
                    checked={selectedForExport.includes(note.id)}
                    onChange={() => toggleNoteSelection(note.id)}
                  />
                  <span>📄 {note.title || 'Bez názvu'}</span>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button onClick={() => setIsExportModalOpen(false)} className="btn-cancel">Zrušit</button>
              <button onClick={handleProcessExport} className="btn-primary">Stáhnout vybrané</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '10px' 
            }}>
          <Logo />
        </div>
        
        <div className="notes-list">
          {notes.map(note => (
            <div 
              key={note.id} 
              className={`note-item ${activeNote && activeNote.id === note.id ? 'active' : ''}`}
              onClick={() => handleSelectNote(note)}
            >
              <span className="note-item-title">📄 {note.title || 'Bez názvu'}</span>
              <div className="sidebar-actions">
                <button onClick={(e) => handleDeleteNote(note.id, e)} className="btn-icon delete">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={() => handleCreateNewNote('Bez názvu')} className="btn-block-create">
            + Nová poznámka
          </button>
          <button onClick={() => setIsExportModalOpen(true)} className="btn-block-export" style={{marginTop: '8px'}}>
            📥 Hromadný export
          </button>
        </div>
      </div>

      {/* HLAVNÍ PROSTOR */}
      <div className="main-editor">
        
        <div className="top-editor-navbar">
          <div></div> 
          
          <div className="nav-right" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button 
              className="account-dropdown-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {avatar ? (
                <img src={avatar} alt="Profil" className="navbar-avatar" />
              ) : (
                <span>👤</span>
              )}
              {username || 'Account'} ▼
            </button>
            
            {isDropdownOpen && (
              <div className="account-dropdown-menu">
                <button onClick={() => navigate('/account')} className="dropdown-item">⚙️ Nastavení účtu</button>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item">🚪 Odhlásit se</button>
                <div className="dropdown-divider"></div>
                <button onClick={handleDeleteAccount} className="dropdown-item danger">❌ Smazat účet</button>
              </div>
            )}
          </div>
        </div>

        <div className="editor-workspace" onClick={(e) => e.stopPropagation()}>
          {activeNote ? (
            <div className="single-pane-workspace">
              <input 
                type="text" 
                className="note-title-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  handleSaveChanges(e.target.value, content);
                }}
                placeholder="Název poznámky..."
              />
              <div className="live-preview-container">
                <CodeMirror
                  value={content}
                  height="100%"
                  extensions={[
                    markdown({ base: markdownLanguage }),
                    EditorView.lineWrapping,
                    syntaxHighlighting(obsidianHighlight),
                    wikiLinkPlugin
                  ]}
                  onChange={(val) => {
                    setContent(val);
                    handleSaveChanges(title, val);
                  }}
                  className="obsidian-codemirror"
                  placeholder="Začni psát v Markdownu..."
                />
              </div>
            </div>
          ) : (
            <div className="no-active-note-placeholder">
              <div className="placeholder-content">
                <span className="placeholder-icon">🗒️</span>
                <h4>NoteMixi Editor</h4>
                <p>Vyber nebo vytvoř poznámku v levém menu.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotesPage;