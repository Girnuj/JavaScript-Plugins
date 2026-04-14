# ImgUploadPreview

jQuery plugin to preview images in an `<img>` from an `<input type="file">`.

## Requirements

- jQuery 3.x or higher
- An `<input>` with the `data-img-upload-preview-target` attribute
- A target `<img>`

## Installation

Include jQuery first, then the plugin:

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="./imgUploadPreview.js"></script>
```

## Basic Usage

```html
<input
  type="file"
  accept="image/*"
  data-img-upload="input"
  data-img-upload-preview-target="#imgPreview1" />

<img id="imgPreview1" alt="Preview" />
```

That is enough. The plugin initializes automatically when the DOM is ready.

## How It Works

- Reads the `<img>` selector from `data-img-upload-preview-target`.
- On `change`, takes the selected file and generates a preview using `FileReader`.
- If no file is selected, clears the `<img>` `src`.
- If the file does not pass type or size validation, clears preview and resets the input.

## Validations

The plugin includes internal validations:

- Allowed MIME type (`allowedMimeTypes`)
- Maximum file size (`maxFileSize`)

Defaults:

- `allowedMimeTypes`: `['image/jpeg', 'image/png', 'image/webp', 'image/gif']`
- `maxFileSize`: `2 * 1024 * 1024` (2 MB)

These options can be customized as needed. They provide reliable plugin-level validation and complement `accept="image/*"` on the input.

## Options (customizable)

```html
<script>
  $('#myInput').imgUploadPreview({
    targetItemSelector: '#imgPreview1',
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    maxFileSize: 5 * 1024 * 1024 // 5 MB
  });
</script>
```

## Automatic Initialization

The plugin auto-initializes on:

- `input[data-img-upload="input"]`
- `input[data-img-upload-preview-target]`

It also uses `MutationObserver` to initialize inputs added dynamically to the DOM.

## Manual Initialization (optional)

If you need to initialize a specific block manually:

```html
<script>
  $('#myInput').imgUploadPreview();
  // or by selector
  $('input[data-img-upload-preview-target]').imgUploadPreview();
</script>
```

## Common Errors

- Missing `data-img-upload-preview-target`: throws an error.
- Selector not found: shows `console.warn`.
- Selector does not point to an `<img>`: throws an error.

## Demo

You can open the test file included in this project:

- `test-img-upload-preview.html`
