import React from 'react';
import Image from 'next/image';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  image?: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
  actions?: React.ReactNode;
  compact?: boolean;
  side?: boolean;
  glass?: boolean;
  bordered?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  image,
  actions,
  compact = false,
  side = false,
  glass = false,
  bordered = false,
  className = '',
}) => {
  const baseClasses = 'card bg-base-100 shadow-xl';

  // Mobile-first layout (PRP-017 T027)
  // side layout only on tablet+ (stacks on mobile)
  const classes = [
    baseClasses,
    compact && 'card-compact',
    side && 'md:card-side',
    glass && 'glass',
    bordered && 'card-bordered',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes}>
      {image && (
        <figure>
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width || 400}
            height={image.height || 300}
            className="object-cover"
          />
        </figure>
      )}
      <div className="card-body">
        {(title || subtitle) && (
          <header>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="text-sm opacity-70">{subtitle}</p>}
          </header>
        )}
        {children}
        {actions && <div className="card-actions justify-end">{actions}</div>}
      </div>
    </article>
  );
};

export default Card;
