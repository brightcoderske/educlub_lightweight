# Moving eduClub to Novahost, in 5 steps

eduClub runs on Novahost as **one Node app** that serves the website, the API, the uploads and the
database connection from one address, `https://educlub.co.ke`. There is no Vercel and no separate API
host any more, so the browser never makes a cross-site request: no CORS errors, and if the host's
firewall ever asks "are you human", it asks on a page the learner can answer.

`learn.educlub.co.ke` is retired completely: nothing is set up for it on Novahost, and the app never uses
it. `runner.educlub.co.ke` stays, because learners' Python must run on an address of its own.

Nothing deploys by itself. Pushing to GitHub changes nothing on the server until you run
`bash scripts/deploy.sh` there.

Everything lives in one folder, `~/apps/educlub`:

```text
~/apps/educlub/                  the application (a checkout of the GitHub repository)
~/apps/educlub/public/           document root of educlub.co.ke: empty apart from cPanel's own .htaccess
~/apps/educlub/runner/           document root of runner.educlub.co.ke: the Python runner only
~/apps/educlub/backend/.env      the one settings file: never committed, never touched by a deploy
~/apps/educlub/backend/uploads/  logos, banners, activity images, learners' files (kept across deploys)
~/apps/educlub/frontend/build/   the built website, served by the app
~/apps/educlub/backups/          database backups the deploy takes before a migration (newest 14 kept)
```

The domains point at `public/` and `runner/`, never at `~/apps/educlub` itself, so `.env` and the code
cannot be fetched by URL. Git ignores those three folders, so updates never touch them.

Replace `CPANELUSER` with your Novahost cPanel username everywhere below.

| Step | What | Learners affected? |
| --- | --- | --- |
| 1 | Domains, and the code on Novahost | No |
| 2 | The Node app, its settings, an empty database and the mailboxes | No |
| 3 | Copy the database and uploads from HostAfrica | No |
| 4 | First deploy, checked before anyone is sent there | No |
| 5 | Switch-over: DNS, SSL, Flutterwave, Vercel, final check | Yes, a quiet hour |

---

## Step 1. Domains, and the code on Novahost

**1a. Ask Novahost** (no need to wait for the answer before carrying on):

1. The **process limit** (Healthfield's is 100, and every thread counts) and the **memory limit** for Node apps.
2. That **Node.js 22 or newer** is available in *Setup Node.js App*, and `git`, `mysqldump` and `taskset`
   work in the Terminal.
3. To **not apply the Imunify360 captcha / anti-bot challenge to `/api/`** on educlub.co.ke. The site's
   own pages can show it, but the API answers background requests that can never solve a captcha.

**1b. Domains** (nothing is live until step 5, so this is safe to do now):

1. `educlub.co.ke`: *Domains* › **Create A New Domain**, untick *Share document root*, document root
   `apps/educlub/public`. If it already exists with another document root, change it to that one
   (*Domains* › *Manage*).
2. `runner.educlub.co.ke`: create it with document root `apps/educlub/runner`.
3. `www.educlub.co.ke`: *Redirects* › type **Permanent (301)**, domain `educlub.co.ke`, redirect to
   `https://educlub.co.ke`, **Only redirect with www.**, **Wild Card Redirect** ticked.

**1c. The code.**

*Without a Terminal* (the repository is public, so no key is needed). Do this **before** 1b, because
cPanel only clones into a folder that does not exist yet or is empty:

1. *File Manager*: look in `apps`. If an `educlub` folder is there and has anything in it, rename it
   `educlub-old`.
2. *Git Version Control* › **Create**: *Clone a Repository* on, Clone URL
   `https://github.com/brightcoderske/educlub_lightweight.git`, Repository Path `apps/educlub`,
   Repository Name `educlub`. Never press *Deploy HEAD Commit* there: the repository's `.cpanel.yml`
   belongs to the old HostAfrica server.
3. Then do 1b. cPanel creates `apps/educlub/public` and `apps/educlub/runner` inside the checkout, and git
   ignores both.

*With a Terminal* (or SSH), make a read-only deploy key for this repository (never a password or token):

```bash
(set -e; mkdir -p ~/.ssh ~/apps; chmod 700 ~/.ssh
[ -f ~/.ssh/educlub_deploy ] || ssh-keygen -t ed25519 -f ~/.ssh/educlub_deploy -N "" -C educlub-server -q
grep -q "^Host github-educlub$" ~/.ssh/config 2>/dev/null || printf '\nHost github-educlub\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/educlub_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config ~/.ssh/educlub_deploy
ssh-keygen -F github.com >/dev/null || ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
echo; echo "Add this key at https://github.com/brightcoderske/educlub_lightweight/settings/keys/new (write access OFF):"; echo; cat ~/.ssh/educlub_deploy.pub)
```

Add the printed line on GitHub (*Settings › Deploy keys › Add deploy key*, title `educlub-server`,
**Allow write access off**). Then put the code into `~/apps/educlub`. This works whether the folder is
new, empty, or already holds the `public/` and `runner/` folders cPanel made in 1b:

```bash
(set -e; mkdir -p ~/apps/educlub/public ~/apps/educlub/runner; cd ~/apps/educlub
[ -d .git ] || git init -q -b main
git remote get-url origin >/dev/null 2>&1 || git remote add origin git@github-educlub:brightcoderske/educlub_lightweight.git
git fetch -q origin main
git rev-parse -q --verify HEAD >/dev/null || git checkout -q -b main --track origin/main
git log --oneline -1; ls)
```

It ends by printing the newest commit and the folder's contents (`backend`, `frontend`, `public`,
`runner`, `scripts` and so on).

## Step 2. The Node app, its settings, an empty database and the mailboxes

1. *MySQL Databases*: create `CPANELUSER_educlub`, a user with a strong password, and add the user to the
   database with **ALL PRIVILEGES**. Leave it empty; step 3 fills it.
2. *Email Accounts*: recreate the mailbox eduClub sends from (the address in `EMAIL_USER` / `EMAIL_FROM`),
   then *Email Deliverability* › **Repair** for educlub.co.ke so SPF and DKIM are published.
3. *Setup Node.js App* › **Create Application**:
   - Node.js version: **22** (or the newest offered)
   - Application mode: **Production**
   - Application root: `apps/educlub/backend`
   - Application URL: `educlub.co.ke`
   - Application startup file: `src/server.js`

   Do not press *Run NPM Install*; the deploy installs packages itself.
4. Create `~/apps/educlub/backend/.env`. Start from the current server's
   `/home/codecham/educlub-backend/.env` and change only these lines:

   ```text
   NODE_ENV=production
   DATABASE_URL=mysql://CPANELUSER_educlub:THE_PASSWORD@localhost:3306/CPANELUSER_educlub
   FRONTEND_URL=https://educlub.co.ke
   CORS_ORIGINS=https://educlub.co.ke,https://www.educlub.co.ke
   EMAIL_HOST=mail.educlub.co.ke          (and EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD for the mailbox above)
   ```

   Then `chmod 600 ~/apps/educlub/backend/.env`. If a variable is also set in *Setup Node.js App ›
   Environment variables*, that value wins over `.env` (except the `EMAIL_` ones), so keep that list empty.

## Step 3. Copy the database and uploads from HostAfrica

1. **On the old server** (HostAfrica Terminal), export. MariaDB there only accepts its local socket:

   ```bash
   mysqldump --socket=/var/lib/mysql/mysql.sock -u codecham_educlub -p --single-transaction --routines codecham_educlub > ~/educlub.sql
   ```

   MariaDB 11 may name collations MySQL does not know; make the dump portable:

   ```bash
   sed -i 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_ci/g; s/utf8mb4_uca1400_as_cs/utf8mb4_unicode_ci/g' ~/educlub.sql
   ```

2. **Pack the uploads** on the old server:

   ```bash
   tar -czf ~/educlub-uploads.tar.gz -C /home/codecham/educlub-backend uploads
   ```

3. **Copy both files** to Novahost (download them from the old cPanel's File Manager and upload them to
   your Novahost home folder), then on Novahost:

   ```bash
   mysql -u CPANELUSER_educlub -p CPANELUSER_educlub < ~/educlub.sql
   ```

   ```bash
   tar -xzf ~/educlub-uploads.tar.gz -C ~/apps/educlub/backend
   ```

The saved picture addresses still name the old server; step 4 fixes them once the app's packages are in.

## Step 4. First deploy, checked before anyone is sent there

This step installs the packages, builds the website (pinned to two CPUs, so the account's process limit
is not hit), checks the database is complete, fills `~/apps/educlub/runner`, restarts the app and waits
until it reports the deployed commit. DNS still points elsewhere, so the deploy asks the app on this
server directly. Then it changes the saved picture addresses from `https://learn.educlub.co.ke/uploads/...`
to `/uploads/...` (it reports "Nothing to do" if they are already done), checks the mailbox login, and
shows the app's health.

*Without a Terminal*: in *Cron Jobs*, add a job set to every minute with this command. It runs only when
there is no log file yet, so it runs once however often cron fires:

```text
[ -e ~/educlub-step4.log ] || (cd ~/apps/educlub && bash scripts/deploy.sh --force --yes && cd backend && . "$(ls -d ~/nodevenv/apps/educlub/backend/*/bin/activate | sort -V | tail -1)" && echo "--- pictures" && node scripts/rewrite-upload-urls.js --apply && echo "--- email" && node scripts/verify-email.js; echo "--- health"; ip=$(sed -n 's/^ip: *//p' /var/cpanel/userdata/$(id -un)/educlub.co.ke); curl -sk --max-time 20 --resolve educlub.co.ke:443:${ip:-127.0.0.1} https://educlub.co.ke/health/ready; echo; echo FINISHED) > ~/educlub-step4.log 2>&1
```

Open `~/educlub-step4.log` in *File Manager* and refresh it until the last line reads `FINISHED` (the
website build takes several minutes). Then **delete the cron job**. To run it again, delete the log first.

*With a Terminal*, run the same commands one at a time:

```bash
cd ~/apps/educlub && bash scripts/deploy.sh --force
```

```bash
cd ~/apps/educlub/backend && source ~/nodevenv/apps/educlub/backend/*/bin/activate
```

```bash
node scripts/rewrite-upload-urls.js --apply
```

```bash
node scripts/verify-email.js
```

```bash
curl -sk --resolve educlub.co.ke:443:$(sed -n 's/^ip: *//p' /var/cpanel/userdata/$(id -un)/educlub.co.ke) https://educlub.co.ke/health/ready
```

In the log, look for:

- `DEPLOYED <commit>` from the deploy.
- `Rewrote N value(s)` (or "Nothing to do") after `--- pictures`.
- "SMTP connection and authentication verified" after `--- email`.
- After `--- health`, `clock.databaseNow` and `clock.serverNow` matching to the second: the database and
  the app agree on the time.

## Step 5. Switch-over

Pick a quiet hour (no lessons), then:

1. Repeat **step 3** so the newest data and uploads are copied, then run step 4 again (delete
   `~/educlub-step4.log` first if you use the cron job).
2. **DNS**: point `educlub.co.ke`, `www` and `runner` at Novahost. The simplest is to switch the domain's
   nameservers to Novahost's, which also moves mail. Then *SSL/TLS Status* › **Run AutoSSL**. Leave
   `learn` out: it is retired.
3. **Flutterwave**: in the Flutterwave dashboard, *Settings › Webhooks*, change the URL to
   `https://educlub.co.ke/api/payments/flutterwave/webhook`. That one address handles both course and
   competition payments; the secret hash stays as it is.
4. **Vercel**: remove `educlub.co.ke`, `www.educlub.co.ke` and `runner.educlub.co.ke` from the Vercel project.
5. Sign in as a learner and a teacher, open a course (its pictures should show), run a Python activity,
   look at a school logo and a competition banner, and send a password reset.
6. Leave the old HostAfrica app running, unchanged, for a week in case anything was missed.

## Every update after this

```bash
cd ~/apps/educlub && bash scripts/deploy.sh
```

It lists the new commits and asks before doing anything. Then it does only what those commits need: a
backend change is just a restart; packages are reinstalled only when their lock file changed; the website
is rebuilt only when `frontend/` changed, beside the live one; the database is backed up and migrated only
when the schema changed. If any step fails, or the site does not report the new commit within 90 seconds,
the previous version is put back and restarted.
