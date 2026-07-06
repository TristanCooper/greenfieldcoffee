import { EmptyState, PageHeader } from '@greenfield/ui';

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" crumb="All channels" />
      <EmptyState
        title="No orders yet"
        hint="Orders you create or import will appear here. EU shipments will show whether a DDS is required."
      />
    </>
  );
}