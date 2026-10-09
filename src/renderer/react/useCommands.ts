import { getAppStore } from '../core/store';
import type { Commands } from '../core/commands';

/**
 * Cross-store operations for components.
 *
 * A single instance lives on the app store, so every caller shares one export
 * worker instead of spawning a Worker per component.
 */
export function useCommands(): Commands {
	return getAppStore().commands;
}
