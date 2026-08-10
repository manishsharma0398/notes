# Chapter 02 — HTTP Request Handling: Interview Questions

---

## Q1 — The Location Matching Priority Trap

> **"You have this config. A request comes in for `GET /api/v2/users`. Which location block handles it? Why?"**

```nginx
location /api/         { proxy_pass http://api_v1; }
location /api/v2/      { proxy_pass http://api_v2; }
location ~ /users      { proxy_pass http://user_service; }
location = /api/v2/users { return 200 "exact"; }
```

**What they're testing:** Understanding of the full priority algorithm.

**Trap:** Saying "the first matching one" (wrong — that's `select`/`poll` thinking applied to config).

**Strong answer:**
Step 1: Check exact match (`=`). `/api/v2/users` matches `= /api/v2/users` exactly. **This wins immediately.** No further checks. Response: `200 "exact"`.

If the exact match didn't exist: the algorithm would find the longest plain prefix (`/api/v2/` beats `/api/`) and then check regexes. `~ /users` would match `/api/v2/users` and win over the prefix `/api/v2/`. If you wanted `/api/v2/` to win over regexes, you'd write `location ^~ /api/v2/`.

---

## Q2 — The `try_files` Filesystem Trap

> **"Your Nginx config is:**
> ```nginx
> root /var/www/html;
> location / {
>     try_files $uri $uri/ /index.html;
> }
> ```
> **Traffic doubles and you see a spike in disk I/O and `sys` CPU time. The application only serves an SPA — there are no static files except `index.html` and assets. Why is `try_files` contributing to this? How do you fix it?"**

**What they're testing:** Understanding that `try_files` does `stat()` syscalls, not string matching.

**Strong answer:**
For every request to `/api/users`, `/dashboard`, `/settings`, etc., Nginx does:
1. `stat("/var/www/html/api/users")` → ENOENT
2. `stat("/var/www/html/api/users/")` → ENOENT
3. Internal redirect to `/index.html`

That's 2 failing `stat()` calls per request hitting the kernel VFS layer. Under high load this is real overhead — `stat()` is a syscall that acquires locks on the dentry cache.

**Fix 1:** Use `open_file_cache` to cache ENOENT results:
```nginx
open_file_cache max=1000 inactive=20s;
open_file_cache_valid 30s;
open_file_cache_errors on;   # ← cache ENOENT results too
```

**Fix 2:** If everything goes to `index.html`, skip `try_files` entirely:
```nginx
location / {
    try_files /index.html =404;  # or just: index index.html; try_files $uri /index.html;
}
```

**Fix 3:** For API paths, bypass `try_files`:
```nginx
location /api/ {
    proxy_pass http://upstream;    # skip try_files entirely for API paths
}
location / {
    try_files $uri /index.html;
}
```

---

## Q3 — The Default Server Trap

> **"Your Nginx server has two `server` blocks: one for `app.example.com` and one for `api.example.com`. A penetration tester hits your server with `Host: attacker.com`. Which server block responds? What does it serve? Is this a security issue?"**

**What they're testing:** Understanding of `default_server` fallback and its implications.

**Strong answer:**
Without an explicit `default_server` directive, Nginx uses the **first server block in config order** for unmatched `Host` headers. The pen tester gets the first block — possibly `app.example.com`'s full content.

This is a security issue because:
1. It exposes the application to requests with arbitrary `Host` headers — bypassing any host-based firewall rules
2. Depending on the app, a manipulated `Host` header can affect password reset links, SSRF, cache poisoning

**Correct fix:**
```nginx
# First in config — catches everything unrecognized
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;
    ssl_certificate     /etc/nginx/ssl/default.crt;
    ssl_certificate_key /etc/nginx/ssl/default.key;
    return 444;   # close connection, no response
}
```
`return 444` is Nginx-specific: it closes the TCP connection without sending any HTTP response. Useful for rejecting scanners silently.

---

## Failure Exercise

> **"A developer adds this to the Nginx config of a production server:**
>
> ```nginx
> location /internal/health {
>     return 200 "OK";
> }
>
> location ~ /health {
>     proxy_pass http://upstream;
> }
> ```
>
> **They expect `/internal/health` to be served directly (fast, no upstream) and all other `/health` paths to proxy. In testing it works. In production under load, health check monitors start failing intermittently — sometimes they get `200 OK`, sometimes they get upstream responses. Why? How do you fix it without changing the health check URL?"**

**Hint:** Think about what `~ /health` matches, and what `/internal/health` is as a location type. What's the priority relationship?

*(Answer this before we move to Chapter 03 — Reverse Proxy Internals.)*
