# Students-Hub

School kiosk and admin app: student check-in/out, facility bookings, counselling questionnaires ("Ask Ms Vi"), and equipment loans. Laravel 11 API with a React (Vite) single-page app, MySQL, and database queues.

## Run it locally

Requirements: PHP 8.2+, Composer, Node 22+, MySQL 8.

```bash
composer install
npm install
cp .env.example .env          # then set DB_CONNECTION=mysql and the DB_* values
php artisan key:generate
php artisan migrate --seed
composer dev                  # artisan serve + queue worker + log tail + Vite
```

Open the URL `artisan serve` prints. If port 8000 is taken it moves to 8001; the frontend calls the API on the page's own origin, so any port works.

`composer dev` must keep running: bookings and check-ins schedule queued jobs that close them automatically.

Seeded logins (local only, password `secret`): `superadmin@gmail.com`, `admin1@gmail.com` (Checkin), `admin2@gmail.com` (Booking), `admin3@gmail.com` (Counsel).

## Tests

```bash
php artisan test   # Laravel, on in-memory SQLite (see phpunit.xml), never your MySQL
npm test           # frontend unit tests (Vitest), e.g. resources/js/components/store/__tests__
```

CI runs the frontend tests, the build and the Laravel suite on every push to `develop` and `main`, and on every pull request into them.

## Branches and releases

Code moves in one direction: `develop` → `main` → client branches.

| Branch | Role |
| --- | --- |
| `feat/*`, `fix/*`, `chore/*` | One piece of work. Opened from `develop`, merged back through a pull request with green CI |
| `develop` | Integration. Everything merged here should be releasable |
| `main` | Staging and demo. Every release is tagged here |
| `client/<name>` | One per production server. Only ever moved forward to a release tag |

Releases are tagged `vMAJOR.MINOR.PATCH` on `main`. MINOR goes up for a normal release, PATCH for a hotfix, MAJOR when an upgrade needs manual work on the server.

Release to staging:

```bash
git switch main && git pull
git merge --ff-only develop
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main --follow-tags
```

Promote a tested release to production:

```bash
git switch client/<name> && git pull
git merge --ff-only v1.1.0
git push origin client/<name>
```

Hotfix production, then bring the fix back:

```bash
git switch -c hotfix/<name> client/<name>
# fix, commit, test
git switch client/<name> && git merge --ff-only hotfix/<name>
git tag -a v1.1.1 -m "Hotfix: <name>"
git push origin client/<name> --follow-tags
git switch develop && git merge client/<name> && git push origin develop
```

Rules:

- Client branches never get commits of their own. Anything that differs per client (name, branding, URLs) goes in that server's `.env` or database.
- If `--ff-only` refuses, someone committed directly to the target branch. Merge that commit into `develop` first.
- Never merge `develop` straight into a client branch, and never merge one client branch into another.
- Never squash or rebase into `main` or a client branch.
- Once a migration is in a tagged release, never edit it. Add a new migration.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, where type is `feat`, `fix`, `refactor`, `test`, `docs`, `ci` or `chore`. Put the issue IDs a commit closes in the body, e.g. `Closes: C2, M1`.
