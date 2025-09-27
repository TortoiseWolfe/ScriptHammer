# Data Model: E2E Testing Framework

## Core Entities

### 1. Page Objects

#### BasePage

```typescript
abstract class BasePage {
  protected page: Page;
  protected baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL || 'http://localhost:3000/CRUDkit';
  }

  async navigate(path: string = ''): Promise<void> {
    await this.page.goto(`${this.baseURL}${path}`);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  async getTheme(): Promise<string> {
    return (await this.page.getAttribute('html', 'data-theme')) || 'light';
  }
}
```

#### HomePage

```typescript
class HomePage extends BasePage {
  // Selectors
  private readonly themeSwicherButton = '[data-testid="theme-switcher"]';
  private readonly heroTitle = 'h1:has-text("CRUDkit")';
  private readonly gameDemo = '#game-demo';
  private readonly skipLink = 'a[href="#game-demo"]';
  private readonly progressBadge = '.badge.badge-success';

  async clickThemeSwitcher(): Promise<void> {
    await this.page.click(this.themeSwicherButton);
  }

  async getProgress(): Promise<string> {
    return (await this.page.textContent(this.progressBadge)) || '0%';
  }

  async playDiceGame(): Promise<void> {
    const game = this.page.locator(this.gameDemo);
    await game.locator('button:has-text("Roll")').click();
  }

  async navigateToComponents(): Promise<void> {
    await this.page.click('a[href="/components"]');
  }
}
```

#### ThemePage

```typescript
class ThemePage extends BasePage {
  private readonly themeGrid = '.grid';
  private readonly themeCard = '.card';
  private readonly searchInput = 'input[placeholder*="Search"]';

  async selectTheme(themeName: string): Promise<void> {
    await this.page.click(`[data-theme="${themeName}"]`);
  }

  async searchTheme(query: string): Promise<void> {
    await this.page.fill(this.searchInput, query);
  }

  async getAvailableThemes(): Promise<string[]> {
    return await this.page.$$eval('[data-theme]', (elements) =>
      elements.map((el) => el.getAttribute('data-theme')).filter(Boolean)
    );
  }

  async verifyThemePersistence(theme: string): Promise<boolean> {
    await this.page.reload();
    const currentTheme = await this.getTheme();
    return currentTheme === theme;
  }
}
```

### 2. Test Fixtures

#### UserFixture

```typescript
interface UserFixture {
  name: string;
  email: string;
  message?: string;
  preferences?: {
    theme?: string;
    fontSize?: 'small' | 'medium' | 'large';
    spacing?: 'compact' | 'normal' | 'relaxed';
  };
}

const testUsers: UserFixture[] = [
  {
    name: 'Test User',
    email: 'test@example.com',
    message: 'This is a test message',
    preferences: {
      theme: 'dark',
      fontSize: 'medium',
      spacing: 'normal',
    },
  },
  {
    name: 'Mobile User',
    email: 'mobile@example.com',
    preferences: {
      theme: 'synthwave',
      fontSize: 'large',
      spacing: 'relaxed',
    },
  },
];
```

#### ThemeFixture

```typescript
interface ThemeFixture {
  name: string;
  type: 'light' | 'dark';
  primary: string;
  secondary: string;
  accent: string;
}

const themes: ThemeFixture[] = [
  {
    name: 'light',
    type: 'light',
    primary: '#570df8',
    secondary: '#f000b8',
    accent: '#37cdbe',
  },
  {
    name: 'dark',
    type: 'dark',
    primary: '#793ef9',
    secondary: '#f000b8',
    accent: '#37cdbe',
  },
  {
    name: 'synthwave',
    type: 'dark',
    primary: '#e779c1',
    secondary: '#58c7f3',
    accent: '#f3cc30',
  },
  // ... all 32 themes
];
```

### 3. Test Configuration

#### PlaywrightConfig

```typescript
interface TestConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  workers: number;
  projects: BrowserProject[];
  reporter: ReporterConfig[];
  use: UseOptions;
}

interface BrowserProject {
  name: string;
  use: {
    browserName: 'chromium' | 'firefox' | 'webkit';
    viewport?: { width: number; height: number };
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
  };
}

interface UseOptions {
  actionTimeout: number;
  navigationTimeout: number;
  screenshot: 'only-on-failure' | 'off' | 'on';
  video: 'retain-on-failure' | 'off' | 'on';
  trace: 'on-first-retry' | 'off' | 'on';
}
```

### 4. Test Reports

#### TestResult

```typescript
interface TestResult {
  testId: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  browser: string;
  error?: {
    message: string;
    stack: string;
    screenshot?: string;
    video?: string;
    trace?: string;
  };
  steps: TestStep[];
  annotations: TestAnnotation[];
}

interface TestStep {
  title: string;
  duration: number;
  error?: Error;
}

interface TestAnnotation {
  type: 'skip' | 'fail' | 'slow' | 'fixme';
  description?: string;
}
```

#### TestReport

```typescript
interface TestReport {
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  browsers: string[];
  results: TestResult[];
  config: TestConfig;
  artifacts: {
    screenshots: string[];
    videos: string[];
    traces: string[];
    reports: string[];
  };
}
```

### 5. PWA Test Models

#### PWACapabilities

```typescript
interface PWACapabilities {
  manifest: {
    name: string;
    short_name: string;
    display: 'standalone' | 'fullscreen' | 'minimal-ui';
    theme_color: string;
    background_color: string;
    icons: Array<{
      src: string;
      sizes: string;
      type: string;
      purpose?: string;
    }>;
  };
  serviceWorker: {
    registered: boolean;
    scope: string;
    updateViaCache: 'imports' | 'all' | 'none';
  };
  installPrompt: {
    available: boolean;
    outcome: 'accepted' | 'dismissed' | null;
  };
  offline: {
    cachesPages: boolean;
    showsOfflineUI: boolean;
    backgroundSync: boolean;
  };
}
```

### 6. Accessibility Test Models

#### AccessibilityViolation

```typescript
interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary: string;
  }>;
}

interface AccessibilityReport {
  url: string;
  timestamp: Date;
  passes: number;
  violations: AccessibilityViolation[];
  incomplete: AccessibilityViolation[];
  inapplicable: number;
}
```

## Data Flow

### Test Execution Flow

```
1. Load Configuration
   → playwright.config.ts
   → Environment variables
   → Command line arguments

2. Initialize Test Context
   → Create browser context
   → Set viewport/device
   → Configure network conditions

3. Execute Test Scenarios
   → Navigate to page
   → Perform actions
   → Assert expectations
   → Capture artifacts

4. Generate Reports
   → Collect results
   → Process artifacts
   → Format output
   → Upload to storage
```

### Data Persistence

#### Local Storage

- Theme preferences
- User settings
- Game state
- Form data

#### Session Storage

- Temporary UI state
- Navigation history
- Search filters

#### Cookies

- Authentication tokens
- Consent preferences
- Analytics flags

## Validation Rules

### Page Load Validation

- DOM ready state
- Network idle (no pending requests)
- No console errors
- Required elements visible

### Form Validation

- Required fields present
- Email format valid
- Message length constraints
- Error messages displayed

### Theme Validation

- Theme attribute set on HTML
- CSS variables updated
- LocalStorage persisted
- Visual changes applied

### PWA Validation

- Manifest accessible
- Service worker active
- Cache populated
- Offline navigation works

## Performance Constraints

### Timing Thresholds

- Page load: < 3 seconds
- Theme switch: < 500ms
- Form submission: < 2 seconds
- PWA install: < 5 seconds

### Resource Limits

- Screenshot size: < 5MB
- Video size: < 50MB
- Trace size: < 100MB
- Total artifacts: < 500MB

### Concurrency Limits

- Max workers: 4
- Max retries: 2
- Max test duration: 30s
- Max suite duration: 5min
