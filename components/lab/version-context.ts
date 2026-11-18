"use client";

import { createContext } from "react";
import type { Version } from "./options";

/** The version chosen, for the parts of the page that drag differently by it (the flowchart's boxes). */
export const VersionContext = createContext<Version>("mix");
