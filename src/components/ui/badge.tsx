import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-(--color-elevated) text-foreground',
        secondary:   'bg-(--color-elevated) text-(--color-text-secondary)',
        destructive: 'bg-(--color-error) text-white',
        outline:     'border border-(--color-border) text-(--color-text-secondary)',
        success:     'bg-(--color-success-bg) text-(--color-success)',
        warning:     'bg-(--color-warning-bg) text-(--color-warning)',
        info:        'bg-(--color-info-bg) text-(--color-info)',
        sale:        'bg-(--color-sale) text-white',
        new:         'bg-(--color-info) text-white',
        premium:     'bg-amber-800 text-white',
        featured:    'bg-(--brand-amber) text-white',
        bestseller:  'bg-(--brand-primary) text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
