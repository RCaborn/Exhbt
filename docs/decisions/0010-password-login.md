Status: accepted
Date: 13 Nov 2026

# Log in with a password

`/login` was a fresh email link every time. It is now an email address or a username, plus a password.

- A new account chooses a password. One email confirms the address. After that, the password is enough.
- An account that only has a sign-in link (the roadmap email, or an older login) sets a password from one email, or from the account page while that link's session is still open.
- The roadmap email still includes a link that signs them in and saves the roadmap. That delivers something they asked for. It is not the everyday login.
- A username works once it has been claimed. An old username still works for the 30 days it redirects.
- A wrong email, an unknown username and a wrong password all get the same reply, so the form does not say which accounts exist.
- The password lives in Supabase Auth. It is not a column on `profiles`. With no Supabase (local development and the tests), a hash is kept in memory, and `/auth/dev` still stands in for the roadmap email.
