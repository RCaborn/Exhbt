Status: accepted
Date: 8 Nov 2026

# Portfolios are subdomains

Three hosts, one deployment, one Worker:

- `www.exhbt.co.uk` (and the apex) is the marketing site: pricing, universities, legal.
- `app.exhbt.co.uk` is the tool: the roadmap, the account, building exhbts.
- `alex.exhbt.co.uk` is that person's public portfolio.

An employer link is a path on the person's host, with a short random suffix so the company name cannot be guessed. It is not a second level of subdomain. A wildcard certificate covers one label only.

DNS is a single proxied wildcard, plus more specific records for `www`, `app`, and the mail names Resend and Workspace already use. Do not create a DNS record, a Worker route, or a custom hostname per person. Those are capped. The wildcard is not.

Usernames that match infrastructure stay reserved: `www`, `app`, `api`, `mail`, `send`, `admin`, `auth`, `login`, `static`, `demo`, `dev`, `status`, and any name added later for email. The allowed shape is the username check already on `profiles.username`.

Sign-in cookies belong to `app.exhbt.co.uk` only, never the parent domain.

Phase 1 still serves marketing and the roadmap on one origin. The hosts above are the addresses we show and the ones to build. They are not routed yet. The old path form of a portfolio is not the canonical address, and living copy should not teach it.

Code: `lib/hosts.ts`.
