# Juliet desktop-pet interaction pack

This package combines Juliet's corrected right-facing walk with a new stop, turn-to-user, talk, turn-back, and resume sequence.

## Animation states

- `walkRight`: eight-frame forward walk loop
- `turnToUser`: frames 1–4 of the turn-talk sheet
- `talkToUser`: frames 5–8, looped while a message is visible
- `turnBackRight`: play frames 4–1, then resume `walkRight`

Speech text is not baked into the sprites. The included manifest provides `"Hi!"` as an editable preview default; the application should render its own speech bubble and substitute any message at runtime.

## Technical details

- Both sprite sheets are 512 × 256 transparent RGBA PNGs
- 4 columns × 2 rows
- Eight 128 × 128 frames per sheet
- Anchor point: `(64, 120)`
- Six opaque colors plus full transparency
- Use nearest-neighbor scaling (`image-rendering: pixelated` on the web)

`juliet-animations.json` defines the state sequences and speech event. `juliet-interaction-preview.gif` demonstrates the complete walk, stop, turn, speak, turn-back, and resume behavior.
