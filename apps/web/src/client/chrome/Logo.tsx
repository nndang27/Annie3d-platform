/**
 * The Annie wordmark: the camera operator's tripod is the "A" (orange crossbar), "nnie" follows,
 * the i's dot is the orange REC light. Drawn for a dark ground (docs/brand/annie-logo-dark.svg);
 * the top bar shows it on its own dark tile. Decorative: the link around it carries the name.
 */
export function Logo() {
  return (
    <svg className="logo-wordmark" viewBox="3 3 54 27" aria-hidden="true" focusable="false">
      <circle cx="12.1" cy="7.9" r="2.6" fill="#f4f1ea" />
      <path
        d="M5.6 27C5.7 19.8 7.3 14.2 10.5 12.2c1.6-1 3.6-1.1 5.3-.4v2.6c-.8.2-1.4.8-1.6 1.7L13.3 27z"
        fill="#f4f1ea"
      />
      <rect x="15.4" y="9.5" width="8.4" height="5.3" rx="1.5" fill="#ff6a3d" />
      <path d="M23.4 11.3l3.1-1.6v5l-3.1-1.6z" fill="#ff6a3d" />
      <circle cx="18.3" cy="12.15" r="1.05" fill="#17191d" />
      <g stroke="#f4f1ea" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M19.6 14.9L16.3 27M19.6 14.9L22.9 27M19.6 14.9V27" />
      </g>
      <path d="M17.55 22.2h4.1" stroke="#ff6a3d" strokeWidth="1.6" strokeLinecap="round" />
      <g fill="none" stroke="#f4f1ea" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25.8 27v-5.4a3.05 3.05 0 0 1 6.1 0V27" />
        <path d="M34.6 27v-5.4a3.05 3.05 0 0 1 6.1 0V27" />
        <path d="M43.6 18.9V27" />
        <path d="M46.4 22.8h8.2a4.1 4.1 0 1 0-1.2 2.95" />
      </g>
      <circle cx="43.6" cy="15.3" r="1.3" fill="#ff6a3d" />
    </svg>
  );
}
