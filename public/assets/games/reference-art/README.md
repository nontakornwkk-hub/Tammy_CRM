# Paw wheel reference artwork

Created with the built-in image_gen tool after the user explicitly authorized using image artwork. These five versioned WebP assets are the selected project deliverables; generated originals remain in the tool's default folder. Alpha was inspected before integration. shop.webp is opaque; pets.webp, frame.webp, icons.webp and title.webp preserve alpha. No reference screenshot, buttons or account values are baked into the playable page.

| File | Purpose |
|---|---|
| shop.webp | Background shop |
| pets.webp | Separate left dog and right kitten/crate via runtime clipping |
| frame.webp | Stationary rim, pointer, central paw and base |
| icons.webp | Dynamic prize atlas, 1536x1024 with six 512px cells |
| title.webp | Default game title; renamed games use live text |

## Final prompt set (built-in image_gen)

### shop

Preserve the reference's warm cinematic wooden pet shop; remove HUD, title, progress, wheel, pets, controls and navigation; reconstruct the hidden shop and floor.

### pets

Extract reference golden retriever in blue paw bandana at left and grey-white kitten in green bandana on a wooden crate at right; transparent 3:2 layer, separate full bodies, empty center.

### frame

Extract polished gold circular rim, bulbs, paw pointer, stationary center paw medallion and navy/gold pedestal. Transparent prize interior, no pets or UI, portrait 4:5.

### icons

Create transparent 3x2 equal-cell atlas from reference: coins, percent coupon, pet-food bag; green treat tin, blue-ribbon gift, bone/paw biscuit.

### title

Extract exact Thai wording วงล้ออุ้งเท้า with puffy gold letters, sculpted blue backing, paws and bell; transparent 3:1 sprite.


The live SVG rotor reads the configured prize count, colors, titles/values and optional uploaded pictures. Only that rotor turns; the illustrated frame and center paw are outside its transform. Server-confirmed results determine the stopping angle. Character motion honors reduced motion. Member bottom navigation is unchanged.
