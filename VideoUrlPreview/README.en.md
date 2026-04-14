# VideoUrlPreview

jQuery plugin to preview YouTube videos inside an `<iframe>` from a URL entered in an `<input>`.

## Requirements

- jQuery 3.x or higher
- An `<input>` with the `data-video-preview-target-frame` attribute
- A target `<iframe>`

## Installation

Include jQuery first, then the plugin:

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="./VideoUrlPreview.js"></script>
```

## Basic Usage

```html
<input
  type="text"
  data-role="video-preview"
  data-video-preview-target-frame="#previewFrame1"
  placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />

<iframe id="previewFrame1" allowfullscreen></iframe>
```

That is enough. The plugin initializes automatically when the DOM is ready.

## How It Works

- Reads the iframe selector from `data-video-preview-target-frame`.
- On `input` event: updates preview only when a valid YouTube ID is detected.
- On `change` event (blur/enter): if the value is invalid, clears the iframe `src`.
- If the input already has a value during initialization, it tries to render the preview.

## Automatic Initialization

The plugin auto-initializes on:

- `input[data-role="video-preview"]`
- `input[data-video-preview-target-frame]`

It also uses `MutationObserver` to initialize inputs added dynamically to the DOM.

## Manual Initialization (optional)

If you need to initialize a specific block manually:

```html
<script>
  $('#myInput').videoUrlPreview();
  // or by selector
  $('input[data-video-preview-target-frame]').videoUrlPreview();
</script>
```

## Supported URL Formats

Common YouTube URL formats are supported, for example:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

## Common Errors

- Missing `data-video-preview-target-frame`: throws an error.
- Selector not found: shows `console.warn`.
- Selector does not point to an `<iframe>`: throws an error.

## Demo

You can open the test file included in this project:

- `test-video-url-preview.html`
