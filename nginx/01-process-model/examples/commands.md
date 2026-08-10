# Examples — Chapter 01: Process Model & Event Loop

---

## 1. Observe the Process Tree

```bash
# Start nginx (or exec into a running container)
ps aux | grep nginx
```

Expected output on a 4-core machine:
```
root       1234  0.0  nginx: master process nginx -g daemon off;
www-data   1235  0.1  nginx: worker process
www-data   1236  0.1  nginx: worker process
www-data   1237  0.1  nginx: worker process
www-data   1238  0.1  nginx: worker process
```

The master is root (needed for binding port 80/443).  
Workers are `www-data` (dropped privileges after binding).

---

## 2. Minimal Config Showing Key Process Directives

```nginx
# /etc/nginx/nginx.conf

worker_processes auto;           # = number of logical CPU cores
worker_rlimit_nofile 65536;      # raise OS fd limit for workers
                                 # must be >= worker_connections * 2
                                 # (each connection = client fd + upstream fd)

events {
    worker_connections 4096;     # max simultaneous connections per worker
    use epoll;                   # explicit (Nginx auto-selects on Linux, but good to know)
    multi_accept on;             # accept as many connections as possible per epoll wake-up
                                 # default off; useful under high connection rate
}

http {
    listen 80 reuseport;         # per-worker listening socket — eliminates thundering herd
    ...
}
```

---

## 3. Verify SO_REUSEPORT is Active

```bash
ss -tlnp | grep :80
```

With `reuseport`, you'll see **multiple socket entries for port 80** — one per worker:

```
LISTEN  0  511  0.0.0.0:80  0.0.0.0:*  users:(("nginx",pid=1235,fd=6))
LISTEN  0  511  0.0.0.0:80  0.0.0.0:*  users:(("nginx",pid=1236,fd=6))
LISTEN  0  511  0.0.0.0:80  0.0.0.0:*  users:(("nginx",pid=1237,fd=6))
LISTEN  0  511  0.0.0.0:80  0.0.0.0:*  users:(("nginx",pid=1238,fd=6))
```

Without `reuseport`, you'd see **one socket entry** shared by all workers.

---

## 4. Watch Workers During a Reload

```bash
# Terminal 1: watch process list
watch -n 0.5 'ps aux | grep nginx'

# Terminal 2: trigger a reload
nginx -s reload
```

Observe: briefly you'll see the old workers plus new workers simultaneously.  
Old workers disappear after their keep-alive connections time out.

---

## 5. Check the Current fd Limit for a Worker

```bash
# Find a worker PID
WORKER_PID=$(pgrep -f "nginx: worker" | head -1)

# Check its open fd limit
cat /proc/$WORKER_PID/limits | grep "open files"
```

Output:
```
Max open files            65536                65536                files
```

If this is the default 1024, you will hit `Too many open files` (errno 24) under load.  
Each client connection + upstream connection = 2 fds per request.  
At `worker_connections 4096`, each worker needs at least 8192 fds (plus Nginx internal fds).

---

## 6. strace a Worker to See the Event Loop

```bash
WORKER_PID=$(pgrep -f "nginx: worker" | head -1)
strace -p $WORKER_PID -e trace=epoll_wait,read,write,accept4 2>&1 | head -50
```

You'll see the tight loop:
```
epoll_wait(5, [], 512, 60000)            # wait up to 60s for events
epoll_wait(5, [{EPOLLIN, {u32=3, ...}}], 512, 60000)   # a client connected
accept4(3, {sa_family=AF_INET, ...}, [16], SOCK_NONBLOCK|SOCK_CLOEXEC) = 8
read(8, "GET / HTTP/1.1\r\nHost: ...", 1024) = 74
write(8, "HTTP/1.1 200 OK\r\n...", 250)  = 250
epoll_wait(5, [], 512, 60000)            # back to waiting
```

This is the event loop in raw syscall form.
