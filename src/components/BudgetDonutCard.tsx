import { CategoryPieChart } from './CategoryPieChart';

interface BudgetDonutCardProps {
  title: string;
  subtitle: string;
  data: Array<{
    id: string;
    name: string;
    value: number;
    accent: string;
  }>;
  total: number;
  formatCurrency: (value: number) => string;
  defaultLabel: string;
  ariaLabel?: string;
}

export function BudgetDonutCard({
  title,
  subtitle,
  data,
  total,
  formatCurrency,
  defaultLabel,
  ariaLabel
}: BudgetDonutCardProps) {
  return (
    <section className="donut-card" aria-label={title}>
      <div className="donut-card-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <CategoryPieChart
        data={data}
        total={total}
        formatCurrency={formatCurrency}
        defaultLabel={defaultLabel}
        ariaLabel={ariaLabel}
      />
    </section>
  );
}
