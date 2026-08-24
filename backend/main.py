from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg2
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone
import random
import smtplib
from email.mime.text import MIMEText

import os
from dotenv import load_dotenv

# Načtení proměnných ze souboru .env
load_dotenv()
# --- NASTAVENÍ APLIKACE ---
app = FastAPI()

# Povolení CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "https://notemixi.tail1a26d2.ts.net"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NASTAVENÍ DATABÁZE ---
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

# --- NASTAVENÍ EMAILU A BEZPEČNOSTI ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

def get_db_connection():
    # 1. Navážeme spojení
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
    
    # 2. TÍMTO ŘÁDKEM NATVRDO VYNUTÍME UTF-8 PRO HÁČKY A ČÁRKY!
    conn.set_client_encoding('UTF8')
    
    # 3. Vrátíme spojení
    return conn

def send_verification_email(receiver_email, code):
    # Příprava zprávy s podporou háčků a čárek (utf-8)
    msg = MIMEText(f"Vítej v NoteMixi!\n\nTvůj ověřovací kód je: {code}", 'plain', 'utf-8')
    msg['Subject'] = "Ověření účtu NoteMixi"
    msg['From'] = EMAIL_SENDER
    msg['To'] = receiver_email

    # Odeslání přes zabezpečený server Googlu
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.send_message(msg)

# --- MODELY DAT (Pydantic) ---
class UserRegister(BaseModel):
    # Omezíme délku na 3-50 znaků a povolíme jen specifické znaky
    username: str
    email: str
    password: str
    first_name: str = Field(
        ..., 
        min_length=3, 
        max_length=50, 
        pattern=r"^[a-zA-Z0-9_a-žA-Ž]+$"
    )
    last_name: str = Field(
        ..., 
        min_length=3, 
        max_length=50, 
        pattern=r"^[a-zA-Z0-9_a-žA-Ž]+$"
    )

class VerifySchema(BaseModel):
    email: str
    code: str

class UserLogin(BaseModel):
    username: str
    password: str

class NoteCreate(BaseModel):
    title: str
    content: str

class NoteUpdate(BaseModel):
    title: str
    content: str

class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    current_password: str | None = None  # Nové: Staré heslo
    new_password: str | None = None      # Nové: Nové heslo
    avatar: str | None = None

# --- POMOCNÁ FUNKCE PRO ZÍSKÁNÍ ID UŽIVATELE Z TOKENU ---
def get_current_user_id(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chybí token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Neplatný token")

# --- ENDPOINTY (Cesty) ---

@app.post("/register")
def register(user: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Kontrola, zda uživatel nebo e-mail už neexistuje
    cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (user.username, user.email))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Uživatelské jméno nebo e-mail již existuje")

    hashed_password = pwd_context.hash(user.password)
    verification_code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    try:
        cursor.execute(
            """INSERT INTO users (first_name, last_name, username, email, password_hash, verification_code, code_expires_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (user.first_name, user.last_name, user.username, user.email, hashed_password, verification_code, expires_at)
        )
        conn.commit()
        send_verification_email(user.email, verification_code)
        return {"message": "Registrace úspěšná, kód odeslán na e-mail"}
    except Exception as e:
        conn.rollback()
        print(f"❗️ SKUTEČNÁ CHYBA PŘI REGISTRACI: {e}")
        raise HTTPException(status_code=500, detail="Chyba databáze")
    finally:
        cursor.close()
        conn.close()

@app.post("/login")
def login(user: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Místo is_verified teď vytáhneme e-mail
    cursor.execute("SELECT id, password_hash, email FROM users WHERE username = %s", (user.username,))
    db_user = cursor.fetchone()

    if not db_user or not pwd_context.verify(user.password, db_user[1]):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Špatné jméno nebo heslo")

    # Uživatel zadal správné heslo -> Generujeme 2FA kód!
    user_id = db_user[0]
    user_email = db_user[2]
    verification_code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    cursor.execute(
        "UPDATE users SET verification_code = %s, code_expires_at = %s WHERE id = %s",
        (verification_code, expires_at, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

    # Odeslání e-mailu s kódem
    send_verification_email(user_email, verification_code)

    # Vracíme pouze e-mail, aby frontend věděl, kam přeposlat uživatele na VerifyPage
    return {"message": "2FA kód odeslán", "email": user_email}

@app.post("/verify")
def verify_account(data: VerifySchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, verification_code, code_expires_at FROM users WHERE email = %s", (data.email,))
    user = cursor.fetchone()
    
    if not user:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
        
    user_id, db_username, db_code, expires_at = user
    
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if db_code != data.code:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Nesprávný kód")
        
    if datetime.now(timezone.utc) > expires_at:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Platnost kódu vypršela")
        
    # Kód je správný! Nastavíme is_verified (kdyby náhodou nebyl) a smažeme kód
    cursor.execute("UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = %s", (user_id,))
    conn.commit()
    cursor.close()
    conn.close()

    # TEPRVE TEĎ GENERUJEME A VRACÍME PŘÍSTUPOVÝ TOKEN!
    token = jwt.encode({"sub": str(user_id)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "username": db_username}

@app.get("/notes")
def get_notes(user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, content FROM notes WHERE user_id = %s ORDER BY id DESC", (user_id,))
    notes = [{"id": row[0], "title": row[1], "content": row[2]} for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return notes

@app.post("/notes")
def create_note(note: NoteCreate, user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO notes (user_id, title, content) VALUES (%s, %s, %s) RETURNING id, title, content", 
        (user_id, note.title, note.content)
    )
    new_note = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    # Nyní vracíme kompletní data nové poznámky, aby se React aktualizoval plynule
    return {"id": new_note[0], "title": new_note[1], "content": new_note[2]}

@app.put("/notes/{note_id}")
def update_note(note_id: int, note: NoteUpdate, user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE notes SET title = %s, content = %s WHERE id = %s AND user_id = %s",
        (note.title, note.content, note_id, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "Poznámka aktualizována"}

@app.delete("/notes/{note_id}")
def delete_note(note_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, user_id))
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "Poznámka smazána"}

@app.get("/users/me")
def get_user_info(user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT first_name, last_name, username, email, avatar FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
        
    return {
        "first_name": user[0],
        "last_name": user[1],
        "username": user[2],
        "email": user[3],
        "avatar": user[4]
    }

@app.put("/users/me")
def update_user_info(data: UserUpdate, user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    updates = []
    values = []
    
    email_changed = False
    password_changed = False
    verification_code = None
    
    # Získání aktuálního hashe hesla uživatele z databáze pro pozdější ověření
    cursor.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
    user_db = cursor.fetchone()
    current_hash = user_db[0]
    
    if data.first_name:
        updates.append("first_name = %s")
        values.append(data.first_name)
    if data.last_name:
        updates.append("last_name = %s")
        values.append(data.last_name)
        
    if data.email:
        verification_code = str(random.randint(100000, 999999))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        
        updates.append("email = %s")
        values.append(data.email)
        updates.append("is_verified = FALSE")
        updates.append("verification_code = %s")
        values.append(verification_code)
        updates.append("code_expires_at = %s")
        values.append(expires_at)
        
        email_changed = True
        
    # --- NOVÁ BEZPEČNÁ LOGIKA PRO ZMĚNU HESLA ---
    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Pro změnu hesla musíš zadat své aktuální heslo.")
            
        if not pwd_context.verify(data.current_password, current_hash):
            raise HTTPException(status_code=400, detail="Aktuální heslo je nesprávné.")
            
        updates.append("password_hash = %s")
        values.append(pwd_context.hash(data.new_password))
        password_changed = True
        
    if data.avatar is not None:
        updates.append("avatar = %s")
        values.append(data.avatar)
        
    if not updates:
        return {"message": "Žádné změny k uložení", "email_changed": False, "password_changed": False}
        
    values.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
    
    try:
        cursor.execute(query, tuple(values))
        conn.commit()
        
        if email_changed:
            send_verification_email(data.email, verification_code)
            
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Chyba při aktualizaci (e-mail možná už existuje)")
    finally:
        cursor.close()
        conn.close()
        
    return {
        "message": "Účet byl úspěšně aktualizován",
        "email_changed": email_changed,
        "password_changed": password_changed
    }

@app.delete("/users/me")
def delete_my_account(user_id: int = Depends(get_current_user_id)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Poznámky se smažou samy díky ON DELETE CASCADE v databázi
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return {"message": "Účet smazán"}
    except:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Chyba při mazání účtu")
    finally:
        cursor.close()
        conn.close()