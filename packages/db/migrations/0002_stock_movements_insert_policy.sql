-- 0002_stock_movements_insert_policy.sql
--
-- The original 0001_initial_schema.sql intentionally left stock_movements
-- without an INSERT policy — the comment said "writes only by service role".
-- That turned out to be wrong: the receive-green flow runs as the per-user
-- client (so audit-events reflect the actor) and stock_movements is the
-- inventory truth source.
--
-- Add the same all-tenant policy the other tables have. The existing
-- audit_events policy already covers its insert path; this migration only
-- fixes stock_movements.

drop policy if exists stock_movements_insert_tenant on public.stock_movements;
create policy stock_movements_insert_tenant
  on public.stock_movements for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists stock_movements_update_tenant on public.stock_movements;
create policy stock_movements_update_tenant
  on public.stock_movements for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());