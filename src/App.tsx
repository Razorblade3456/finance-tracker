import { DragEvent as ReactDragEvent, useMemo, useState } from 'react';
import { Category, CategoryKey, PinNote, Transaction, TransactionCadence } from './types';
import { CategoryColumn } from './components/CategoryColumn';
import { TransactionForm } from './components/TransactionForm';
import { InsightList } from './components/InsightList';
import { PinBoard } from './components/PinBoard';

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
    name: 'Recurring',
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
    name: 'Personal & Lifestyle',
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

const pinAccentPalette = ['#f472b6', '#22d3ee', '#34d399', '#facc15', '#c084fc'];

const initialPinNotes: PinNote[] = [
  {
    id: 'pin-delivery',
    label: 'Late-night delivery spending',
    detail: 'Swap two orders for homemade dinners and pocket about $80 each month.',
    accent: pinAccentPalette[0]
  },
  {
    id: 'pin-coffee',
    label: 'Daily coffee runs',
    detail: 'Keep café stops to three times a week and transfer the savings on Fridays.',
    accent: pinAccentPalette[1]
  },
  {
    id: 'pin-vapes',
    label: 'Vape + convenience store drops',
    detail: 'Track each visit and cap it at $60 so the rest feeds your travel pot.',
    accent: pinAccentPalette[2]
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
  const [pins, setPins] = useState<PinNote[]>(initialPinNotes);

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

  const handleAddPin = (label: string, detail: string) => {
    setPins((current) => {
      const accent = pinAccentPalette[current.length % pinAccentPalette.length];

      return [
        ...current,
        {
          id: generateId(),
          label,
          detail,
          accent
        }
      ];
    });
  };

  const handleReorderPins = (draggedId: string, targetId: string | null) => {
    setPins((current) => {
      const draggedIndex = current.findIndex((pin) => pin.id === draggedId);

      if (draggedIndex === -1) {
        return current;
      }

      const reordered = [...current];
      const [draggedPin] = reordered.splice(draggedIndex, 1);

      if (!targetId) {
        reordered.push(draggedPin);
        return reordered;
      }

      if (targetId === draggedId) {
        reordered.splice(draggedIndex, 0, draggedPin);
        return reordered;
      }

      const targetIndex = reordered.findIndex((pin) => pin.id === targetId);

      if (targetIndex === -1) {
        reordered.push(draggedPin);
        return reordered;
      }

      reordered.splice(targetIndex, 0, draggedPin);
      return reordered;
    });
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

  const { monthlyCommitments, monthlySavings, monthlyIncome, net } = summary;
  const hasMonthlyLeftover = net >= 0;
  const netLabel = hasMonthlyLeftover ? 'Left after bills' : 'Short this month';
  const netNote = hasMonthlyLeftover
    ? 'Use this for goals or flexible spending'
    : 'Plan to cover this gap soon';

  const yearlyOutlook = useMemo(
    () => ({
      income: monthlyIncome * 12,
      commitments: monthlyCommitments * 12,
      savings: monthlySavings * 12,
      net: net * 12
    }),
    [monthlyIncome, monthlyCommitments, monthlySavings, net]
  );

  const insights = useMemo(() => {
    type InsightBar = { id: string; name: string; value: number; accent: string };

    const spendingBars: InsightBar[] = categories
      .filter((category) => category.id !== 'income')
      .map((category) => ({
        id: category.id,
        name: category.name,
        value: categoryMonthlyTotals[category.id],
        accent: category.accent
      }))
      .filter((bar) => bar.value > 0);

    const spendingTotal = spendingBars.reduce((sum, bar) => sum + bar.value, 0);

    const livingCosts = Math.max(monthlyCommitments - monthlySavings, 0);
    const savings = Math.max(monthlySavings, 0);
    const net = monthlyIncome - monthlyCommitments;
    const available = net > 0 ? net : 0;
    const overBudget = net < 0 ? Math.abs(net) : 0;

    const allocationBars: InsightBar[] = [];

    if (livingCosts > 0) {
      allocationBars.push({
        id: 'living-costs',
        name: 'Living costs & essentials',
        value: livingCosts,
        accent: '#60a5fa'
      });
    }

    if (savings > 0) {
      allocationBars.push({
        id: 'savings',
        name: 'Savings & investments',
        value: savings,
        accent: '#22d3ee'
      });
    }

    if (available > 0) {
      allocationBars.push({
        id: 'available',
        name: 'Available to assign',
        value: available,
        accent: '#34d399'
      });
    }

    if (overBudget > 0) {
      allocationBars.push({
        id: 'over-budget',
        name: 'Over budget',
        value: overBudget,
        accent: '#f472b6'
      });
    }

    const allocationTotal = allocationBars.reduce((sum, bar) => sum + bar.value, 0);
    const hasAvailable = available > 0;

    return {
      spending: {
        bars: spendingBars,
        total: spendingTotal
      },
      allocation: {
        bars: allocationBars,
        total: allocationTotal,
        summaryLabel: hasAvailable ? 'Budget allocation' : 'Budget pressure',
        summaryHelper: hasAvailable
          ? 'How your income covers this month’s plan'
          : 'Where commitments exceed income',
        summaryValue: monthlyIncome > 0 ? monthlyIncome : allocationTotal
      }
    };
  }, [
    categories,
    categoryMonthlyTotals,
    monthlyCommitments,
    monthlySavings,
    monthlyIncome
  ]);

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-title">
          <span className="logo-badge">FL</span>
          <h1>Flow Ledger</h1>
        </div>
        <p>
          Keep your money map lightweight and beautiful today, with the structure ready to graduate
          into a native app tomorrow.
        </p>
      </header>

      <main className="dashboard">
        <section className="summary-card">
          <h2>At a glance</h2>
          <div className="summary-grid">
            <div className="stat">
              <span className="stat-label">Money coming in</span>
              <span className="stat-value">{formatCurrency(monthlyIncome)}</span>
              <span className="stat-note">Average monthly income</span>
            </div>
            <div className="stat">
              <span className="stat-label">Money going out</span>
              <span className="stat-value">{formatCurrency(monthlyCommitments)}</span>
              <span className="stat-note">Bills, plans, and recurring costs</span>
            </div>
            <div className="stat">
              <span className="stat-label">Set aside for savings</span>
              <span className="stat-value">{formatCurrency(monthlySavings)}</span>
              <span className="stat-note">What you’re tucking away every month</span>
            </div>
            <div className="stat">
              <span className="stat-label">{netLabel}</span>
              <span className="stat-value">{formatCurrency(net)}</span>
              <span className="stat-note">{netNote}</span>
            </div>
          </div>
        </section>

        <TransactionForm
          categories={categories.map(({ id, name }) => ({ id, name }))}
          onAddTransaction={handleAddTransaction}
        />
      </main>

      <section className="insights-section">
        <div className="insights-grid">
          <article className="insight-card insight-card--spending">
            <div className="insight-header">
              <span className="insight-kicker">Spending palette</span>
              <h2>Explore commitments by category</h2>
              <p>
                Hover or focus the bars to surface the category totals that shape your monthly
                commitments.
              </p>
            </div>
            <div className="insight-summary">
              <span className="insight-summary-label">Monthly commitments</span>
              <span className="insight-summary-value">
                {formatCurrency(insights.spending.total)}
              </span>
            </div>
            <InsightList
              data={insights.spending.bars}
              total={insights.spending.total}
              formatCurrency={formatCurrency}
              ariaLabel="Monthly commitments by category"
              emptyMessage="Add expenses to visualize your commitments."
            />
          </article>

          <article className="insight-card insight-card--allocation">
            <div className="insight-header">
              <span className="insight-kicker">Budget pulse</span>
              <h2>Follow where the next dollar goes</h2>
              <p>
                Compare how income supports living costs, savings goals, and any over-budget
                pressure.
              </p>
            </div>
            <div className="insight-summary">
              <span className="insight-summary-label">{insights.allocation.summaryLabel}</span>
              <span className="insight-summary-value">
                {formatCurrency(insights.allocation.summaryValue)}
              </span>
              <span className="insight-summary-helper">{insights.allocation.summaryHelper}</span>
            </div>
            <InsightList
              data={insights.allocation.bars}
              total={insights.allocation.total}
              formatCurrency={formatCurrency}
              ariaLabel="Monthly budget allocation"
              emptyMessage="Track income and commitments to see your allocation."
            />
          </article>
        </div>
      </section>

      <section className="layout-columns">
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
      </section>

      <section className="pin-section">
        <PinBoard pins={pins} onAddPin={handleAddPin} onReorder={handleReorderPins} />
      </section>

      <section className="yearly-section">
        <div className="yearly-card">
          <div className="yearly-header">
            <h2>Yearly breakdown</h2>
            <p>
              See how this month scales across the year. These totals will sync to your account once
              Google sign-in and the database land.
            </p>
          </div>
          <div className="yearly-grid">
            <div className="yearly-stat">
              <span className="yearly-label">Yearly income</span>
              <span className="yearly-value">{formatCurrency(yearlyOutlook.income)}</span>
            </div>
            <div className="yearly-stat">
              <span className="yearly-label">Yearly bills & plans</span>
              <span className="yearly-value">{formatCurrency(yearlyOutlook.commitments)}</span>
            </div>
            <div className="yearly-stat">
              <span className="yearly-label">Saved across the year</span>
              <span className="yearly-value">{formatCurrency(yearlyOutlook.savings)}</span>
            </div>
            <div className="yearly-stat">
              <span className="yearly-label">
                {yearlyOutlook.net >= 0 ? 'Estimated cushion' : 'Projected shortfall'}
              </span>
              <span className="yearly-value">{formatCurrency(yearlyOutlook.net)}</span>
            </div>
          </div>
        </div>
      </section>

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

      <p className="footer-note">
        Flow Ledger is intentionally mobile-first and ready for the moment it becomes a dedicated
        app – your data model and interactions will translate smoothly.
      </p>
    </div>
  );
}
