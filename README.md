# devkit-lite

> Handy developer utilities: image generator, lorem text, colorful console

A lightweight TypeScript utility library providing essential developer tools for placeholder images, lorem ipsum text generation, and enhanced console logging.

## 📦 Installation

```bash
npm install devkit-lite
```

```bash
yarn add devkit-lite
```

```bash
pnpm add devkit-lite
```

## 🚀 Quick Start

```typescript
import { generateImg, generateParagraph, Console } from "devkit-lite";

// Generate placeholder image URL
const imageUrl = generateImg(123, 800, 600);
console.log(imageUrl); // https://picsum.photos/id/123/800/600

// Generate lorem ipsum text
const text = generateParagraph(50);
console.log(text); // Lorem ipsum dolor sit amet...

// Enhanced console logging
Console("User logged in successfully", "response");
Console({ userId: 123, name: "John" }, "info");
Console("Database connection failed", "error");
```

## 📚 API Reference

### `generateImg(id?, width?, height?)`

Generates a placeholder image URL using [Picsum Photos](https://picsum.photos).

**Parameters:**

- `id` (number, optional): Image ID. Defaults to a random number between 0-1000
- `width` (number, optional): Image width in pixels. Defaults to 400
- `height` (number, optional): Image height in pixels. Defaults to 300

**Returns:** `string` - Placeholder image URL

**Example:**

```typescript
// Random image with default size
const img1 = generateImg();

// Specific image with custom dimensions
const img2 = generateImg(237, 1920, 1080);
```

### `generateParagraph(wordCount?)`

Generates lorem ipsum placeholder text with the specified word count.

**Parameters:**

- `wordCount` (number, optional): Number of words to generate. Defaults to 20

**Returns:** `string` - Lorem ipsum text ending with a period

**Example:**

```typescript
// Generate 20 words (default)
const shortText = generateParagraph();

// Generate 100 words
const longText = generateParagraph(100);
```

### `Console(message, type?)`

Enhanced console logger with color-coded output and icons. Automatically hides logs in production environment.

**Parameters:**

- `message` (unknown): The message to log. Can be a string, object, array, or any value
- `type` (LogType, optional): Log type. Defaults to `'debug'`

**Log Types:**

- `'database'` - 🗄️ Blue for database operations
- `'response'` - ✅ Green for successful responses
- `'debug'` - 🐛 Yellow for debug messages
- `'info'` - ℹ️ Cyan for informational messages
- `'warn'` - ⚠️ Magenta for warnings
- `'error'` - ❌ Red for errors

**Returns:** `void`

**Note:** Logs are automatically suppressed when `NODE_ENV === 'production'`

**Example:**

```typescript
// String messages
Console("User created", "response");
Console("Invalid input", "error");
Console("Processing data...", "info");

// Object logging (automatically pretty-printed)
Console({ userId: 123, action: "login" }, "database");
Console([1, 2, 3, 4, 5], "debug");
```

## ✨ Features

- 🖼️ **Placeholder Images**: Quick access to placeholder images via Picsum Photos
- 📝 **Lorem Ipsum Generator**: Generate placeholder text of any length
- 🎨 **Colorful Console**: Enhanced console logging with colors, icons, and type safety
- 🚫 **Production Safe**: Console logs automatically disabled in production
- 📦 **TypeScript**: Full TypeScript support with type definitions
- 🌳 **Tree-shakeable**: Import only what you need
- ⚡ **Lightweight**: Minimal dependencies

## 🔧 Requirements

- Node.js 14+ (or any modern JavaScript runtime)
- TypeScript 4.5+ (for TypeScript projects)

## 📄 License

MIT © [Saurav Pandey](https://github.com/sauravpandey)

## 👤 Author

**Saurav Pandey**

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/devkit-lite/issues).

## ⭐ Show Your Support

If this project helped you, please give it a ⭐ on GitHub!
