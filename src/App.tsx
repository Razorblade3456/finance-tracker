import {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  FocusEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Category, CategoryKey, Transaction, TransactionCadence } from './types';
import { CategoryColumn } from './components/CategoryColumn';
import { TransactionForm } from './components/TransactionForm';
import { InsightList } from './components/InsightList';
import { DownloadButton } from './components/DownloadButton';

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
  recurrenceSourceId: overrides.recurrenceSourceId,
  note: '',
  date: new Date().toLocaleDateString('en-CA'),
  createdAt: new Date().toISOString(),
  ...overrides
});

const storageVersion = 'v1';
const anonymousStorageKey = `flow-ledger-state-${storageVersion}-anonymous`;

const cadenceToMonths: Partial<Record<TransactionCadence, number>> = {
  Monthly: 1,
  Quarterly: 3,
  Annual: 12
};

const cadenceToDays: Partial<Record<TransactionCadence, number>> = {
  Weekly: 7,
  'Bi-weekly': 14
};

const parseDateOnly = (value: string) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map((segment) => Number(segment));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

const formatDateOnly = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextOccurrenceDate = (date: Date, cadence: TransactionCadence, anchorDay = date.getDate()) => {
  const monthStep = cadenceToMonths[cadence];
  if (monthStep) {
    const nextDate = new Date(date);
    const day = anchorDay;
    nextDate.setDate(1);
    nextDate.setMonth(nextDate.getMonth() + monthStep);
    const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    nextDate.setDate(Math.min(day, lastDay));
    return nextDate;
  }

  const dayStep = cadenceToDays[cadence];
  if (dayStep) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + dayStep);
    return nextDate;
  }

  return null;
};

const applyRecurringTransactions = (inputCategories: Category[], now = new Date()) => {
  let didChange = false;

  const categories = inputCategories.map((category) => {
    const seriesMap = new Map<string, Transaction[]>();

    category.transactions.forEach((transaction) => {
      const seriesId = transaction.recurrenceSourceId ?? transaction.id;
      const existingSeries = seriesMap.get(seriesId) ?? [];
      existingSeries.push({
        ...transaction,
        recurrenceSourceId: seriesId
      });
      seriesMap.set(seriesId, existingSeries);
    });

    const generatedTransactions: Transaction[] = [];

    seriesMap.forEach((seriesTransactions, seriesId) => {
      const recurringTransactions = seriesTransactions
        .filter((transaction) => transaction.cadence !== 'One-time')
        .sort((a, b) => getTransactionTimestamp(a) - getTransactionTimestamp(b));

      if (recurringTransactions.length === 0) {
        return;
      }

      let lastTransaction = recurringTransactions[recurringTransactions.length - 1];
      let lastDate = parseDateOnly(lastTransaction.date);

      if (!lastDate) {
        const createdAtDate = new Date(lastTransaction.createdAt);
        if (Number.isNaN(createdAtDate.getTime())) {
          return;
        }
        lastDate = createdAtDate;
      }

      const anchorDay = parseDateOnly(recurringTransactions[0].date)?.getDate() ?? lastDate.getDate();
      let nextDate = getNextOccurrenceDate(lastDate, lastTransaction.cadence, anchorDay);

      while (nextDate && nextDate <= now) {
        didChange = true;
        const nextTransaction: Transaction = {
          ...lastTransaction,
          id: generateId(),
          recurrenceSourceId: seriesId,
          date: formatDateOnly(nextDate),
          createdAt: nextDate.toISOString()
        };

        generatedTransactions.push(nextTransaction);
        lastTransaction = nextTransaction;
        nextDate = getNextOccurrenceDate(nextDate, lastTransaction.cadence, anchorDay);
      }
    });

    if (generatedTransactions.length === 0) {
      return {
        ...category,
        transactions: category.transactions.map((transaction) => ({
          ...transaction,
          recurrenceSourceId: transaction.recurrenceSourceId ?? transaction.id
        }))
      };
    }

    return {
      ...category,
      transactions: sortTransactionsByRecency([
        ...category.transactions.map((transaction) => ({
          ...transaction,
          recurrenceSourceId: transaction.recurrenceSourceId ?? transaction.id
        })),
        ...generatedTransactions
      ])
    };
  });

  return {
    categories,
    didChange
  };
};

const getTransactionTimestamp = (transaction: Transaction) => {
  if (transaction.date) {
    const parsed = parseDateOnly(transaction.date) ?? new Date(NaN);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const createdAt = new Date(transaction.createdAt);
  if (!Number.isNaN(createdAt.getTime())) {
    return createdAt.getTime();
  }

  return 0;
};

const sortTransactionsByRecency = (transactions: Transaction[]) =>
  [...transactions].sort((a, b) => getTransactionTimestamp(b) - getTransactionTimestamp(a));

const themeStorageKey = 'flow-ledger-theme';

const INSIGHT_TIMEFRAME_MAX_MONTHS = 24;

const baseCategories: Category[] = [
  {
    id: 'income',
    name: 'Recurring income',
    accent: '#9ae6b4',
    description: 'Paychecks and other repeating deposits that arrive on a schedule.',
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
    accent: '#93c5fd',
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
    accent: '#fbcfe8',
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
    accent: '#fde68a',
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
    accent: '#a5f3fc',
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
    accent: '#ddd6fe',
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

const initialCategories: Category[] = baseCategories.map((category) => ({
  ...category,
  transactions: sortTransactionsByRecency(category.transactions)
}));

type CategoryWithMonthlyTotal = Category & { monthlyTotal: number };

type PersistedAppState = {
  categories: Category[];
  pinnedTransactionIds: string[];
  pinnedViewCadence: PinnedViewCadence;
  selectedMonth: string;
  selectedYear: string;
  insightTimeframeMonths: number;
  insightTimeframeStartMonth: string;
  insightTimeframeStartYear: string;
};

// Recover the former account ledger without requiring a Google session.
const getLocalStorageKey = () => {
  const keys = Object.keys(window.localStorage).filter((key) =>
    key.startsWith(`flow-ledger-state-${storageVersion}-`) && key !== anonymousStorageKey
  );
  // Keep account ledgers separate; consistently reopen the first existing account.
  return keys.sort()[0] ?? anonymousStorageKey;
};

const pinAccentPalette = ['#fbcfe8', '#bae6fd', '#bbf7d0', '#fde68a', '#ddd6fe'];

type PinnedViewCadence = 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Quarterly' | 'Annual';

const pinnedViewCadenceOptions: PinnedViewCadence[] = [
  'Weekly',
  'Bi-weekly',
  'Monthly',
  'Quarterly',
  'Annual'
];

const monthlyToPinnedMultiplier: Record<PinnedViewCadence, number> = {
  Weekly: 1 / cadenceToMonthlyFactor.Weekly,
  'Bi-weekly': 1 / cadenceToMonthlyFactor['Bi-weekly'],
  Monthly: 1,
  Quarterly: 3,
  Annual: 12
};

const pinnedCadenceDisplay: Record<PinnedViewCadence, string> = {
  Weekly: 'week',
  'Bi-weekly': '2 weeks',
  Monthly: 'month',
  Quarterly: 'quarter',
  Annual: 'year'
};

const getInitialThemePreference = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storedPreference = window.localStorage.getItem(themeStorageKey);
    if (storedPreference === 'dark') {
      return true;
    }

    if (storedPreference === 'light') {
      return false;
    }
  } catch (error) {
    // Ignore storage access issues and fall back to system preference.
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  return false;
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialThemePreference);
  const [isStorageReady, setStorageReady] = useState(false);
  const storageKeyRef = useRef(anonymousStorageKey);
  const [storageError, setStorageError] = useState('');
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [dragState, setDragState] = useState<{
    transactionId: string;
    fromCategoryId: CategoryKey;
  } | null>(null);
  const [dropCategoryId, setDropCategoryId] = useState<CategoryKey | null>(null);
  const [isTrashHovered, setIsTrashHovered] = useState(false);
  const [pinnedTransactionIds, setPinnedTransactionIds] = useState<string[]>([]);
  const [pinnedViewCadence, setPinnedViewCadence] = useState<PinnedViewCadence>('Monthly');
  const [sidebarCategoryId, setSidebarCategoryId] = useState<CategoryKey | null>(null);
  const categoryMonthMenuRef = useRef<HTMLDivElement | null>(null);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = new Date(2000, index, 1);
        return {
          value: String(index),
          label: date.toLocaleString('en-US', { month: 'long' })
        };
      }),
    []
  );
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth()));
  const monthLabel = useMemo(() => {
    const match = monthOptions.find((option) => option.value === selectedMonth);
    return match?.label ?? 'January';
  }, [monthOptions, selectedMonth]);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
  }, []);
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [isCategoryMonthMenuOpen, setCategoryMonthMenuOpen] = useState(false);
  const [insightTimeframeMonths, setInsightTimeframeMonths] = useState(3);
  const [insightTimeframeStartMonth, setInsightTimeframeStartMonth] = useState(
    () => String(new Date().getMonth())
  );
  const [insightTimeframeStartYear, setInsightTimeframeStartYear] = useState(
    () => String(new Date().getFullYear())
  );

  const restorePersistedState = useCallback(
    () => {
      if (typeof window === 'undefined') {
        return;
      }


      try {
        storageKeyRef.current = getLocalStorageKey();
        const rawState = window.localStorage.getItem(storageKeyRef.current);
        if (!rawState) {
          const recurring = applyRecurringTransactions(initialCategories);
          setCategories(recurring.categories);
          setPinnedTransactionIds([]);
          setPinnedViewCadence('Monthly');
          setSelectedMonth(String(new Date().getMonth()));
          setSelectedYear(String(new Date().getFullYear()));
          setInsightTimeframeMonths(3);
          setInsightTimeframeStartMonth(String(new Date().getMonth()));
          setInsightTimeframeStartYear(String(new Date().getFullYear()));
          return;
        }

        const parsedState = JSON.parse(rawState) as Partial<PersistedAppState>;
        if (!Array.isArray(parsedState.categories) || parsedState.categories.some((category) => !category || !Array.isArray(category.transactions) || category.transactions.some((transaction) => !transaction || !Number.isFinite(transaction.amount) || transaction.amount < 0 || !['Income', 'Expense', 'Savings'].includes(transaction.flow) || !(transaction.cadence in cadenceToMonthlyFactor)))) {
          throw new Error('Invalid saved ledger');
        }
        const persistedCategories = Array.isArray(parsedState.categories)
          ? parsedState.categories
          : initialCategories;
        const recurring = applyRecurringTransactions(persistedCategories);

        setCategories(recurring.categories);
        setPinnedTransactionIds(
          Array.isArray(parsedState.pinnedTransactionIds) ? parsedState.pinnedTransactionIds : []
        );
        setPinnedViewCadence(
          parsedState.pinnedViewCadence && pinnedViewCadenceOptions.includes(parsedState.pinnedViewCadence)
            ? parsedState.pinnedViewCadence
            : 'Monthly'
        );
        setSelectedMonth(parsedState.selectedMonth ?? String(new Date().getMonth()));
        setSelectedYear(parsedState.selectedYear ?? String(new Date().getFullYear()));
        setInsightTimeframeMonths(
          typeof parsedState.insightTimeframeMonths === 'number'
            ? parsedState.insightTimeframeMonths
            : 3
        );
        setInsightTimeframeStartMonth(
          parsedState.insightTimeframeStartMonth ?? String(new Date().getMonth())
        );
        setInsightTimeframeStartYear(
          parsedState.insightTimeframeStartYear ?? String(new Date().getFullYear())
        );
      } catch (error) {
        const recurring = applyRecurringTransactions(initialCategories);
        setCategories(recurring.categories);
        setStorageError("Saved data could not be loaded. Export anything you need before continuing.");
      } finally {
        setStorageReady(true);
      }
    },
    []
  );
  const darkModeLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';
  const navigationItems = useMemo(
    () => [
      { id: 'monthly-overview', label: 'Monthly' },
      { id: 'log-transaction', label: 'Log a transaction' },
      { id: 'categories-section', label: 'Categories' },
      { id: 'pinned-transactions', label: 'Pinned' },
      { id: 'insights-section', label: 'Budget & expenses' },
      { id: 'yearly-outlook', label: 'Yearly' }
    ],
    []
  );

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

  const formatCurrency = useCallback(
    (value: number) => {
      const sign = value < 0 ? '-' : '';
      return `${sign}${formatter.format(Math.abs(value))}`;
    },
    [formatter]
  );

  const formatDate = useCallback((value: string) => {
    if (!value) {
      return '';
    }

    const parsed = parseDateOnly(value) ?? new Date(NaN);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  useEffect(() => {
    restorePersistedState();
  }, [restorePersistedState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isStorageReady || storageError) {
      return;
    }

    const storageKey = storageKeyRef.current;
    const stateToPersist: PersistedAppState = {
      categories,
      pinnedTransactionIds,
      pinnedViewCadence,
      selectedMonth,
      selectedYear,
      insightTimeframeMonths,
      insightTimeframeStartMonth,
      insightTimeframeStartYear
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
    } catch (error) {
      setStorageError('Changes could not be saved in this browser. Download your summaries before closing.');
    }
  }, [
    categories,
    isStorageReady,
    storageError,
    insightTimeframeMonths,
    insightTimeframeStartMonth,
    insightTimeframeStartYear,
    pinnedTransactionIds,
    pinnedViewCadence,
    selectedMonth,
    selectedYear
  ]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((previous) => !previous);
  }, []);

  const handleNavigation = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, targetId: string) => {
      event.preventDefault();
      const target = document.getElementById(targetId);

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (typeof target.focus === 'function') {
          try {
            target.focus({ preventScroll: true });
          } catch (error) {
            target.focus();
          }
        }
      }
    },
    []
  );

  const pinnedTransactionSet = useMemo(
    () => new Set(pinnedTransactionIds),
    [pinnedTransactionIds]
  );

  const monthCategories = useMemo(() => categories.map((category) => ({
    ...category,
    transactions: category.transactions.filter((transaction) => {
      const date = parseDateOnly(transaction.date);
      return date?.getMonth() === Number(selectedMonth) && date?.getFullYear() === Number(selectedYear);
    })
  })), [categories, selectedMonth, selectedYear]);

  const categoryMonthlyTotals = useMemo(() => {
    const totals: Record<CategoryKey, number> = {
      income: 0,
      'financial-obligations': 0,
      'lifestyle-recurring': 0,
      'personal-family': 0,
      'savings-investments': 0,
      miscellaneous: 0
    };

    monthCategories.forEach((category) => {
      totals[category.id] = category.transactions.reduce((sum, transaction) => {
        const normalized = transaction.amount;
        if (transaction.flow === 'Income') {
          return sum + normalized;
        }

        return sum - normalized;
      }, 0);
    });

    return totals;
  }, [monthCategories]);

  const summary = useMemo(() => {
    let monthlyExpenses = 0;
    let monthlySavings = 0;
    let monthlyIncome = 0;
    let totalTransactions = 0;

    monthCategories.forEach((category) => {
      category.transactions.forEach((transaction) => {
        const normalized = transaction.amount;
        totalTransactions += 1;

        if (transaction.flow === 'Income') {
          monthlyIncome += normalized;
        } else if (transaction.flow === 'Savings') {
          monthlySavings += normalized;
          monthlyExpenses += normalized;
        } else {
          monthlyExpenses += normalized;
        }
      });
    });

    const net = monthlyIncome - monthlyExpenses;

    const topCategory = categories.reduce<{ name: string; total: number }>(
      (acc, category) => {
        const total = category.id === 'income' ? 0 : Math.abs(categoryMonthlyTotals[category.id]);
        if (total > acc.total) {
          return { name: category.name, total };
        }

        return acc;
      },
      { name: categories[0]?.name ?? 'Financial obligations', total: 0 }
    );

    return {
      monthlyExpenses,
      monthlySavings,
      monthlyIncome,
      net,
      totalTransactions,
      topCategory
    };
  }, [monthCategories, categoryMonthlyTotals]);

  const handleAddTransaction = (payload: {
    categoryId: CategoryKey;
    label: string;
    amount: number;
    cadence: TransactionCadence;
    flow: Transaction['flow'];
    note: string;
    date: string;
  }) => {
    const recurrenceSourceId = generateId();
    const newTransaction: Transaction = {
      id: generateId(),
      recurrenceSourceId,
      label: payload.label,
      amount: payload.amount,
      cadence: payload.cadence,
      flow: payload.flow,
      note: payload.note,
      date: payload.date,
      createdAt: new Date().toISOString()
    };

    setCategories((current) =>
      current.map((category) =>
        category.id === payload.categoryId
          ? {
              ...category,
              transactions: sortTransactionsByRecency([
                ...category.transactions,
                newTransaction
              ])
            }
          : category
      )
    );
  };

  const togglePinnedTransaction = (transactionId: string) => {
    setPinnedTransactionIds((current) =>
      current.includes(transactionId)
        ? current.filter((id) => id !== transactionId)
        : [...current, transactionId]
    );
  };

  const duplicateTransaction = (categoryId: CategoryKey, transactionId: string) => {
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        const target = category.transactions.find((transaction) => transaction.id === transactionId);

        if (!target) {
          return category;
        }

        const now = new Date();

        const clonedTransaction: Transaction = {
          ...target,
          id: generateId(),
          recurrenceSourceId: generateId(),
          date: formatDateOnly(now),
          createdAt: now.toISOString()
        };

        return {
          ...category,
          transactions: sortTransactionsByRecency([...category.transactions, clonedTransaction])
        };
      })
    );
  };

  const openCategoryDetails = useCallback((categoryId: CategoryKey) => {
    setSidebarCategoryId(categoryId);
  }, []);

  const closeCategoryDetails = useCallback(() => {
    setSidebarCategoryId(null);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const rootElement = document.documentElement;
    const bodyElement = document.body;

    if (isDarkMode) {
      rootElement.classList.add('theme-dark');
      bodyElement.classList.add('theme-dark');
    } else {
      rootElement.classList.remove('theme-dark');
      bodyElement.classList.remove('theme-dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(themeStorageKey, isDarkMode ? 'dark' : 'light');
    } catch (error) {
      // Ignore storage write failures.
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(themeStorageKey)) {
          return;
        }
      } catch (error) {
        // Ignore storage read issues and fall back to system preference.
      }

      setIsDarkMode(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const syncRecurringTransactions = () => {
      setCategories((current) => {
        const recurring = applyRecurringTransactions(current);
        return recurring.didChange ? recurring.categories : current;
      });
    };

    syncRecurringTransactions();
    const intervalId = window.setInterval(syncRecurringTransactions, 60 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!sidebarCategoryId) {
      document.body.style.overflow = '';
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarCategoryId(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarCategoryId]);

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
          transactions: sortTransactionsByRecency(remaining)
        };
      });

      if (!transactionToMove) {
        return current;
      }

      return withoutTransaction.map((category) =>
        category.id === toCategory
          ? {
              ...category,
              transactions: sortTransactionsByRecency([
                ...category.transactions,
                transactionToMove!
              ])
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
              transactions: sortTransactionsByRecency(
                category.transactions.filter((transaction) => transaction.id !== transactionId)
              )
            }
          : category
      )
    );

    setPinnedTransactionIds((current) => current.filter((id) => id !== transactionId));
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

  const { monthlyExpenses, monthlySavings, monthlyIncome, net } = summary;
  const hasMonthlyLeftover = net >= 0;
  const netLabel = hasMonthlyLeftover ? 'Left after bills' : 'Short this month';
  const netNote = hasMonthlyLeftover
    ? 'Use this for goals or flexible spending'
    : 'Plan to cover this gap soon';

  const yearlyOutlook = useMemo(
    () => ({
      income: monthlyIncome * 12,
      expenses: monthlyExpenses * 12,
      savings: monthlySavings * 12,
      net: net * 12
    }),
    [monthlyIncome, monthlyExpenses, monthlySavings, net]
  );

  const sanitizedInsightTimeframe = useMemo(() => {
    if (!insightTimeframeMonths || Number.isNaN(insightTimeframeMonths)) {
      return 1;
    }

    return Math.min(
      Math.max(Math.trunc(insightTimeframeMonths), 1),
      INSIGHT_TIMEFRAME_MAX_MONTHS
    );
  }, [insightTimeframeMonths]);

  const sanitizedTimeframeStartMonth = useMemo(() => {
    const parsed = Number(insightTimeframeStartMonth);
    if (Number.isNaN(parsed)) {
      return 0;
    }

    return Math.min(Math.max(parsed, 0), 11);
  }, [insightTimeframeStartMonth]);

  const sanitizedTimeframeStartYear = useMemo(() => {
    const parsed = Number(insightTimeframeStartYear);
    if (Number.isNaN(parsed)) {
      return new Date().getFullYear();
    }

    return parsed;
  }, [insightTimeframeStartYear]);

  const timeframeStartDate = useMemo(
    () => new Date(sanitizedTimeframeStartYear, sanitizedTimeframeStartMonth, 1),
    [sanitizedTimeframeStartMonth, sanitizedTimeframeStartYear]
  );

  const timeframeEndDate = useMemo(
    () =>
      new Date(
        sanitizedTimeframeStartYear,
        sanitizedTimeframeStartMonth + sanitizedInsightTimeframe - 1,
        1
      ),
    [sanitizedInsightTimeframe, sanitizedTimeframeStartMonth, sanitizedTimeframeStartYear]
  );

  const timeframeStartLabel = useMemo(
    () =>
      timeframeStartDate.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
      }),
    [timeframeStartDate]
  );

  const timeframeEndLabel = useMemo(
    () =>
      timeframeEndDate.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
      }),
    [timeframeEndDate]
  );

  const timeframeRangeDisplay = useMemo(() => {
    if (sanitizedInsightTimeframe === 1) {
      return timeframeStartLabel;
    }

    return `${timeframeStartLabel} – ${timeframeEndLabel}`;
  }, [sanitizedInsightTimeframe, timeframeEndLabel, timeframeStartLabel]);

  const timeframeMonthsDisplay = useMemo(() => {
    if (sanitizedInsightTimeframe === 1) {
      return '1 month';
    }

    return `${sanitizedInsightTimeframe} months`;
  }, [sanitizedInsightTimeframe]);

  const timeframeSentence = useMemo(() => {
    if (sanitizedInsightTimeframe === 1) {
      return `in ${timeframeStartLabel}`;
    }

    return `from ${timeframeStartLabel} through ${timeframeEndLabel}`;
  }, [sanitizedInsightTimeframe, timeframeEndLabel, timeframeStartLabel]);

  const timeframePillLabel = useMemo(() => {
    if (sanitizedInsightTimeframe === 1) {
      return timeframeStartLabel;
    }

    return `${timeframeRangeDisplay} • ${timeframeMonthsDisplay}`;
  }, [
    sanitizedInsightTimeframe,
    timeframeMonthsDisplay,
    timeframeRangeDisplay,
    timeframeStartLabel
  ]);

  const insights = useMemo(() => {
    type InsightBar = {
      id: string;
      name: string;
      value: number;
      monthlyValue: number;
      accent: string;
    };

    const spendingBars: InsightBar[] = categories
      .filter((category) => category.id !== 'income')
      .map((category) => ({
        id: category.id,
        name: category.name,
        monthlyValue: Math.abs(categoryMonthlyTotals[category.id]),
        value: Math.abs(categoryMonthlyTotals[category.id]) * sanitizedInsightTimeframe,
        accent: category.accent
      }))
      .filter((bar) => bar.value > 0);

    const spendingTotal = spendingBars.reduce((sum, bar) => sum + bar.value, 0);

    const livingCostsMonthly = Math.max(monthlyExpenses - monthlySavings, 0);
    const savingsMonthly = Math.max(monthlySavings, 0);
    const netMonthly = monthlyIncome - monthlyExpenses;
    const availableMonthly = netMonthly > 0 ? netMonthly : 0;
    const overBudgetMonthly = netMonthly < 0 ? Math.abs(netMonthly) : 0;

    const livingCosts = livingCostsMonthly * sanitizedInsightTimeframe;
    const savings = savingsMonthly * sanitizedInsightTimeframe;
    const available = availableMonthly * sanitizedInsightTimeframe;
    const overBudget = overBudgetMonthly * sanitizedInsightTimeframe;

    const allocationBars: InsightBar[] = [];

    if (livingCosts > 0) {
      allocationBars.push({
        id: 'living-costs',
        name: 'Living costs & essentials',
        monthlyValue: livingCostsMonthly,
        value: livingCosts,
        accent: '#93c5fd'
      });
    }

    if (savings > 0) {
      allocationBars.push({
        id: 'savings',
        name: 'Savings & investments',
        monthlyValue: savingsMonthly,
        value: savings,
        accent: '#99f6e4'
      });
    }

    if (available > 0) {
      allocationBars.push({
        id: 'available',
        name: 'Available to assign',
        monthlyValue: availableMonthly,
        value: available,
        accent: '#bbf7d0'
      });
    }

    if (overBudget > 0) {
      allocationBars.push({
        id: 'over-budget',
        name: 'Over budget',
        monthlyValue: overBudgetMonthly,
        value: overBudget,
        accent: '#fbcfe8'
      });
    }

    const allocationTotal = allocationBars.reduce((sum, bar) => sum + bar.value, 0);
    const hasAvailable = availableMonthly > 0;

    return {
      spending: {
        bars: spendingBars,
        total: spendingTotal,
        timeframeSentence,
        rangeDisplay: timeframeRangeDisplay,
        monthsDisplay: timeframeMonthsDisplay,
        months: sanitizedInsightTimeframe
      },
      allocation: {
        bars: allocationBars,
        total: allocationTotal,
        summaryLabel: hasAvailable ? 'Budget allocation' : 'Budget pressure',
        summaryHelper: hasAvailable
          ? `How your income covers ${timeframeSentence}.`
          : `Where expenses exceed income over ${timeframeSentence}.`,
        summaryValue:
          monthlyIncome > 0 ? monthlyIncome * sanitizedInsightTimeframe : allocationTotal,
        timeframeDisplay: timeframeMonthsDisplay,
        timeframeSentence,
        timeframeRange: timeframeRangeDisplay,
        timeframeMonths: sanitizedInsightTimeframe
      }
    };
  }, [
    categories,
    categoryMonthlyTotals,
    monthlyExpenses,
    monthlySavings,
    monthlyIncome,
    sanitizedInsightTimeframe,
    timeframeMonthsDisplay,
    timeframeRangeDisplay,
    timeframeSentence
  ]);

  const handleInsightTimeframeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);

    if (Number.isNaN(nextValue)) {
      setInsightTimeframeMonths(1);
      return;
    }

    const clamped = Math.min(Math.max(Math.trunc(nextValue), 1), INSIGHT_TIMEFRAME_MAX_MONTHS);
    setInsightTimeframeMonths(clamped);
  }, []);

  const handleInsightTimeframeBlur = useCallback(() => {
    setInsightTimeframeMonths((current) => {
      if (!current || Number.isNaN(current)) {
        return 1;
      }

      return Math.min(Math.max(Math.trunc(current), 1), INSIGHT_TIMEFRAME_MAX_MONTHS);
    });
  }, []);

  const handleInsightTimeframeStartMonthChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setInsightTimeframeStartMonth(event.target.value);
    },
    []
  );

  const handleInsightTimeframeStartYearChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setInsightTimeframeStartYear(event.target.value);
    },
    []
  );

  const handlePinnedCadenceChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setPinnedViewCadence(event.target.value as PinnedViewCadence);
    },
    []
  );

  const pinnedSummary = useMemo(() => {
    type PinnedItem = {
      id: string;
      name: string;
      categoryName: string;
      value: number;
      accent: string;
    };

    if (!pinnedTransactionIds.length) {
      return { items: [] as PinnedItem[], total: 0 };
    }

    const set = new Set(pinnedTransactionIds);
    const multiplier = monthlyToPinnedMultiplier[pinnedViewCadence];
    const collected: Array<Omit<PinnedItem, 'accent'>> = [];

    categories.forEach((category) => {
      category.transactions.forEach((transaction) => {
        if (set.has(transaction.id)) {
          const normalizedMonthly = Math.abs(
            transaction.amount * cadenceToMonthlyFactor[transaction.cadence]
          );

          collected.push({
            id: transaction.id,
            name: transaction.label,
            categoryName: category.name,
            value: normalizedMonthly * multiplier
          });
        }
      });
    });

    const sorted = collected.sort((a, b) => b.value - a.value);

    const items: PinnedItem[] = sorted.map((item, index) => ({
      ...item,
      accent: pinAccentPalette[index % pinAccentPalette.length]
    }));

    const total = items.reduce((sum, item) => sum + item.value, 0);

    return { items, total };
  }, [categories, pinnedTransactionIds, pinnedViewCadence]);

  const filteredCategories = useMemo<CategoryWithMonthlyTotal[]>(() =>
    monthCategories.map((category) => ({
      ...category,
      transactions: sortTransactionsByRecency(category.transactions),
      monthlyTotal: categoryMonthlyTotals[category.id]
    })), [monthCategories, categoryMonthlyTotals]);

  const midpoint = Math.ceil(filteredCategories.length / 2);
  const primaryCategories = filteredCategories.slice(0, midpoint);
  const secondaryCategories = filteredCategories.slice(midpoint);
  const activeSidebarCategory = useMemo(
    () =>
      sidebarCategoryId
        ? filteredCategories.find((category) => category.id === sidebarCategoryId) ?? null
        : null,
    [filteredCategories, sidebarCategoryId]
  );

  type ExportTarget = 'monthly' | 'yearly' | 'expenses' | 'allocation';

  const downloadCsv = useCallback((fileName: string, headers: string[], rows: (string | number)[][]) => {
    if (!rows.length) {
      return;
    }

    const escapeCell = (cell: string | number) => {
      const stringified = String(cell ?? '');
      if (stringified.includes('"')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }

      if (stringified.includes(',') || stringified.includes('\n')) {
        return `"${stringified}"`;
      }

      return stringified;
    };

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCell).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownload = useCallback(
    (target: ExportTarget) => {
      if (target === 'expenses') {
        const headers = ['Category', 'Total over timeframe', 'Average per month'];
        const rows: (string | number)[][] = insights.spending.bars.map((bar) => [
          bar.name,
          formatCurrency(bar.value),
          formatCurrency(bar.monthlyValue)
        ]);

        rows.push([
          'Total expenses',
          formatCurrency(insights.spending.total),
          formatCurrency(insights.spending.total / sanitizedInsightTimeframe)
        ]);

        const fileName = `expenses-${insightTimeframeStartYear}-${String(
          sanitizedTimeframeStartMonth + 1
        ).padStart(2, '0')}-to-${timeframeEndDate.getFullYear()}-${String(
          timeframeEndDate.getMonth() + 1
        ).padStart(2, '0')}.csv`;

        downloadCsv(fileName, headers, rows);
        return;
      }

      if (target === 'allocation') {
        const headers = ['Allocation area', 'Total over timeframe', 'Average per month'];
        const rows: (string | number)[][] = insights.allocation.bars.map((bar) => [
          bar.name,
          formatCurrency(bar.value),
          formatCurrency(bar.monthlyValue)
        ]);

        rows.push([
          'Total allocation',
          formatCurrency(insights.allocation.total),
          formatCurrency(insights.allocation.total / sanitizedInsightTimeframe)
        ]);

        const fileName = `budget-allocation-${insightTimeframeStartYear}-${String(
          sanitizedTimeframeStartMonth + 1
        ).padStart(2, '0')}-to-${timeframeEndDate.getFullYear()}-${String(
          timeframeEndDate.getMonth() + 1
        ).padStart(2, '0')}.csv`;

        downloadCsv(fileName, headers, rows);
        return;
      }

      if (target === 'monthly') {
        const headers = ['Metric', 'Amount', 'Notes'];
        const rows: (string | number)[][] = [
          ['Money coming in', formatCurrency(monthlyIncome), 'Income recorded this month'],
          ['Money going out', formatCurrency(monthlyExpenses), 'Expenses and savings transfers'],
          ['Set aside for savings', formatCurrency(monthlySavings), 'Included in money going out'],
          [netLabel, formatCurrency(net), netNote]
        ];

        downloadCsv(
          `monthly-summary-${selectedYear}-${String(Number(selectedMonth) + 1).padStart(2, '0')}.csv`,
          headers,
          rows
        );
        return;
      }

      if (target === 'yearly') {
        const headers = ['Metric', 'Amount'];
        const rows: (string | number)[][] = [
          ['Yearly income', formatCurrency(yearlyOutlook.income)],
          ['Yearly bills & plans', formatCurrency(yearlyOutlook.expenses)],
          ['Saved across the year', formatCurrency(yearlyOutlook.savings)],
          [yearlyOutlook.net >= 0 ? 'Estimated cushion' : 'Projected shortfall', formatCurrency(yearlyOutlook.net)]
        ];

        downloadCsv(`yearly-breakdown-${selectedYear}.csv`, headers, rows);
        return;
      }
    },
    [
      downloadCsv,
      formatCurrency,
      monthlyExpenses,
      monthlyIncome,
      monthlySavings,
      net,
      netLabel,
      netNote,
      selectedMonth,
      selectedYear,
      yearlyOutlook.expenses,
      yearlyOutlook.income,
      yearlyOutlook.net,
      yearlyOutlook.savings,
      insights.spending.bars,
      insights.spending.total,
      sanitizedInsightTimeframe,
      insightTimeframeStartYear,
      sanitizedTimeframeStartMonth,
      timeframeEndDate,
      insights.allocation.bars,
      insights.allocation.total
    ]
  );

  useEffect(() => {
    if (!isCategoryMonthMenuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!categoryMonthMenuRef.current?.contains(event.target as Node)) {
        setCategoryMonthMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isCategoryMonthMenuOpen]);

  useEffect(() => {
    setCategoryMonthMenuOpen(false);
  }, [selectedMonth, selectedYear]);

  const [isHeaderStuck, setIsHeaderStuck] = useState(false);
  const [isHeaderNavEngaged, setIsHeaderNavEngaged] = useState(false);
  const navInteractionTimeoutRef = useRef<number | null>(null);

  const clearNavInteractionTimeout = useCallback(() => {
    if (navInteractionTimeoutRef.current !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(navInteractionTimeoutRef.current);
      } else {
        clearTimeout(navInteractionTimeoutRef.current);
      }
      navInteractionTimeoutRef.current = null;
    }
  }, []);

  const engageHeaderNav = useCallback(() => {
    clearNavInteractionTimeout();
    setIsHeaderNavEngaged(true);
  }, [clearNavInteractionTimeout]);

  const releaseHeaderNav = useCallback(
    (delay = 160) => {
      clearNavInteractionTimeout();

      if (typeof window === 'undefined') {
        setIsHeaderNavEngaged(false);
        return;
      }

      navInteractionTimeoutRef.current = window.setTimeout(() => {
        setIsHeaderNavEngaged(false);
        navInteractionTimeoutRef.current = null;
      }, delay);
    },
    [clearNavInteractionTimeout]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleScroll = () => {
      setIsHeaderStuck(window.scrollY > 32);
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(
    () => () => {
      clearNavInteractionTimeout();
    },
    [clearNavInteractionTimeout]
  );

  const handleHeaderNavFocus = useCallback(() => {
    engageHeaderNav();
  }, [engageHeaderNav]);

  const handleHeaderNavBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        releaseHeaderNav();
      }
    },
    [releaseHeaderNav]
  );

  const handleHeaderNavMouseEnter = useCallback(() => {
    engageHeaderNav();
  }, [engageHeaderNav]);

  const handleHeaderNavMouseLeave = useCallback(() => {
    releaseHeaderNav();
  }, [releaseHeaderNav]);

  const handleHeaderNavTouchStart = useCallback(() => {
    engageHeaderNav();
  }, [engageHeaderNav]);

  const handleHeaderNavTouchEnd = useCallback(() => {
    releaseHeaderNav(320);
  }, [releaseHeaderNav]);

  const headerBarClasses = useMemo(() => {
    const classes = ['header-bar'];
    if (isHeaderStuck) {
      classes.push('header-bar--stuck');

      if (isHeaderNavEngaged) {
        classes.push('header-bar--active');
      }
    }

    return classes.join(' ');
  }, [isHeaderNavEngaged, isHeaderStuck]);

  return (
    <div className="app-shell">
      <div
        className={headerBarClasses}
        aria-hidden={!isHeaderStuck}
        onMouseEnter={handleHeaderNavMouseEnter}
        onMouseLeave={handleHeaderNavMouseLeave}
        onFocus={handleHeaderNavFocus}
        onBlur={handleHeaderNavBlur}
        onTouchStart={handleHeaderNavTouchStart}
        onTouchEnd={handleHeaderNavTouchEnd}
      >
        <div className="header-bar__inner">
          <nav className="header-nav" aria-label="Primary">
            <ul className="header-nav__list">
              {navigationItems.map((item) => (
                <li key={item.id} className="header-nav__item">
                  <a
                    href={`#${item.id}`}
                    className="header-nav__link"
                    onClick={(event) => handleNavigation(event, item.id)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-pressed={isDarkMode}
            aria-label={darkModeLabel}
          >
            <span className="theme-toggle__icon" aria-hidden="true">
              {isDarkMode ? '🌙' : '🌞'}
            </span>
            <span className="theme-toggle__label">
              {isDarkMode ? 'Light mode' : 'Dark mode'}
            </span>
          </button>
        </div>
      </div>
      <header className="header">
        <div className="header-top">
          <div className="header-title">
            <span className="logo-badge">FL</span>
            <h1>Flow Ledger</h1>
          </div>
          <div className="local-status"><span aria-hidden="true">●</span> Personal ledger · saved on this device</div>
          <button type="button" className="theme-toggle" onClick={toggleDarkMode} aria-label={darkModeLabel} aria-pressed={isDarkMode}>
            {isDarkMode ? '☀ Light mode' : '☾ Dark mode'}
          </button>
        </div>
        <p className="header-tagline">
          A little clarity for every dollar. Track your spending, build your savings, and find your balance.
        </p>
        <p className="header-subtext">
          No account needed. Your ledger stays in this browser; CSV exports are available below.
        </p>
      </header>

      {storageError ? <p className="storage-alert" role="alert">{storageError}</p> : null}
      <main className="dashboard">
        <section id="monthly-overview" className="summary-card" tabIndex={-1}>
          <div className="summary-header">
            <div className="summary-intro">
              <h2>Monthly summary</h2>
              <p>
                See {monthLabel} {selectedYear} at a glance. Totals reflect the transactions dated in this month.
              </p>
            </div>
            <div className="summary-controls">
              <label className="control-group" htmlFor="summary-month">
                <span className="control-label">Month</span>
                <span className="control-select-wrapper">
                  <select
                    id="summary-month"
                    className="control-select"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden="true" className="control-select-icon">
                    ▾
                  </span>
                </span>
              </label>
              <span className="summary-pill">{monthLabel} {selectedYear}</span>
              <DownloadButton
                label="Download month (.csv)"
                onClick={() => handleDownload('monthly')}
                aria-label={`Download ${monthLabel} ${selectedYear} summary`}
              />
            </div>
          </div>
          <div className="summary-grid">
            <div className="stat">
              <span className="stat-label">Money coming in</span>
              <span className="stat-value">{formatCurrency(monthlyIncome)}</span>
              <span className="stat-note">Income recorded this month</span>
            </div>
            <div className="stat">
              <span className="stat-label">Money going out</span>
              <span className="stat-value">{formatCurrency(monthlyExpenses)}</span>
              <span className="stat-note">Expenses and savings transfers</span>
            </div>
            <div className="stat">
              <span className="stat-label">Set aside for savings</span>
              <span className="stat-value">{formatCurrency(monthlySavings)}</span>
              <span className="stat-note">Included in money going out</span>
            </div>
            <div className="stat">
              <span className="stat-label">{netLabel}</span>
              <span className="stat-value">{formatCurrency(net)}</span>
              <span className="stat-note">{netNote}</span>
            </div>
          </div>
        </section>

        <TransactionForm
          id="log-transaction"
          categories={categories.map(({ id, name }) => ({ id, name }))}
          onAddTransaction={handleAddTransaction}
        />

        <section
          id="categories-section"
          className="section-block categories-section"
          tabIndex={-1}
        >
          <div className="section-heading">
            <div>
              <h2>Categories & transactions</h2>
              <p>Review recent activity, tidy each lane, and pin anything you want to watch.</p>
            </div>
            <div className="section-heading__actions">
              <div className="category-month-picker" ref={categoryMonthMenuRef}>
                <button
                  type="button"
                  className="category-month-button"
                  onClick={() => setCategoryMonthMenuOpen((previous) => !previous)}
                  aria-expanded={isCategoryMonthMenuOpen}
                  aria-haspopup="listbox"
                >
                  {monthLabel} {selectedYear}
                </button>
                {isCategoryMonthMenuOpen ? (
                  <div className="category-month-menu" role="listbox" aria-label="Choose month">
                    {monthOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`category-month-option ${
                          option.value === selectedMonth ? 'is-active' : ''
                        }`}
                        role="option"
                        aria-selected={option.value === selectedMonth}
                        onClick={() => {
                          setSelectedMonth(option.value);
                          setCategoryMonthMenuOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="category-layout">
            <div className="category-layout__row category-layout__row--primary">
              {primaryCategories.map((category) => (
                <CategoryColumn
                  key={category.id}
                  category={category}
                  monthlyTotal={category.monthlyTotal}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  isDropTarget={dropCategoryId === category.id}
                  isDragging={Boolean(dragState)}
                  formatCurrency={formatCurrency}
                  onTogglePin={togglePinnedTransaction}
                  onDuplicateTransaction={duplicateTransaction}
                  onDeleteTransaction={deleteTransaction}
                  pinnedTransactionIds={pinnedTransactionSet}
                  onRequestDetails={openCategoryDetails}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
            {secondaryCategories.length ? (
              <div className="category-layout__row category-layout__row--secondary">
                {secondaryCategories.map((category) => (
                <CategoryColumn
                  key={category.id}
                  category={category}
                  monthlyTotal={category.monthlyTotal}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  isDropTarget={dropCategoryId === category.id}
                  isDragging={Boolean(dragState)}
                  formatCurrency={formatCurrency}
                  onTogglePin={togglePinnedTransaction}
                  onDuplicateTransaction={duplicateTransaction}
                  onDeleteTransaction={deleteTransaction}
                  pinnedTransactionIds={pinnedTransactionSet}
                  onRequestDetails={openCategoryDetails}
                  isDarkMode={isDarkMode}
                />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="pinned-transactions"
          className="section-block pinned-section"
          tabIndex={-1}
        >
          <div className="pinned-card">
            <div className="pinned-header">
              <div className="pinned-header__intro">
                <h2>Pinned transactions</h2>
                <p>Keep the payments and goals you care about close at hand.</p>
                <span className="pinned-header__note">
                  Showing totals per <strong>{pinnedCadenceDisplay[pinnedViewCadence]}</strong>.
                </span>
              </div>
              <div className="pinned-header__controls">
                <label className="control-group" htmlFor="pinned-timeframe">
                  <span className="control-label">View totals by</span>
                  <span className="control-select-wrapper">
                    <select
                      id="pinned-timeframe"
                      className="control-select"
                      value={pinnedViewCadence}
                      onChange={handlePinnedCadenceChange}
                    >
                      {pinnedViewCadenceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              </div>
            </div>

            {pinnedSummary.items.length ? (
              <>
                <div className="pinned-bar" role="list" aria-label="Pinned transaction totals">
                  {pinnedSummary.items.map((item) => {
                    const percentage = pinnedSummary.total
                      ? (item.value / pinnedSummary.total) * 100
                      : 0;

                    return (
                      <div
                        key={item.id}
                        className="pinned-bar__segment"
                        style={{ width: `${percentage}%`, background: item.accent }}
                        title={`${item.name} • ${formatCurrency(item.value)} per ${pinnedCadenceDisplay[pinnedViewCadence]}`}
                        role="listitem"
                        tabIndex={0}
                        aria-label={`${item.name} from ${item.categoryName} worth ${formatCurrency(
                          item.value
                        )} per ${pinnedCadenceDisplay[pinnedViewCadence]}`}
                      >
                        <span className="pinned-bar__tooltip">
                          <strong>{item.name}</strong>
                          <span>
                            {formatCurrency(item.value)} / {pinnedCadenceDisplay[pinnedViewCadence]}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <InsightList
                  data={pinnedSummary.items.map((item) => ({
                    id: item.id,
                    name: `${item.name} • ${item.categoryName}`,
                    value: item.value,
                    accent: item.accent
                  }))}
                  total={pinnedSummary.total}
                  formatCurrency={formatCurrency}
                  ariaLabel={`Pinned transactions list per ${pinnedCadenceDisplay[pinnedViewCadence]}`}
                  emptyMessage="Pin transactions above to keep them in view."
                />
              </>
            ) : (
              <div className="pinned-empty" role="status">
                Pin any transaction from the categories above to track it here.
              </div>
            )}
          </div>
        </section>
      </main>

      <section id="insights-section" className="section-block insights-section" tabIndex={-1}>
        <div className="section-heading">
          <div>
            <h2>Insight spotlight</h2>
            <p>Glance at the categories shaping your month and how income is working for you.</p>
          </div>
        </div>
        <div className="insights-grid">
          <article className="insight-card insight-card--spending">
            <div className="insight-header">
              <span className="insight-kicker">Spending palette</span>
              <h2>Expenses by category</h2>
              <p>Estimated spending over this window, based on the selected summary month.</p>
            </div>
            <div className="insight-controls">
              <label className="control-group" htmlFor="expenses-timeframe-start-month">
                <span className="control-label">Start month</span>
                <span className="control-select-wrapper">
                  <select
                    id="expenses-timeframe-start-month"
                    className="control-select"
                    value={insightTimeframeStartMonth}
                    onChange={handleInsightTimeframeStartMonthChange}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="control-group" htmlFor="expenses-timeframe-start-year">
                <span className="control-label">Start year</span>
                <span className="control-select-wrapper">
                  <select
                    id="expenses-timeframe-start-year"
                    className="control-select"
                    value={insightTimeframeStartYear}
                    onChange={handleInsightTimeframeStartYearChange}
                  >
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="control-group" htmlFor="expenses-timeframe-months">
                <span className="control-label">Timeframe (months)</span>
                <span className="control-input-wrapper">
                  <input
                    id="expenses-timeframe-months"
                    className="control-input"
                    type="number"
                    min={1}
                    max={INSIGHT_TIMEFRAME_MAX_MONTHS}
                    value={sanitizedInsightTimeframe}
                    onChange={handleInsightTimeframeChange}
                    onBlur={handleInsightTimeframeBlur}
                    aria-label="Choose how many months to include in the expenses overview"
                  />
                  <span className="control-input-suffix">months</span>
                </span>
              </label>
              <span className="summary-pill">Viewing {timeframePillLabel}</span>
              <DownloadButton
                label="Download expenses (.csv)"
                onClick={() => handleDownload('expenses')}
                aria-label={`Download expenses from ${timeframeRangeDisplay}`}
              />
            </div>
            <div className="insight-summary">
              <span className="insight-summary-label">Expenses {timeframeSentence}</span>
              <span className="insight-summary-value">
                {formatCurrency(insights.spending.total)}
              </span>
            </div>
            <InsightList
              data={insights.spending.bars}
              total={insights.spending.total}
              formatCurrency={formatCurrency}
              ariaLabel={`Expenses ${timeframeSentence} by category`}
              emptyMessage="Add spending to visualize your expenses."
            />
          </article>

          <article className="insight-card insight-card--allocation">
            <div className="insight-header">
              <span className="insight-kicker">Budget pulse</span>
              <h2>How income is split</h2>
              <p>Estimated allocation over this window, based on the selected summary month.</p>
            </div>
            <div className="insight-controls">
              <label className="control-group" htmlFor="allocation-timeframe-start-month">
                <span className="control-label">Start month</span>
                <span className="control-select-wrapper">
                  <select
                    id="allocation-timeframe-start-month"
                    className="control-select"
                    value={insightTimeframeStartMonth}
                    onChange={handleInsightTimeframeStartMonthChange}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="control-group" htmlFor="allocation-timeframe-start-year">
                <span className="control-label">Start year</span>
                <span className="control-select-wrapper">
                  <select
                    id="allocation-timeframe-start-year"
                    className="control-select"
                    value={insightTimeframeStartYear}
                    onChange={handleInsightTimeframeStartYearChange}
                  >
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="control-group" htmlFor="allocation-timeframe-months">
                <span className="control-label">Timeframe (months)</span>
                <span className="control-input-wrapper">
                  <input
                    id="allocation-timeframe-months"
                    className="control-input"
                    type="number"
                    min={1}
                    max={INSIGHT_TIMEFRAME_MAX_MONTHS}
                    value={sanitizedInsightTimeframe}
                    onChange={handleInsightTimeframeChange}
                    onBlur={handleInsightTimeframeBlur}
                    aria-label="Choose how many months to include in the budget overview"
                  />
                  <span className="control-input-suffix">months</span>
                </span>
              </label>
              <span className="summary-pill">Viewing {timeframePillLabel}</span>
              <DownloadButton
                label="Download budget (.csv)"
                onClick={() => handleDownload('allocation')}
                aria-label={`Download budget allocation from ${timeframeRangeDisplay}`}
              />
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
              ariaLabel={`Budget allocation over ${insights.allocation.timeframeSentence}`}
              emptyMessage="Track income and expenses to see your allocation."
            />
          </article>
        </div>
      </section>

      {activeSidebarCategory ? (
        <div
          className="category-sidebar-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`category-sidebar-title-${activeSidebarCategory.id}`}
          onClick={closeCategoryDetails}
        >
          <aside
            className="category-sidebar"
            onClick={(event) => event.stopPropagation()}
            style={{
              background: isDarkMode
                ? `linear-gradient(160deg, ${activeSidebarCategory.accent}33, ${activeSidebarCategory.accent}55), linear-gradient(160deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85))`
                : `linear-gradient(160deg, ${activeSidebarCategory.accent}22, ${activeSidebarCategory.accent}40), linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.82))`
            }}
          >
            <header className="category-sidebar__header">
              <div>
                <span className="category-sidebar__eyebrow">{monthLabel} {selectedYear}</span>
                <h3 id={`category-sidebar-title-${activeSidebarCategory.id}`}>
                  {activeSidebarCategory.name}
                </h3>
                <p className="category-sidebar__subhead">
                  All transactions captured for this month.
                </p>
              </div>
              <button
                type="button"
                className="category-sidebar__close"
                onClick={closeCategoryDetails}
                aria-label="Close transaction details"
              >
                ×
              </button>
            </header>
            <div className="category-sidebar__content">
              {activeSidebarCategory.transactions.length ? (
                <div className="category-sidebar__transactions">
                  {activeSidebarCategory.transactions.map((transaction) => {
                    const isPinned = pinnedTransactionSet.has(transaction.id);
                    const amountPrefix = transaction.flow === 'Income' ? '+' : '-';
                    const displayAmount = `${amountPrefix}${formatCurrency(transaction.amount)}`;
                    const amountClass = `transaction-amount ${transaction.flow.toLowerCase()}`;
                    const metaParts: string[] = [transaction.flow, transaction.cadence];
                    const formattedDate = formatDate(transaction.date);

                    if (formattedDate) {
                      metaParts.push(formattedDate);
                    }

                    return (
                      <div
                        key={transaction.id}
                        className={`transaction-card transaction-card--static ${
                          isPinned ? 'transaction-card--pinned' : ''
                        }`}
                      >
                        <div
                          className={`transaction-actions ${
                            isPinned ? 'transaction-actions--active' : ''
                          }`}
                        >
                          <button
                            type="button"
                            className={`transaction-action transaction-pin ${
                              isPinned ? 'is-pinned' : ''
                            }`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              togglePinnedTransaction(transaction.id);
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            aria-pressed={isPinned}
                            aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${transaction.label}`}
                          >
                            📌
                          </button>
                          <button
                            type="button"
                            className="transaction-action transaction-action--duplicate"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              duplicateTransaction(activeSidebarCategory.id, transaction.id);
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            aria-label={`Duplicate ${transaction.label}`}
                          >
                            ⎘
                          </button>
                          <button
                            type="button"
                            className="transaction-action transaction-action--delete"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteTransaction(activeSidebarCategory.id, transaction.id);
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            aria-label={`Delete ${transaction.label}`}
                          >
                            🗑️
                          </button>
                        </div>
                        <div className="transaction-info">
                          <span className="transaction-label">{transaction.label}</span>
                          <span className="transaction-meta">{metaParts.join(' • ')}</span>
                          {transaction.note ? (
                            <span className="transaction-meta">{transaction.note}</span>
                          ) : null}
                        </div>
                        <span className={amountClass}>{displayAmount}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="category-sidebar__empty">
                  No transactions recorded for this month yet. Add one to see it here instantly.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      <section id="yearly-outlook" className="section-block yearly-section" tabIndex={-1}>
        <div className="yearly-card">
          <div className="yearly-header">
            <div className="yearly-intro">
              <h2>Yearly breakdown</h2>
              <p>
                A projection for {selectedYear}, based on {monthLabel} activity multiplied by 12. One-time payments in this month are included in the estimate.
              </p>
            </div>
            <label className="control-group" htmlFor="yearly-year">
              <span className="control-label">Year</span>
              <span className="control-select-wrapper">
                <select
                  id="yearly-year"
                  className="control-select"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="control-select-icon">
                  ▾
                </span>
              </span>
            </label>
            <DownloadButton
              label="Download year (.csv)"
              onClick={() => handleDownload('yearly')}
              aria-label={`Download yearly breakdown for ${selectedYear}`}
            />
          </div>
          <div className="yearly-grid">
            <div className="yearly-stat">
              <span className="yearly-label">Yearly income</span>
              <span className="yearly-value">{formatCurrency(yearlyOutlook.income)}</span>
            </div>
            <div className="yearly-stat">
              <span className="yearly-label">Yearly bills & plans</span>
              <span className="yearly-value">{formatCurrency(yearlyOutlook.expenses)}</span>
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

      <footer className="footer-note">
        Flow Ledger is intentionally mobile-first and ready for the moment it becomes a dedicated
        app – your data model and interactions will translate smoothly.
      </footer>
    </div>
  );
}
