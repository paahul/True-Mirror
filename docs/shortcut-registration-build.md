# Shortcut Registration Flow — Build Guide (Phase 2, step 4 — DEFERRED)

> **Not needed yet.** Plan is to onboard the first friend **manually** (see
> `friend-install-guide.md`) and validate the real-world flow before building this.
> This guide is for when you want one shareable link that self-provisions each user.

## What it does

Turns the personal Shortcut (hardcoded token) into a shareable one:

- **First run:** ask name + optional email + Watch mode → POST `/api/register` with the
  invite code → receive a token → **save it to a file in iCloud Drive**.
- **Every later run:** read the saved token, skip straight to the analysis.

One link, posted to a group; everyone installs the same Shortcut; each person's first
run creates their own user row. No touching the database per person.

## Prereqs

- **Invite code:** the registration endpoint is gated by the `INVITE_CODE` env var you
  set in Vercel. The Shortcut must send that **exact same value**. (It's not a secret
  from your friends — it's a soft gate; same code for everyone you share with.)
- `POST /api/register` accepts: `name` (required), `email`, `invite_code`, `mode`
  (`curious`|`active`|`performance`), and reminder fields. Returns `{ "token": "…" }`.

## Build outline

Put this **at the very top** of the Shortcut, before the health-reading actions.

### 1. Try to read an existing token
1. **If** (check whether the token file exists) — easiest robust approach:
   - **Get File** from iCloud Drive at path `Shortcuts/TrueMirror/token.txt`
     - Turn **OFF** "Error If Not Found" if that option exists, so a missing file doesn't halt the shortcut. If there's no such toggle, wrap the Get File in a **Try/Otherwise**-style structure using **If** on whether the result has a value.
   - **If** the file content **has any value** → **Set Variable** `Token` to it → skip to analysis (use an **If/Otherwise** to gate the registration block).

### 2. First run — register (the Otherwise branch)
2. **Ask for Input** (Text) → "What's your name?" → Set Variable `Name`
3. **Ask for Input** (Text) → "Email for reminders? (optional)" → Set Variable `Email`
4. **Choose from Menu** → "How do you use your Watch?" with items:
   - "Just curious" → Set Variable `Mode` = `curious`
   - "Building active habits" → Set Variable `Mode` = `active`
   - "Serious training" → Set Variable `Mode` = `performance`
5. **Text** (register body):
   ```
   {
     "name": "‹Name›",
     "email": "‹Email›",
     "invite_code": "YOUR_INVITE_CODE_HERE",
     "mode": "‹Mode›"
   }
   ```
   (Note: name/email/mode ARE strings here, so they keep quotes — unlike the numeric
   health values. Watch smart-quotes.)
6. **Get Contents of URL** → POST `https://truemirror.paahulhq.com/api/register`
   - Header `Content-Type: application/json`, Request Body **File** = the Text above
7. **Get Dictionary Value** → key `token` from the response → Set Variable `Token`
8. **Save the token:**
   - **Text** = the `Token` variable
   - **Save File** → iCloud Drive → path `Shortcuts/TrueMirror/token.txt` → turn OFF
     "Ask Where to Save" → overwrite if exists

### 3. Continue to analysis
9. From here, the rest is your existing analysis flow — except the analyze URL's
   `?token=` should use the **`Token`** variable instead of a hardcoded value.
   - Build the analyze URL as **Text**: `https://truemirror.paahulhq.com/api/analyze?token=‹Token›`
   - Use that Text as the URL in the analyze Get Contents of URL action.

## Gotchas

- **Token persistence is the crux.** Shortcut variables reset each run, so the iCloud
  file is what makes "first run vs later run" work. Test by running twice — the second
  run should NOT ask for your name.
- **Strings vs numbers:** register body fields are strings (quoted); health body numbers
  are unquoted. Don't mix them up.
- **Invite code** must match Vercel's `INVITE_CODE` exactly, or you get `403 Invalid invite code`.
- If `email` is blank, sending `"email": ""` is fine (the API treats empty as no email).

## Why we're deferring it

Building reliable first-run/file logic in Shortcuts is fiddlier than the metric blocks,
and we want to learn from one real friend (permission friction, whether the analysis is
useful) before investing here. Manual provisioning (`friend-install-guide.md`) gets a
friend running today with near-zero extra build.
