# Chapter 1 Revision Notes

## Core Concept
**Pipeline = Execution Graph + State Machine**, NOT just scripts

## The Graph
- **Nodes:** Jobs
- **Edges:** Dependencies (`needs`, `depends_on`, stages)
- **Execution:** Topological sort

## Job Lifecycle States
```
WAITING → PENDING → RUNNING → SUCCESS/FAILURE/CANCELLED
```

## Isolation Reality
| Platform | Isolation |
|----------|-----------|
| GitHub Actions | Fresh VM per job |
| GitLab CI | Fresh container per job |
| Jenkins | Shared workspace (stages) |

## What's Guaranteed
✅ Dependency order  
✅ Exit code = success/failure  
✅ Fresh environment (VM/container)  
✅ Logs captured  

## NOT Guaranteed
❌ Determinism  
❌ Timing (can queue indefinitely)  
❌ State persistence between jobs  
❌ Parallel execution speed  

## Common Traps
1. **Assumed shared state:** Jobs don't share filesystem
2. **"Works locally":** CI has fresh environment
3. **Non-determinism:** Network, time, race conditions

## Debug Mantra
*"What works locally assumes state that CI doesn't have"*

## One-Sentence Summary
A CI/CD pipeline is an execution graph (DAG) orchestrated by a state machine that schedules jobs to isolated runners, guaranteeing dependency order and exit-code-based success/failure but not determinism, timing, or cross-job state persistence.
