# Логотипи брендів

Файли логотипів для чіпів виробників на сторінці прайс-листа (`/price-sheet`).

Очікувані файли (PNG або SVG з прозорим фоном, бажано висотою ~48–64px):

- `kingroon.png` — Kingroon
- `sunlu.png` — Sunlu
- `bambu-lab.png` — Bambu Lab

Шляхи задаються в `MANUFACTURERS` у `src/app/(root)/price-sheet/PriceSheet.tsx`.
Поки файл відсутній, чіп показує назву бренду текстом (fallback).
