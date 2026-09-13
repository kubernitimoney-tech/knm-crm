import React from 'react';
import { cn } from '../../lib/utils';
import { BADGE_BASE_CLASS, BADGE_TONE_CLASS, type BadgeTone } from '@/lib/badgeStyles';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  key?: React.Key;
}

const variantToTone: Record<NonNullable<BadgeProps['variant']>, BadgeTone> = {
  primary: 'primary',
  secondary: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

export const Badge = ({ children, variant = 'primary', className }: BadgeProps) => {
  return (
    <span className={cn(BADGE_BASE_CLASS, BADGE_TONE_CLASS[variantToTone[variant]], className)}>
      {children}
    </span>
  );
};
