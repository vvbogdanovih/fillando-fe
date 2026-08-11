// SmoothScrollProvider is deliberately NOT re-exported here: it is mounted in the
// storefront root layout, and pulling it through this barrel would drag every other
// export — and with them motion/react — into the shared layout chunk.
// Import it from './SmoothScrollProvider' directly.
export { ScrollReveal } from './ScrollReveal'
export { StaggerGroup, StaggerItem } from './Stagger'
export { Parallax } from './Parallax'
export { MagneticButton } from './MagneticButton'
