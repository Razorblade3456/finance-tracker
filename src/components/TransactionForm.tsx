import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CategoryKey,
  TransactionCadence,
  TransactionFlow
} from '../types';

const cadenceOptions: TransactionCadence[] = [
  'Weekly',
  'Bi-weekly',
  'Monthly',
  'Quarterly',
  'Annual',
  'One-time'
];

const flowOptions: TransactionFlow[] = ['Expense', 'Savings', 'Income'];

interface TransactionFormProps {
  categories: { id: CategoryKey; name: string }[];
  onAddTransaction: (payload: {
    categoryId: CategoryKey;
    label: string;
    amount: number;
    cadence: TransactionCadence;
    flow: TransactionFlow;
    note: string;
    date: string;
  }) => void;
}

export function TransactionForm({ categories, onAddTransaction }: TransactionFormProps) {
  const initialCategory = useMemo(() => {
    const firstNonIncome = categories.find((category) => category.id !== 'income');
    return firstNonIncome?.id ?? categories[0]?.id ?? 'financial-obligations';
  }, [categories]);

  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryKey>(initialCategory);
  const [cadence, setCadence] = useState<TransactionCadence>('Monthly');
  const [flow, setFlow] = useState<TransactionFlow>('Expense');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const resetForm = () => {
    setLabel('');
    setAmount('');
    setCadence('Monthly');
    setFlow('Expense');
    setNote('');
    setDate(new Date().toISOString().slice(0, 10));
  };

  useEffect(() => {
    setCategoryId((current) => {
      const exists = categories.some((category) => category.id === current);
      if (exists) {
        return current;
      }

      return initialCategory;
    });
  }, [categories, initialCategory]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount);

    if (!label.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    onAddTransaction({
      categoryId,
      label: label.trim(),
      amount: parsedAmount,
      cadence,
      flow,
      note: note.trim(),
      date
    });

    resetForm();
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div>
        <h2>Log a transaction</h2>
        <p className="helper-text">
          Keep tabs on cashflow you can eventually sync to mobile – add the details, set the date,
          and drag it to another category as life shifts.
        </p>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="transaction-label">Name</label>
          <input
            id="transaction-label"
            name="transaction-label"
            placeholder="e.g. Rent, Gym membership"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="transaction-amount">Amount</label>
          <input
            id="transaction-amount"
            name="transaction-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="transaction-date">Date</label>
          <input
            id="transaction-date"
            name="transaction-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="transaction-category">Category</label>
          <select
            id="transaction-category"
            name="transaction-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value as CategoryKey)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="transaction-cadence">Cadence</label>
          <select
            id="transaction-cadence"
            name="transaction-cadence"
            value={cadence}
            onChange={(event) => setCadence(event.target.value as TransactionCadence)}
          >
            {cadenceOptions.map((cadenceOption) => (
              <option key={cadenceOption} value={cadenceOption}>
                {cadenceOption}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="transaction-flow">Type</label>
          <select
            id="transaction-flow"
            name="transaction-flow"
            value={flow}
            onChange={(event) => setFlow(event.target.value as TransactionFlow)}
          >
            {flowOptions.map((flowOption) => (
              <option key={flowOption} value={flowOption}>
                {flowOption}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="transaction-note">Notes</label>
          <textarea
            id="transaction-note"
            name="transaction-note"
            placeholder="Add context you want to see later on mobile"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <button type="submit" className="add-button">
        Add transaction
      </button>
    </form>
  );
}
