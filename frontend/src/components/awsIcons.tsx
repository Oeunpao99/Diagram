import type { ReactNode } from "react";

/** Colour language loosely following AWS's own icon categories — close
 *  enough to read as "cloud architecture diagram" at a glance without
 *  reproducing AWS's trademarked artwork; every glyph below is drawn from
 *  scratch, not traced from AWS's icon set. This is only the *default* —
 *  see `color` below for when it gets overridden. */
export const AWS_CATEGORY_COLOR = {
  compute: "#ED7100",
  storage: "#7AA116",
  database: "#2E73B8",
  network: "#8C4FFF",
  security: "#DD344C",
  integration: "#E7157B",
  monitoring: "#0F9C8E",
} as const;

/** Shared frame every service icon below is built from, so the whole set
 *  reads as one family regardless of which glyph is inside.
 *
 *  Every other icon in the catalogue is a `currentColor` stroke glyph that
 *  picks up whatever colour the node is given — these used to be the one
 *  exception, a coloured badge that stayed its fixed AWS-category colour no
 *  matter what the user set on the node (a real "why won't this recolour"
 *  bug). `color`, when passed, is the node's own explicit colour choice: it
 *  wins, and the icon drops the badge entirely to draw as a plain stroke
 *  glyph like everything else in the family. Left unset (the common case,
 *  no colour chosen), it keeps the branded badge look — genuinely useful in
 *  an architecture diagram, where compute-orange vs. database-blue lets you
 *  read the diagram by colour before you've read a single label. */
function Badge({
  brand,
  color,
  size = 24,
  children,
}: {
  brand: string;
  color?: string;
  size?: number;
  children: ReactNode;
}) {
  if (color) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="5.5" fill={brand} />
      <g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

interface AwsIconProps {
  size?: number;
  /** The node's own explicit colour, if it has one — see Badge above. */
  color?: string;
}

/* ---------------------------------------------------------------- compute */

export function IconEc2({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.compute} color={color} size={size}>
      <rect x="7" y="7" width="10" height="10" rx="1.3" />
      <path d="M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3" />
    </Badge>
  );
}

export function IconLambda({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.compute} color={color} size={size}>
      <path d="M8 7 13 18M11 11.2 8 18" />
    </Badge>
  );
}

export function IconEcs({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.compute} color={color} size={size}>
      <rect x="6" y="6" width="5" height="5" rx="1" />
      <rect x="13" y="6" width="5" height="5" rx="1" />
      <rect x="6" y="13" width="5" height="5" rx="1" />
      <rect x="13" y="13" width="5" height="5" rx="1" />
    </Badge>
  );
}

/* ---------------------------------------------------------------- storage */

export function IconS3({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.storage} color={color} size={size}>
      <path d="M6.5 8h11L16 18H8L6.5 8z" />
      <path d="M6 8h12" />
    </Badge>
  );
}

/* --------------------------------------------------------------- database */

export function IconRds({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.database} color={color} size={size}>
      <path d="M6 7c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5v10c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5V7z" />
      <path d="M18 7c0 1.4-2.7 2.5-6 2.5S6 8.4 6 7" />
    </Badge>
  );
}

export function IconDynamoDb({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.database} color={color} size={size}>
      <ellipse cx="12" cy="7" rx="6" ry="2" />
      <ellipse cx="12" cy="12" rx="6" ry="2" />
      <ellipse cx="12" cy="17" rx="6" ry="2" />
      <path d="M6 7v10M18 7v10" />
    </Badge>
  );
}

export function IconElastiCache({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.database} color={color} size={size}>
      {/* The bolt is a solid accent, not an outline — it needs its own fill
          either way: the badge's white against a coloured square, or the
          override colour against nothing once the badge itself is gone. */}
      <path d="M13 4 7 13h4l-1 7 7-9h-4l1-7z" fill={color ?? "#fff"} stroke="none" />
    </Badge>
  );
}

/* ---------------------------------------------------------------- network */

export function IconRoute53({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.network} color={color} size={size}>
      <circle cx="12" cy="12" r="6.5" />
      <ellipse cx="12" cy="12" rx="3" ry="6.5" />
      <path d="M5.5 12h13" />
    </Badge>
  );
}

export function IconElb({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.network} color={color} size={size}>
      <path d="M6 12h4M10 12 17 7M10 12l7 5" />
      <circle cx="5" cy="12" r="1.4" fill={color ?? "#fff"} stroke="none" />
      <circle cx="18.3" cy="7" r="1.4" fill={color ?? "#fff"} stroke="none" />
      <circle cx="18.3" cy="17" r="1.4" fill={color ?? "#fff"} stroke="none" />
    </Badge>
  );
}

export function IconCloudFront({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.network} color={color} size={size}>
      <circle cx="12" cy="15" r="4" />
      <path d="M8 9.3a8 8 0 0 1 8 0M6 6a11.3 11.3 0 0 1 12 0" />
    </Badge>
  );
}

export function IconApiGateway({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.network} color={color} size={size}>
      <path d="M9.5 6 5 12l4.5 6M14.5 6 19 12l-4.5 6" />
      <path d="M10.5 12h3" />
    </Badge>
  );
}

export function IconVpc({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.network} color={color} size={size}>
      <rect x="5" y="5" width="14" height="14" rx="2" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="2.2" fill={color ?? "#fff"} stroke="none" />
    </Badge>
  );
}

/* --------------------------------------------------------------- security */

export function IconIam({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.security} color={color} size={size}>
      <circle cx="8.5" cy="8.5" r="3.2" />
      <path d="M10.8 10.8 18 18M14.6 14.6l1.8-1.8M17 17l1.8-1.8" />
    </Badge>
  );
}

/* ------------------------------------------------------------ integration */

export function IconSqs({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.integration} color={color} size={size}>
      <rect x="4.5" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <rect x="15.5" y="10" width="4" height="4" rx="1" />
      <path d="M8.5 12H10M14 12h1.5" />
    </Badge>
  );
}

export function IconSns({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.integration} color={color} size={size}>
      <path d="M12 5.5a4 4 0 0 1 4 4v2.7l1.5 3.3h-11l1.5-3.3V9.5a4 4 0 0 1 4-4z" />
      <path d="M10.2 18.5a1.8 1.8 0 0 0 3.6 0" />
    </Badge>
  );
}

/* ------------------------------------------------------------- monitoring */

export function IconCloudWatch({ size = 24, color }: AwsIconProps) {
  return (
    <Badge brand={AWS_CATEGORY_COLOR.monitoring} color={color} size={size}>
      <path d="M5 16.5 9.5 10l3 3.2L19 6" />
      <circle cx="19" cy="6" r="1.3" fill={color ?? "#fff"} stroke="none" />
    </Badge>
  );
}
