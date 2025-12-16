function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-title">EuroPitch</p>
        <p className="footer-text">
          © {year} EuroPitch. All rights reserved.
        </p>
        <p className="footer-subtext">
          Advancing European student investors — from stock pitching to market strategy.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
