# Chapter 01 — Process Model & Event Loop: Interview Questions

---

## Q1 — The Core Concurrency Question

> **"Nginx claims to handle 10,000 concurrent connections per worker. How is that possible without threads? What does the OS actually do?"**

**What they're testing:** Whether you understand event-driven I/O vs thread-based concurrency.

**Trap:** Saying "Nginx uses async/await" or "it uses green threads." It uses none of these. It uses `epoll` — a kernel facility.

**Strong answer:**
Each Nginx worker is a single OS thread running a `epoll_wait()` loop. All file descriptors (client sockets, upstream sockets, disk I/O where supported) are opened with `O_NONBLOCK`. When Nginx needs to read from a socket, it attempts a `read()` — if no data is available, the kernel returns `EAGAIN` immediately instead of blocking. Nginx registers that fd with epoll (`EPOLLIN` interest), and the kernel adds it to the ready list only when data arrives. `epoll_wait` returns all ready fds in one call, O(1) per fd. The worker processes each ready fd's event and immediately moves to the next. No thread sleeps waiting for I/O — the CPU is always doing work.

---

## Q2 — The Reload Question

> **"You push a config change to an Nginx server handling 50,000 active keep-alive connections. You run `nginx -s reload`. What exactly happens to those connections?"**

**What they're testing:** Whether you understand the graceful shutdown model and its edge cases.

**Trap:** Saying "reload drops all connections" (wrong) or "reload is instant" (also wrong — old workers persist).

**Strong answer:**
The master process reads and validates the new config. It forks new worker processes with the new config. New connections are distributed only to new workers. The master sends `SIGQUIT` to old workers — this is the graceful signal, which tells workers to stop calling `accept()` on new connections but to finish serving existing ones. Old workers will drain. The problem: keep-alive connections don't have pending requests right now — they're just open, idle. Those connections stay with old workers until either a new request arrives and is served, or the `keepalive_timeout` expires. If `keepalive_timeout` is 75 seconds, you can have old workers running for 75+ seconds post-reload. During this window, `worker_processes` is temporarily doubled. Monitor `ps aux | grep nginx` after a reload if you're troubleshooting.

---

## Q3 — The `worker_processes` Sizing Trap

> **"Your Nginx server runs on a 32-core machine. A developer sets `worker_processes 64` thinking more workers means more throughput. What actually happens?"**

**What they're testing:** Understanding of CPU scheduling, cache locality, and the purpose of the event loop.

**Trap:** Agreeing that more workers always helps.

**Strong answer:**
With 64 workers on 32 cores, at any given time 32 workers are runnable and 32 are waiting for a CPU time slice. The OS scheduler must context-switch between workers. Each context switch flushes CPU registers and may cause instruction cache and data cache misses for the incoming worker — the worker's working set (connection state, buffer pools) is no longer warm in L1/L2 cache. For a pure event-loop workload, this is pure overhead. The correct setting is `worker_processes auto` (= 32 on a 32-core machine). The one exception: if workers do blocking I/O (e.g., some 3rd-party modules synchronously call blocking syscalls like DNS resolution via glibc), those workers stall their entire event loop. In that case, more workers partly compensate by having other workers able to run — but the real fix is to use Nginx's non-blocking resolver or a proper async module.

---

## Failure Exercise

> **"You restart Nginx on your production server. `ps aux` shows 1 master and 8 workers. Load is low but `worker_connections` is set to 512. A monitoring alert fires that Nginx is returning 502 errors to upstream. You check upstream — it's healthy. You check Nginx error logs and see: `connect() failed (24: Too many open files)`. Walk me through what's happening and how you fix it without restarting Nginx."**

**Hint:** This is a file descriptor limit problem, not a connection limit problem. Where does the 24 come from? What sets the fd limit? How do you raise it live?

*(Answer this before we move to the next chapter.)*
