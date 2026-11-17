import "server-only";
import { cache } from "react";
import { loadJobLink } from "./job-links";

/**
 * The public job page's loader, shared by the project route's metadata, frame and page so one
 * request looks the link up, and counts its view, once.
 */
export const jobLinkFor = cache(loadJobLink);
