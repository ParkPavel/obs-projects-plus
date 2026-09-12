# Input validation types

[validation.ts](validation.ts) defines the shared types used to display validation errors.

| Export | Meaning |
| --- | --- |
| `FieldError` | An error message, or `null` when valid |
| `ValidationError` | A field name, message and optional code |
| `ValidationErrors` | A list of structured errors |
| `Validator<T>` | A function from a value to `FieldError` |
| `createFieldValidator` | Returns a supplied validator with the shared type |

The module also exports `validateRequired`, `validateName` and `validateEmail`. They return English messages. `validateRequired` rejects falsy values, including `0` and `false`, so it is not appropriate for every numeric or boolean field. `validateName` checks a nonblank name and a minimum string length of two; `validateEmail` checks a basic address pattern.

```typescript
import { validateEmail } from "./validation";

const error = validateEmail("reader@example.com");
if (error !== null) {
  // Display the validation message near the input.
}
```

These helpers are for input validation. Product error codes and recovery instructions are documented separately in the [error reference](../../../docs/ERROR_CODES.md).
