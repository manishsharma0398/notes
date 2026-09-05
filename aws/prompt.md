# AWS Learning — Subject Index

This folder is organized into subject-based subfolders. Each subfolder has its own `prompt.md` tailored to that domain.

---

## Subjects

| Folder                                        | Topics Covered                                                      |
| --------------------------------------------- | ------------------------------------------------------------------- |
| [`compute/`](./compute/prompt.md)             | Lambda, API Gateway, ECS, EKS, Auto Scaling                         |
| [`networking/`](./networking/prompt.md)       | VPC, NAT Gateway, PrivateLink, ALB/NLB, ENIs, DNS                   |
| [`storage/`](./storage/prompt.md)             | S3, Athena, DynamoDB, RDS, Aurora, OpenSearch, EBS/EFS              |
| [`messaging/`](./messaging/prompt.md)         | SQS, SNS, EventBridge, Kinesis, MSK, SES                            |
| [`observability/`](./observability/prompt.md) | CloudWatch, X-Ray, Grafana, cost observability                      |
| [`security/`](./security/prompt.md)           | IAM, SCP, KMS, Secrets Manager, IRSA, VPC security                  |
| [`operations/`](./operations/prompt.md)       | Incident response, multi-AZ failure, Teleport, blast radius, quotas |

---

## Subjects Covered Elsewhere

These topics are part of my AWS stack but are covered in dedicated subject folders in the parent notes directory:

| Subject                                   | Folder                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| Terraform (IaC state, plan/apply, drift)  | [`../terraform/`](../terraform/prompt.md)             |
| ArgoCD + GitLab CI/CD (GitOps, pipelines) | [`../ci-cd-pipelines/`](../ci-cd-pipelines/prompt.md) |
| Kubernetes / EKS platform specifics       | [`../k8s/`](../k8s/prompt.md)                         |
| Container internals / ECS foundations     | [`../docker/`](../docker/prompt.md)                   |
| RDS/DynamoDB query design                 | [`../sql/`](../sql/prompt.md)                         |

---

## Common Context for All AWS Sessions

- **Experience level**: 2–3 years production AWS. Skip basics.
- **Stack**: Lambda + API GW + SQS/SNS/EventBridge + DynamoDB/RDS + S3/Athena + ECS/EKS + CloudWatch + Terraform + GitLab + ArgoCD + Teleport + Grafana
- **Teaching style**: One concept at a time. Mental model first. Actual mechanism second. Failure modes always. No "AWS handles it for you."
- **Format per chapter**: `README.md` + `notes.md` + `interview.md` + `examples/`
- **Depth**: Principal-engineer level. Predict failure modes. Understand trade-offs. Debug at 3 AM.

---

## Chapter structure — updated 2026-09-05

**This supersedes any chapter shape described above.** It is the structure the `js-learnings`
track converged on over 22 chapters, and it is now the standard for every track in this repo.

One folder per concept, containing **all seven pieces**. A chapter is not finished until all of
them exist:

- `README.md` — mental model, mechanism, ASCII diagrams. **Open with a short map of how the topic
  is examined**: what gets asked every time vs. what is background.
- `notes.md` — concise revision notes. The file to read the morning of an interview.
- `interview.md` — the questions, each with **the spoken answer and a target time**, what the
  interviewer is scoring, the follow-up they ask next, and the red flags that drop a level. End
  with a rapid-fire bank of one-sentence answers.
- `mock.md` — **a realistic 20-minute round on this topic**: opener → prediction → live debug →
  whiteboard build → closer, written as a transcript with annotations for what is being scored at
  each turn. Include a levels table (2yr / 4yr / senior answer to the same question), the
  sentences that raise the level most, and the red flags.
- `examples/` — runnable CLI/SDK calls with real output pasted, secrets redacted.
- `exercises/chapter_exercise.md` — 30–60 minutes, this chapter only. Prediction problems,
  true/false **with the mechanism**, and small things to build from scratch. Hints section at the
  bottom, graded and numbered, plus a "what to verify" checklist.
- `exercises/solution/chapter_exercise_worksheet.md` — every problem and question duplicated
  inline with **blank answer blocks**. Do NOT pre-fill it.
- `exercises/cumulative_exercise.md` — 1–3 hours, integrating everything so far. Prefer something
  that **doubles as a whiteboard question** at this level: an end-to-end setup you build, break and observe — cost and IAM stated. Phased, with success
  criteria per phase, and a final phase that breaks the thing and asks what was lost.

**Exercises must never be solved or pre-answered.** Write the problem, the skeleton and the hints.
I write the solution and can share it for review. Do not start the next chapter until I confirm I
have attempted the current one's.

**Verify before shipping a chapter:** run every example and paste its *real* output — never output
written from memory. Where an exercise makes a claim about behaviour, run that too; mis-posed
exercise questions have been caught this way more than once.

**Applies from the next chapter onward.** Chapters 1–7 were written under the older contract
(no `mock.md`, no timed answers, no separate exercise files) and are **deliberately left as they are** — the
depth in them is real, it just is not optimised for the round. Retrofitting them is separate,
optional work; do not silently rewrite them while adding a new chapter.

