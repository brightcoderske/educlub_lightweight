# Moving eduClub to Novahost, step by step

eduClub runs on Novahost as **one Node app** that serves the website, the API, the uploads and the
database connection from one address, `https://educlub.co.ke`. There is no Vercel and no separate API
host any more, so the browser never makes a cross-site request: no CORS errors, and if the host's
firewall ever asks "are you human", it asks on a page the learner can answer.

Nothing deploys by itself. Pushing to GitHub changes nothing on the server until you run
`bash scripts/deploy.sh` there.

```text
~/apps/educlub/                  the application (a checkout of the GitHub repository)
~/apps/educlub/backend/.env      the one settings file: never committed, never touched by a deploy
~/apps/educlub/backend/uploads/  logos, banners, activity images, learners' files (kept across deploys)
~/apps/educlub/frontend/build/   the built website, served by the app
~/apps/educlub-public/           document root of educlub.co.ke: empty apart from cPanel's own .htaccess
~/apps/educlub-runner/           document root of runner.educlub.co.ke: the Python runner only
~/apps/educlub-backups/          database backups the deploy takes before a migration (newest 14 kept)
```

The domains never serve `~/apps/educlub` itself, so `.env` and the code cannot be fetched by URL.

Replace `CPANELUSER` with your Novahost cPanel username everywhere below.

---

## Part A. Ask Novahost first

1. The **process limit** (Healthfield's is 100, and every thread counts) and the **memory limit** for Node apps.
2. That **Node.js 22 or newer** is available in *Setup Node.js App*, and `git`, `mysqldump` and `taskset` work in the Terminal.
3. To **not apply the Imunify360 captcha / anti-bot challenge to `/api/`** on educlub.co.ke. The site's
   own pages can show it, but the API answers background requests that can never solve a captcha.

## Part B. Domains, subdomains and SSL (on Novahost)

You can do all of this before moving DNS; nothing is live until Part H.

1. **`educlub.co.ke`**: *Domains* › **Create A New Domain**, untick *Share document root*, document root
   `apps/educlub-public`.
2. **`learn.educlub.co.ke`**: create it with the **same document root, `apps/educlub-public`**. It must keep
   working: logos, banners, activity images and learners' files are stored in the database with
   `https://learn.educlub.co.ke/uploads/...` addresses, and Flutterwave sends payment notices there.
3. **`runner.educlub.co.ke`**: create it with document root `apps/educlub-runner`. It must stay a different
   address from the site: learners' Python runs there so it can never reach a signed-in session.
4. **`www.educlub.co.ke`**: *Redirects* › permanent (301) redirect to `https://educlub.co.ke`.
5. **SSL**: *SSL/TLS Status* › **Run AutoSSL** for all four once DNS points at Novahost (Part H).

## Part C. Get the code onto the server

In the cPanel Terminal, make a read-only deploy key for this repository (never a password or token):

```bash
(set -e; mkdir -p ~/.ssh ~/apps; chmod 700 ~/.ssh
[ -f ~/.ssh/educlub_deploy ] || ssh-keygen -t ed25519 -f ~/.ssh/educlub_deploy -N "" -C educlub-server -q
grep -q "^Host github-educlub$" ~/.ssh/config 2>/dev/null || printf '\nHost github-educlub\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/educlub_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config ~/.ssh/educlub_deploy
ssh-keygen -F github.com >/dev/null || ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
echo; echo "Add this key at https://github.com/brightcoderske/educlub_lightweight/settings/keys/new (write access OFF):"; echo; cat ~/.ssh/educlub_deploy.pub)
```

Add the printed line on GitHub (*Settings › Deploy keys › Add deploy key*, title `educlub-server`,
**Allow write access off**), then clone and create the two document-root folders:

```bash
git clone git@github-educlub:brightcoderske/educlub_lightweight.git ~/apps/educlub
mkdir -p ~/apps/educlub-public ~/apps/educlub-runner
```

## Part D. The Node app and its settings

1. *Setup Node.js App* › **Create Application**:
   - Node.js version: **22** (or the newest offered)
   - Application mode: **Production**
   - Application root: `apps/educlub/backend`
   - Application URL: `educlub.co.ke`
   - Application startup file: `src/server.js`
   Do not press *Run NPM Install*; the deploy installs packages itself.
2. Create `~/apps/educlub/backend/.env`. Start from the current server's
   `/home/codecham/educlub-backend/.env` and change only these lines:

   ```text
   NODE_ENV=production
   DATABASE_URL=mysql://CPANELUSER_educlub:THE_PASSWORD@localhost:3306/CPANELUSER_educlub
   FRONTEND_URL=https://educlub.co.ke
   PUBLIC_BASE_URL=https://educlub.co.ke
   CORS_ORIGINS=https://educlub.co.ke,https://www.educlub.co.ke,https://learn.educlub.co.ke
   EMAIL_HOST=mail.educlub.co.ke          (and EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD from Part F)
   ```

   Then `chmod 600 ~/apps/educlub/backend/.env`. If a variable is also set in *Setup Node.js App ›
   Environment variables*, that value wins over `.env` (except the `EMAIL_` ones), so keep that list empty.

## Part E. The database and the uploads

1. **On Novahost**: *MySQL Databases* › create `CPANELUSER_educlub`, a user with a strong password, and add
   the user to the database with **ALL PRIVILEGES**.
2. **On the old server** (HostAfrica Terminal), export. MariaDB there only accepts its local socket:

   ```bash
   mysqldump --socket=/var/lib/mysql/mysql.sock -u codecham_educlub -p --single-transaction --routines codecham_educlub > ~/educlub.sql
   ```

   MariaDB 11 may name collations MySQL does not know; make the dump portable:

   ```bash
   sed -i 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_ci/g; s/utf8mb4_uca1400_as_cs/utf8mb4_unicode_ci/g' ~/educlub.sql
   ```

3. **Pack the uploads** on the old server:

   ```bash
   tar -czf ~/educlub-uploads.tar.gz -C /home/codecham/educlub-backend uploads
   ```

4. **Copy both files** to Novahost (download them from the old cPanel's File Manager and upload them to
   your Novahost home folder), then on Novahost:

   ```bash
   mysql -u CPANELUSER_educlub -p CPANELUSER_educlub < ~/educlub.sql
   tar -xzf ~/educlub-uploads.tar.gz -C ~/apps/educlub/backend
   ```

## Part F. Email

1. *Email Accounts*: recreate the mailboxes eduClub sends from (the address in `EMAIL_USER` / `EMAIL_FROM`).
2. *Email Deliverability* › **Repair** for educlub.co.ke so SPF and DKIM are published.
3. Put the new mailbox's server, port and password in `.env`, then check it (Part G does this too):

   ```bash
   cd ~/apps/educlub/backend && npm run email:verify
   ```

## Part G. The first deploy

```bash
cd ~/apps/educlub && bash scripts/deploy.sh --force
```

`--force` does every step: installs the packages, builds the website (pinned to two CPUs, so the account's
process limit is not hit), checks the database is complete, fills `~/apps/educlub-runner`, restarts the app
and waits until `/health` reports the deployed commit. It ends with `DEPLOYED <commit>`.

Before DNS points here, check it through the server itself:

```bash
curl -s --resolve educlub.co.ke:443:127.0.0.1 -k https://educlub.co.ke/health/ready
```

In that answer, `clock.databaseNow` and `clock.serverNow` must match to the second: that confirms the
database and the app agree on the time.

## Part H. The switch-over

Pick a quiet hour (no lessons), then:

1. Repeat **Part E steps 2-4** so the newest data and uploads are copied, and run
   `bash scripts/deploy.sh --force --no-pull` once more.
2. **DNS**: point `educlub.co.ke`, `www`, `learn` and `runner` at Novahost (the simplest is to switch the
   domain's nameservers to Novahost's, which also moves mail). Then run AutoSSL (Part B step 5).
3. **Vercel**: remove `educlub.co.ke`, `www.educlub.co.ke` and `runner.educlub.co.ke` from the Vercel project.
4. Sign in as a learner and a teacher, open a course, run a Python activity, and send a password reset.
5. Leave the old HostAfrica app running, unchanged, for a week in case anything was missed.

## Every update after this

```bash
cd ~/apps/educlub && bash scripts/deploy.sh
```

It lists the new commits and asks before doing anything. Then it does only what those commits need: a
backend change is just a restart; packages are reinstalled only when their lock file changed; the website
is rebuilt only when `frontend/` changed, beside the live one; the database is backed up and migrated only
when the schema changed. If any step fails, or the site does not report the new commit within 90 seconds,
the previous version is put back and restarted.
