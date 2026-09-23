# Template interpolation

[interpolateTemplate](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/templates/interpolate.ts) replaces double-braced variables using callbacks supplied by the caller.

```typescript
import { interpolateTemplate } from "./interpolate";

const text = interpolateTemplate("Hello, {{name}}!", {
  name: () => "Ada",
});
// "Hello, Ada!"
```

A variable can pass an argument after a colon: `{{date:YYYY-MM-DD}}` invokes the `date` callback with `YYYY-MM-DD`. Unknown variables become empty strings. The interpolator does not evaluate code or provide a built-in variable catalogue; callers define the available names.

See [interpolate.test.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/templates/interpolate.test.ts) for the supported syntax.
