import { EmptyState, PageHeader } from '@greenfield/ui';

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" crumb="Quarterly" />
      <EmptyState
        title="Reports build themselves"
        hint="Quarterly audit packs, DDS filing summaries, and deforestation risk reports appear here once there's data to summarise."
      />
    </>
  );
}