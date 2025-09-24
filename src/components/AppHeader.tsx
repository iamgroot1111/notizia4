import "./AppHeader.css";

export default function AppHeader() {
  return (
    <header className="n4-header" role="banner" aria-label="Hauptkopfbereich">
      <img
        className="n4-logo"
        src="/notizia_logo.png"
        alt="Notizia Logo"
        width={150}
        height={150}
        draggable={false}
      />
      <h1 className="n4-title">Heilerfolge sichtbar machen</h1>
    </header>
  );
}
