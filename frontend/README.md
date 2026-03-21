# Letsee Frontend - Developer Guide

## Overview

The Letsee frontend is a vanilla JavaScript application for hotel staff shift management. It features a modular architecture, responsive design, and comprehensive security measures.

## Architecture

```
frontend/
├── index.html              # Main application page
├── login.html              # Login/registration page
├── schedule.html           # Schedule management page
├── js/
│   ├── api.js              # REST API client
│   ├── auth.js             # Authentication logic (in login.js)
│   ├── error-handler.js    # Global error handling
│   ├── store.js            # State management
│   ├── utils.js            # Utility functions
│   ├── people.js           # Staff management module
│   ├── schedule.js         # Schedule management
│   ├── script.js           # Main application logic
│   └── login.js            # Login page logic
├── css/
│   ├── style.css           # Main stylesheet (imports modules)
│   └── modules/
│       ├── base.css        # Base styles, CSS variables, resets
│       ├── shell.css       # Layout, header, navigation
│       ├── handover.css    # Handover notes styles
│       ├── modal.css       # Modal dialogs
│       ├── schedule.css    # Schedule calendar
│       └── people.css      # Staff management
├── package.json            # NPM package configuration
├── .eslintrc.json          # ESLint configuration
├── .prettierrc.json        # Prettier configuration
└── .editorconfig           # EditorConfig settings
```

## Getting Started

### Prerequisites

- Node.js 18+ (for development tools)
- Python 3.8+ (for simple HTTP server)
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

```bash
cd frontend

# Install development dependencies (ESLint, Prettier)
npm install
```

### Running Locally

```bash
# Using the npm script
npm run dev

# Or manually
python -m http.server 3000
```

Then open **http://localhost:3000** in your browser.

### Development Commands

```bash
# Lint JavaScript files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting (CI/CD)
npm run format:check

# Run all checks
npm run check
```

## Code Quality

### ESLint Configuration

The project uses ESLint with the following rules:
- ES2021+ syntax support
- Browser environment globals
- No implicit globals
- Prefer `const`/`let` over `var`
- Require `===` instead of `==`
- No eval() or implied eval()

### Prettier Configuration

Code formatting is automated with Prettier:
- 100 character line length
- 2 space indentation
- Single quotes
- Trailing commas (ES5 compatible)
- Semicolons required

### EditorConfig

Consistent editor settings across all contributors:
- UTF-8 encoding
- LF line endings
- 2 space indentation
- Trim trailing whitespace
- Final newline at end of files

## Security

### XSS Prevention

All user input is sanitized before display:

```javascript
// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Sanitize user input
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}
```

### Input Validation

All user inputs are validated:
- Email format validation
- Password strength requirements (min 8 characters)
- Name sanitization (max 100 chars, no HTML)

### Error Handling

Global error handler catches and reports errors:

```javascript
// Automatically initialized
window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', handleRejection);
```

## State Management

Simple reactive state management:

```javascript
// Subscribe to state changes
const unsubscribe = Store.subscribe((state, oldState) => {
  console.log('State changed:', state);
});

// Update state
Store.setState({ isLoading: true });

// Get state
const people = Store.getState('people');

// Unsubscribe
unsubscribe();
```

## Modules

### api.js

REST API client with authentication:

```javascript
// Auto-includes JWT token in requests
const people = await PeopleAPI.list();
const person = await PeopleAPI.get(id);
await PeopleAPI.create(name, color);
await PeopleAPI.update(id, name, color);
await PeopleAPI.delete(id);
```

### utils.js

Utility functions:
- `escapeHtml(text)` - XSS prevention
- `sanitizeInput(input)` - Input sanitization
- `showAlert(title, message)` - Show alert modal
- `showConfirm(title, message, callback)` - Confirmation dialog
- `generateUUID()` - Generate unique IDs
- `formatDate(date)` - Format dates
- `formatTime(date)` - Format times
- `debounce(func, wait)` - Debounce functions
- `isInViewport(element)` - Check visibility

### people.js

Staff management module:
- `initPersonColorPicker()` - Initialize color picker
- `selectPersonColor(color)` - Select color
- `resetPersonForm()` - Reset form
- `startPersonEdit(id)` - Start editing
- `savePerson()` - Create/update person
- `deletePerson(id, name)` - Delete person
- `renderPeopleList()` - Render list
- `openPeopleModal()` - Open modal
- `closePeopleModal()` - Close modal

### store.js

State management:
- `Store.subscribe(listener)` - Subscribe to changes
- `Store.setState(newState)` - Update state
- `Store.getState(key)` - Get state value
- `Store.reset()` - Reset to initial state
- `Store.setLoading(loading)` - Set loading state
- `Store.setError(error)` - Set error state

### error-handler.js

Error handling:
- `initErrorHandler()` - Initialize handlers
- `showGlobalError(message)` - Show error to user
- `logError(error)` - Log error for debugging
- `reportError(error, context)` - Report error manually

## Responsive Design

### Breakpoints

- Mobile: < 640px
- Tablet: < 768px
- Desktop: < 1024px
- Large Desktop: ≥ 1024px

### Mobile Optimizations

- Header wraps to multiple rows
- Less important elements hidden
- Touch-friendly button sizes
- Modal dialogs use full width
- Print styles remove UI elements

### CSS Variables

Consistent theming with CSS variables:

```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
}
```

## Accessibility

### ARIA Labels

All interactive elements have proper ARIA labels:

```html
<button aria-label="Edit staff member">
  <svg>...</svg>
</button>
```

### Keyboard Navigation

- Tab key navigates through interactive elements
- Enter/Space activate buttons
- Escape closes modals
- Arrow keys for date picker

### Focus Management

- Modals trap focus while open
- Focus restored when modals close
- Visible focus indicators

## Testing

### Manual Testing Checklist

- [ ] Login/logout works
- [ ] Registration works
- [ ] Staff CRUD operations work
- [ ] Schedule editing works
- [ ] Handover notes CRUD works
- [ ] Search and filtering work
- [ ] Theme toggle works
- [ ] Responsive design on mobile
- [ ] Error handling (network errors, invalid input)

### Browser Compatibility

Tested on:
- Chrome (latest)
- Firefox (latest)
- Edge (latest)
- Safari (latest)

## Deployment

### Production Build

No build step required - vanilla JavaScript runs directly in browser.

### Nginx Configuration

See `nginx.conf` in project root for production configuration.

### CDN

Google Fonts are loaded from CDN with preconnect for performance.

## Troubleshooting

### Common Issues

**"API_BASE is not defined"**
- Ensure api.js is loaded before other scripts

**"Store is not defined"**
- Ensure store.js is loaded before other scripts

**"showAlert is not defined"**
- Ensure utils.js is loaded

**Styles not loading**
- Check CSS import order in style.css
- Verify CSS modules exist

### Debugging

```javascript
// Enable debug logging
console.log('Current state:', Store.getState());

// Check for errors
console.log('Recent errors:', getRecentErrors());

// Clear error log
clearErrorLog();
```

## Contributing

1. Install dependencies: `npm install`
2. Make changes
3. Run linting: `npm run lint`
4. Run formatting: `npm run format`
5. Test manually in browser
6. Commit changes

### Code Style

- Use JSDoc for documentation
- Prefer `const` over `let`
- Use template literals for strings
- Use async/await for async code
- Add error handling to all async operations
- Sanitize all user input

## Future Improvements

- [ ] Add TypeScript for type safety
- [ ] Implement virtual scrolling for large lists
- [ ] Add service worker for offline support
- [ ] Implement web workers for heavy computations
- [ ] Add unit tests with Jest
- [ ] Add E2E tests with Playwright
- [ ] Implement code splitting
- [ ] Add lazy loading for modules

## License

MIT License - See LICENSE file for details.
