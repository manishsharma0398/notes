# Examples — Chapter 02: HTTP Request Handling

---

## 1. Observe Header Buffering Limits

```bash
# Send a request with an oversized header to trigger 494
python3 -c "
import socket
s = socket.socket()
s.connect(('localhost', 80))
# 9KB header value — exceeds large_client_header_buffers 4 8k default
big_val = 'x' * 9000
s.sendall(f'GET / HTTP/1.1\r\nHost: example.com\r\nX-Big: {big_val}\r\n\r\n'.encode())
print(s.recv(4096).decode())
s.close()
"
# Expected: HTTP/1.1 494 Request Header Too Large
```

---

## 2. Trigger Body Spill to Disk

```nginx
# nginx.conf fragment
client_body_buffer_size 1k;      # tiny — anything >1KB spills to disk
client_body_temp_path   /tmp/nginx_body;
client_max_body_size    10m;
```

```bash
# Send a 100KB body
dd if=/dev/urandom bs=100K count=1 | \
  curl -X POST http://localhost/upload \
       -H "Content-Type: application/octet-stream" \
       --data-binary @-

# While it's in flight, observe temp files:
ls -la /tmp/nginx_body/
# You'll see: 0000000001  (temp file written by Nginx worker)
```

---

## 3. Verify Location Block Matching (Debug Log)

```nginx
# Enable debug logging temporarily
error_log /var/log/nginx/error.log debug;
```

```bash
curl -v http://localhost/api/v2/users
# In error.log, look for lines like:
# "test location: /api/"          → prefix checked
# "test location: /api/v2/"       → longer prefix found
# "test location: ~ /users"       → regex checked
# "using configuration /api/v2/"  → winner
```

---

## 4. Demonstrate the `if` vs `map` Problem

```nginx
# BAD — "if is evil" pattern
# This BREAKS: the proxy_set_header inside location doesn't inherit correctly
server {
    location / {
        set $upstream "http://primary";
        if ($http_x_canary = "1") {
            set $upstream "http://canary";
        }
        proxy_pass $upstream;
        proxy_set_header Host $host;   # ← may NOT be applied inside if context
    }
}
```

```nginx
# GOOD — map pattern
map $http_x_canary $upstream {
    default   "http://primary";
    "1"       "http://canary";
}

server {
    location / {
        proxy_pass $upstream;
        proxy_set_header Host $host;   # ← always applied, no context issues
    }
}
```

---

## 5. Reproduce the Location Priority Algorithm

```bash
# Use a minimal Nginx config to test location matching interactively
cat > /tmp/test_nginx.conf << 'EOF'
events {}
http {
    server {
        listen 8080;

        location = /exact {
            return 200 "exact match\n";
        }

        location ^~ /prefix/ {
            return 200 "priority prefix (^~)\n";
        }

        location /prefix/other {
            return 200 "plain prefix (longer)\n";
        }

        location ~ /other$ {
            return 200 "regex match\n";
        }

        location / {
            return 200 "catch-all\n";
        }
    }
}
EOF

nginx -c /tmp/test_nginx.conf -t   # validate config

# Test each case:
curl localhost:8080/exact            # → exact match
curl localhost:8080/prefix/foo       # → priority prefix (^~ stops regex)
curl localhost:8080/prefix/other     # → priority prefix (^~ still wins over longer plain prefix)
curl localhost:8080/something/other  # → regex match (plain prefix "/" remembered, then regex checked)
curl localhost:8080/anything         # → catch-all
```

---

## 6. `try_files` Behavior Trace with `strace`

```bash
WORKER_PID=$(pgrep -f "nginx: worker" | head -1)
strace -p $WORKER_PID -e trace=stat,openat 2>&1 &

# Trigger a request to a non-existent path
curl http://localhost/this/does/not/exist

# You'll see in strace output:
# stat("/var/www/html/this/does/not/exist", ...) = -1 ENOENT
# stat("/var/www/html/this/does/not/exist/", ...) = -1 ENOENT
# openat(AT_FDCWD, "/var/www/html/index.html", ...) = 7   ← fallback served
```

---

## 7. Correct `default_server` Setup (Security Baseline)

```nginx
# This block MUST be first (or explicitly marked default_server)
server {
    listen 80  default_server;
    listen 443 ssl default_server;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/default.crt;
    ssl_certificate_key /etc/nginx/ssl/default.key;

    return 444;   # Close connection, no response body
}

# Real vhosts follow
server {
    listen 80;
    listen 443 ssl;
    server_name app.example.com;
    ...
}
```

```bash
# Verify: request with unknown Host hits 444 (connection closed)
curl -v -H "Host: attacker.com" http://your-server/
# Expected: curl: (52) Empty reply from server   ← 444 closed the connection
```
