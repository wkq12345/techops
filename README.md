# TechOps

## Documentation

Start with the [documentation index](docs/README.md) for per-module guides,
frontend/backend architecture, database relationships, API permissions and
development/deployment operations. Update the relevant guide whenever its module
changes.

TechOps is a production-style computer retail, repair, and custom-build management system. It includes authenticated operations for master data, inventory, serialized stock, sales, repairs, purchasing, PC builds, compatibility checks, warranties, returns, audit history, notifications, and reporting.

## Applications

- `frontend/` — React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, and Zod
- `backend/` — Laravel REST API, Sanctum, services, Form Requests, API Resources, policies/gates, and PostgreSQL

## Kubernetes learning environment

An isolated Docker Desktop Kubernetes setup is available under
[`deploy/k8s`](deploy/k8s/README.md). It uses a fresh PostgreSQL database, separate
secrets and Redis, demo records, and `http://127.0.0.1:8080` through port-forwarding.
Follow that guide to enable the local cluster, deploy, verify, and stop workloads.
It does not replace the Windows or Docker Compose workflows below.

## Local setup

1. Start the complete stack:

   ```bash
   docker compose up -d --build
   ```

For host-based development, start only PostgreSQL and run both applications locally:

   ```bash
   cd backend
   Copy-Item .env.example .env
   php artisan key:generate
   php artisan migrate --seed
   php artisan serve
   ```

3. Configure and start the frontend in a second terminal:

   ```bash
   cd frontend
   Copy-Item .env.example .env
   npm install
   npm run dev
   ```

The seeded development administrator is `admin@techops.local` with password `ChangeMe123!`. Change these values through `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding any shared environment.

## Redis operations cache

Redis caches dashboard summaries for 30 seconds and category/brand API lists for
5 minutes. Catalog changes invalidate every cached page after the database
transaction commits. Product changes also invalidate these lists so product counts
stay current. Search, sorting, numbered pages and cursor selectors keep separate
cache entries. Database connection identity separates local and Docker data.

For the current Windows PostgreSQL setup, keep the existing `DB_*` settings and
start only the Redis container from the project root:

```powershell
docker compose up -d redis
docker compose exec redis redis-cli ping
cd backend
composer install
php artisan config:clear
php artisan serve
```

The ping should return `PONG`. Redis is exposed only on `127.0.0.1:6379`.
TechOps uses the native PhpRedis extension (6.3 or newer). Docker installs it in
the backend image. For Windows PHP, download the matching DLL from
[the official PHP extension builds](https://pecl.php.net/package/redis/6.3.0/windows),
matching PHP major/minor version, thread safety, architecture and compiler.
Copy `php_redis.dll` into PHP's extension directory and enable `extension=redis`
in the `php.ini` shown by `php --ini`. Restart the Laravel server after enabling it.
Verify the extension with `php --ri redis` before running `composer install`.
Local `.env` settings are:

```dotenv
OPERATIONS_CACHE_STORE=redis
OPERATIONS_DASHBOARD_TTL=30
OPERATIONS_CATALOG_TTL=300
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

The full Docker stack sets `REDIS_HOST=redis` for its backend and scheduler.
Rebuild the backend image after installing the new dependency before using that
stack. Windows PostgreSQL and Docker PostgreSQL remain separate databases.

Sessions, queues and the default Laravel cache remain database-backed. Redis only
holds replaceable cache data; its container has no persistent business data.
If Redis is unavailable, these endpoints query PostgreSQL directly. If an
invalidation cannot reach Redis, existing catalog entries expire within 5 minutes.
Set `OPERATIONS_CACHE_STORE=array` to disable caching between requests, then clear
Laravel's configuration cache and restart the backend.

To inspect keys after loading the dashboard or category/brand lists:

```powershell
docker compose exec redis redis-cli --scan --pattern '*operations:v1:*'
```

## Staff authentication

Staff sign in at `/login`. API operations require a Laravel Sanctum session and the appropriate role permissions. There is no public sign-up route.

Create staff accounts from the backend directory:

```powershell
php artisan techops:create-user staff@company.com --role=sales-staff
```

For Docker, use `docker compose exec backend php artisan techops:create-user staff@company.com --role=sales-staff`. The command prompts for a name and a hidden password twice. It refuses to overwrite an existing account. Supported seeded roles are `super-admin`, `manager`, `sales-staff`, `technician`, `warehouse-staff`, and `purchasing-staff`.

Open the account avatar in the application bar to change your password. New passwords require at least 12 characters. Changing a password rotates the remember token and invalidates other established browser sessions through Sanctum's password-hash check. Logout and session expiry clear cached operational data. Seeding again preserves an existing administrator's password.

For internal hosting, configure `FRONTEND_URL`, `APP_URL`, and `SANCTUM_STATEFUL_DOMAINS` for the actual host and frontend port, and `VITE_API_URL` for the staff-accessible API URL. Use the same hostname for the frontend and API: do not mix `localhost` and `127.0.0.1`. Password recovery uses the configured mail transport; the development log mailer does not deliver emails. Enable secure session cookies when serving over HTTPS.

## Gmail SMTP

The local `.env` and `.env.example` are configured for `smtp.gmail.com:587`
with STARTTLS required. Complete these two entries privately in `backend/.env`:

```dotenv
MAIL_USERNAME=your-real-address@gmail.com
MAIL_PASSWORD="your-16-character-google-app-password"
```

Enable 2-Step Verification for that Google account, then create an App Password
named TechOps at https://myaccount.google.com/apppasswords. Use the generated
App Password, without its display spaces, rather than your regular Google password.
Google documents account restrictions and requirements at
https://support.google.com/accounts/answer/185833.

`MAIL_FROM_ADDRESS` refers to `${MAIL_USERNAME}`, so the sender follows the account
you enter. Do not commit `.env` or paste the App Password into chat.

After saving the credentials, run `php artisan config:clear` from `backend` and
restart `php artisan serve`. If you run the backend in Docker instead, recreate
its container after changing `.env` so the updated environment is loaded.

Use Forgot password with an existing staff account whose email address can receive
mail. The seeded `admin@techops.local` address is not a deliverable Gmail inbox;
use a real staff email when checking delivery. Gmail authentication and delivery
cannot be verified until credentials are entered. This config enables the existing
password-reset email; operational reminders remain in-app notifications.

For development without sending mail, change `MAIL_MAILER=log` and clear the
configuration cache. This writes email content to Laravel's log instead.

## Verification

```bash
Set-Location backend
php artisan test
Set-Location ..\frontend
npm test
npm run build
```

## Modules and workflows

All record creation and editing opens in a shared modal, including stock adjustments/transfers, record-management workflows, and account password changes. The modal traps keyboard focus, locks background scrolling, fits desktop/mobile viewports, and restores focus on close. Use Cancel, the close button, or Escape to dismiss; backdrop clicks preserve the draft. Dismissal and form controls are blocked while a mutation is pending. Failed saves retain inputs and show feedback; successful create/edit saves close and refresh the affected list.

Sales-order item rows offer Category before Product. All categories is the default; selecting a category requests its active products and all descendant-category products from the backend. Each row has an independent filter. Changing it clears that row's product and serial/IMEI selection. Load more products preserves the filter while fetching additional cursor pages. Category lists are loaded across all cursor pages, and nested category names show their full path. The selected category is a picker filter only, not part of the submitted order payload.

### Warehouses, child locations and mixed-location sales

Warehouses remain standalone stock-holding sites. Each warehouse has multiple Inventory Locations (racks, shelves or bins), managed through a separate CRUD page. Locations use `warehouse_bins` / `bin_id`, generated BIN codes, an editable name, optional zone/rack/shelf/bin details and active/inactive status. A location's warehouse is immutable; transfer stock instead of re-parenting. The protected system Unassigned location is created for every warehouse. Only unused user-created locations can be deleted; linked stock and business history are retained.

Sales rows follow Category → Product → Warehouse → Location → Quantity. Each stock-tracked item requires its own active location; location choices display available quantity for the selected product. Serial/IMEI choices are filtered by both product and location, and already selected units cannot be reused on another line. Changing a category or product resets only that line's location and serial/IMEI choice. Services without stock tracking do not require a location. Repeated product/location lines are checked against their combined requested quantity, with authoritative stock checks in the backend transaction.

New sales requests submit `items[].warehouse_id` and `items[].bin_id`. Legacy clients may omit `bin_id`, which defaults to that warehouse's Unassigned location (or the serialized unit's existing bin). The legacy order-level warehouse remains an optional fallback. Reservations and fulfilment use each saved child location. Returns default to the sold item's warehouse/location and allow a different receiving location. Goods receiving chooses a location inside the PO warehouse; repairs, adjustments and transfers also use child locations. Transfers support both distinct locations within one warehouse and different warehouses.

Apply `2026_10_09_000100_add_sales_item_inventory_locations.php`, then `2026_10_09_000200_add_warehouse_inventory_locations.php` before deploying the hierarchy. The second additive migration puts existing quantity/reservation balances into Unassigned under their original warehouse, fills only missing serialized-unit bins, and retains all warehouse totals and history. `inventory_location_stock` stores child balances; `inventory_stock` remains the aggregate for reports. Shared transactional inventory operations update both together. No tables are dropped or truncated, and rollback requires explicit approval.

Record lists use numbered pagination and sortable columns (30 rows per page); catalog selectors load all cursor pages. Dashboard, reports, and account are not paginated lists. Product and inventory dropdown filters apply to the current page only; the Inventory Locations warehouse filter applies across pages.

The backend assigns [business codes](docs/modules/generated-codes.md) on save. Create forms hide the code and edit forms display it as read-only. Both omit it from form submissions. Orders, repairs, builds, invoices, receipts and returns use separate automatic numbers. Staff enter physical serial numbers and IMEIs from the actual items.

The additive `2026_10_07_000001_create_record_code_sequences_table` migration creates only the counter table. Apply it before using automatic-code creation (`php artisan migrate --path=database/migrations/2026_10_07_000001_create_record_code_sequences_table.php`). Row-locked transactional counters avoid simultaneous allocations and retain history after deletions. The first allocation starts above existing matching numeric codes; failures roll back the allocation with the record. Sequence history is intentionally retained: removing its table or resetting counters requires explicit approval.

- Master data: customers, suppliers, brands, hierarchical categories, products, attributes, warehouses and bins
- Inventory: quantity and serialized stock, reservations, transfers, adjustments and immutable stock movements
- Sales: server-priced orders, reservation, payment, fulfilment and invoice creation
- Repairs: device intake, guarded status transitions and inventory-backed parts usage
- Purchasing: purchase orders, approval, partial receiving and serialized receiving
- PC Builder: requirements, component selection and compatibility validation
- After-sales: warranties, warranty claims, customer returns and supplier returns
- Operations: audit logs, database notifications and live sales/inventory/repair/purchasing reports

All stock-changing service methods use database transactions and row locks. Product prices and totals are calculated by the backend.
