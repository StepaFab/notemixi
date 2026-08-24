function Logo() {
  return (
    <div className="logo-top-left">
      <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="25" fill="#222831" />
        <text x="35" y="68" fontFamily="'Segoe UI', sans-serif" fontSize="48" fontWeight="900" fill="#ffffff" textAnchor="middle">N</text>
        <text x="68" y="68" fontFamily="'Segoe UI', sans-serif" fontSize="48" fontWeight="900" fill="#00adb5" textAnchor="middle">X</text>
      </svg>
      <span className="logo-text">NoteMixi</span>
    </div>
  );
}

export default Logo;