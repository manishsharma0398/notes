# Chapter 02 — HTTP Request Handling

## Mental Model

> **Nginx processes an HTTP request in two distinct phases: selection (which server block? which location block?) and execution (what do I do with it?). These phases are completely separate and have different matching semantics.**

Most config bugs live in phase one — selection. Engineers write rules assuming Nginx reads them top-to-bottom like a script. It does not. Nginx applies a fixed priority algorithm that is independent of the order you write blocks.

---

## Phase 1A — How Nginx Parses an Incoming Request

When a client TCP connection is accepted by a worker, Nginx reads into a kernel receive buffer. Then:

```
1. Read request line:    GET /api/users HTTP/1.1\r\n
2. Read headers:         Host: example.com\r\n
                         Content-Length: 512\r\n
                         ...
                         \r\n           ← blank line signals end of headers
3. Read body (if any):   { "name": "..." }
```

**Steps 1 and 2 happen synchronously in the event loop** — Nginx reads headers into a fixed buffer (`client_header_buffer_size`, default 1KB). If the headers fit, great. If not, it allocates `large_client_header_buffers` (default: 4 × 8KB). If headers exceed that, Nginx returns `400 Bad Request` or `494 Request Header Too Large`.

**Step 3 (body) is different.** The body is not read eagerly. Nginx buffers the body into `client_body_buffer_size` (default: 8KB on 32-bit, 16KB on 64-bit). If the body fits, it stays in memory. If it exceeds this size, Nginx **spills to a temp file on disk** (`client_body_temp_path`).

---

## `client_body_buffer_size` and `client_max_body_size`

These two directives are confused constantly:

| Directive | What it controls | What happens when exceeded |
|---|---|---|
| `client_max_body_size` | Maximum body size Nginx will accept at all | 413 Request Entity Too Large |
| `client_body_buffer_size` | How much body fits in memory | Body spills to disk temp file |

```
Request body: 50MB upload

client_max_body_size  100m;    ← allows it (50 < 100)
client_body_buffer_size 16k;   ← 50MB - 16KB spills to /tmp/nginx/

                   ┌──────────┐
Client ──50MB──►   │ 16KB RAM │ ← stays in memory
                   │          │
                   │49.98MB   │ ── written to disk temp file
                   │ on disk  │
                   └──────────┘
```

**Performance trap:** If you're building an API that processes large JSON bodies, and `client_body_buffer_size` is 16KB, every large body hits disk. For an upstream that processes in milliseconds, this disk I/O dominates latency. Set `client_body_buffer_size` to your p95 request body size.

**Security trap:** `client_max_body_size 0` disables size checking entirely. An attacker can stream an unlimited body, filling your disk and/or RAM. Never do this in production.

---

## Phase 1B — Server Block Selection

When Nginx has the `Host` header, it must pick which `server {}` block handles the request. The algorithm:

### Step 1: Match on `listen` port and IP

Only server blocks listening on the port the connection arrived on are candidates.

### Step 2: Match on `server_name`

Among candidates, Nginx applies this priority (highest to lowest):

```
1. Exact match                    server_name example.com;
2. Wildcard at start              server_name *.example.com;
3. Wildcard at end                server_name example.*;
4. First regex match (in order)   server_name ~^api\..*;
5. Default server                 listen 80 default_server;
```

**Critical: if no `server_name` matches, Nginx uses the `default_server`** for that port — not the first block in the file. If you don't mark any block `default_server`, Nginx uses the first block in config order.

```nginx
# This block catches ALL unmatched requests — not just ones without a Host header
server {
    listen 80 default_server;
    server_name _;
    return 444;   # Nginx-specific: close connection without response
}
```

**The trap:** Engineers add a new `server` block for `api.example.com` and assume it won't match traffic for `other.example.com`. But if `other.example.com` is not explicitly handled, it falls to the default server — whichever that is. This is how staging traffic accidentally hits production: a misconfigured `default_server`.

---

## Phase 1C — Location Block Matching

This is the most misunderstood part of Nginx config. The algorithm is **not** first-match. It is:

### The Four Location Types

```nginx
location = /exact     { ... }   # 1. Exact match       (highest priority)
location ^~ /prefix/  { ... }   # 2. Priority prefix   (stops regex search if matched)
location /prefix/     { ... }   # 3. Regular prefix    (longest match wins)
location ~ \.php$     { ... }   # 4. Case-sensitive regex  (first match wins)
location ~* \.php$    { ... }   # 5. Case-insensitive regex
```

### The Algorithm (this order is fixed — your file order doesn't matter for types 1–3):

```
1. Check all exact matches (=). If found → done.
2. Check all prefix matches (/prefix and ^~). Find the LONGEST match.
   - If longest match is ^~  → done. (stop, don't check regex)
   - If longest match is / (plain prefix) → remember it, keep going.
3. Check regex locations IN FILE ORDER. First match → done.
4. If no regex matched → use the remembered longest prefix match.
```

### ASCII Priority Diagram

```
Request: GET /api/v1/users

location = /api/v1/users  { }   ← 1. exact match? YES → stop here
─────────────────────────────────
location ^~ /api/         { }   ← 2. ^~ prefix? checked if no exact match
location /api/            { }   ← 3. plain prefix: longest match remembered
location ~ /users$        { }   ← 4. regex: checked in file order
```

### The Common Traps

**Trap 1: Regex beats longer prefix**
```nginx
location /api/v1/users { proxy_pass http://api; }
location ~ /users      { proxy_pass http://legacy; }   # ← THIS WINS
```
The regex `/users` matches and wins over the longer prefix `/api/v1/users`. The request goes to legacy. Use `^~` on the prefix to prevent regex from overriding it.

**Trap 2: Trailing slash semantics**
```nginx
location /app   { proxy_pass http://upstream; }
location /app/  { proxy_pass http://upstream; }
```
`/app` and `/app/` are distinct prefix matches. `/app` matches `/appfoo` too. `/app/` does not. When in doubt, use exact match `= /app` for root paths.

**Trap 3: The catch-all `/` location**
```nginx
location / { ... }   # matches EVERYTHING not matched by anything else
```
This is the lowest-priority prefix (shortest possible). Any other prefix or regex will beat it.

---

## `try_files` — What It Actually Does

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

`try_files` is a filesystem stat sequence, not a redirect:

```
For request: GET /about

1. Check if /var/www/html/about  exists as a FILE  → stat("/var/www/html/about")
2. Check if /var/www/html/about/ exists as a DIR   → stat("/var/www/html/about/")
3. Fall through to internal redirect → /index.html
```

**It does `stat()` syscalls on the filesystem.** Each `try_files` check is a syscall. On high-traffic servers with many misses, this adds up. Use `open_file_cache` to cache successful stat results.

### The `=404` trap

```nginx
try_files $uri $uri/ =404;
```

The `=404` at the end is a **status code return**, not a file to serve. It means "if nothing matched, return 404 directly." This is different from passing to a named location. This is correct for static file serving. For SPAs, you want the fallthrough to `index.html` instead.

### The named location pattern (correct for APIs)

```nginx
location / {
    try_files $uri @backend;
}

location @backend {
    proxy_pass http://upstream;
}
```

`@backend` is a named internal location — not accessible from the outside, only via internal redirects like `try_files` or `error_page`. This pattern serves files if they exist (useful for a static + API hybrid) and falls to upstream otherwise.

---

## Variable Evaluation — Lazy, Not Eager

Nginx config variables (`$uri`, `$host`, `$http_host`, `$upstream_addr`) are **lazily evaluated** — computed at request time, not at config load time.

```nginx
log_format main '$remote_addr - $request - $upstream_response_time';
```

`$upstream_response_time` is only populated after a proxy request completes. If the location doesn't proxy, the variable is `-`.

**The cost:** Variables that require computation (e.g., `$request_time`, anything in Lua) are computed every time they're referenced. Variables that require a hash lookup (like `$http_<header_name>`) scan the request header list. For hot paths with many variables in log format, this is measurable overhead.

**The `set` trap:**
```nginx
set $backend "http://primary";
if ($uri ~* "^/legacy") {
    set $backend "http://old";
}
proxy_pass $backend;
```

`if` blocks in Nginx are not conditional branches in the programming sense — they create a new implicit location context. Using `if` inside `location` blocks is notorious for causing unexpected behavior. The Nginx docs literally say: ["if is evil"](https://www.nginx.com/resources/wiki/start/topics/depth/ifisevil/). Use `map {}` blocks instead.

---

## The Correct Alternative: `map`

```nginx
map $uri $backend {
    default         "http://primary";
    ~^/legacy       "http://old";
}

server {
    location / {
        proxy_pass $backend;
    }
}
```

`map` is evaluated once per request and cached for that request's lifetime. It is declarative, correct, and fast.

---

## Common Misconceptions

| What engineers think | What actually happens |
|---|---|
| Location blocks are matched in file order | Only regex locations respect file order. Prefix matching is longest-match. |
| `try_files` does HTTP redirects | It does filesystem `stat()` calls and internal Nginx redirects, not HTTP 301/302 |
| `if` blocks work like conditionals | They create implicit location contexts — behavior is non-obvious and dangerous |
| The first `server` block is the default | The block marked `default_server` is default, regardless of order |
| Variables are computed at config load | All variables are evaluated lazily at request time |

---

## Revision Notes

- Headers read into fixed buffer (1KB default); body buffered to `client_body_buffer_size`, spills to disk if exceeded.
- `client_max_body_size` controls max accepted size; `client_body_buffer_size` controls memory vs disk split.
- Server block selection: exact `server_name` > wildcard start > wildcard end > regex > `default_server`.
- Location matching order: `=` exact → `^~` priority prefix → longest plain prefix (remembered) → first regex match → fall back to remembered prefix.
- `try_files` does `stat()` syscalls — not HTTP redirects. `=404` is a direct status return, not a file.
- Never use `if` for routing logic inside `location` blocks. Use `map {}` instead.
- Unmatched `Host` headers always fall to `default_server` — make sure you control what that is.
