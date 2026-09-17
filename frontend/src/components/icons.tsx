import type { ReactNode } from "react";

/** Shared stroke iconography for the Kumnous-គំនូស UI. */
function S({
  children,
  size = 16,
  stroke = 1.6,
}: {
  children: ReactNode;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Traces the glyph in public/komnous-app-icon.svg (a hub node branching to
 *  two others through a decision diamond) so every in-app badge — top bar,
 *  dashboard sidebar, Kumnous AI avatar — matches the app icon/favicon.
 *  `currentColor` here instead of that file's fixed white/green, since each
 *  usage site supplies its own badge background and accent colour. */
export const LogoMark = () => (
  <svg viewBox="0 0 100 100" width="12" height="12" fill="none" aria-hidden="true">
    <path d="M25 14V86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
    <path d="M25 50 79 14" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
    <path d="M25 50 79 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
    <circle cx="79" cy="14" r="8" fill="currentColor" />
    <circle cx="79" cy="86" r="8" fill="currentColor" />
    <circle cx="25" cy="86" r="8" fill="currentColor" />
    <circle cx="25" cy="14" r="8" fill="currentColor" />
    <path d="M25 37 38 50 25 63 12 50Z" fill="currentColor" />
  </svg>
);

export const ChevronDown = () => (
  <S size={12} stroke={2}>
    <path d="m6 9 6 6 6-6" />
  </S>
);

export const ChevronRight = () => (
  <S size={12} stroke={2}>
    <path d="m9 6 6 6-6 6" />
  </S>
);

export const ChevronLeft = () => (
  <S size={12} stroke={2}>
    <path d="m15 6-6 6 6 6" />
  </S>
);

export const X = () => (
  <S stroke={2}>
    <path d="M18 6 6 18M6 6l12 12" />
  </S>
);

export const Check = () => (
  <S stroke={2.2}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </S>
);

export const CheckCircle = () => (
  <S>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 5-5.5" />
  </S>
);

/** An empty, unfilled ring — a todo-list row that hasn't started yet. */
export const CircleOutline = () => (
  <S>
    <circle cx="12" cy="12" r="9" />
  </S>
);

export const Alert = () => (
  <S>
    <path d="M12 3h.01M13 3l8 14.5a1 1 0 0 1-.9 1.5H3.9a1 1 0 0 1-.9-1.5L11 3a1 1 0 0 1 1.8-.5Z" opacity="0" />
    <path d="M12 9v4.5M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </S>
);

export const Sparkles = () => (
  <S>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
    <path d="M5 4l.6 1.6L7.2 6.2 5.6 6.8 5 8.4 4.4 6.8 2.8 6.2 4.4 5.6Z" />
  </S>
);

export const Search = () => (
  <S size={14}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 4 4" />
  </S>
);

export const Plus = () => (
  <S stroke={2}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const ArrowRight = () => (
  <S stroke={2}>
    <path d="M4 12h14" />
    <path d="m13 7 5 5-5 5" />
  </S>
);

export const ArrowUp = () => (
  <S size={14} stroke={2}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </S>
);

export const Undo = () => (
  <S>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 5 5v1" />
  </S>
);

export const Redo = () => (
  <S>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0-5 5v1" />
  </S>
);

export const MessageSquare = () => (
  <S>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
  </S>
);

export const Share = () => (
  <S>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 3.9M8.6 10.5 15.4 6.6" />
  </S>
);

export const Download = () => (
  <S>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </S>
);

export const FileImage = () => (
  <S>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <circle cx="9" cy="13" r="1.4" />
    <path d="m12.5 17 2-2.5 2.5 3.5" />
  </S>
);

export const FileText = () => (
  <S>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
  </S>
);

export const FileCode = () => (
  <S>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M10 13l-2 2 2 2M14 13l2 2-2 2" />
  </S>
);

export const FileUp = () => (
  <S>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M12 12v7M9 15l3-3 3 3" />
  </S>
);

export const ClipboardPaste = () => (
  <S>
    <path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1Z" />
    <path d="M16 4h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1" />
    <path d="M9 12h6M9 16h6" />
  </S>
);

export const Printer = () => (
  <S>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </S>
);

export const MousePointer = () => (
  <S>
    <path d="m3 3 7.1 16.6 2.2-7.3L19.6 10Z" />
    <path d="m9.5 9.5 5 1.5" opacity="0" />
  </S>
);

export const Pan = () => (
  <S>
    <path d="M9 11V5a1.5 1.5 0 0 1 3 0v4.5M12 9.5V4a1.5 1.5 0 0 1 3 0v5" />
    <path d="M9 9V6a1.5 1.5 0 0 0-3 0v7l-1.6-1.6a1.5 1.5 0 0 0-2.2 2L6 18.5A6 6 0 0 0 10.5 21h4a6 6 0 0 0 6-6v-4a1.5 1.5 0 0 0-3 0" />
  </S>
);

export const Square = () => (
  <S>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
  </S>
);

export const TypeIcon = () => (
  <S>
    <path d="M4 7V5h16v2" />
    <path d="M12 5v14M9 19h6" />
  </S>
);

export const AlignLeft = () => (
  <S size={14} stroke={2}>
    <path d="M4 6h16M4 12h10M4 18h13" />
  </S>
);

export const AlignCenter = () => (
  <S size={14} stroke={2}>
    <path d="M4 6h16M7 12h10M5.5 18h13" />
  </S>
);

export const AlignRight = () => (
  <S size={14} stroke={2}>
    <path d="M4 6h16M10 12h10M7 18h13" />
  </S>
);

export const GitBranch = () => (
  <S>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="7" r="2.5" />
    <path d="M6 8.5v7M6 11h7a5 5 0 0 1 5 5" />
  </S>
);

export const Layers = () => (
  <S>
    <path d="m12 3 8 4-8 4-8-4Z" />
    <path d="m4 11.5 8 4 8-4" opacity="0" />
    <path d="m4 12 8 4 8-4M4 16.5 12 20.5 20 16.5" />
  </S>
);

export const Upload = () => (
  <S>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5M12 3v12" />
  </S>
);

export const ImageIcon = () => (
  <S>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-4.5-4.5L9 18" />
  </S>
);

export const UserIcon = () => (
  <S>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
  </S>
);

export const ServerIcon = () => (
  <S>
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <path d="M7 7h.01M7 17h.01" />
  </S>
);

export const DatabaseIcon = () => (
  <S>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </S>
);

export const CloudIcon = () => (
  <S>
    <path d="M17.5 19a4.5 4.5 0 0 0 .4-9 6 6 0 0 0-11.6 1.6A3.7 3.7 0 0 0 6.8 19Z" />
  </S>
);

export const BoxIcon = () => (
  <S>
    <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5Z" />
    <path d="m3 8.5 9 5.5 9-5.5M12 14v7" />
  </S>
);

export const DiamondIcon = () => (
  <S>
    <path d="M12 3l7 9-7 9-7-9 7-9Z" />
  </S>
);

export const QueueIcon = () => (
  <S>
    <rect x="3" y="7" width="18" height="10" rx="5" />
    <path d="M9 7v10M15 7v10" />
  </S>
);

export const PillIcon = () => (
  <S>
    <rect x="4" y="6" width="16" height="12" rx="6" />
  </S>
);

export const NoteIcon = () => (
  <S>
    <path d="M6 3h9l3 3v15H6V3Z" />
    <path d="M15 3v3h3M9 12h6M9 16h5" />
  </S>
);

export const DataIcon = () => (
  <S>
    <path d="M4 6l6-3 10 3v12l-6 3-6-3 6-3 6-3-10-3-6 3V6Z" />
  </S>
);

export const CircleIcon = () => (
  <S>
    <circle cx="12" cy="12" r="8.5" />
  </S>
);

export const HexagonIcon = () => (
  <S>
    <path d="M12 3.5 19.2 8v8L12 20.5 4.8 16V8L12 3.5Z" />
  </S>
);

export const OctagonIcon = () => (
  <S>
    <path d="M8.3 3.5h7.4L20.5 8.3v7.4L15.7 20.5H8.3L3.5 15.7V8.3L8.3 3.5Z" />
  </S>
);

export const TriangleIcon = () => (
  <S>
    <path d="M12 4.5 21 19.5H3L12 4.5Z" />
  </S>
);

export const PentagonIcon = () => (
  <S>
    <path d="M12 3.5 20.5 9.5 17.2 20H6.8L3.5 9.5 12 3.5Z" />
  </S>
);

export const StarIcon = () => (
  <S>
    <path d="m12 3 2.7 5.9 6.3.6-4.7 4.3 1.3 6.2L12 16.9l-5.6 3.1 1.3-6.2L3 9.5l6.3-.6Z" />
  </S>
);

export const TagIcon = () => (
  <S>
    <path d="M3 4h11l6 8-6 8H3Z" />
    <circle cx="6.5" cy="12" r="1.3" />
  </S>
);

export const ArrowRightIcon = () => (
  <S>
    <path d="M3 7h11l7 5-7 5H3Z" />
  </S>
);

export const Maximize = () => (
  <S>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
  </S>
);

export const ZoomIn = () => (
  <S>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.5-4.5M10.5 8v5M8 10.5h5" />
  </S>
);

export const ZoomOut = () => (
  <S>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.5-4.5M8 10.5h5" />
  </S>
);

export const Copy = () => (
  <S>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </S>
);

export const Pencil = () => (
  <S>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </S>
);

export const Trash = () => (
  <S>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </S>
);

export const Shuffle = () => (
  <S>
    <path d="M2 18h1.5a6 6 0 0 0 5-2.7L12 11l1.5-2.3A6 6 0 0 1 18.5 6H22" />
    <path d="m18 2 4 4-4 4M2 6h1.5a6 6 0 0 1 5 2.7L12 13l1.5 2.3a6 6 0 0 0 5 2.7H22" />
    <path d="m18 16 4 4-4 4" />
  </S>
);

export const LinkIcon = () => (
  <S>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </S>
);

export const Send = () => (
  <S size={14} stroke={2}>
    <path d="m22 2-11 11M22 2 15 22l-4-9-9-4Z" />
  </S>
);

export const MoreVertical = () => (
  <S stroke={2}>
    <circle cx="12" cy="5" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
  </S>
);

export const CircleDot = () => (
  <S size={12}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </S>
);

export const ExtractNote = () => (
  <S size={12}>
    <path d="M4 5h11M4 10h11M4 15h7" />
    <path d="M17 12v6M14 15l3 3 3-3" />
  </S>
);

export const Save = () => (
  <S>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </S>
);

export const Settings = () => (
  <S>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.97Z" />
  </S>
);

export const Palette = () => (
  <S>
    <path d="M12 21a9 9 0 1 1 9-9c0 2.5-1.5 3.5-3 3.5H15.5a2 2 0 0 0-1.4 3.4c.4.4.6.9.5 1.4-.3 1.6-1.4 2.2-2.6 2.5" />
    <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
  </S>
);

export const Puzzle = () => (
  <S>
    <path d="M12 3a3 3 0 0 1 3 3h1a2 2 0 0 1 2 2v1a3 3 0 0 1 0 6v1a2 2 0 0 1-2 2h-1a3 3 0 1 1-6 0H8a2 2 0 0 1-2-2v-1a3 3 0 0 1 0-6V8a2 2 0 0 1 2-2h1a3 3 0 0 1 3-3Z" />
  </S>
);

export const Sun = () => (
  <S>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </S>
);

export const Moon = () => (
  <S>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </S>
);

export const Monitor = () => (
  <S>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </S>
);

export const Home = () => (
  <S>
    <path d="m3 11 9-7 9 7" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </S>
);

export const Star = () => (
  <S>
    <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.8-4.6 6.6-.9Z" />
  </S>
);

export const Clock = () => (
  <S>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.3l3.5 2" />
  </S>
);

export const Eye = () => (
  <S>
    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
    <circle cx="12" cy="12" r="3" />
  </S>
);

export const EyeOff = () => (
  <S>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.2 6.8A16.8 16.8 0 0 0 2.5 12s3.5 7 9.5 7a9.2 9.2 0 0 0 3.4-.65" />
    <path d="M9.9 10a3 3 0 0 0 4.15 4.1" />
  </S>
);

export const Grid = () => (
  <S>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.4" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.4" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1.4" />
  </S>
);

export const Folder = () => (
  <S>
    <path d="M3.5 6.5a1 1 0 0 1 1-1h5l1.8 2.2h8.2a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" />
  </S>
);

export const Briefcase = () => (
  <S>
    <rect x="3" y="7.5" width="18" height="12" rx="1.8" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 13h18" />
  </S>
);

export const Cpu = () => (
  <S>
    <rect x="7" y="7" width="10" height="10" rx="1.6" />
    <rect x="10" y="10" width="4" height="4" rx="0.8" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
  </S>
);

export const Truck = () => (
  <S>
    <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
    <circle cx="7.5" cy="18" r="1.6" />
    <circle cx="16.5" cy="18" r="1.6" />
  </S>
);

export const ClipboardList = () => (
  <S>
    <rect x="5" y="4.5" width="14" height="16" rx="1.8" />
    <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
    <path d="M8.5 11h7M8.5 14.5h7M8.5 17.5h4.5" />
  </S>
);

/** Page-aspect glyph — one square and one wide sheet, echoing shapes when
 *  e.g. 1:1 vs 16:9 is selected. */
export const Ratio = ({ ratio }: { ratio?: number }) => (
  <S size={14} stroke={2}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect
      x="13"
      y="5.5"
      width={ratio && ratio < 1 ? 8 : 9}
      height={ratio && ratio < 1 ? 9 : 8}
      rx="1.5"
    />
  </S>
);

/* -------------------------------------------------------------------------
   Social sign-in marks — real brand colours/silhouettes, not this file's
   usual single-stroke style, since these need to stay recognisable as the
   providers they are.
   ------------------------------------------------------------------------- */

export const GoogleIcon = () => (
  <svg width={16} height={16} viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
    />
  </svg>
);

export const GithubIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);