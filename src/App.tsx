import { DragEvent as ReactDragEvent, useEffect, useMemo, useState } from 'react';
import { Category, CategoryKey, Transaction, TransactionCadence } from './types';
import { CategoryColumn } from './components/CategoryColumn';
import { TransactionForm } from './components/TransactionForm';
import { CategoryPieChart } from './components/CategoryPieChart';

const cadenceToMonthlyFactor: Record<TransactionCadence, number> = {
  Weekly: 4,
  'Bi-weekly': 2,
  Monthly: 1,
  Quarterly: 1 / 3,
  Annual: 1 / 12,
  'One-time': 1 / 12
};

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

const seededTransaction = (
  overrides: Partial<Transaction> & Pick<Transaction, 'label' | 'amount' | 'cadence' | 'flow'>
): Transaction => ({
  id: generateId(),
  note: '',
  createdAt: new Date().toISOString(),
  ...overrides
});

const initialCategories: Category[] = [
  {
    id: 'income',
    name: 'Income',
    accent: '#34d399',
    description: 'Your primary paycheck or recurring income stream to anchor the plan.',
    transactions: [
      seededTransaction({
        label: 'Primary paycheck',
        amount: 3200,
        cadence: 'Monthly',
        flow: 'Income',
        note: 'Lands near the first of each month'
      })
    ]
  },
  {
    id: 'financial-obligations',
    name: 'Financial obligations',
    accent: '#38bdf8',
    description: 'Mortgages, rent, insurance and the must-pay bills that keep life stable.',
    transactions: [
      seededTransaction({
        label: 'Rent',
        amount: 1850,
        cadence: 'Monthly',
        flow: 'Expense',
        note: 'Due on the 1st each month'
      }),
      seededTransaction({
        label: 'Auto insurance',
        amount: 165,
        cadence: 'Monthly',
        flow: 'Expense',
        note: 'Covers both vehicles'
      }),
      seededTransaction({
        label: 'Student loan',
        amount: 220,
        cadence: 'Monthly',
        flow: 'Expense'
      })
    ]
  },
  {
    id: 'lifestyle-recurring',
    name: 'Lifestyle & recurring',
    accent: '#f472b6',
    description: 'Subscriptions and routines that make day-to-day life feel good.',
    transactions: [
      seededTransaction({
        label: 'Gym membership',
        amount: 42,
        cadence: 'Monthly',
        flow: 'Expense'
      }),
      seededTransaction({
        label: 'Streaming bundle',
        amount: 28,
        cadence: 'Monthly',
        flow: 'Expense'
      })
    ]
  },
  {
    id: 'personal-family',
    name: 'Personal & family',
    accent: '#facc15',
    description: 'The flexible spending for people, pets and shared experiences.',
    transactions: [
      seededTransaction({
        label: 'Childcare co-op',
        amount: 95,
        cadence: 'Weekly',
        flow: 'Expense'
      }),
      seededTransaction({
        label: 'Family dinner night',
        amount: 120,
        cadence: 'Monthly',
        flow: 'Expense'
      })
    ]
  },
  {
    id: 'savings-investments',
    name: 'Savings & investments',
    accent: '#22d3ee',
    description: 'Long-term wins such as emergency funds, retirement and brokerage deposits.',
    transactions: [
      seededTransaction({
        label: '401(k) contribution',
        amount: 350,
        cadence: 'Monthly',
        flow: 'Savings'
      }),
      seededTransaction({
        label: 'High-yield savings',
        amount: 150,
        cadence: 'Monthly',
        flow: 'Savings'
      })
    ]
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous',
    accent: '#c084fc',
    description: 'Everything else — gifts, experiments, and the unexpected extras.',
    transactions: [
      seededTransaction({
        label: 'Coffee shop budget',
        amount: 45,
        cadence: 'Monthly',
        flow: 'Expense'
      })
    ]
  }
];

export default function App() {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [dragState, setDragState] = useState<{
    transactionId: string;
    fromCategoryId: CategoryKey;
  } | null>(null);
  const [dropCategoryId, setDropCategoryId] = useState<CategoryKey | null>(null);
  const [isTrashHovered, setIsTrashHovered] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const targets: (Element | null)[] = [document.body, document.documentElement];

    targets.forEach((element) => {
      if (!element) return;

      element.classList.toggle('money-drag', Boolean(dragState));
    });

    return () => {
      targets.forEach((element) => {
        if (!element) return;

        element.classList.remove('money-drag');
      });
    };
  }, [dragState]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }),
    []
  );

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? '-' : '';
    return `${sign}${formatter.format(Math.abs(value))}`;
  };

  const categoryMonthlyTotals = useMemo(() => {
    const totals: Record<CategoryKey, number> = {
      income: 0,
      'financial-obligations': 0,
      'lifestyle-recurring': 0,
      'personal-family': 0,
      'savings-investments': 0,
      miscellaneous: 0
    };

    categories.forEach((category) => {
      totals[category.id] = category.transactions.reduce((sum, transaction) => {
        const normalized = transaction.amount * cadenceToMonthlyFactor[transaction.cadence];
        if (transaction.flow === 'Income') {
          return sum - normalized;
        }

        return sum + normalized;
      }, 0);
    });

    return totals;
  }, [categories]);

  const summary = useMemo(() => {
    let monthlyCommitments = 0;
    let monthlySavings = 0;
    let monthlyIncome = 0;
    let totalTransactions = 0;

    categories.forEach((category) => {
      category.transactions.forEach((transaction) => {
        const normalized = transaction.amount * cadenceToMonthlyFactor[transaction.cadence];
        totalTransactions += 1;

        if (transaction.flow === 'Income') {
          monthlyIncome += normalized;
        } else if (transaction.flow === 'Savings') {
          monthlySavings += normalized;
          monthlyCommitments += normalized;
        } else {
          monthlyCommitments += normalized;
        }
      });
    });

    const net = monthlyIncome - monthlyCommitments;

    const topCategory = categories.reduce<{ name: string; total: number }>(
      (acc, category) => {
        const total = categoryMonthlyTotals[category.id];
        if (total > acc.total) {
          return { name: category.name, total };
        }

        return acc;
      },
      { name: categories[0]?.name ?? 'Financial obligations', total: 0 }
    );

    return {
      monthlyCommitments,
      monthlySavings,
      monthlyIncome,
      net,
      totalTransactions,
      topCategory
    };
  }, [categories, categoryMonthlyTotals]);

  const handleAddTransaction = (payload: {
    categoryId: CategoryKey;
    label: string;
    amount: number;
    cadence: TransactionCadence;
    flow: Transaction['flow'];
    note: string;
  }) => {
    const newTransaction: Transaction = {
      id: generateId(),
      label: payload.label,
      amount: payload.amount,
      cadence: payload.cadence,
      flow: payload.flow,
      note: payload.note,
      createdAt: new Date().toISOString()
    };

    setCategories((current) =>
      current.map((category) =>
        category.id === payload.categoryId
          ? {
              ...category,
              transactions: [...category.transactions, newTransaction]
            }
          : category
      )
    );
  };

  const moveTransaction = (fromCategory: CategoryKey, toCategory: CategoryKey, transactionId: string) => {
    if (fromCategory === toCategory) {
      setDropCategoryId(null);
      setDragState(null);
      setIsTrashHovered(false);
      return;
    }

    setCategories((current) => {
      let transactionToMove: Transaction | null = null;

      const withoutTransaction = current.map((category) => {
        if (category.id !== fromCategory) {
          return category;
        }

        const remaining = category.transactions.filter((transaction) => {
          if (transaction.id === transactionId) {
            transactionToMove = transaction;
            return false;
          }

          return true;
        });

        return {
          ...category,
          transactions: remaining
        };
      });

      if (!transactionToMove) {
        return current;
      }

      return withoutTransaction.map((category) =>
        category.id === toCategory
          ? {
              ...category,
              transactions: [...category.transactions, transactionToMove!]
            }
          : category
      );
    });

    setDragState(null);
    setDropCategoryId(null);
    setIsTrashHovered(false);
  };

  const handleDragStart = (originCategoryId: CategoryKey, transactionId: string) => {
    setDragState({ fromCategoryId: originCategoryId, transactionId });
    setIsTrashHovered(false);
  };

  const handleDragOver = (targetCategoryId: CategoryKey) => {
    setDropCategoryId(targetCategoryId);
  };

  const handleDrop = (targetCategoryId: CategoryKey) => {
    if (!dragState) {
      return;
    }

    moveTransaction(dragState.fromCategoryId, targetCategoryId, dragState.transactionId);
    setIsTrashHovered(false);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropCategoryId(null);
    setIsTrashHovered(false);
  };

  const deleteTransaction = (categoryId: CategoryKey, transactionId: string) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              transactions: category.transactions.filter((transaction) => transaction.id !== transactionId)
            }
          : category
      )
    );

    setDragState(null);
    setDropCategoryId(null);
    setIsTrashHovered(false);
  };

  const handleTrashDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    setIsTrashHovered(true);
  };

  const handleTrashDragLeave = () => {
    setIsTrashHovered(false);
  };

  const handleTrashDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dragState) {
      return;
    }

    deleteTransaction(dragState.fromCategoryId, dragState.transactionId);
  };

  const netPrefix = summary.net >= 0 ? '+' : '-';

  const commitmentsPie = useMemo(() => {
    const slices = categories
      .filter((category) => categoryMonthlyTotals[category.id] > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        value: categoryMonthlyTotals[category.id],
        accent: category.accent
      }));

    const total = slices.reduce((sum, slice) => sum + slice.value, 0);

    return { slices, total };
  }, [categories, categoryMonthlyTotals]);

  const budgetPie = useMemo(() => {
    const livingCosts = Math.max(summary.monthlyCommitments - summary.monthlySavings, 0);
    const savings = Math.max(summary.monthlySavings, 0);
    const income = Math.max(summary.monthlyIncome, 0);
    const unassignedIncome = Math.max(income - summary.monthlyCommitments, 0);
    const overBudget = Math.max(summary.monthlyCommitments - income, 0);

    const slices = [
      {
        id: 'living-costs',
        name: 'Living costs',
        value: livingCosts,
        accent: '#38bdf8'
      },
      {
        id: 'savings-investments',
        name: 'Savings & investments',
        value: savings,
        accent: '#22d3ee'
      },
      {
        id: 'unassigned-income',
        name: 'Income left to plan',
        value: unassignedIncome,
        accent: '#34d399'
      },
      {
        id: 'over-budget',
        name: 'Over budget',
        value: overBudget,
        accent: '#f87171'
      }
    ].filter((slice) => slice.value > 0);

    const total = slices.reduce((sum, slice) => sum + slice.value, 0);

    return { slices, total };
  }, [summary.monthlyCommitments, summary.monthlyIncome, summary.monthlySavings]);

  return (
    <div className="app-shell">
      <div className="mural-frame">
        <header className="mural-header">
          <span className="mural-brand">Walsh</span>
          <nav className="mural-nav" aria-label="Primary">
            <a href="#workspace">Work</a>
            <a href="#summary">Info</a>
            <a href="#contact">Contact</a>
          </nav>
          <button type="button" className="mural-peek" aria-label="Open navigation menu">
            <span aria-hidden="true" />
          </button>
        </header>

        <div className="mural-hero" id="summary">
          <aside className="mural-side">
            <span className="side-title">Flow Ledger</span>
            <p className="side-tagline">
              A personal finance wall made to feel as bold and expressive as the decisions behind it.
            </p>
          </aside>

          <div className="mural-canvas">
            <div className="mural-art" aria-hidden="true">
              <div className="art-panel art-panel--left" />
              <div className="art-panel art-panel--center">
                <span>وفا</span>
              </div>
              <div className="art-panel art-panel--right">
                <div className="doorway">
                  <div className="doorway-inner" />
                </div>
              </div>
              <div className="art-stripes art-stripes--top" />
              <div className="art-stripes art-stripes--bottom" />
            </div>

            <div className="mural-overlay">
              <section className="summary-card mural-summary" aria-labelledby="summary-heading">
                <div className="summary-heading">
                  <span className="logo-badge">FL</span>
                  <div>
                    <h2 id="summary-heading">Monthly mural</h2>
                    <p className="summary-caption">Numbers behind the color</p>
                  </div>
                </div>
                <div className="summary-grid">
                  <div className="stat">
                    <span className="stat-label">Commitments</span>
                    <span className="stat-value">{formatCurrency(summary.monthlyCommitments)}</span>
                    <span className="helper-text">Recurring bills + lifestyle picks</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Savings cadence</span>
                    <span className="stat-value">{formatCurrency(summary.monthlySavings)}</span>
                    <span className="helper-text">Intentional set-asides</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Net monthly flow</span>
                    <span className="stat-value">
                      {netPrefix}
                      {formatCurrency(Math.abs(summary.net))}
                    </span>
                    <span className="helper-text">Income minus commitments</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Tracked items</span>
                    <span className="stat-value">{summary.totalTransactions}</span>
                    <span className="helper-text">
                      {summary.topCategory.name}
                      {summary.topCategory.total > 0
                        ? ` (${formatCurrency(summary.topCategory.total)}/mo)`
                        : ''}
                    </span>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>

      <section className="workspace" id="workspace">
        <div className="workspace-header">
          <h2>Transaction studio</h2>
          <p>
            Add, move, or clear items while the trash can watches in the wings. Every change feeds
            directly into the mural above.
          </p>
        </div>

        <TransactionForm
          categories={categories.map(({ id, name }) => ({ id, name }))}
          onAddTransaction={handleAddTransaction}
        />

        <div className="layout-columns">
          {categories.map((category) => (
            <CategoryColumn
              key={category.id}
              category={category}
              monthlyTotal={categoryMonthlyTotals[category.id]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              isDropTarget={dropCategoryId === category.id}
              isDragging={Boolean(dragState)}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      </section>

      {(commitmentsPie.slices.length > 0 || budgetPie.slices.length > 0) && (
        <section className="insights" aria-labelledby="insights-heading">
          <div className="insights-header">
            <h2 id="insights-heading">Interactive insights</h2>
            <p>
              Explore how each category shapes your month and where your income is headed. Hover the
              charts to see exact amounts and highlights.
            </p>
          </div>
          <div className="insights-grid">
            {commitmentsPie.slices.length > 0 && (
              <section className="chart-card" aria-label="Spending distribution">
                <h3 className="chart-title">Spending palette</h3>
                <p className="chart-subtitle">Hover to flood the mural with a category</p>
                <div className="chart-wrapper">
                  <CategoryPieChart
                    data={commitmentsPie.slices}
                    total={commitmentsPie.total}
                    formatCurrency={formatCurrency}
                    defaultLabel="Monthly commitments"
                    ariaLabel="Monthly spending by category"
                  />
                </div>
              </section>
            )}
            {budgetPie.slices.length > 0 && (
              <section className="chart-card" aria-label="Budget allocation">
                <h3 className="chart-title">Budget pulse</h3>
                <p className="chart-subtitle">Track where every incoming dollar is headed</p>
                <div className="chart-wrapper">
                  <CategoryPieChart
                    data={budgetPie.slices}
                    total={budgetPie.total}
                    formatCurrency={formatCurrency}
                    defaultLabel="Budget allocation"
                    ariaLabel="Budget allocation overview"
                  />
                </div>
              </section>
            )}
          </div>
        </section>
      )}

      {dragState ? (
        <div
          className={`trash-dropzone ${isTrashHovered ? 'active' : ''}`}
          onDragOver={handleTrashDragOver}
          onDragEnter={handleTrashDragOver}
          onDragLeave={handleTrashDragLeave}
          onDrop={handleTrashDrop}
        >
          <div className="trash-icon" aria-hidden="true">
            🗑️
          </div>
          <div className="trash-text">
            <strong>Drop to delete</strong>
            <span>Remove this transaction</span>
          </div>
        </div>
      ) : null}

      <footer className="mural-footer" id="contact">
        <span className="footer-mark">Flow Ledger</span>
        <span className="footer-note">
          Built as a playful nod to Zooba&apos;s NoLiTa mural while keeping your budgeting tools intact.
        </span>
      </footer>
    </div>
  );
}
