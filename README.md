# `@lucid-softworks/http-cors`

Cross-origin response and preflight middleware.

```ts
import { cors } from "@lucid-softworks/http-cors";

app.use(
  cors({
    allowCredentials: true,
    origin: ["https://app.example"],
  }),
);
```

Origins may be a wildcard, string, array, regular expression, or predicate.
Preflights may reflect requested headers or use an explicit allow-list.
