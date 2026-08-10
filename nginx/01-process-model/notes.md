# Chapter 01 — Process Model & Event Loop: Revision Notes

1. **Two process types, two roles**: Master = supervisor (config, port binding, forking). Workers = everything client-facing. Master never reads a socket.

2. **One event loop per worker**: A single thread calls `epoll_wait()` in a tight loop. Non-blocking I/O means the thread never waits on network data — it registers interest and the kernel calls it back.

3. **epoll is O(1)**: Unlike `select`/`poll` (O(n) per call), `epoll_wait` returns only the ready file descriptors. 10,000 idle connections cost almost nothing.

4. **worker_processes = CPU cores**: One worker per logical core is correct for CPU-bound work. Going higher causes context switches and CPU cache thrashing with no throughput gain.

5. **Thundering herd → SO_REUSEPORT**: Without `reuseport`, all workers wake on every new connection. With `reuseport`, the kernel distributes SYNs across per-worker sockets. Zero mutex, lower latency.

6. **Graceful reload**: `nginx -s reload` forks new workers with new config, then sends SIGQUIT to old workers. Old workers finish in-flight requests then exit. Zero dropped connections.

7. **Max connections formula**: `worker_processes × worker_connections` — not just `worker_connections`. A 4-core machine with `worker_connections 1024` handles max 4096 simultaneous connections.
