/**
 * Landing Section: Features Grid
 *
 * Bento-style 2-column grid with 4 feature cards.
 */

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Zap, Shield, BarChart3, Sparkles, Check } from 'lucide-react'
import {
  ScrollReveal,
  StaggerContainer,
  staggerChild,
  GlassCard,
  PlaceholderImage,
  SectionHeading,
  cn,
} from '../primitives'

// ============================================================================
// Configuration
// ============================================================================

const FEATURES: Array<{
  icon: typeof Zap
  title: string
  description: string
  gradient: string
  iconColor: string
  borderGlow: string
  image: string
  Visual: (() => ReactNode) | null
}> = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Real-time sync and instant updates across all devices.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-400',
    borderGlow: 'group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    image: '',
    Visual: null,
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'Enterprise-grade security with role-based access and encryption.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
    borderGlow: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    image: '',
    Visual: ShieldVisual,
  },
  {
    icon: BarChart3,
    title: 'Powerful Analytics',
    description: 'Built-in dashboards and real-time insights for better decisions.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-400',
    borderGlow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    image: '',
    Visual: BarChartVisual,
  },
  {
    icon: Sparkles,
    title: 'AI-Powered',
    description: 'Smart automation that learns from your workflow.',
    gradient: 'from-violet-500/20 to-purple-500/20',
    iconColor: 'text-violet-400',
    borderGlow: 'group-hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    image: '',
    Visual: null,
  },
]

// ============================================================================
// Decorative Visuals
// ============================================================================

function SpeedPulseVisual() {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-foreground/[0.02]">
      <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
        {[0.3, 0.7, 0.5, 1, 0.6, 0.85, 0.45, 0.9, 0.35, 0.75, 0.55, 0.95, 0.4, 0.8, 0.65].map((h, i) => (
          <motion.div
            key={i}
            className="w-[4px] rounded-full bg-gradient-to-t from-amber-500/60 to-orange-400/30"
            initial={{ height: '10%' }}
            whileInView={{ height: `${h * 80}%` }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04, duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-background/90 to-transparent" />
    </div>
  )
}

function ShieldVisual() {
  const checkItems = ['Encryption', 'RBAC', 'Audit Log']
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-foreground/[0.02]">
      <div className="flex flex-col gap-2 px-4 py-3">
        {checkItems.map((item, i) => (
          <motion.div
            key={item}
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
          >
            <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-xs text-muted-foreground/60 font-medium">{item}</span>
            <div className="flex-1 h-px bg-foreground/[0.04]" />
            <span className="text-[10px] text-emerald-400/60 font-medium">Active</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function BarChartVisual() {
  const bars = [
    { h: 35, label: 'Mon' },
    { h: 58, label: 'Tue' },
    { h: 42, label: 'Wed' },
    { h: 78, label: 'Thu' },
    { h: 65, label: 'Fri' },
    { h: 88, label: 'Sat' },
    { h: 52, label: 'Sun' },
  ]
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-foreground/[0.02]">
      <div className="absolute inset-0 flex items-end justify-center gap-2 px-4 pb-5 pt-2">
        {bars.map((bar, i) => (
          <div key={bar.label} className="flex flex-col items-center gap-1.5 flex-1">
            <motion.div
              className="w-full max-w-[24px] rounded-t-sm bg-gradient-to-t from-blue-500/50 to-cyan-400/30"
              initial={{ height: 0 }}
              whileInView={{ height: `${bar.h}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
            />
            <span className="text-[8px] text-muted-foreground/60 font-medium">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SparkleVisual() {
  const nodes = [
    { x: 20, y: 30, delay: 0 },
    { x: 50, y: 15, delay: 0.1 },
    { x: 80, y: 35, delay: 0.2 },
    { x: 35, y: 65, delay: 0.15 },
    { x: 65, y: 55, delay: 0.25 },
    { x: 50, y: 80, delay: 0.3 },
  ]
  const connections = [
    [0, 1], [1, 2], [0, 3], [1, 4], [2, 4], [3, 5], [4, 5],
  ]
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-foreground/[0.02]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {connections.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="url(#sparkleGrad)"
            strokeWidth="0.5"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.4 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
          />
        ))}
        <defs>
          <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(139,92,246)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="rgb(168,85,247)" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {nodes.map((node, i) => (
          <motion.circle
            key={i}
            cx={node.x}
            cy={node.y}
            r="3"
            fill="rgba(139,92,246,0.4)"
            stroke="rgba(139,92,246,0.6)"
            strokeWidth="0.5"
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: node.delay + 0.1, duration: 0.4, ease: 'easeOut' }}
          />
        ))}
        {nodes.map((node, i) => (
          <motion.circle
            key={`glow-${i}`}
            cx={node.x}
            cy={node.y}
            r="5"
            fill="none"
            stroke="rgba(139,92,246,0.15)"
            strokeWidth="1"
            initial={{ scale: 0 }}
            whileInView={{ scale: [1, 1.8, 1] }}
            viewport={{ once: true }}
            transition={{ delay: node.delay + 0.5, duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </svg>
    </div>
  )
}

// ============================================================================
// Feature Card
// ============================================================================

function BentoFeatureCard({
  feature,
  size = 'normal',
}: {
  feature: (typeof FEATURES)[number]
  size?: 'large' | 'normal'
}) {
  const isLarge = size === 'large'

  return (
    <motion.div variants={staggerChild} className={isLarge ? 'md:col-span-2' : ''}>
      <GlassCard className={cn('h-full overflow-hidden', feature.borderGlow)}>
        <div
          className={cn(
            'absolute inset-0 opacity-[0.15] group-hover:opacity-100 transition-opacity duration-700',
            'bg-gradient-to-br',
            feature.gradient,
          )}
        />
        <div className={cn('relative z-10 flex flex-col', isLarge ? 'p-8 md:p-10' : 'p-7')}>
          <div className="flex items-start gap-5">
            <div
              className={cn(
                'shrink-0 rounded-xl flex items-center justify-center',
                'bg-foreground/[0.06] border border-foreground/[0.08]',
                'group-hover:scale-110 transition-transform duration-500',
                isLarge ? 'w-14 h-14' : 'w-11 h-11',
              )}
            >
              <feature.icon className={cn(feature.iconColor, isLarge ? 'w-7 h-7' : 'w-5 h-5')} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={cn('text-foreground font-semibold mb-2', isLarge ? 'text-xl' : 'text-base')}>
                {feature.title}
              </h3>
              <p className={cn('text-muted-foreground leading-relaxed', isLarge ? 'text-base' : 'text-sm')}>
                {feature.description}
              </p>
            </div>
          </div>
          {feature.Visual ? (
            <div className={cn(isLarge ? 'mt-8' : 'mt-5')}>
              <feature.Visual />
            </div>
          ) : isLarge ? (
            <div className="mt-8">
              <PlaceholderImage label="Add Image" src={feature.image || undefined} aspectRatio="aspect-[16/10]" />
            </div>
          ) : null}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ============================================================================
// Section
// ============================================================================

export default function FeaturesGridSection() {
  return (
    <section id="features" className="relative py-28 md:py-36">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          tag="Features"
          title="Everything you need"
          titleHighlight="all in one place"
          subtitle="Powerful features designed to streamline your workflow."
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5" staggerDelay={0.08}>
          <BentoFeatureCard feature={FEATURES[0]} size="large" />
          <BentoFeatureCard feature={FEATURES[1]} />
          <BentoFeatureCard feature={FEATURES[2]} />
          <BentoFeatureCard feature={FEATURES[3]} size="large" />
        </StaggerContainer>
      </div>
    </section>
  )
}
