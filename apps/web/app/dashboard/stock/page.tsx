import { EmptyState, PageHeader } from '@greenfield/ui';

export default function StockPage() {
  return (
    <>
      <PageHeader title="Stock" crumb="Green & roasted" />
      <EmptyState
        title="Nothing on the shelves"
        hint="When you receive a green lot or complete a roast, it will show up here by location."
      />
    </>
  );
}