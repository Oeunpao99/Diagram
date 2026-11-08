/** Small drawn flags for the language switch. Drawn rather than emoji
 *  because Windows has no flag emoji and prints the letters ("GB", "KH")
 *  instead. */

export function FlagUK() {
  return (
    <svg viewBox="0 0 60 40" className="h-[14px] w-[21px] shrink-0 rounded-[2px]" aria-hidden="true">
      <clipPath id="flag-uk-clip">
        <rect width="60" height="40" />
      </clipPath>
      <g clipPath="url(#flag-uk-clip)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
        <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
      </g>
    </svg>
  );
}

/** Cambodia: blue, a red band twice as tall, blue; Angkor Wat in white,
 *  simplified to its five towers so it still reads at 14px. */
export function FlagKH() {
  return (
    <svg viewBox="0 0 60 40" className="h-[14px] w-[21px] shrink-0 rounded-[2px]" aria-hidden="true">
      <rect width="60" height="40" fill="#032EA1" />
      <rect y="10" width="60" height="20" fill="#E00025" />
      <g fill="#fff">
        <rect x="18" y="25" width="24" height="2.5" />
        <path d="M30 13l2 4h-4z" />
        <rect x="28.5" y="17" width="3" height="8" />
        <path d="M24.5 16l1.6 3.4h-3.2z M35.5 16l1.6 3.4h-3.2z" />
        <rect x="23.4" y="19.4" width="2.2" height="5.6" />
        <rect x="34.4" y="19.4" width="2.2" height="5.6" />
        <path d="M20 18.5l1.3 2.8h-2.6z M40 18.5l1.3 2.8h-2.6z" />
        <rect x="19.1" y="21.3" width="1.8" height="3.7" />
        <rect x="39.1" y="21.3" width="1.8" height="3.7" />
      </g>
    </svg>
  );
}
