'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from './card'

export type MotionCardProps = React.ComponentProps<typeof Card> & {
  /**
   * If true, disables framer-motion wrapping entirely.
   * Crucial for avoiding conflicts with drag-and-drop libraries like dnd-kit.
   */
  disableAnimation?: boolean
  /**
   * Stagger index for entrance animations.
   */
  index?: number
}

export const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  ({ className, disableAnimation = false, index = 0, children, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion()
    const isAnimated = !disableAnimation && !shouldReduceMotion

    if (!isAnimated) {
      return (
        <Card ref={ref} className={className} {...props}>
          {children}
        </Card>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.25,
          delay: index * 0.04,
          ease: [0.25, 0.1, 0.25, 1.0], // Snappy ease-out
        }}
        whileHover={{
          scale: 1.02,
          transition: { duration: 0.15, ease: 'easeOut' },
        }}
        // ensure we pass the ref to the motion div so outer components can measure it if needed
        ref={ref}
      >
        <Card className={className} {...props}>
          {children}
        </Card>
      </motion.div>
    )
  }
)

MotionCard.displayName = 'MotionCard'
