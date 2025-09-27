---
title: 'Zod: Type-Safe Validation That Developers Love'
slug: 'zod-form-validation'
excerpt: 'Runtime validation that matches your TypeScript types. No more validation bugs.'
author: 'TortoiseWolfe'
publishDate: 2025-11-09
status: 'published'
featured: false
categories:
  - Forms
  - TypeScript
  - Validation
tags:
  - zod
  - validation
  - forms
  - typescript
  - type-safety
readTime: 8
ogImage: '/blog-images/2025-11-09-zod-form-validation.png'
---

# Zod: Type-Safe Validation That Developers Love

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Validation Nightmare 😱

```javascript
// The old way
if (!email || !email.includes('@')) {
  errors.email = 'Invalid email';
}
if (!age || age < 18 || age > 99) {
  errors.age = 'Must be 18-99';
}
if (password.length < 8) {
  errors.password = 'Too short';
}
// 100 more lines of this...
```

Enter Zod. Validation becomes beautiful.

## Zod in 30 Seconds ✨

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18).max(99),
  password: z.string().min(8),
});

// Validate
const result = UserSchema.parse(data);
// Done. Throws if invalid. Returns typed data if valid.
```

## TypeScript Magic 🎩

```typescript
// Define schema once
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().optional(),
});

// Get TypeScript type for free!
type LoginData = z.infer<typeof LoginSchema>;
// {
//   email: string;
//   password: string;
//   remember?: boolean;
// }

// Types and validation always in sync
```

## Form Integration Heaven 🏖️

```typescript
// With React Hook Form
const formSchema = z.object({
  name: z.string().min(2, 'Too short'),
  email: z.string().email('Invalid email'),
  age: z.number().min(18, 'Must be 18+'),
});

const form = useForm({
  resolver: zodResolver(formSchema),
});

// That's it. Full validation with custom messages.
```

## Complex Validations Made Simple 🧩

```typescript
const PasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/[0-9]/, 'One number')
  .regex(/[^A-Za-z0-9]/, 'One special character');

const SignupSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

## API Validation 🚀

```typescript
// Validate API responses
const ApiResponse = z.object({
  user: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
  }),
  token: z.string(),
  expiresAt: z.string().datetime(),
});

try {
  const data = ApiResponse.parse(response.json());
  // data is fully typed and validated
} catch (error) {
  // API returned unexpected format
  console.error('Invalid API response:', error);
}
```

## Transform and Clean Data 🧹

```typescript
const UserInput = z.object({
  email: z.string().email().toLowerCase(), // Auto lowercase
  name: z.string().trim(), // Auto trim whitespace
  age: z.string().transform(Number), // String to number
  tags: z.string().transform((str) => str.split(',')), // String to array
});

// Input: { email: "USER@EXAMPLE.COM ", name: " John ", age: "25", tags: "dev,react" }
// Output: { email: "user@example.com", name: "John", age: 25, tags: ["dev", "react"] }
```

## Conditional Validation 🔄

```typescript
const PurchaseSchema = z
  .object({
    paymentMethod: z.enum(['card', 'paypal', 'crypto']),

    // Only required if card
    cardNumber: z.string().optional(),
    cvv: z.string().optional(),

    // Only required if PayPal
    paypalEmail: z.string().email().optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMethod === 'card') {
        return data.cardNumber && data.cvv;
      }
      if (data.paymentMethod === 'paypal') {
        return data.paypalEmail;
      }
      return true;
    },
    {
      message: 'Missing payment details',
    }
  );
```

## Error Messages That Help 💬

```typescript
const schema = z.object({
  username: z
    .string()
    .min(3, 'Username needs 3+ characters')
    .max(20, 'Username too long (max 20)')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),

  birthDate: z
    .date()
    .max(new Date(), 'No time travelers please')
    .min(new Date('1900-01-01'), 'Please enter a valid birth date'),
});

// Clear, helpful error messages
// Users know exactly what to fix
```

## Async Validation 🔄

```typescript
const EmailSchema = z
  .string()
  .email()
  .refine(async (email) => {
    // Check if email already exists
    const exists = await checkEmailExists(email);
    return !exists;
  }, 'Email already taken');

// Async validation for API checks
// Works seamlessly with forms
```

## Composable Schemas 🧱

```typescript
// Build complex from simple
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zip: z.string().regex(/^\d{5}$/),
});

const CompanySchema = z.object({
  name: z.string(),
  address: AddressSchema, // Reuse!
  phone: z.string(),
});

const UserSchema = z.object({
  personal: PersonalSchema,
  company: CompanySchema.optional(),
  addresses: z.array(AddressSchema), // Arrays too!
});
```

## Performance Tips 🚀

```typescript
// Parse = validate and throw
try {
  const data = schema.parse(input); // Throws on error
} catch (e) {
  // Handle errors
}

// SafeParse = validate and return result
const result = schema.safeParse(input);
if (result.success) {
  // Use result.data
} else {
  // Handle result.error
}

// SafeParse is faster for expected failures
```

## Real World Impact 📊

**Before Zod**:

- Validation bugs: Weekly
- Type mismatches: Common
- Form development: 2 days
- Confidence: Low

**After Zod**:

- Validation bugs: Zero
- Types always match: 100%
- Form development: 2 hours
- Confidence: High

## Start with Zod Today

```bash
docker compose exec scripthammer pnpm add zod
docker compose exec scripthammer pnpm add @hookform/resolvers
```

Stop writing validation logic.
Start declaring what you want.

Validation that's actually fun to write.
