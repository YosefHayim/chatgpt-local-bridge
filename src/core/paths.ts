import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Canonical on-disk locations for all bridge state.
 *
 * Everything the bridge persists — config, logs, sessions, checkpoints, the
 * signed-in Chrome profile — lives under a single home directory so there is one
 * obvious place to inspect or clear it. The directory name matches the package
 * (`chatgpt-local-bridge`); the login profile already lived here, so
 * consolidating onto this root preserves the user's ChatGPT session rather than
 * forcing a re-login.
 *
 * The resolved constants cover the common case. The `*Home(home)` helpers exist
 * for the two subsystems (hooks, custom commands) that accept an injected home
 * directory so their tests can point at a temp dir.
 */

/** Bridge home directory name under the user's home (e.g. `~/.chatgpt-local-bridge`). */
export const BRIDGE_DIR_NAME = ".chatgpt-local-bridge";

/** Absolute bridge home for a given OS home directory (defaults to the real one). */
export function bridgeHome(home = homedir()): string {
  return join(home, BRIDGE_DIR_NAME);
}

/** Resolved bridge home for the current user. */
export const BRIDGE_HOME = bridgeHome();

export const CONFIG_PATH = join(BRIDGE_HOME, "config.json");
export const LOGS_DIR = join(BRIDGE_HOME, "logs");
export const SESSIONS_DIR = join(BRIDGE_HOME, "sessions");
export const CHECKPOINTS_DIR = join(BRIDGE_HOME, "checkpoints");
export const EXPORTS_DIR = join(BRIDGE_HOME, "exports");
export const SCREENSHOTS_DIR = join(BRIDGE_HOME, "screenshots");

/**
 * Isolated Chrome user-data directory holding the signed-in ChatGPT session.
 *
 * The bridge owns this directory outright rather than reusing the user's real
 * Chrome profile: Chrome ≥136 refuses to open a remote-debug port when the
 * requested user-data-dir is already in use by another Chrome process, and
 * copying/symlinking the real profile corrupted session cookies on launch. A
 * dedicated persistent dir sidesteps both — the user logs in once and the
 * session survives bridge restarts.
 */
export const CHROME_PROFILE_DIR = join(BRIDGE_HOME, "chrome-profile");

/** Filename for hook config, shared by the repo's `.bridge/` dir and the bridge home. */
export const HOOKS_FILE = "hooks.json";

/** Path to the user-level hooks config, honouring an injected home dir for tests. */
export function homeHooksPath(home = homedir()): string {
  return join(bridgeHome(home), HOOKS_FILE);
}
