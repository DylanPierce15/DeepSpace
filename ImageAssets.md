# Image Assets on Canvas

Images placed **on the canvas** are stored as `general-asset-image-{assetId}.json` files in the room directory. These are different from chat attachments.

---

## What you can see by default
- Metadata: filename, dimensions, mimeType (by reading the JSON file)
- That an image exists at a location

## What you CAN'T see without `inspect image`
- The actual visual content (pixels)

## When to use `inspect image {ASSET_ID}`
- User refers to an image **on the canvas** (e.g., "the chart I added", "that screenshot on my board")
- You need to understand visual content of a canvas asset to complete a task
- You see a `general-asset-image-*.json` and need to know what's depicted

## NOT needed for
- Images in `.chat-attachments/` — these are already provided in your conversation context
- Text/code content — use normal file reading

---

## Example
```bash
# Inspect the image (fetches and saves to .canvas-images/)
inspect image GM2wo-KippGsBKzYPvYv3

# Then read the saved image to view its contents
Read .canvas-images/GM2wo-KippGsBKzYPvYv3.png
```

