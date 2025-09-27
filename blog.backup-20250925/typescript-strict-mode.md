---
title: 'The Night TypeScript Saved My Sanity (And My Weekend)'
slug: 'typescript-strict-mode'
excerpt: 'The story of how a 3 AM production disaster led me to embrace TypeScript strict mode, and why I will never write plain JavaScript again.'
author: 'TortoiseWolfe'
publishDate: 2025-10-04
status: 'published'
featured: false
categories:
  - TypeScript
  - Development
  - Best Practices
tags:
  - typescript
  - strict-mode
  - type-safety
  - development
readTime: 15
ogImage: '/blog-images/2025-10-04-typescript-strict-mode.png'
---

# The Night TypeScript Saved My Sanity (And My Weekend)

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Call That Changed Everything

3:17 AM on Friday night - well, technically Saturday morning, but when the angry buzz of a pager awakens you, technicalities don't matter. Furthermore, the bedroom was dark except for the evil red glow of my phone screen displaying the one notification every developer dreads: "PRODUCTION DOWN - CRITICAL."

My dog Nollie barely lifted her head from her bed, giving me a look that clearly said "again?" She knew the drill, as this marked the third time this month. I stumbled out of bed, nearly stepping over Nollie who had strategically positioned herself in the doorway, and made my way to my home office. The coffee maker wouldn't even get a chance to warm up – this was going to be an instant coffee kind of emergency.

As my desktop monitor flickered to life, I logged into our monitoring dashboard. Red. Everything was red. Error rates through the roof. Response times measured in geological timescales. And there, in the center of it all, the most infuriating error message in the history of JavaScript:

```
TypeError: Cannot read property 'name' of undefined
  at updateUser (user-service.js:147:42)
  at processQueue (queue-processor.js:89:15)
  at <anonymous>
```

Line 147. In a file with 2,847 lines. In a codebase with 10,000+ files. Finding this bug would be like finding a specific grain of sand on a beach. At night. During a hurricane.

I opened the offending file, scrolled to line 147, and there it was. The code that would haunt my dreams:

```javascript
// The innocent-looking disaster
function updateUser(user) {
  const updatedUser = {
    ...user,
    fullName: `${user.firstName} ${user.lastName}`,
    displayName: user.preferences.nickname || user.firstName,
    isAdmin: user.role.name === 'admin', // 💥 THIS LINE
    lastUpdated: Date.now(),
  };

  return saveToDatabase(updatedUser);
}
```

Someone, somewhere, had passed a user object without a role property. Subsequently, JavaScript, in its infinite wisdom, happily chugged along until it tried to read `name` from `undefined`. Then boom - production crashed, customers became angry, and my weekend vanished.

## The Investigation That Made Me Question Everything

After applying the emergency fix (a band-aid `user.role?.name` that made me die a little inside), I started investigating. How did this happen? Moreover, we had code reviews, tests, and senior developers with decades of experience.

I pulled up the git history and discovered the updateUser function had undergone 47 modifications in the past year. Additionally, each developer maintained slightly different assumptions about what a "user" object contained. Some assumed `role` was always present. Others assumed it might be null. One brave soul had added a comment: `// TODO: Figure out user object structure`.

That TODO was dated 3 months ago.

I spent the next four hours tracing through the codebase, finding every place we passed user objects around. The results were terrifying:

```javascript
// In authentication-service.js
function loginUser(email, password) {
  const user = findUserByEmail(email);
  // Returns user with 'role' property
  return user;
}

// In social-login.js
function oauthCallback(profile) {
  const user = {
    email: profile.email,
    firstName: profile.given_name,
    lastName: profile.family_name,
    // Oops, no 'role' property!
  };
  return createOrUpdateUser(user);
}

// In admin-panel.js
function impersonateUser(userId) {
  const user = getBasicUserInfo(userId);
  // Returns user WITHOUT role (for security)
  return user;
}
```

Three different functions created three different "user" shapes or interfaces. Furthermore, one shared updateUser function expected a specific type, yet zero compile-time type checking existed. Consequently, it was a miracle this hadn't exploded sooner.

## The Monday Morning Meeting That Changed Our Lives

Monday morning arrived with the entire engineering team assembled in the conference room, looking like extras from a zombie movie. The CTO started the meeting with four words that still echo in my mind: "This can't happen again."

Sarah from QA raised her hand. "We need more tests," she said. Tom from Backend suggested, "More code reviews." Someone in the back mumbled something about switching to Rust.

Then Jake, our newest junior developer, fresh out of bootcamp, said something that changed everything: "Why don't we use TypeScript with strict mode? My bootcamp instructor said it prevents exactly this kind of error."

The room fell silent, with only the fluorescent lights humming overhead. Moreover, the senior developers exchanged glances – that mixture of skepticism and curiosity that emerges when a junior developer suggests something that might actually be right about TypeScript's type safety and interfaces.

"Show us," said the CTO.

Jake opened his laptop, connected to the projector, and started typing:

```typescript
// TypeScript with strict mode enabled
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    name: string;
    permissions: string[];
  };
  preferences?: {
    // Optional!
    nickname?: string;
    theme?: string;
  };
}

function updateUser(user: User) {
  const updatedUser = {
    ...user,
    fullName: `${user.firstName} ${user.lastName}`,
    displayName: user.preferences?.nickname || user.firstName,
    isAdmin: user.role.name === 'admin', // TypeScript KNOWS this exists
    lastUpdated: Date.now(),
  };

  return saveToDatabase(updatedUser);
}

// Now try to break it:
const brokenUser = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  // Missing required properties!
};

updateUser(brokenUser);
// ❌ ERROR: Property 'id' is missing in type...
// ❌ ERROR: Property 'role' is missing in type...
```

The IDE lit up like a Christmas tree. Red squiggly lines everywhere. But here's the thing – those errors appeared WHILE TYPING. Not at runtime. Not in production. Not at 3 AM. Right there, in the editor, before the code could even be saved.

The room erupted. "But that's just interfaces," someone said. "We'd have to rewrite everything!" another protested. The discussion went on for two hours. But by the end, we had a decision: We were going TypeScript. Full strict mode. No exceptions.

## Our Journey to TypeScript Enlightenment

The migration started the next day. We didn't try to convert everything at once – that would have been insane. Instead, we took what I now call the "Gradually Typing" approach.

## Week 1: The TypeScript Denial Phase

```typescript
// What everyone wrote initially
function processOrder(order: any): any {
  // Just slap 'any' on everything!
  return doSomething(order);
}
```

I watched developers going through the stages of grief. Denial was strong in week one. "We'll just use `any` for now and fix it later," became the motto. The TypeScript compiler was happy. The code compiled. But we weren't getting any benefits.

Then I enabled `noImplicitAny` in our `tsconfig.json`:

```json
{
  "compilerOptions": {
    "noImplicitAny": true // The first step to recovery
  }
}
```

Suddenly, 2,341 errors appeared. The `any` escape hatch was sealed. Now we had to actually think about our types.

## Week 2: The TypeScript Anger Phase

```typescript
// The angry phase
function WHY_WONT_THIS_COMPILE(data: unknown) {
  // TypeScript won't let me do ANYTHING with unknown!
  return data.someProperty; // ERROR
}
```

Tom threw his mechanical keyboard. It survived (those things are built like tanks). Sarah started a Slack channel called #typescript-rage. It had 47 members by lunch.

But then something beautiful happened. People started understanding that TypeScript wasn't being mean – it was protecting us. That `unknown` type was forcing us to validate our data:

```typescript
function processApiResponse(data: unknown) {
  // TypeScript forces validation
  if (isValidUserResponse(data)) {
    // Now TypeScript KNOWS the shape
    return data.user.name; // No error!
  }
  throw new Error('Invalid API response');
}
```

## Week 3: The TypeScript Bargaining Phase

"What if we just use strict mode for NEW code?" someone suggested. "Can we disable it just for the legacy modules?" another pleaded.

We tried. Oh, how we tried. We had three different `tsconfig.json` files at one point:

- `tsconfig.strict.json` for new code
- `tsconfig.loose.json` for legacy code
- `tsconfig.medium.json` for code in transition

It was a disaster. Types from strict modules couldn't properly interact with loose modules. We were creating more problems than we were solving.

Finally, our tech lead made the call: "One config. Full strict. We do this right or not at all."

## Week 4: The TypeScript Acceptance Phase

And then it clicked. It was Tom who had the breakthrough first. He was refactoring the user service (yes, the same one that caused the 3 AM incident), and he discovered something amazing:

```typescript
// The old way - full of assumptions
function getFullName(user) {
  if (user && user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user && user.name) {
    return user.name;
  }
  return 'Unknown User';
}

// The TypeScript way - explicit and safe
interface UserWithFullName {
  firstName: string;
  lastName: string;
}

interface UserWithSingleName {
  name: string;
}

type AnyUser = UserWithFullName | UserWithSingleName;

function getFullName(user: AnyUser): string {
  if ('firstName' in user) {
    // TypeScript knows this is UserWithFullName
    return `${user.firstName} ${user.lastName}`;
  }
  // TypeScript knows this is UserWithSingleName
  return user.name;
}
```

No more defensive coding. No more null checks everywhere. TypeScript understood our intent and enforced it at compile time.

## The ScriptHammer Strict Mode Configuration

Fast forward to today. ScriptHammer ships with the strictest TypeScript configuration we could create. Every single flag that could catch a bug is enabled. Let me show you what we're running in production right now:

Check out `/tsconfig.json` in our codebase:

```json
{
  "compilerOptions": {
    // The nuclear option - enables everything below
    "strict": true,

    // No more "Cannot read property of undefined"
    "strictNullChecks": true,

    // Function signatures must match exactly
    "strictFunctionTypes": true,

    // No more wrong 'this' context
    "strictBindCallApply": true,

    // Class properties must be initialized
    "strictPropertyInitialization": true,

    // No implicit 'any' types
    "noImplicitAny": true,

    // 'this' must have explicit type
    "noImplicitThis": true,

    // JavaScript 'use strict' in every file
    "alwaysStrict": true,

    // Bonus strictness we added
    "noUncheckedIndexedAccess": true, // arr[0] might be undefined!
    "noImplicitReturns": true, // All code paths must return
    "noFallthroughCasesInSwitch": true, // No accidental switch fallthrough
    "noUnusedLocals": true, // No unused variables
    "noUnusedParameters": true, // No unused function params
    "exactOptionalPropertyTypes": true // undefined !== missing
  }
}
```

This configuration has caught literally hundreds of bugs before they could reach production. Want to see it in action? Open up any component in [Storybook](http://localhost:6006) and try to break it. You can't. TypeScript won't let you.

## Real Examples From Our Codebase

## The Form Validation That Just Works with TypeScript

Check out our contact form at [/contact](/contact). The entire form is type-safe from the UI to the API:

```typescript
// See: /src/components/atomic/ContactForm/ContactForm.tsx
interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  honeypot?: string; // Anti-spam field
}

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message too short'),
  honeypot: z.string().optional(),
});

// TypeScript infers the type from the schema!
type ValidatedFormData = z.infer<typeof contactSchema>;
// Guaranteed to match ContactFormData interface
```

When you submit that form, TypeScript ensures every field is validated, every error is handled, and every success response is properly typed. You can see this in action in the [ContactForm Storybook story](http://localhost:6006/?path=/story/atomic-contactform--default).

## The Theme System That Never Breaks (Thanks to TypeScript)

Navigate to [/themes](/themes) and try switching between our 32 themes. Each theme change triggers a cascade of type-checked operations:

```typescript
// See: /src/contexts/ThemeContext.tsx
type ThemeName =
  | 'light'
  | 'dark'
  | 'cupcake'
  | 'bumblebee'
  | 'emerald'
  | 'corporate'
  | 'synthwave'
  | 'retro';
// ... 24 more themes

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  systemPreference: 'light' | 'dark' | null;
  isLoading: boolean;
}

// Try to set invalid theme? TypeScript says no:
setTheme('invalid-theme');
// ❌ Argument of type '"invalid-theme"' is not assignable to parameter
```

Every theme name is type-checked. Every theme switch is validated. You literally cannot set an invalid theme. The [ThemeSelector component in Storybook](http://localhost:6006/?path=/story/atomic-themeselector--default) demonstrates this perfectly.

## The TypeScript API Client That Handles Every Edge Case

Our API client knows exactly what it's fetching and what it might return:

```typescript
// See: /src/utils/api-client.ts
type ApiResponse<T> =
  | { success: true; data: T; timestamp: number }
  | { success: false; error: string; code: number };

async function fetchBlogPosts(): Promise<ApiResponse<BlogPost[]>> {
  try {
    const response = await fetch('/api/blog/posts');

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        code: response.status,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: validateBlogPosts(data), // Runtime validation
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 500,
    };
  }
}

// Using it is foolproof:
const result = await fetchBlogPosts();
if (result.success) {
  // TypeScript KNOWS result.data exists and is BlogPost[]
  console.log(`Fetched ${result.data.length} posts`);
  result.data.forEach((post) => {
    // Full intellisense for post properties!
    console.log(post.title, post.publishDate);
  });
} else {
  // TypeScript KNOWS result.error and result.code exist
  console.error(`Failed with ${result.code}: ${result.error}`);
}
```

## The Superpowers You Didn't Know You Needed

## TypeScript Superpower #1: Fearless Refactoring

Last month, we needed to rename `userId` to `id` across our entire codebase. In the JavaScript days, this would have been a week-long project with inevitable bugs. With TypeScript:

1. Changed the interface property
2. TypeScript showed 147 errors
3. Fixed each error (took 2 hours)
4. Deployed with confidence
5. Zero bugs reported

Want to try it yourself? Open `/src/types/user.ts`, change any property name, and watch TypeScript immediately show you every place that needs updating.

## TypeScript Superpower #2: Self-Documenting Code

Hover over any function in our codebase. Go ahead, try it in VS Code:

```typescript
// Hover over this function in VS Code
function calculateShippingCost(
  items: CartItem[],
  destination: Address,
  options?: ShippingOptions
): PriceBreakdown {
  // Implementation
}

// VS Code shows:
// function calculateShippingCost(
//   items: CartItem[],          <- Click to see shape
//   destination: Address,        <- Click to see properties
//   options?: ShippingOptions    <- Optional, click for options
// ): PriceBreakdown             <- Click to see what's returned
```

No more diving into documentation. No more console.logging to see object shapes. The types ARE the documentation.

## TypeScript Superpower #3: Catching Typos Before They Cost Money

Remember that $50,000 typo story? Here's a real example from our codebase:

```typescript
// The status type that saves us daily
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
}

function processOrder(order: Order) {
  if (order.status === 'payed') {
    // <-- TYPO!
    // ❌ TypeScript ERROR:
    // This condition will always return 'false' since
    // the types 'OrderStatus' and '"payed"' have no overlap
  }
}
```

TypeScript catches the typo immediately. In the IDE. Before commit. Before code review. Before production. Before your weekend gets ruined.

## TypeScript Superpower #4: The Autocomplete That Knows Everything

Start typing in our codebase and watch the magic:

```typescript
const user = getCurrentUser();
user.  // <-- TypeScript shows EVERYTHING available

// IntelliSense menu appears:
// ├── id: number
// ├── email: string
// ├── profile: UserProfile
// │   ├── firstName: string
// │   ├── lastName: string
// │   ├── avatar?: string
// │   └── bio?: string
// ├── settings: UserSettings
// │   ├── theme: ThemeName
// │   ├── notifications: NotificationPrefs
// │   └── privacy: PrivacySettings
// └── createdAt: Date
```

No more guessing. No more documentation diving. The IDE knows exactly what's available and guides you to it.

## The Tests That Write Themselves

Look at our test coverage in `/src/tests`. Notice something? The tests are incredibly simple:

```typescript
// See: /src/components/atomic/Button/Button.test.tsx
describe('Button Component', () => {
  it('should handle click events', () => {
    const handleClick = vi.fn();
    const { getByRole } = render(
      <Button onClick={handleClick}>Click me</Button>
    );

    fireEvent.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

No defensive checks. No "what if onClick is null" tests. TypeScript won't let you pass null to a required prop. The type system eliminates entire categories of tests.

Want to see more? Check out the Button component's type definitions in [Storybook](http://localhost:6006/?path=/story/atomic-button--all-variants). Try passing invalid props in the controls panel. You can't. The types prevent it.

## The Migration Path: Your Journey to Type Safety

Ready to join us in TypeScript strict mode land? Here's the exact path we took:

## Step 1: Start With Understanding Your TypeScript Pain

```bash
# See how many potential bugs you have
docker compose exec scripthammer npx typescript --init
docker compose exec scripthammer npx tsc --noEmit --allowJs

# You'll see something like:
# Found 2,847 errors
```

Don't panic! That's normal. We had over 3,000 errors on day one.

## Step 2: Enable Gradual TypeScript Adoption

```json
// tsconfig.json - Start gentle
{
  "compilerOptions": {
    "allowJs": true, // Allow .js files
    "checkJs": false, // Don't check them yet
    "strict": false, // Not ready for strict
    "noImplicitAny": false // Allow implicit any for now
  }
}
```

## Step 3: Convert to TypeScript File by File

```bash
# Pick your easiest file first
mv utils/constants.js utils/constants.ts

# Fix the errors in just that file
docker compose exec scripthammer npx tsc --noEmit utils/constants.ts

# Commit when green
git add utils/constants.ts
git commit -m "Convert constants to TypeScript"
```

## Step 4: Gradually Increase TypeScript Strictness

```json
// Week 2: Enable noImplicitAny
"noImplicitAny": true

// Week 3: Enable strictNullChecks
"strictNullChecks": true

// Week 4: Go full strict
"strict": true
```

## Step 5: Celebrate Your New TypeScript Superpower

The day you enable full strict mode is the day you stop worrying about runtime type errors. Forever.

## The Stories From the Trenches

## Sarah's Story: "The QA Engineer Who Became a TypeScript Evangelist"

Sarah was our biggest TypeScript skeptic. She had this sign on her desk: "Dynamic Types = Creative Freedom." Then she discovered that TypeScript had eliminated 73% of the bugs she usually found in QA.

"I used to spend hours writing test cases for null checks, undefined properties, wrong types being passed around," she told me over coffee last week. "Now I test actual business logic. TypeScript handles the boring stuff. I've actually had to find new types of bugs to justify my existence!"

She now has a new sign: "TypeScript: Making QA Engineers Find Real Bugs Since 2012."

## Tom's Story: "The Backend Developer Who Stopped Hating Frontend with TypeScript"

Tom was a backend Java developer who got "voluntold" to help with frontend work. He hated JavaScript with a passion that bordered on religious.

"JavaScript felt like coding with my eyes closed," he explained. "I'd write something, pray it worked, then spend hours debugging when it didn't. TypeScript feels like Java but better. The types are there when I need them, invisible when I don't."

Tom now leads our frontend architecture team. He even gave a conference talk titled "TypeScript: The Gateway Drug to Functional Programming."

## My Story: "The 3 AM TypeScript Survivor"

Remember that 3 AM incident? It never happened again. Not once. In the few weeks since we went full strict mode:

- Zero runtime type errors in production
- 94% reduction in "Cannot read property of undefined" errors
- 6 hours average sleep on weekends (up from 4)
- 1 dog who no longer gives me disappointed looks at 3 AM

Last week, I tried to help a friend debug their JavaScript project. After 30 minutes, I gave up and said, "Just add TypeScript. Trust me." They called me yesterday to thank me. Their exact words: "How did we ever live without this?"

## The Gotchas We Learned the Hard Way

## TypeScript Gotcha #1: The any Trap

```typescript
// The temptation is real
function quickFix(data: any) {
  // TypeScript gives up
  return data.whatever.you.want.no.checking;
}
```

We instituted a rule: Every `any` requires a comment explaining why and a TODO to fix it. Our `any` count went from 500 to 12 in three weeks.

## TypeScript Gotcha #2: The Type Assertion Lie

```typescript
// The dangerous cast
const user = {} as User; // TypeScript trusts you
console.log(user.name); // Runtime error!
```

Type assertions are lies you tell TypeScript. We only use them when interfacing with external libraries, and always with runtime validation.

## TypeScript Gotcha #3: The Optional Property Confusion

```typescript
interface Config {
  apiUrl?: string; // Optional
}

const config: Config = {};
fetch(config.apiUrl); // TypeScript allows this!
// But config.apiUrl is undefined
```

We learned to use required properties with union types instead:

```typescript
interface Config {
  apiUrl: string | null; // Explicit about missing
}
```

## Your First Day With TypeScript Strict Mode

Want to experience the magic yourself? Here's a challenge:

1. Clone ScriptHammer:

```bash
git clone https://github.com/TortoiseWolfe/ScriptHammer.git
cd ScriptHammer
```

2. Try to break something:

```bash
docker compose exec scripthammer code src/components/atomic/Button/Button.tsx
# Try removing the required 'children' prop type
# Watch TypeScript immediately complain
```

3. Check out the Storybook types:

```bash
docker compose exec scripthammer pnpm run storybook
# Open http://localhost:6006
# Look at the Controls panel - everything is type-safe!
```

4. Write your first strict mode component:

```bash
docker compose exec scripthammer pnpm run generate:component MyComponent
# The generator creates a fully-typed component
# Try to use it wrong - you can't!
```

## The Bottom Line: Sleep Is Worth More Than Dynamic Types

Here's what TypeScript strict mode means in real terms:

**Before TypeScript:**

- 3 AM wake-up calls: 3-4 per month
- Debugging "undefined" errors: 15 hours/month
- Refactoring confidence: 30%
- Runtime errors in production: 47/month
- Developer happiness: 4/10

**After TypeScript Strict Mode:**

- 3 AM wake-up calls: 0
- Debugging type errors: 0 hours/month
- Refactoring confidence: 95%
- Runtime type errors in production: 0
- Developer happiness: 9/10

The 1-point deduction in happiness? The red squiggly lines when you're first learning. But those red squiggles are your friends. They're saving you from future pain.

## The Truth About the Red Squiggles

Yes, TypeScript will yell at you. A lot. At first, it feels like having a backseat driver who won't shut up. But here's the secret: every red squiggle is a bug that won't make it to production. Every TypeScript error is a future 3 AM call that won't happen.

I've started thinking of TypeScript errors as a time machine. Each error is future-you traveling back to prevent present-you from ruining future-you's weekend.

## Join the Type-Safe Revolution

ScriptHammer ships with TypeScript strict mode enabled by default. Every component is fully typed. Every API call is validated. Every possible null is handled. Every typo is caught.

Check it out yourself:

- Browse our typed components in [Storybook](http://localhost:6006)
- See the type safety in action on our [Contact Form](/contact)
- Watch how themes work with type checking at [/themes](/themes)
- Read the actual TypeScript config at `/tsconfig.json`

Because life's too short for runtime type errors.

And weekends are too precious to waste on preventable bugs.

---

_P.S. - That user object that caused the 3 AM incident? It's now fully typed with 17 required properties and 6 optional ones. It hasn't caused a single error since. I sleep soundly knowing it never will again._

_P.P.S. - If you're still using `any` everywhere, you're not using TypeScript. You're using JavaScript with extra steps. Enable strict mode. Thank yourself later._

_P.P.P.S. - Yes, the learning curve is steep. Yes, the red squiggles are annoying. Yes, you'll fight with the compiler. Do it anyway. Your future self will send you a thank-you note. Mine did. It was delivered at 3:17 AM on a Saturday - the exact time I would have been debugging, but instead was sleeping peacefully._
