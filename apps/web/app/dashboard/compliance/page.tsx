import { EmptyState, PageHeader } from '@greenfield/ui';

export default function CompliancePage() {
  return (
    <>
      <PageHeader title="Compliance" crumb="EUDR" />
      <EmptyState
        title="No statements drafted yet"
        hint="When an EU shipment is allocated, its DDS is drafted automatically from the chain. You'll see drafts, ready-to-file, and filed statements here."
      />
    </>
  );
}