import { EmptyState, PageHeader } from '@greenfield/ui';

export default function DailyBoardPage() {
  return (
    <>
      <PageHeader title="Daily board" crumb="Today" />
      <EmptyState
        title="No roasts scheduled"
        hint="When you receive green coffee and start scheduling roasts, today's queue will appear here."
      />
    </>
  );
}