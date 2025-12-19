Place Windows icon files here for electron-builder.

- Recommended: convert `frontend/src/assets/logo-white.svg` to a 256x256 or 512x512 ICO named `icon.ico`.
- The repo includes a script `npm run icon:generate` that renders `logo-white.svg` to multiple PNGs and combines them into `build/icons/icon.ico`.

Example (ImageMagick):
  magick convert logo-white.svg -resize 256x256 build/icons/icon.ico
