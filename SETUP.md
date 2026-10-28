# Put the shop online for free

The public storefront and Node.js/Express API run as separate Render services,
and Supabase provides the database and file storage. Store traffic goes through
the API; the Supabase service-role key stays on the Render API service and must
never go in `app.js`, `index.html`, or `supabase-config.js`.

## What you will need

- A GitHub account to store this project.
- A Supabase account for the database.
- A Render account for both the API and storefront.

Render provides free `*.onrender.com` URLs for the API and static storefront.
No custom domain is required.

## 1. Set up Supabase

1. Create a Supabase project on its free plan and wait for it to finish
   provisioning.
2. For a new project, run every file in `supabase/migrations/` in filename
   order, including `202610240001_store.sql` and
   `202610240002_customer_accounts.sql`,
   `202610240003_service_role_permissions.sql`, and
   `202610250004_checkout_only_stock.sql`, and
   `202610250005_featured_products.sql`, and
   `202610280006_gcash_receipt_without_reference.sql`, and
   `202610280007_product_back_images.sql`. If earlier migrations were already
   run, run only the unapplied migrations.
3. Run `supabase/seed.sql` to insert the six sample garments.
4. Enable Email/Password sign-in in Supabase Authentication and enable email
   confirmation. Customers register from **Sign in → Create an account** in
   the storefront. Supabase sends only the account-confirmation email; order
   notifications are not configured.
5. To protect sign-in and account creation with Cloudflare Turnstile, create a Turnstile widget in
   Cloudflare and allow the storefront hostname (also allow `localhost` for
   local development). In Supabase, open **Authentication → Bot and Abuse
   Protection**, enable CAPTCHA, choose **Cloudflare Turnstile**, and enter its
   secret key. Put the widget's public site key in `turnstileSiteKey` in
   `supabase-config.js`, then commit and deploy that change. Never put the
   secret key in the repository. Sign-in and account creation stay disabled
   until the security check is completed.
6. Create and confirm the shop owner's account, then grant it admin access in
   the SQL Editor (replace the email):

   ```sql
   insert into public.store_admins (user_id)
   select id from auth.users where lower(email) = lower('owner@example.com');
   ```

   Customer sign-ups do not grant admin access. Add an account to
   `store_admins` only when you intentionally want it to use the separate
   Admin portal.

7. In the Supabase project API settings, copy the project URL, the public
   publishable/anon key, and the secret service-role key. The publishable key
   goes in the frontend config. The service-role key goes only in Render's
   environment variables.
8. Add your actual GCash QR image as `gcash-qr.jpg` beside `index.html`.

## 2. Put the code in GitHub

Create a new repository and push this folder. Do not add `.env` files,
Supabase service-role keys, passwords, or other secrets to GitHub. `.gitignore`
already excludes `.env` and `node_modules`.

## 3. Deploy both services to Render

1. In Render, choose **New → Blueprint** and connect the GitHub repository.
   The included `render.yaml` defines the free Node web service for the API.
2. Set these values in the API service environment settings:
   - `SUPABASE_URL`: your Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: the private server-side service-role key.
   - `ALLOWED_ORIGINS`: use `http://localhost:8765` for the first API deploy;
     you will replace it with the storefront URL after creating the static site.
3. Deploy and wait for Render's health check at `/api/health` to pass. Copy the
   API service URL, for example `https://rg-thrift-api.onrender.com`.
4. In Render, choose **New → Static Site** and connect the same GitHub
   repository. Set the build command to `npm run build:render-site` and the
   publish directory to `render-site`.
5. Add the static site's build environment variable `API_BASE_URL`, set to the
   API service URL from step 3 (for example
   `https://rg-thrift-api.onrender.com`). Deploy the static site and copy its
   `https://*.onrender.com` URL.
6. In the API service's environment settings, replace the temporary
   `ALLOWED_ORIGINS` value with the exact static storefront URL (no trailing
   slash), then save and redeploy.
7. In Supabase Authentication URL settings, set the storefront URL as the site
   URL and include it in the allowed redirect URLs. Open the storefront URL and
   test sign-in, product management, and checkout.

The free Render API web service sleeps after 15 minutes without traffic and may
take about a minute to wake for the next visitor. Free services also have usage
limits; this tier is for class/demo projects, not guaranteed always-on service.
Order and image data is stored in Supabase, not Render's temporary filesystem.
The static-site build publishes only the storefront files and rewrites
`apiBaseUrl` in its generated `supabase-config.js` from `API_BASE_URL`. It does
not publish the API source, `.env`, or Supabase migrations. `.gitignore` keeps
the generated `render-site/` folder out of Git.

## Local development

1. Run `npm.cmd install`.
2. Copy `.env.example` to `.env` and fill in the Supabase URL and service-role
   key. Keep `.env` private and uncommitted.
3. Set `apiBaseUrl` in `supabase-config.js` to `http://localhost:3000`, and set
   `ALLOWED_ORIGINS` in `.env` to `http://localhost:8765`.
4. In one terminal run `npm.cmd run dev`.
5. In another terminal run `python -m http.server 8765`, then visit
   `http://localhost:8765`.

If Python is unavailable, use any local static file server. The browser cannot
load JavaScript modules reliably from a `file:` URL.

## Features and project limits

- Customer email/password sign-up, sign-in, sign-out, and a separate account
  page at `account.html` showing orders placed while signed in. Customers must
  create an account and sign in before checkout; their cart is kept while they
  authenticate. The account
  page opens separately from the storefront to provide more room for sign-up
  and profile forms. Customer profiles collect a
  Philippines-only country, first and last name, street address, optional
  apartment/suite, barangay, 4-digit postal code, city/municipality, and
  province. Guest order lookup remains available for previous guest orders.
- Orders are linked to the authenticated customer by the API. The customer
  orders endpoint filters by the verified Supabase user ID; customers cannot
  request another account's order history.
- Admin screens and every admin API endpoint require a valid Supabase session
  and an explicit `store_admins` entry. A customer account alone never gives
  admin access. The Supabase service-role key stays on Render only.
- Signing in from `account.html` checks admin permission with the API. Accounts
  explicitly listed in `store_admins` are sent to the admin portal; customer
  accounts stay in the customer area. Admin status is never inferred from an
  email address alone.
- Product inventory, front and optional back photos, categories, and custom
  measurements.
- Admin inventory is grouped into Featured, Available, Sold out, and Hidden.
  Featured pieces appear on both the homepage and Shop page; Available pieces
  appear only in Shop. Hiding a piece removes it from the storefront without
  removing it from inventory; sold-out pieces remain visible in Shop with a
  Sold out label.
- Cart items do not hold stock. Checkout atomically verifies and claims stock,
  so another customer may purchase a piece before checkout succeeds.
- COD and manual GCash receipt review (JPEG/PNG up to 5 MB).
- Admin-only payment receipt viewing, cancellation/restocking, order statuses,
  courier, tracking number, and ETA.
- Customer order lookup using the order number and checkout email.
- Email notifications and online payment gateway processing are not included.

The local demo mode is not secure for admin use. Admin access is disabled until
the Supabase backend is configured. Use HTTPS deployment URLs and keep Supabase
email confirmation enabled. Free plans can change and have quota or
availability limits. A custom domain
usually costs money. GCash remains manually verified; never treat an uploaded
receipt as automatic proof of payment.
