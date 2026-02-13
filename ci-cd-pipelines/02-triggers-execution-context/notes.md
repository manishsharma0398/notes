# Chapter 2 Notes

**Trigger = Webhook + Context (SHA, ref, actor, event)**

## Types
- `push`: Builds exact commit
- `pull_request`: Builds merge simulation  
- `schedule`: Cron, builds latest
- `workflow_dispatch`: Manual
- API: External trigger

## Context Variables
- `github.sha`: Commit hash
- `github.ref`: Branch/tag ref
- `github.actor`: Who triggered
- `github.event_name`: Event type

## Critical Trap
**pull_request** tests merge simulation, NOT actual merge!

## One-Sentence
CI pipelines are triggered by webhooks containing immutable execution context (commit SHA, ref, actor) with pull_request events building merge simulations rather than actual branch commits, explaining why PR tests can pass but post-merge builds fail.
