# Error-Related Parameters Types

This directory contains type definitions for error handling and validation throughout the application.

## validation.ts

Contains types and utilities for validation and error handling:

### Types

- `FieldError` - Type for field validation errors. Can be a string message or null.
- `ValidationError` - Structured validation error with field, message, and optional code.
- `ValidationErrors` - Array of ValidationError objects.
- `Validator<T>` - Type for validation functions.

### Helper Functions

- `createFieldValidator<T>()` - Creates a field validator function.
- `validateRequired()` - Validates that a field is not empty.
- `validateName()` - Validates name fields (minimum 2 characters).
- `validateEmail()` - Validates email format using regex.

## Usage Examples

### Component with Field Error

```svelte
<script lang="ts">
  import { FieldError } from "src/lib/types/validation";
  
  export let fieldError: FieldError = null;
  export let value: string = "";
  export let validate: ((value: string) => FieldError) | null = null;
</script>

<input bind:value class:error={!!fieldError} />
{#if fieldError}
  <div class="error-message">{fieldError}</div>
{/if}
```

### Component with Validation Errors

```svelte
<script lang="ts">
  import { ValidationError, ValidationErrors } from "src/lib/types/validation";
  
  export let validationErrors: ValidationErrors = [];
</script>

{#each validationErrors as error}
  <div class="error-item">
    <strong>{error.field}:</strong> {error.message}
  </div>
{/each}
```

### Using Validator Functions

```svelte
<script lang="ts">
  import { validateRequired, validateEmail } from "src/lib/types/validation";
  
  let email = "";
  $: emailError = validateEmail(email);
</script>

<input bind:value={email} />
{#if emailError}
  <span class="error">{emailError}</span>
{/if}