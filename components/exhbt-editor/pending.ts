"use client";

/**
 * Sends the newest doc to the server if it has not got it; resolves when that lands or after three seconds.
 * The crash fallback in EditorGate.tsx awaits it before it reloads into the classic editor (decision 0026,
 * "Saving"). A stub until the editor's store exists: it resolves at once.
 */
export function flushPending(): Promise<void> {
  return Promise.resolve();
}
