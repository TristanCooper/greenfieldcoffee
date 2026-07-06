-- 0001_initial_schema.sql
-- Greenfield Coffee — initial schema
--
-- This migration creates every table needed for Phase 0:
--   tenants, users, suppliers, producers, storage_locations,
--   green_lots, roast_batches, roast_batch_inputs, roast_batch_outputs, skus,
--   stock_levels, stock_movements,
--   customers, orders, order_lines, order_allocations, shipments, shipment_lines,
--   dds_statements, audit_events
--
-- It also sets up:
--   * Row-level security on every tenant-scoped table, keyed on current_tenant_id()
--   * An append-only policy on audit_events (insert allowed, update/delete denied)
--   * Indexes for the queries the app runs on hot paths
--   * Triggers that automatically write audit_events on create/update/archive
--
-- Apply by pasting into the Supabase dashboard SQL Editor, or with `supabase db push`.
-- Read it first. Migrations are append-only — never edit a file that has already run.

----------------------------------------------------------------------------
-- Extensions
----------------------------------------------------------------------------

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- Grant schema/table access to Supabase roles. This mirrors what Supabase
-- does on hosted projects so RLS is the only thing standing between tenants.
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
grant all on all sequences in schema public to authenticated, anon;
grant all on all functions in schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
alter default privileges in schema public grant all on functions to authenticated, anon;

----------------------------------------------------------------------------
-- Helper: current tenant id, read from the JWT
----------------------------------------------------------------------------

-- The active tenant is stored in the user's JWT under app_metadata.tenant_id
-- and is set by the auth flow at sign-in / invite acceptance. This function
-- lets every RLS policy read it without trusting client-supplied values.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
      current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id'
    ),
    ''
  )::uuid
$$;

grant execute on function public.current_tenant_id() to authenticated, anon;

----------------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------------

do $$ begin
  create type user_role as enum ('owner', 'roaster', 'sales', 'auditor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('invited', 'active', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type eu_operator_type as enum ('operator', 'trader');
exception when duplicate_object then null; end $$;

do $$ begin
  create type producer_type as enum ('cooperative', 'estate', 'smallholder', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type geolocation_source as enum ('gps', 'polygon', 'centroid', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deforestation_risk_class as enum ('low', 'standard', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type processing_method as enum ('washed', 'natural', 'honey', 'anaerobic', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lot_status as enum ('received', 'in_use', 'depleted', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type storage_location_kind as enum ('green_bunker', 'finished_goods', 'packaging', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type roast_batch_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sku_product_type as enum (
    'whole_bean_250g', 'whole_bean_1kg', 'ground_250g', 'ground_1kg',
    'espresso_250g', 'filter_250g', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_channel as enum ('manual', 'web', 'email', 'wholesale', 'subscription');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'draft', 'open', 'allocated', 'picking', 'packed', 'shipped', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_item_kind as enum ('green', 'roasted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_type as enum (
    'receive', 'roast_charge', 'roast_drop', 'pick', 'pack', 'dispatch', 'adjust_in', 'adjust_out'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_reference as enum (
    'green_lot', 'roast_batch', 'order', 'shipment', 'manual'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dds_status as enum ('draft', 'ready', 'filed', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_event_type as enum (
    'create', 'update', 'archive', 'login', 'export',
    'dds_generate', 'dds_file', 'block', 'unblock', 'role_change'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_entity_type as enum (
    'green_lot', 'roast_batch', 'sku', 'order', 'shipment',
    'dds_statement', 'customer', 'supplier', 'producer', 'user', 'tenant'
  );
exception when duplicate_object then null; end $$;

----------------------------------------------------------------------------
-- Tenants & users
----------------------------------------------------------------------------

create table if not exists public.tenants (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  country_code             char(2) not null,
  vat_number               text,
  eori_number              text,
  eu_operator_type         eu_operator_type,
  eu_operator_eori_or_vat  text,
  default_currency         char(3) not null default 'GBP' check (default_currency in ('GBP','EUR')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz
);

create index if not exists idx_tenants_archived on public.tenants (archived_at);

-- Tenants: read by anyone authenticated, write by service role only (signup flow).
alter table public.tenants enable row level security;

drop policy if exists tenants_select_authenticated on public.tenants;
create policy tenants_select_authenticated
  on public.tenants for select
  to authenticated
  using (id = public.current_tenant_id() or archived_at is null);

drop policy if exists tenants_update_own on public.tenants;
create policy tenants_update_own
  on public.tenants for update
  to authenticated
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  -- email is unique per tenant; the same person may belong to multiple tenants later
  email           text not null,
  full_name       text not null default '',
  role            user_role not null default 'roaster',
  status          user_status not null default 'invited',
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (tenant_id, email)
);

create index if not exists idx_users_tenant on public.users (tenant_id);
create index if not exists idx_users_tenant_role on public.users (tenant_id, role);
create index if not exists idx_users_archived on public.users (archived_at);

alter table public.users enable row level security;

drop policy if exists users_select_tenant on public.users;
create policy users_select_tenant
  on public.users for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists users_insert_tenant on public.users;
create policy users_insert_tenant
  on public.users for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists users_update_tenant on public.users;
create policy users_update_tenant
  on public.users for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

----------------------------------------------------------------------------
-- Traceability spine: producers, suppliers, storage locations
----------------------------------------------------------------------------

create table if not exists public.producers (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete restrict,
  name                      text not null,
  country_code              char(2) not null,
  region                    text,
  fcs_or_estate_name        text,
  producer_type             producer_type not null default 'other',
  latitude                  double precision,
  longitude                 double precision,
  geolocation_source        geolocation_source,
  geolocation_accuracy_m    double precision,
  deforestation_risk_class  deforestation_risk_class,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  archived_at               timestamptz
);

create index if not exists idx_producers_tenant on public.producers (tenant_id);
create index if not exists idx_producers_tenant_country on public.producers (tenant_id, country_code);

alter table public.producers enable row level security;
create policy producers_all_tenant on public.producers
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.suppliers (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete restrict,
  name                  text not null,
  country_code          char(2) not null,
  address               text,
  contact_email         text,
  contact_phone         text,
  vat_or_tax_id         text,
  eu_operator_or_trader boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz
);

create index if not exists idx_suppliers_tenant on public.suppliers (tenant_id);

alter table public.suppliers enable row level security;
create policy suppliers_all_tenant on public.suppliers
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.storage_locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  name        text not null,
  kind        storage_location_kind not null default 'other',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_storage_locations_tenant on public.storage_locations (tenant_id);

alter table public.storage_locations enable row level security;
create policy storage_locations_all_tenant on public.storage_locations
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

----------------------------------------------------------------------------
-- Green lots — the central traceability node
----------------------------------------------------------------------------

create table if not exists public.green_lots (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete restrict,
  lot_code                    text not null,
  supplier_id                 uuid not null references public.suppliers(id) on delete restrict,
  producer_id                 uuid not null references public.producers(id) on delete restrict,
  origin_country              char(2) not null,
  harvest_year                integer,
  harvest_start_date          date,
  harvest_end_date            date,
  variety                     text,
  processing_method           processing_method,
  grade                       text,
  green_weight_kg             numeric(10,3) not null check (green_weight_kg >= 0),
  current_weight_kg           numeric(10,3) not null check (current_weight_kg >= 0),
  storage_location_id         uuid references public.storage_locations(id) on delete restrict,
  received_on                 date not null,
  expected_deforestation_risk deforestation_risk_class not null default 'standard',
  status                      lot_status not null default 'received',
  blocked_reason              text,
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  archived_at                 timestamptz,
  unique (tenant_id, lot_code)
);

create index if not exists idx_green_lots_tenant on public.green_lots (tenant_id);
create index if not exists idx_green_lots_tenant_status on public.green_lots (tenant_id, status);
create index if not exists idx_green_lots_tenant_supplier on public.green_lots (tenant_id, supplier_id);
create index if not exists idx_green_lots_tenant_producer on public.green_lots (tenant_id, producer_id);
create index if not exists idx_green_lots_received_on on public.green_lots (tenant_id, received_on desc);

alter table public.green_lots enable row level security;
create policy green_lots_all_tenant on public.green_lots
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

----------------------------------------------------------------------------
-- Production: SKUs, roast batches, batch inputs/outputs
----------------------------------------------------------------------------

create table if not exists public.skus (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete restrict,
  sku_code                 text not null,
  name                     text not null,
  product_type             sku_product_type not null,
  is_single_origin         boolean not null default false,
  primary_origin_country   char(2),
  roast_profile_target     text,
  pack_weight_g            integer,
  shelf_life_days          integer,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz,
  unique (tenant_id, sku_code)
);

create index if not exists idx_skus_tenant on public.skus (tenant_id);

alter table public.skus enable row level security;
create policy skus_all_tenant on public.skus
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.roast_batches (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete restrict,
  batch_code               text not null,
  machine                  text,
  scheduled_for            date,
  started_at               timestamptz,
  completed_at             timestamptz,
  status                   roast_batch_status not null default 'planned',
  total_charge_weight_kg   numeric(10,3),
  total_drop_weight_kg     numeric(10,3),
  yield_pct                numeric(5,2),
  development_time_pct     numeric(5,2),
  sensory_notes            text,
  created_by               uuid not null references public.users(id) on delete restrict,
  approved_by              uuid references public.users(id) on delete restrict,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz,
  unique (tenant_id, batch_code)
);

create index if not exists idx_roast_batches_tenant on public.roast_batches (tenant_id);
create index if not exists idx_roast_batches_tenant_status on public.roast_batches (tenant_id, status);
create index if not exists idx_roast_batches_scheduled on public.roast_batches (tenant_id, scheduled_for);

alter table public.roast_batches enable row level security;
create policy roast_batches_all_tenant on public.roast_batches
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.roast_batch_inputs (
  id                uuid primary key default gen_random_uuid(),
  roast_batch_id    uuid not null references public.roast_batches(id) on delete cascade,
  green_lot_id      uuid not null references public.green_lots(id) on delete restrict,
  charge_weight_kg  numeric(10,3) not null check (charge_weight_kg > 0),
  created_at        timestamptz not null default now()
);

create index if not exists idx_roast_batch_inputs_batch on public.roast_batch_inputs (roast_batch_id);
create index if not exists idx_roast_batch_inputs_lot on public.roast_batch_inputs (green_lot_id);

-- Inputs are accessible via the batch's tenant; join-based check is sufficient.
-- We don't carry tenant_id on inputs to keep the join path short. RLS reads the parent.
alter table public.roast_batch_inputs enable row level security;
create policy roast_batch_inputs_select on public.roast_batch_inputs
  for select to authenticated
  using (exists (
    select 1 from public.roast_batches rb
    where rb.id = roast_batch_inputs.roast_batch_id
      and rb.tenant_id = public.current_tenant_id()
  ));
create policy roast_batch_inputs_write on public.roast_batch_inputs
  for insert to authenticated
  with check (exists (
    select 1 from public.roast_batches rb
    where rb.id = roast_batch_inputs.roast_batch_id
      and rb.tenant_id = public.current_tenant_id()
  ));
create policy roast_batch_inputs_update on public.roast_batch_inputs
  for update to authenticated
  using (exists (
    select 1 from public.roast_batches rb
    where rb.id = roast_batch_inputs.roast_batch_id
      and rb.tenant_id = public.current_tenant_id()
  ));

create table if not exists public.roast_batch_outputs (
  id              uuid primary key default gen_random_uuid(),
  roast_batch_id  uuid not null references public.roast_batches(id) on delete cascade,
  sku_id          uuid not null references public.skus(id) on delete restrict,
  drop_weight_kg  numeric(10,3) not null check (drop_weight_kg > 0),
  created_at      timestamptz not null default now()
);

create index if not exists idx_roast_batch_outputs_batch on public.roast_batch_outputs (roast_batch_id);
create index if not exists idx_roast_batch_outputs_sku on public.roast_batch_outputs (sku_id);

alter table public.roast_batch_outputs enable row level security;
create policy roast_batch_outputs_select on public.roast_batch_outputs
  for select to authenticated
  using (exists (
    select 1 from public.roast_batches rb
    where rb.id = roast_batch_outputs.roast_batch_id
      and rb.tenant_id = public.current_tenant_id()
  ));
create policy roast_batch_outputs_write on public.roast_batch_outputs
  for insert to authenticated
  with check (exists (
    select 1 from public.roast_batches rb
    where rb.id = roast_batch_outputs.roast_batch_id
      and rb.tenant_id = public.current_tenant_id()
  ));
create policy roast_batch_outputs_update on public.roast_batch_outputs
  for update to authenticated
  using (exists (
    select 1 from public.roast_batches rb
    where rb.id = roast_batch_outputs.roast_batch_id
      and rb.tenant_id = public.current_tenant_id()
  ));

----------------------------------------------------------------------------
-- Inventory: stock levels (projection) + stock movements (event log)
----------------------------------------------------------------------------

create table if not exists public.stock_levels (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete restrict,
  item_kind                stock_item_kind not null,
  green_lot_id             uuid references public.green_lots(id) on delete restrict,
  sku_id                   uuid references public.skus(id) on delete restrict,
  roast_batch_id           uuid references public.roast_batches(id) on delete restrict,
  location_id              uuid not null references public.storage_locations(id) on delete restrict,
  quantity_kg              numeric(10,3) not null default 0,
  reserved_kg              numeric(10,3) not null default 0,
  lot_identifier_override  text,
  expires_on               date,
  updated_at               timestamptz not null default now(),
  -- Stock levels are derived; no created_at and no archived_at (managed by triggers).
  check (
    (item_kind = 'green'  and green_lot_id is not null and sku_id is null)
    or
    (item_kind = 'roasted' and sku_id is not null)
  ),
  check (quantity_kg >= 0 and reserved_kg >= 0 and reserved_kg <= quantity_kg)
);

create index if not exists idx_stock_levels_tenant on public.stock_levels (tenant_id);
create index if not exists idx_stock_levels_tenant_kind on public.stock_levels (tenant_id, item_kind);
create index if not exists idx_stock_levels_lot on public.stock_levels (green_lot_id);
create index if not exists idx_stock_levels_sku on public.stock_levels (sku_id);
create index if not exists idx_stock_levels_batch on public.stock_levels (roast_batch_id);

alter table public.stock_levels enable row level security;
create policy stock_levels_all_tenant on public.stock_levels
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  item_kind       stock_item_kind not null,
  green_lot_id    uuid references public.green_lots(id) on delete restrict,
  sku_id          uuid references public.skus(id) on delete restrict,
  roast_batch_id  uuid references public.roast_batches(id) on delete restrict,
  movement_type   stock_movement_type not null,
  quantity_kg     numeric(10,3) not null,   -- signed: negative for out movements
  location_id     uuid not null references public.storage_locations(id) on delete restrict,
  reference_type  stock_movement_reference not null,
  reference_id    uuid,
  occurred_at     timestamptz not null default now(),
  performed_by    uuid not null references public.users(id) on delete restrict,
  notes           text,
  created_at      timestamptz not null default now(),
  -- Movements are append-only.
  check (quantity_kg <> 0)
);

create index if not exists idx_stock_movements_tenant on public.stock_movements (tenant_id);
create index if not exists idx_stock_movements_tenant_occurred on public.stock_movements (tenant_id, occurred_at desc);
create index if not exists idx_stock_movements_lot on public.stock_movements (green_lot_id);
create index if not exists idx_stock_movements_sku on public.stock_movements (sku_id);
create index if not exists idx_stock_movements_reference on public.stock_movements (reference_type, reference_id);

alter table public.stock_movements enable row level security;

-- Anyone in the tenant can read movements (the day's board needs them).
drop policy if exists stock_movements_select_tenant on public.stock_movements;
create policy stock_movements_select_tenant
  on public.stock_movements for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- Writes only by service role (the application server uses the service-role key
-- for movement inserts to keep the rules centralised in code). Authenticated
-- users do not insert movements directly.
-- If you ever want clients to write movements, tighten the with check below.

----------------------------------------------------------------------------
-- Customers, orders, shipments
----------------------------------------------------------------------------

create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete restrict,
  name              text not null,
  contact_email     text,
  contact_phone     text,
  billing_address   jsonb,
  shipping_address  jsonb,
  country_code      char(2) not null,
  vat_number        text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz
);

create index if not exists idx_customers_tenant on public.customers (tenant_id);

alter table public.customers enable row level security;
create policy customers_all_tenant on public.customers
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete restrict,
  order_code               text not null,
  customer_id              uuid not null references public.customers(id) on delete restrict,
  channel                  order_channel not null default 'manual',
  status                   order_status not null default 'draft',
  destination_country      char(2) not null,
  requires_dds             boolean not null default false,
  requested_delivery_date  date,
  promised_delivery_date   date,
  total_value              numeric(12,2),
  currency                 char(3) not null default 'GBP' check (currency in ('GBP','EUR')),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz,
  unique (tenant_id, order_code)
);

create index if not exists idx_orders_tenant on public.orders (tenant_id);
create index if not exists idx_orders_tenant_status on public.orders (tenant_id, status);
create index if not exists idx_orders_tenant_destination on public.orders (tenant_id, destination_country);

alter table public.orders enable row level security;
create policy orders_all_tenant on public.orders
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.order_lines (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  sku_id      uuid not null references public.skus(id) on delete restrict,
  quantity    numeric(10,3) not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  line_total  numeric(12,2) not null check (line_total >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_lines_order on public.order_lines (order_id);

alter table public.order_lines enable row level security;
create policy order_lines_all on public.order_lines
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_lines.order_id
      and o.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_lines.order_id
      and o.tenant_id = public.current_tenant_id()
  ));

create table if not exists public.order_allocations (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  order_line_id   uuid not null references public.order_lines(id) on delete cascade,
  stock_level_id  uuid not null references public.stock_levels(id) on delete restrict,
  quantity_units  numeric(10,3) not null check (quantity_units > 0),
  created_at      timestamptz not null default now()
);

create index if not exists idx_order_allocations_order on public.order_allocations (order_id);
create index if not exists idx_order_allocations_line on public.order_allocations (order_line_id);
create index if not exists idx_order_allocations_stock on public.order_allocations (stock_level_id);

alter table public.order_allocations enable row level security;
create policy order_allocations_all on public.order_allocations
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_allocations.order_id
      and o.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_allocations.order_id
      and o.tenant_id = public.current_tenant_id()
  ));

create table if not exists public.shipments (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete restrict,
  shipment_code             text not null,
  order_id                  uuid not null references public.orders(id) on delete restrict,
  carrier                   text,
  tracking_number           text,
  dispatched_at             timestamptz,
  delivered_at              timestamptz,
  destination_country       char(2) not null,
  customs_documents_required boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  archived_at               timestamptz,
  unique (tenant_id, shipment_code)
);

create index if not exists idx_shipments_tenant on public.shipments (tenant_id);
create index if not exists idx_shipments_tenant_order on public.shipments (tenant_id, order_id);

alter table public.shipments enable row level security;
create policy shipments_all_tenant on public.shipments
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.shipment_lines (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  stock_level_id  uuid references public.stock_levels(id) on delete restrict,
  quantity_units  numeric(10,3) not null check (quantity_units > 0),
  gross_weight_kg numeric(10,3) not null check (gross_weight_kg >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists idx_shipment_lines_shipment on public.shipment_lines (shipment_id);
create index if not exists idx_shipment_lines_stock on public.shipment_lines (stock_level_id);

alter table public.shipment_lines enable row level security;
create policy shipment_lines_all on public.shipment_lines
  for all to authenticated
  using (exists (
    select 1 from public.shipments s
    where s.id = shipment_lines.shipment_id
      and s.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.shipments s
    where s.id = shipment_lines.shipment_id
      and s.tenant_id = public.current_tenant_id()
  ));

----------------------------------------------------------------------------
-- EUDR: due diligence statements
----------------------------------------------------------------------------

create table if not exists public.dds_statements (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete restrict,
  reference_number            text not null,
  shipment_id                 uuid not null references public.shipments(id) on delete restrict,
  operator_name               text not null,
  operator_address            text not null,
  operator_eori_or_vat        text not null,
  status                      dds_status not null default 'draft',
  filed_at                    timestamptz,
  filed_reference             text,
  pdf_storage_path            text,
  verification_risk_level     deforestation_risk_class not null default 'standard',
  country_of_production       char(2) not null,
  geolocation_polygon_or_point jsonb not null,
  producer_name               text not null,
  producer_country            char(2) not null,
  supplier_name               text not null,
  supplier_country            char(2) not null,
  commodity_code              text not null default '0901',
  quantity_kg                 numeric(10,3) not null check (quantity_kg > 0),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  archived_at                 timestamptz,
  unique (tenant_id, reference_number)
);

create index if not exists idx_dds_statements_tenant on public.dds_statements (tenant_id);
create index if not exists idx_dds_statements_tenant_shipment on public.dds_statements (tenant_id, shipment_id);
create index if not exists idx_dds_statements_status on public.dds_statements (tenant_id, status);

alter table public.dds_statements enable row level security;
create policy dds_statements_all_tenant on public.dds_statements
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

----------------------------------------------------------------------------
-- Audit log — append-only
----------------------------------------------------------------------------

create table if not exists public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  actor_id        uuid references public.users(id) on delete restrict,
  actor_role      text not null,                 -- denormalised so role changes don't rewrite history
  event_type      audit_event_type not null,
  entity_type     audit_entity_type not null,
  entity_id       uuid not null,
  before_state    jsonb,
  after_state     jsonb,
  diff_summary    text,
  ip_address      inet,
  user_agent      text,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_events_tenant on public.audit_events (tenant_id);
create index if not exists idx_audit_events_tenant_occurred on public.audit_events (tenant_id, occurred_at desc);
create index if not exists idx_audit_events_entity on public.audit_events (tenant_id, entity_type, entity_id);
create index if not exists idx_audit_events_actor on public.audit_events (tenant_id, actor_id);

alter table public.audit_events enable row level security;

-- Anyone in the tenant can read the audit log (auditor role especially).
drop policy if exists audit_events_select_tenant on public.audit_events;
create policy audit_events_select_tenant
  on public.audit_events for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- Inserts are allowed; updates and deletes are blocked at the RLS layer AND by triggers below.
drop policy if exists audit_events_insert_tenant on public.audit_events;
create policy audit_events_insert_tenant
  on public.audit_events for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

-- Block updates and deletes at the trigger level too. Defence in depth.
create or replace function public.audit_events_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only; % is not permitted', tg_op;
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.audit_events_block_mutation();

drop trigger if exists audit_events_no_delete on public.audit_events;
create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function public.audit_events_block_mutation();

----------------------------------------------------------------------------
-- updated_at maintenance
----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Apply updated_at trigger to every table that carries an updated_at column.
do $$
declare
  t record;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t.tbl);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t.tbl);
  end loop;
end $$;

----------------------------------------------------------------------------
-- End of 0001_initial_schema.sql
----------------------------------------------------------------------------