import { DragEvent } from 'react';
import { Category, CategoryKey, Transaction } from '../types';

interface CategoryColumnProps {
  category: Category;
  monthlyTotal: number;
  onDragStart: (originCategoryId: CategoryKey, transactionId: string) => void;
  onDragEnd: () => void;
  onDrop: (targetCategoryId: CategoryKey) => void;
  onDragOver: (targetCategoryId: CategoryKey) => void;
  isDropTarget: boolean;
  isDragging: boolean;
  formatCurrency: (value: number) => string;
}

export function CategoryColumn({
  category,
  monthlyTotal,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  isDropTarget,
  isDragging,
  formatCurrency
}: CategoryColumnProps) {
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();
    onDragOver(category.id);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDrop(category.id);
  };

  const isNetInflow = monthlyTotal < 0;
  const monthlyTotalDisplay = isNetInflow
    ? `+${formatCurrency(Math.abs(monthlyTotal))}`
    : formatCurrency(monthlyTotal);

  const renderTransaction = (transaction: Transaction) => {
    const amountClass = `transaction-amount ${transaction.flow.toLowerCase()}`;
    const isOutflow = transaction.flow !== 'Income';
    const amountPrefix = isOutflow ? '-' : '+';
    const displayAmount = `${amountPrefix}${formatCurrency(transaction.amount)}`;

    const handleTransactionDragStart = (
      event: DragEvent<HTMLDivElement>,
      transactionId: string
    ) => {
      event.dataTransfer.setData('text/plain', transactionId);
      event.dataTransfer.effectAllowed = 'move';
      onDragStart(category.id, transactionId);
    };

    return (
      <div
        key={transaction.id}
        className="transaction-card"
        draggable
        onDragStart={(event) => handleTransactionDragStart(event, transaction.id)}
        onDragEnd={onDragEnd}
      >
        <div className="transaction-info">
          <span className="transaction-label">{transaction.label}</span>
          <span className="transaction-meta">
            {transaction.flow} • {transaction.cadence}
          </span>
          {transaction.note ? (
            <span className="transaction-meta">{transaction.note}</span>
          ) : null}
        </div>
        <span className={amountClass}>{displayAmount}</span>
      </div>
    );
  };

  const sectionClassName = [
    'category-card',
    `category-${category.id}`,
    isDropTarget ? 'drop-target' : '',
    isNetInflow ? 'net-inflow' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={sectionClassName}
      style={{
        background: `linear-gradient(160deg, rgba(15,23,42,0.85), rgba(15,23,42,0.7)), linear-gradient(160deg, ${category.accent}, rgba(15, 23, 42, 0.95))`
      }}
    >
      <header className="category-header">
        <div>
          <div className="category-title">{category.name}</div>
          <div className="category-total">{monthlyTotalDisplay} per month</div>
        </div>
        <span className="category-chip" style={{ borderColor: category.accent, color: '#0f172a', background: '#f8fafc' }}>
          <span
            style={{
              display: 'inline-block',
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '999px',
              background: category.accent
            }}
          ></span>
          {category.transactions.length}
        </span>
      </header>

      <p className="category-description">{category.description}</p>

      <div className="transaction-list" onDragOver={handleDragOver} onDrop={handleDrop}>
        {category.transactions.length > 0 ? (
          category.transactions.map(renderTransaction)
        ) : (
          <div className="empty-state">No items yet – start by adding one below.</div>
        )}
      </div>

      {isDragging ? (
        <div className={`drop-zone ${isDropTarget ? 'drag-over' : ''}`}>
          {isDropTarget ? 'Release to move here' : 'Drag and drop to reorganize'}
        </div>
      ) : (
        <div className="drop-zone">Drag items here to move them</div>
      )}
    </section>
  );
}
