import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideIcon } from "lucide-react";

/** Either a lucide-react icon or one of this app's own hand-drawn ones (the
 *  coloured AWS-style badges) — a plain union rather than a narrowed
 *  structural type, since `LucideIcon`'s `propTypes` field makes it
 *  incompatible with a tighter `ComponentType<{ size?: number }>` even
 *  though calling it with just `size`/`strokeWidth` is always valid. */
export type IconComponent =
  | LucideIcon
  | ((props: { size?: number; strokeWidth?: number; color?: string }) => JSX.Element);

/** Renders an icon component to a standalone `data:image/svg+xml,...` URL —
 *  the same shape the AI icon generator's SVGs already take, so a library
 *  icon drops onto the canvas through the exact same image-node path
 *  (`addImageDataUrl`) rather than needing a second rendering system.
 *  `renderToStaticMarkup` runs fine outside SSR; it's just a pure
 *  JSX-to-HTML-string function. */
export function iconToDataUrl(Icon: IconComponent, strokeWidth = 1.6): string {
  // The union covers two incompatible prop shapes (LucideProps vs. this
  // app's own `{ size, strokeWidth }`); both individually accept exactly
  // the props passed below, but TS can't resolve createElement's overloads
  // against a union, hence the cast to their common calling shape.
  const AnyIcon = Icon as ComponentType<{ size?: number; strokeWidth?: number }>;
  const svg = renderToStaticMarkup(createElement(AnyIcon, { size: 24, strokeWidth }))
    // Width/height would fix the SVG's intrinsic size; the canvas node's own
    // box already sizes it (same convention the AI-generated icons use).
    .replace(/\swidth="24"/, "")
    .replace(/\sheight="24"/, "");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
