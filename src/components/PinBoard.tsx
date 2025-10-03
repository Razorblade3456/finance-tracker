import { DragEvent, FormEvent, useState } from 'react';
import type { PinNote } from '../types';

interface PinBoardProps {
  pins: PinNote[];
  onReorder: (draggedId: string, targetId: string | null) => void;
  onAddPin: (label: string, detail: string) => void;
}

export function PinBoard({ pins, onReorder, onAddPin }: PinBoardProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);

  const resetDrag = () => {
    setDraggedId(null);
    setHoverTargetId(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = newLabel.trim();
    const detail = newDetail.trim();

    if (!label) {
      return;
    }

    onAddPin(label, detail);
    setNewLabel('');
    setNewDetail('');
  };

  const handleDragStart = (pinId: string, event: DragEvent<HTMLElement>) => {
    setDraggedId(pinId);
    setHoverTargetId(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pinId);
  };

  const handleDragEnter = (pinId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!draggedId || draggedId === pinId) {
      return;
    }
    setHoverTargetId(pinId);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDropOnItem = (pinId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!draggedId) {
      return;
    }

    onReorder(draggedId, pinId);
    resetDrag();
  };

  const handleDropToBoard = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedId) {
      return;
    }

    onReorder(draggedId, null);
    resetDrag();
  };

  const handleDragEnd = () => {
    resetDrag();
  };

  return (
    <section className="pin-board">
      <div className="pin-board__header">
        <span className="pin-board__kicker">Pin &amp; trim</span>
        <h2>Keep the habits you&apos;re cutting back on top of mind</h2>
        <p>
          Drag to reorder your watch list. Soon these pins will sync with your Google sign-in so
          nothing slips through the cracks.
        </p>
      </div>

      <form className="pin-board__form" onSubmit={handleSubmit}>
        <div className="pin-board__input-group">
          <label htmlFor="pin-label">What do you want to remember?</label>
          <input
            id="pin-label"
            name="pin-label"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Example: Skip weekday delivery"
            autoComplete="off"
          />
        </div>
        <div className="pin-board__input-group">
          <label htmlFor="pin-detail">Add a quick note (optional)</label>
          <textarea
            id="pin-detail"
            name="pin-detail"
            value={newDetail}
            onChange={(event) => setNewDetail(event.target.value)}
            placeholder="Why it matters or the limit you want to set"
          />
        </div>
        <button type="submit" className="pin-board__button">
          Add pin
        </button>
      </form>

      <div
        className="pin-board__list"
        onDragOver={handleDragOver}
        onDrop={handleDropToBoard}
        aria-live="polite"
      >
        {pins.length === 0 ? (
          <div className="pin-board__empty">Pin the spending habits you want to keep an eye on.</div>
        ) : (
          pins.map((pin) => (
            <article
              key={pin.id}
              className={`pin-card${
                draggedId === pin.id ? ' pin-card--dragging' : ''
              }${hoverTargetId === pin.id ? ' pin-card--drop-target' : ''}`}
              style={{ borderColor: pin.accent }}
              draggable
              onDragStart={(event) => handleDragStart(pin.id, event)}
              onDragEnter={(event) => handleDragEnter(pin.id, event)}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDropOnItem(pin.id, event)}
              onDragEnd={handleDragEnd}
            >
              <div className="pin-card__accent" aria-hidden="true" style={{ background: pin.accent }} />
              <div className="pin-card__content">
                <h3>{pin.label}</h3>
                {pin.detail ? <p>{pin.detail}</p> : <p className="pin-card__placeholder">Add a note any time.</p>}
                <span className="pin-card__hint">Drag to move • Drop to reorder</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
