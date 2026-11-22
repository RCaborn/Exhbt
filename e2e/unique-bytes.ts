import { randomBytes } from "node:crypto";

/**
 * A fixture file's bytes with a few random ones added at the end (after a PNG's last chunk or a PDF's %%EOF, which readers
 * ignore), so each run's upload is its own. The server matches files by content across accounts: a fixture shared by two specs
 * that ran on the same server would make one account's file match another's and bring up the file-match prompt. Within one
 * spec the same constant keeps the same bytes, so a test that wants two accounts to share a file still can.
 */
export const uniqueBytes = (b: Buffer): Buffer => Buffer.concat([b, randomBytes(8)]);
