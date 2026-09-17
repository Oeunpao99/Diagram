export interface SlashCommand {
  cmd: string;
  description: string;
}

/** The Copilot composer's "type / to see a menu" command set — kept
 *  intentionally short for v1. */
export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/new", description: "Clear this diagram's chat and start over" },
  { cmd: "/session", description: "Show info about this conversation" },
  { cmd: "/undo", description: "Undo the last change" },
  { cmd: "/redo", description: "Redo the last undone change" },
  { cmd: "/explain", description: "Explain this diagram" },
];

/** `query` is whatever's typed after "/" so far — no slash, no leading
 *  space. Empty query matches every command (just typed "/"). */
export function matchSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((command) => command.cmd.slice(1).startsWith(q));
}
