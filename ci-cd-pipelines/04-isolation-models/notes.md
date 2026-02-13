# Chapter 4 Notes

## Isolation Levels
1. **VMs:** Strongest, different kernel, slow start (~20s)
2. **Containers:** Medium, shared kernel, fast start (~2s)
3. **Shared workspace:** Weakest, same process, instant

## Security Implications
- VMs: Can't read other jobs' data
- Containers: Kernel exploits affect all
- Shared: Jobs can interfere

## Dangerous Patterns
**docker:dind** requires privileged mode → full host access

## Noisy Neighbors
Shared runners → resource contention → variable performance

## One-Sentence
CI isolation models range from VMs (strongest security, separate kernels, slow startup) to containers (medium security, shared kernel, fast) to shared workspaces (weakest, same process, instant), with security boundaries determining whether jobs can access each other's data and docker-in-docker requiring dangerous privileged mode.
