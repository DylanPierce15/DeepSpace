# Landing Page

Complete landing page with hero, sections, CTA, and footer — install once, keep what fits, remove the rest

A full landing page kit: shell with fixed background, scroll overlay, typewriter hero, CTA, and footer, plus 9 optional section components. All sections are installed into components/landing/. Import the ones that serve the app's story and delete the rest. The template uses the app's @theme tokens so it adapts to any color scheme automatically. always read SkeletonGuide.md 'Landing Page' section at start for guidance.

## Dependencies

None

## Files

Copy from `src/` in this directory to the app:

- `LandingPage.tsx` → `src/pages/LandingPage.tsx`
- `primitives.tsx` → `src/components/landing/primitives.tsx`
- `FeaturesGridSection.tsx` → `src/components/landing/FeaturesGridSection.tsx`
- `ShowcaseSection.tsx` → `src/components/landing/ShowcaseSection.tsx`
- `HowItWorksSection.tsx` → `src/components/landing/HowItWorksSection.tsx`
- `TestimonialsSection.tsx` → `src/components/landing/TestimonialsSection.tsx`
- `FAQSection.tsx` → `src/components/landing/FAQSection.tsx`
- `StatsSection.tsx` → `src/components/landing/StatsSection.tsx`
- `TeamSection.tsx` → `src/components/landing/TeamSection.tsx`
- `LogoCloudSection.tsx` → `src/components/landing/LogoCloudSection.tsx`
- `VideoSection.tsx` → `src/components/landing/VideoSection.tsx`

## Wiring

1. Read SkeletonGuide.md 'Landing Page' section before editing any code. Load the frontend-design skill and commit to a creative direction first. This template is raw material — redesign layouts, animations, typography, and colors to match the app's identity.
2. In App.tsx, find the '── Landing page ──' comment block. Uncomment the import and LANDING_PAGE_ROUTE lines, delete the two null placeholders, and uncomment the /welcome Route.
3. Update NAV_LINKS in LandingPage.tsx — each href (minus #) MUST exactly match the id attribute on the corresponding <section> element. Mismatched ids break scroll-based nav highlighting.
4. Critical: The placeholder images in different sections being used must be replaced with ai generated images or code based previews/figures.

## Patterns

- `LANDING_BG_URL → set R2 URL from mcapi image generation; empty string falls back to solid bg-background`
- `NAV_LINKS: { label, href: '#sectionId' }[] → href minus # must match <section id>`
- `Configuration block at top: APP_NAME, HERO_HEADLINE, HERO_SUBHEADLINE, HERO_IMAGE, SHOWCASE_ITEMS, FEATURES, FAQ_ITEMS, FOOTER_LINKS`
- `Primitives (components/landing/primitives): Typewriter, ScrollReveal, GlassCard, BrowserMockup, SectionHeading, PlaceholderImage, AnimatedStat, StaggerContainer`
