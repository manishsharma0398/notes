# Chapter 02 — HTTP Request Handling: Revision Notes

1. **Header buffering is fixed-size**: Request headers read into `client_header_buffer_size` (1KB default). Overflow → `large_client_header_buffers`. Exceed that → 400/494 error.

2. **Body buffering is two-tier**: Up to `client_body_buffer_size` stays in RAM. Anything beyond spills to a disk temp file. This is silent and can dominate latency. Size this to your p95 body size.

3. **`client_max_body_size` ≠ `client_body_buffer_size`**: max = hard limit (returns 413 if exceeded). buffer = memory/disk split. They are independent.

4. **Server block selection is NOT first-match**: Priority is exact `server_name` → wildcard-start → wildcard-end → regex (file order) → `default_server`. Unmatched `Host` headers go to `default_server`.

5. **Location matching is NOT top-to-bottom**: `=` exact wins outright. `^~` prefix stops regex search. Plain prefix: longest match remembered. Regex: first match in file order. If no regex matches, use the remembered prefix.

6. **`try_files` is a `stat()` loop**: Each argument is a filesystem check. Last argument can be a fallback URI or `=<status>`. It does NOT do HTTP redirects.

7. **`if` inside `location` is dangerous**: Creates an implicit child location context with subtle inheritance rules. Use `map {}` for all conditional routing.
