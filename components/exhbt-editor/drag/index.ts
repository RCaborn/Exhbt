"use client";

/*
 * The drag board (decision 0026, "Dragging"): F's. `DragBoard` wraps the canvas and the tray;
 * `useBoard` is what the toolbar, the "+", the tray, the phone's bar and the reorder sheet move,
 * add and remove through. The engine is engine.ts, the geometry plan.ts and measure.ts, the
 * overlays Board.tsx; the three styles are options.ts.
 */

export { DragBoard, useBoard, type Board } from "./Board";
