import { ComponentPropsWithoutRef } from 'react';

interface DownloadButtonProps extends ComponentPropsWithoutRef<'button'> {
  label: string;
}

export function DownloadButton({ label, className = '', ...buttonProps }: DownloadButtonProps) {
  return (
    <button type="button" className={`export-button ${className}`.trim()} {...buttonProps}>
      <span className="export-button__icon" aria-hidden="true">
        ⬇️
      </span>
      <span className="export-button__label">{label}</span>
    </button>
  );
}
