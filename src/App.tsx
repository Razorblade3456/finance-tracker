import { DragEvent as ReactDragEvent, useEffect, useMemo, useState } from 'react';
import { Category, CategoryKey, Transaction, TransactionCadence } from './types';
import {
  deleteTransactionById,
  fetchCategories,
  fetchTransactions,
  insertTransaction,
  updateTransactionCategory
} from './lib/supabaseClient';
import { CategoryColumn } from './components/CategoryColumn';
import { TransactionForm } from './components/TransactionForm';
import { CategoryBarChart } from './components/CategoryBarChart';

const cadenceToMonthlyFactor: Record<TransactionCadence, number> = {
  Weekly: 4,
  'Bi-weekly': 2,
  Monthly: 1,
  Quarterly: 1 / 3,
  Annual: 1 / 12,
  'One-time': 1 / 12
};

type CategoryRow = {
  id: CategoryKey;
  name: string;
  accent: string;
  description: string;
  sort_order: number;
};

type TransactionRow = {
  id: string;
  category_id: CategoryKey;
  label: string;
  amount: number | string;
  cadence: TransactionCadence;
  flow: Transaction['flow'];
  note: string | null;
  created_at: string;
};

const mapCategoryRow = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  accent: row.accent,
  description: row.description,
  transactions: []
});

const mapTransactionRow = (row: TransactionRow): Transaction => ({
  id: row.id,
  label: row.label,
  amount: Number(row.amount),
  cadence: row.cadence,
  flow: row.flow,
  note: row.note ?? '',
  createdAt: row.created_at
});

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [dragState, setDragState] = useState<{
    transactionId: string;
    fromCategoryId: CategoryKey;
  } | null>(null);
  const [dropCategoryId, setDropCategoryId] = useState<CategoryKey | null>(null);
  const [isTrashHovered, setIsTrashHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: categoryRows, error: categoryError } = await fetchCategories();

      if (categoryError || !categoryRows) {
        console.error('Failed to load categories', categoryError);
        setIsLoading(false);
        return;
      }

      const { data: transactionRows, error: transactionError } = await fetchTransactions();

      if (transactionError) {
        console.error('Failed to load transactions', transactionError);
      }

      const categoryRowsTyped = Array.isArray(categoryRows)
        ? (categoryRows as CategoryRow[])
        : [];
      const mappedCategories = categoryRowsTyped.map((row) => mapCategoryRow(row));
      const transactionRowsTyped = Array.isArray(transactionRows)
        ? (transactionRows as TransactionRow[])
        : [];

      const categoriesWithTransactions = mappedCategories.map((category) => ({
        ...category,
        transactions: transactionRowsTyped
          .filter((transaction) => transaction.category_id === category.id)
          .map((transaction) => mapTransactionRow(transaction))
      }));

      setCategories(categoriesWithTransactions);
      setIsLoading(false);
    }

    void loadData();
  }, []);

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

  const handleAddTransaction = async (payload: {
    categoryId: CategoryKey;
    label: string;
    amount: number;
    cadence: TransactionCadence;
    flow: Transaction['flow'];
    note: string;
  }) => {
    const { data, error } = await insertTransaction({
      category_id: payload.categoryId,
      label: payload.label,
      amount: payload.amount,
      cadence: payload.cadence,
      flow: payload.flow,
      note: payload.note
    });

    const insertedRow = Array.isArray(data) ? data[0] : data;

    if (error || !insertedRow) {
      console.error('Failed to save transaction', error);
      return;
    }

    const newTransaction = mapTransactionRow(insertedRow as TransactionRow);

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

  const moveTransaction = async (
    fromCategory: CategoryKey,
    toCategory: CategoryKey,
    transactionId: string
  ) => {
    if (fromCategory === toCategory) {
      setDropCategoryId(null);
      setDragState(null);
      setIsTrashHovered(false);
      return;
    }

    const { error } = await updateTransactionCategory(transactionId, toCategory);

    if (error) {
      console.error('Failed to move transaction', error);
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

    void moveTransaction(dragState.fromCategoryId, targetCategoryId, dragState.transactionId);
    setIsTrashHovered(false);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropCategoryId(null);
    setIsTrashHovered(false);
  };

  const deleteTransaction = async (categoryId: CategoryKey, transactionId: string) => {
    const { error } = await deleteTransactionById(transactionId);

    if (error) {
      console.error('Failed to delete transaction', error);
      setDragState(null);
      setDropCategoryId(null);
      setIsTrashHovered(false);
      return;
    }

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

    void deleteTransaction(dragState.fromCategoryId, dragState.transactionId);
  };

  const netPrefix = summary.net >= 0 ? '+' : '-';

  if (isLoading) {
    return <div className="app-shell">Loading your budget…</div>;
  }

  const chartData = useMemo(() => {
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
              <span className="stat-label">Monthly commitments</span>
              <span className="stat-value">{formatCurrency(summary.monthlyCommitments)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Savings cadence</span>
              <span className="stat-value">{formatCurrency(summary.monthlySavings)}</span>
              <span className="helper-text">Recurring investments you are prioritizing</span>
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
                Heaviest category: {summary.topCategory.name}{' '}
                {summary.topCategory.total > 0
                  ? `(${formatCurrency(summary.topCategory.total)}/mo)`
                  : ''}
              </span>
            </div>
          </div>
        </section>

        <TransactionForm
          categories={categories.map(({ id, name }) => ({ id, name }))}
          onAddTransaction={handleAddTransaction}
        />
      </main>

      <section className="insights-section">
        <div className="insights-card">
          <div className="insights-header">
            <h2>Interactive budget dashboard</h2>
            <p>
              Two quick reads that show how your commitments color the mural and where your income is
              headed each month.
            </p>
          </div>
          <CategoryBarChart
            data={chartData.slices}
            total={chartData.total}
            formatCurrency={formatCurrency}
          />
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
