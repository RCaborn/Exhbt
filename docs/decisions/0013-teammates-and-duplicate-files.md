Status: accepted
Date: 13 Nov 2026

# Teammates, and private matching of identical files

Rory's idea: let people add teammates to a project, and when someone uploads a file that's already on another person's exhbt, either they join that project or it gets flagged. What we agreed (13 Nov 2026, "Teammates + private match"): teammates yes, and a match is a private question to the uploader, never a public label. Nothing is ever marked "plagiarised". An exact fingerprint only catches identical files, group projects share files for good reasons, and a public accusation is a legal and trust risk we don't need.

## Teammates

- The owner invites people from the exhbt's Teammates page (`/exhbts/[id]/team`), by email, with a short role such as "Built the model" (`ROLE_MAX_CHARS`). The email goes through the usual Resend sender, from hello@.
- The link carries a token signed with `sign()` in `lib/access.ts`. The table keeps only the token's SHA-256 (`exhbt_invites.token_hash`), so a copy of the table can't be turned into working links. A link works for `INVITE_DAYS`; Resend makes a new link and the old one stops working; Cancel stops it.
- Accepting needs the person signed in, with a password, at the address the invite went to, and then a press of "Join the team". A first-time address creates an account on the way in. Opening the link alone never joins anyone, so a mail scanner that follows links can't. We ask for the name that will show on the project and save it to their profile.
- An exhbt can have `TEAMMATES_PER_EXHBT` people besides its owner, counting invites still open. It's the same on every plan, so it lives in `lib/team-rules.ts` as a code constant, not in `lib/entitlements.ts`. Invites are also capped per hour (`INVITES_PER_HOUR`) so the form can't be used to flood someone's inbox.
- Accepted teammates show on the public project page under the author: photo or initials, name and role, with the name linked to their portfolio when they have a live one (`TeamByline`). The portfolio tile shows the same names and roles as text, since the tile is itself a link and links can't nest (`TeamLine`).
- The owner can remove a teammate and a teammate can leave, from `/exhbts`. Either way they disappear from the page straight away.
- Teammates count no words toward the 200-word cap. They're a byline, like the author's own name and photo (decision 0009), not content: they live in `exhbt_members`, never in the block document, and `wordCount()` doesn't see them.

## A teammate's own exhbt

"Make my own exhbt from this project" (on `/exhbts`, under Team projects) creates a new, empty draft for the teammate with `exhbts.team_of` pointing at the original. It copies nothing anyone wrote. It counts against the teammate's own plan through `canCreateExhbt`, with the same re-check after saving as "Start from scratch".

The project's uploaded files are made available to draft from by **copying them**, object and record, into the teammate's own storage folder and attaching the copies to their new exhbt (`makeOwnExhbt` in `lib/team.ts`, `copyStoredObject` in `lib/uploads.ts`). We chose copies over a second record pointing at the same stored object because deleting must stay simple and safe:

- deleting the original exhbt, or the owner's whole account, removes the owner's objects and nothing else, so the teammate's copies keep working; `team_of` is `on delete set null`, so their exhbt stays and only the link goes;
- the teammate deleting their exhbt or account removes only their copies;
- `exhbt_files` keeps its one-object-per-row rule (`unique (bucket, path)`), and no delete has to ask who else still points at a file.

The cost is storage. Copies count towards the teammate's plan; a file their plan's per-file or total cap couldn't hold is left out, and the editor says how many. Only uploaded material is shared (kinds source, evidence and image). The app's own helper files are never copied (`isDraftHelperFile` in `lib/draft-tools.ts`): the kept source text includes the owner's notes, which is writing.

The editor's strip offers "Draft from these files". That opens `/exhbts/new?into=<id>`, where the copies are fetched and read in the browser like any upload, and the AI draft fills that exhbt instead of making another (`into` on `/api/exhbts/draft`). It's allowed only while the exhbt is the teammate's own, unpublished and still empty (`canDraftInto`), so a draft never writes over their words. The drafts allowance applies as usual.

Leaving the team, or being removed, clears `team_of` on the teammate's own exhbts of that project. Their exhbt and their copies stay theirs. While they're on the team, both pages say "Team project with" and the other names.

## Whose file may show

A file shows only as part of its owner's exhbt, portfolio or profile: `mayShowFile` in `lib/files.ts` is true only when `StoredFile.userId` is that person, and `signedFileUrl(fileId, ownerId)` needs the owner, so no caller can skip the check. A teammate's copy is their own record, so it passes for them; the original never does. On the write side, `createExhbt` and `saveExhbtDraft` (both stores) drop any image section or work file the writer doesn't own, silently, in every environment (an autosave has nowhere to show an error, and development then behaves as production does). Every write path goes through those two methods.

## Private matching of identical files

**Where the fingerprint is made.** On the server. Uploads go straight from the browser to Storage, so there is no server step in the upload itself; after the PUT, the browser calls `POST /api/files/[id]/complete`, and the server reads the stored object back and records its SHA-256 in `exhbt_files.sha256` (`completeUpload` in `lib/duplicates.ts`). We didn't take a hash from the browser: a browser can send any value it likes, which would let anyone dodge a match or plant one. Reading the object back costs one download per upload, which is fine at our file sizes. The same step refuses a stored object bigger than the size the upload asked for. Profile photos are fingerprinted but never matched. Helper files the app writes itself have no fingerprint.

**What counts as a match.** The same fingerprint on a file attached to an exhbt on another account, where the uploader isn't already on that project. "The project" is the original exhbt plus every teammate's own exhbt made from it; being its author, the author of one of those, or a teammate on any of them counts as being on it. Only the oldest such file is used.

**What the uploader sees.** A panel at the foot of the screen: "This file is already on someone else's exhbt. Were you on that project together?", with "Ask to join" and "No, it's mine". It never names the other person or their exhbt, and the server's answer to the browser is an opaque id. "Ask to join" says plainly that the owner will see the uploader's name and email address.

**What the owner sees.** Only after the uploader asks: an email ("… asked to join …") and a request on `/exhbts` and on the Teammates page, with the uploader's name, email and stated part. Approving adds them as a teammate and emails them; only then do they learn whose exhbt it is. Declining changes nothing anywhere and tells nobody.

**What's kept.** Every match is a row in `duplicate_matches`: uploader, owner, both file ids, the hash, the outcome (`shown`, `asked`, `approved`, `declined`, `mine`, `repeat`) and when each side answered. The same uploader matching the same exhbt again after either side has answered is logged as `repeat` and asks nothing, so nobody can pester an owner by uploading the file twice. The table has row-level security on and no policy at all: only the service role reads it, so an uploader can never query who else holds a file. There's no admin page yet; an admin reviews it in Supabase's SQL editor, for example `select * from duplicate_matches where outcome in ('mine', 'declined', 'repeat') order by created_at desc`.

**Nothing is public.** No page, tile, badge or link previews mention a match. The privacy policy says fingerprints are compared to spot shared project files and help teammates find each other, that nothing about it is shown publicly, and that matches may be reviewed.

## What an exact hash can't do

It only finds files that are byte-for-byte the same. A re-saved PDF, a file exported again, a single changed cell or a screenshot of the same chart all give a different fingerprint, so most copying goes unseen, and an identical file usually means a shared group project rather than anything wrong. That's why a match is a question and a way for teammates to find each other, not a judgement. It is not the originality check: that is still "coming soon" (`ORIGINALITY_CHECK_LIVE` in `lib/entitlements.ts`), and no exhbt shows an originality tick.

## Privacy, export and deletion

- The account export includes memberships, the teammates on your exhbts, invites you sent and invites to your address (never the token hash), and your own side of any file match, without the other account.
- Deleting an account removes its memberships, the teammates and invites on its exhbts, invites sent to its address, and matches on either side. A teammate's own exhbt made from one of its exhbts keeps its copied files and loses the link.

## Not decided here

An admin page for matches, near-duplicate detection, letting a teammate edit their own role, and showing a teammate's role on per-job link pages.

Code: `lib/team.ts`, `lib/team-rules.ts`, `lib/duplicates.ts`, `app/(app)/team/`, `app/(app)/exhbts/[id]/team/`, `components/team/`, `components/portfolio/TeamByline.tsx`. Schema: `supabase/migrations/20261119000000_teammates.sql`.
