/**
 * A chunk asked for again when it fails to load: twice more, a moment apart, before the failure is let
 * through to the crash fallback (EditorGate.tsx).
 *
 * Safari stops a page's loads the moment the person goes somewhere else (Reload, Back, a link out, an
 * address typed), while the page is still there. A chunk that was on its way then "fails", and without
 * this the fallback opened the classic editor, which took the person there instead of where they were
 * going. Asked for again, the chunk loads, or the page has gone by then. It is also what a phone's
 * connection needs: one dropped request should not cost the person the editor.
 */
export function again<T>(load: () => Promise<T>, waits: readonly number[] = [500, 1500]): Promise<T> {
  return load().catch((e: unknown) => {
    const [wait, ...rest] = waits;
    if (wait === undefined) throw e;
    return new Promise<T>((done, fail) => setTimeout(() => again(load, rest).then(done, fail), wait));
  });
}
