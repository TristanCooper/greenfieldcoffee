import { EmptyState, PageHeader } from '@greenfield/ui';

export default function ReceiveGreenPage() {
  return (
    <>
      <PageHeader title="Receive green" crumb="EUDR intake" />
      <EmptyState
        title="Receive a new green lot"
        hint="The receive-green flow captures supplier, producer, geolocation, and deforestation risk in one place. The data you enter here powers traceability all the way to the DDS."
      />
    </>
  );
}