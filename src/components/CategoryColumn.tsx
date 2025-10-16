import { CSSProperties, DragEvent, MouseEvent } from 'react';
import { Category, CategoryKey, Transaction } from '../types';

const transactionDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

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
  onTogglePin: (transactionId: string) => void;
  onDuplicateTransaction: (categoryId: CategoryKey, transactionId: string) => void;
  onDeleteTransaction: (categoryId: CategoryKey, transactionId: string) => void;
  pinnedTransactionIds: Set<string>;
  onRequestDetails: (categoryId: CategoryKey) => void;
  isDarkMode: boolean;
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
  formatCurrency,
  onTogglePin,
  onDuplicateTransaction,
  onDeleteTransaction,
  pinnedTransactionIds,
  onRequestDetails,
  isDarkMode
}: CategoryColumnProps) {
  const visibleTransactions = category.transactions.slice(0, 5);
  const hasMoreTransactions = category.transactions.length > visibleTransactions.length;

  const cardStyle: CSSProperties = {
    background: isDarkMode
      ? `linear-gradient(160deg, ${category.accent}33, ${category.accent}55), linear-gradient(160deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85))`
      : `linear-gradient(160deg, ${category.accent}22, ${category.accent}36), linear-gradient(160deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.72))`
  };

  const chipStyle: CSSProperties = isDarkMode
    ? {
        borderColor: `${category.accent}88`,
        background: 'rgba(15, 23, 42, 0.82)',
        color: '#f8fafc'
      }
    : {
        borderColor: `${category.accent}66`,
        background: 'rgba(255, 255, 255, 0.75)',
        color: '#0f172a'
      };

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

  const renderTransaction = (transaction: Transaction) => {
    const isPinned = pinnedTransactionIds.has(transaction.id);
    const amountClass = `transaction-amount ${transaction.flow.toLowerCase()}`;
    const amountPrefix = transaction.flow === 'Income' ? '+' : '-';
    const displayAmount = `${amountPrefix}${formatCurrency(transaction.amount)}`;
    const metaParts: string[] = [transaction.flow, transaction.cadence];

    if (transaction.date) {
      const parsed = new Date(transaction.date);
      if (!Number.isNaN(parsed.valueOf())) {
        metaParts.push(transactionDateFormatter.format(parsed));
      }
    }

    const handleTransactionDragStart = (
      event: DragEvent<HTMLDivElement>,
      transactionId: string
    ) => {
      event.dataTransfer.setData('text/plain', transactionId);
      event.dataTransfer.effectAllowed = 'move';
      onDragStart(category.id, transactionId);
    };

    const handlePinClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      onTogglePin(transaction.id);
    };

    const handleDuplicateClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      onDuplicateTransaction(category.id, transaction.id);
    };

    const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      onDeleteTransaction(category.id, transaction.id);
    };

    return (
      <div
        key={transaction.id}
        className={`transaction-card ${isPinned ? 'transaction-card--pinned' : ''}`}
        draggable
        onDragStart={(event) => handleTransactionDragStart(event, transaction.id)}
        onDragEnd={onDragEnd}
      >
        <div className={`transaction-actions ${isPinned ? 'transaction-actions--active' : ''}`}>
          <button
            type="button"
            className={`transaction-action transaction-pin ${isPinned ? 'is-pinned' : ''}`}
            onClick={handlePinClick}
            onMouseDown={(event) => event.stopPropagation()}
            aria-pressed={isPinned}
            aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${transaction.label}`}
          >
            📌
          </button>
          <button
            type="button"
            className="transaction-action transaction-action--duplicate"
            onClick={handleDuplicateClick}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label={`Duplicate ${transaction.label}`}
          >
            ⎘
          </button>
          <button
            type="button"
            className="transaction-action transaction-action--delete"
            onClick={handleDeleteClick}
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
  };

  return (
    <section className={`category-card ${isDropTarget ? 'drop-target' : ''}`} style={cardStyle}>
      <header className="category-header">
        <div>
          <div className="category-title">{category.name}</div>
          <div className="category-total">{formatCurrency(monthlyTotal)} per month</div>
        </div>
        <span className="category-chip" style={chipStyle}>
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
          <>
            {visibleTransactions.map(renderTransaction)}
            {hasMoreTransactions ? (
              <button
                type="button"
                className="category-see-more"
                onClick={() => onRequestDetails(category.id)}
              >
                See all {category.transactions.length} transactions
              </button>
            ) : null}
          </>
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
