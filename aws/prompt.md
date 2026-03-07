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
