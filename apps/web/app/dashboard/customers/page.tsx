import { EmptyState, PageHeader } from '@greenfield/ui';

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" crumb="All" />
      <EmptyState
        title="No customers yet"
        hint="Wholesale accounts and direct customers will appear here. EU destinations get tagged for DDS."
      />
    </>
  );
}