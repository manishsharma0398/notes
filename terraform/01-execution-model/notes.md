# Chapter 01 — Execution Model — Revision Notes

## 1. Terraform is a graph-based state reconciliation engine

- It compares **desired state** (your `.tf` config) against **known state** (state file + cloud refresh).
- It computes a **diff** (the plan), then **executes** changes in dependency order.
- Order of resource blocks in your `.tf` files is **irrelevant** — the dependency graph determines execution order.

## 2. The three phases have distinct responsibilities

| Phase | Contacts Cloud? | Mutates Cloud? | Writes State? |
|-------|:---:|:---:|:---:|
| `init` | No (only registry) | No | No (only backend metadata) |
| `plan` | Yes (refresh via `ReadResource`) | No | No |
| `apply` | Yes | Yes | Yes — after EACH resource |

## 3. Providers are separate processes, not libraries

- Provider = standalone Go binary (e.g., `terraform-provider-aws`, ~400MB).
- Communication: **gRPC over local socket**. Protocol Buffers define the message format.
- Key RPCs: `GetProviderSchema`, `ConfigureProvider`, `ReadResource`, `PlanResourceChange`, `ApplyResourceChange`.
- **Terraform Core has zero cloud knowledge.** All AWS/GCP/Azure logic lives in the provider.

## 4. The dependency graph controls execution order and concurrency

- Graph is a **DAG** (Directed Acyclic Graph). Edges = "must happen after."
- Built by transforms: `ConfigTransformer` (vertices from config), `ReferenceTransformer` (edges from expressions), `ProviderTransformer` (provider init edges).
- Default parallelism: **10 concurrent operations**. Independent resources are planned/applied simultaneously.
- `depends_on` adds **explicit** edges. Most edges are **implicit** — inferred from expression references.

## 5. Apply is NOT atomic — partial failure leaves partial state

- State is written **after each successful resource operation**, not at the end.
- If apply fails at resource 5/10: resources 1–4 are in state ✓, resource 5 is NOT in state, resources 6–10 were never attempted (if dependent on 5) or may have already completed (if independent).
- There is **no rollback**. The next `plan` will show the remaining work.
- "Resource created" ≠ "resource ready" — AWS API returning success does not mean the resource is serving traffic.
