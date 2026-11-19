"use client";

import { useSyncExternalStore } from "react";

/**
 * A small value held outside React, with subscribers (the open sheet, the files, the save status, the
 * formatted field with the cursor). Each reader takes its own slice with useAtom, so a change
 * re-renders only the parts whose slice changed.
 */
export type Atom<T> = { get(): T; set(next: T | ((prev: T) => T)): void; subscribe(fn: () => void): () => void };

export function atom<T>(initial: T): Atom<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      for (const fn of [...listeners]) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}

const self = <T,>(v: T) => v;

/** One slice of an atom. `select` must return the same value while its slice has not changed. */
export function useAtom<T, S = T>(a: Atom<T>, select: (v: T) => S = self as (v: T) => S): S {
  return useSyncExternalStore(
    a.subscribe,
    () => select(a.get()),
    () => select(a.get()),
  );
}
