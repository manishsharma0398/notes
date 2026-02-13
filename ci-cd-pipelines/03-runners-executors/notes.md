# Chapter 3 Notes

**Runner = Worker, Executor = Isolation method**

## Hosted
- GitHub/GitLab managed
- Fresh VM per job
- Ephemeral, secure
- Cold start ~20s

## Self-Hosted
- You manage
- Persistent state (danger!)
- Warm start ~1s
- **Never for public repos**

## Security Critical
Self-hosted risks:
- State leakage between jobs
- Persistent malware
- Secret exposure

## One-Sentence
Runners are worker machines that execute jobs using hosted (ephemeral VMs managed by platform, secure but slower) or self-hosted (persistent machines you manage, faster but with state-leakage security risks making them unsuitable for public repos) execution models.
