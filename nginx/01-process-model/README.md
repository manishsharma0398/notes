# Chapter 01 — Nginx Process Model & Event Loop

## Mental Model

Before you touch a single config directive, you need a correct mental model of what Nginx **is** at the OS level.

> **Nginx is not a multi-threaded server. It is a multi-process server where each process runs a non-blocking event loop.**

This is the single most important thing to internalize. Almost every Nginx performance characteristic, failure mode, and config trade-off flows from this fact.

Think of it this way:

```
OS
└── nginx (master process)       ← PID 1 in Docker; real PID ~1234 on bare metal
    ├── nginx (worker process)   ← handles ALL client connections
    ├── nginx (worker process)
    ├── nginx (worker process)
    └── nginx (worker process)
        └── [event loop]         ← single thread, thousands of concurrent connections
```

The master process **never handles a client connection**. Workers handle everything.

---

## The Master Process

The master process does exactly four things:

1. **Reads and validates config** on startup (and on `nginx -s reload`)
2. **Binds to privileged ports** (80, 443) — requires root; workers inherit the socket
3. **Forks worker processes** and restarts them if they crash
4. **Handles signals**: `SIGHUP` = reload, `SIGQUIT` = graceful shutdown, `SIGTERM` = fast shutdown

It then sits idle. It does not touch the network. It does not read from sockets. It is purely a supervisor.

**Why only one master?**
Because port binding and config reloading are control-plane operations — they must be serialized. Having multiple masters would require distributed locking across processes for these operations. One master, many workers is simpler and correct.

---

## Worker Processes

Each worker is a completely independent OS process — separate address space, separate file descriptor table (except for the inherited listening socket). The kernel schedules them independently.

Each worker runs a **single-threaded event loop**:

```
while (true) {
    events = epoll_wait(epfd, ...);   // block until something is ready
    for each event:
        handle_event(event);          // read, parse, proxy, write — all non-blocking
}
```

The critical insight: **"handle_event" never blocks**. Every I/O call uses `O_NONBLOCK` file descriptors. If data isn't ready yet, Nginx doesn't wait — it registers interest with epoll and moves on to the next event.

---

## How a Single Worker Handles Thousands of Connections

This is where most engineers have a wrong mental model.

**Wrong model:** "Nginx must use threads or async/await under the hood."  
**Correct model:** Nginx uses the OS kernel's event notification API (epoll on Linux) to know *exactly* when a file descriptor is ready for I/O — no waiting, no polling.

### The epoll mechanism

```
Client A: SYN ──────────────────────────► Linux TCP stack
                                          ├── completes 3-way handshake
                                          └── puts fd into "readable" state

Worker (epoll_wait returns):
  ├── fd for Client A is ready → read HTTP request headers (non-blocking read)
  ├── fd for upstream B is ready → read proxy response (non-blocking read)
  └── fd for Client C is ready → write response (non-blocking write)
```

The worker never asks "is fd X ready?" (that's polling, O(n)). Instead, the kernel tells the worker "these fds are now ready" via `epoll_wait` — O(1) per ready event, regardless of how many fds are being monitored.

This is fundamentally different from:
- **Apache prefork**: one process per connection → 1000 connections = 1000 processes (context switch hell)
- **Apache worker MPM**: one thread per connection → 1000 connections = 1000 threads (memory overhead)
- **Nginx**: one event loop per worker → 1000 connections = 1 thread, 1 process per worker

---

## `worker_processes` — How Many Workers?

```nginx
worker_processes auto;  # recommended
```

`auto` sets worker count to the number of **logical CPU cores** as reported by the OS.

**Why one worker per core?**  
Each worker is CPU-bound only when it's actually processing (parsing HTTP, running Lua, TLS). The rest of the time it's blocked in `epoll_wait` — which is a kernel call that yields the CPU. With more workers than cores, you get context switches between workers for no gain, plus cache thrashing.

**When `auto` is wrong:**
- You're running on a CPU with 64 cores but Nginx is only serving static files — 4–8 workers is enough; more workers increase memory and `accept_mutex` contention
- Your workers use synchronous 3rd-party modules that do blocking I/O (e.g., old `ngx_http_auth_ldap`) — those workers block their entire event loop, and more workers partially compensates
- You're running multiple Nginx instances on the same host — they'll all try to claim all cores

---

## The `accept_mutex` Problem (Thundering Herd)

When a new TCP connection arrives on port 80, **all workers are notified simultaneously** by the kernel (pre-Linux 3.9 behavior). All of them wake up. Only one gets the connection. The rest go back to sleep. This is the **thundering herd** problem.

Nginx's original solution: `accept_mutex on` (the default pre-1.11.3). A mutex ensures only one worker at a time can call `accept()`.

**The cost:** The mutex adds latency — a worker may wait up to `accept_mutex_delay` (default: 500ms) before trying to accept. This creates artificial queuing at low concurrency.

**Modern solution:** Linux 3.9+ `SO_REUSEPORT`

```nginx
listen 80 reuseport;
```

With `SO_REUSEPORT`, each worker has its **own separate listening socket** for the same port. The kernel load-balances `SYN` packets across these sockets using a hash. No mutex, no thundering herd, lower latency. This is the modern recommendation.

```
Without SO_REUSEPORT:
  Single listening socket → all workers compete → thundering herd

With SO_REUSEPORT:
  Worker 0 socket → kernel routes some SYNs here
  Worker 1 socket → kernel routes other SYNs here
  Worker 2 socket → ...
```

---

## What Happens to In-Flight Requests During `nginx -s reload`?

`nginx -s reload` sends `SIGHUP` to the master. The master:

1. Reads and validates the new config
2. Forks **new workers** with the new config
3. Sends `SIGQUIT` (graceful) to old workers — they stop accepting new connections but finish serving existing ones
4. Old workers exit after their in-flight requests complete

Result: **zero dropped connections** (assuming correct config). New requests go to new workers. Old requests are served by old workers until completion.

**The trap:** If old workers have keep-alive connections with idle clients, they won't exit until those connections time out. During a reload, you can briefly have `2 × worker_processes` worker processes running.

---

## ASCII Diagram — Full Request Flow

```
                     ┌─────────────────────────────────────────┐
                     │           OS Kernel (Linux)             │
                     │                                         │
  Client ──SYN──►    │  TCP Stack → fd added to epoll set      │
                     │                                         │
                     │  epoll_wait() ◄─── Worker Process       │
                     │       │                   │             │
                     │  fd ready ──────────────► │             │
                     │                    handle_event()       │
                     │                    - read request       │
                     │                    - proxy upstream     │
                     │                    - write response     │
                     └─────────────────────────────────────────┘

  Master Process (supervisor only):
  ├── forks workers
  ├── binds port 80/443
  └── handles SIGHUP/SIGQUIT/SIGTERM
```

---

## Common Misconceptions

| What engineers think | What actually happens |
|---|---|
| Nginx uses threads internally for concurrency | No threads. Single-threaded event loop per worker. |
| More `worker_processes` = more performance | Beyond CPU core count, you get contention and cache thrashing |
| `nginx -s reload` drops connections | No — old workers drain gracefully; new workers take new connections |
| Workers are restarted periodically | Workers run indefinitely until crashed, signaled, or config reload |
| `worker_connections 1024` limits total connections | It limits connections **per worker** — total = `worker_processes × worker_connections` |

---

## Revision Notes

- Nginx = 1 master (supervisor) + N workers (event loops). Master never touches a socket.
- Each worker = single thread running `epoll_wait()` loop. Non-blocking I/O everywhere.
- `epoll` is O(1) per ready event. This is why 1 worker can handle thousands of connections.
- `worker_processes auto` = one worker per logical CPU core. Correct for most workloads.
- `SO_REUSEPORT` eliminates thundering herd and `accept_mutex` latency. Use it.
- `nginx -s reload` is zero-downtime: new workers take new connections, old workers drain.
- Total max connections = `worker_processes × worker_connections` (not just `worker_connections`).
