import type { ReactNode } from 'react';

type NoticeVariant = 'info' | 'error' | 'pending';

const VARIANT_CLASS: Record<NoticeVariant, string> = {
  info: 'notice',
  error: 'notice notice--error',
  pending: 'notice notice--pending',
};

/**
 * Mensagem de estado (vazio, sem resultado, erro, conteúdo em preparação).
 * Erros usam role="alert"; os demais são texto comum.
 */
export function Notice({
  title,
  children,
  variant = 'info',
}: {
  title: string;
  children?: ReactNode;
  variant?: NoticeVariant;
}) {
  return (
    <div className={VARIANT_CLASS[variant]} role={variant === 'error' ? 'alert' : undefined}>
      <p className="notice__title">{title}</p>
      {children}
    </div>
  );
}
