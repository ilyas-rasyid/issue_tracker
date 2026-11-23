# IssueTrack — Design Direction (Frozen MVP)

**Product:** A public issue tracker for developers; not a SaaS marketing site or template dashboard.

## Art direction

- Function-first issue data. The board is a compact table, not a dashboard of unsupported KPI cards.
- **Balanced Compact:** 52px list rows; 40px desktop inputs; mobile primary controls at least 44px.
- Topbar navigation only. Detail uses content + 288px metadata column on desktop and a stacked layout on mobile.
- Primary `#4F46E5`, honest neutral surfaces, semantic status and priority colors. No gradients or neon/glow.
- Geist for UI; JetBrains Mono only for keys and code. Typography is restrained, contrast-tested, and easy to scan.
- System/Light/Dark; no color-only state and no motion that obscures content.
- Borders separate content. Cards are reserved for Kanban items, popovers, or specific containers; no generic card grids.

## Reject typical AI slop

- Purple-to-blue/aurora gradients; glass blur everywhere; giant hero copy; decorative illustrations with no purpose.
- Inflated 24–32px corner radii, stacked soft shadows, arbitrary badge palettes, emoji icons.
- Generic copy like “Supercharge your workflow”, fake testimonials or invented metrics.
- Blank/loading/error/empty states that are never designed or tested; dead buttons; unusable mobile overflow.
- Three identical feature cards or huge marketing banners in an application whose main task is issue discovery.
- Animation on every row or page transition; moving focus unexpectedly.

## Quality gate

Evaluate desktop 1440/1024, tablet 768, and mobile 390/320 widths; test Light and Dark; use keyboard only; measure real WCAG contrast. Check title overflow, long Markdown code, 5 image thumbnails, empty board, zero results, permission restrictions, Closed issues, and failed uploads. Every control must have a real action.

## Open GitHub references (research, not vendored code)

- https://github.com/nyrthoughts/anti-slop-design
- https://github.com/muris11/anti-ai-slop
- https://github.com/wpgaurav/design-slop

These repositories are inspiration for review criteria only. The visual language and application code are original for IssueTrack; their scripts/skills are not bundled or executed.
