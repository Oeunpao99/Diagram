import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideIcon } from "lucide-react";

/** Either a lucide-react icon or one of this app's own SVG-badge ones — the
 *  official AWS/Azure service icons (awsServiceIcons.tsx / azureServiceIcons.tsx)
 *  — a plain union rather than a narrowed structural type, since `LucideIcon`'s
 *  `propTypes` field makes it incompatible with a tighter
 *  `ComponentType<{ size?: number }>` even though calling it with just
 *  `size`/`strokeWidth` is always valid. */
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
  let svg = renderToStaticMarkup(createElement(AnyIcon, { size: 24, strokeWidth }))
    // Width/height would fix the SVG's intrinsic size; the canvas node's own
    // box already sizes it (same convention the AI-generated icons use).
    .replace(/\swidth="24"/, "")
    .replace(/\sheight="24"/, "");
  // lucide-react's own markup always carries this, but this app's own hand-
  // authored `<svg>` JSX (past and future — this bit it once for the AWS
  // badges) never needed one for its normal, inline-in-the-page use — xmlns-
  // free SVG is valid there because the browser is already parsing it as
  // part of the surrounding HTML/XML document. Wrapped in a
  // `data:image/svg+xml` URI for `<img src>` it becomes its own standalone
  // document instead, and without xmlns a browser renders nothing for it —
  // no broken-image glyph, just silently blank (see `_clean_svg` on the
  // backend, which hit and fixed this exact failure for AI-generated icons).
  if (!/\sxmlns=/.test(svg.slice(0, svg.indexOf(">") + 1))) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
