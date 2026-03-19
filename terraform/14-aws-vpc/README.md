# Chapter 14: AWS VPC Networking

The Virtual Private Cloud (VPC) is the foundational networking layer of AWS. Understanding how to build a multi-tier network architecture in Terraform is the single most tested skill in Cloud Engineering interviews.

---

## 1. The 3-Tier Network Architecture

When deploying infrastructure (like EC2 instances, RDS databases, or classical load-balanced web servers), you never place everything on the public internet. You build a 3-tier VPC.

### 1. The VPC (`aws_vpc`)
A logically isolated network slice of the AWS cloud defined by an IPv4 CIDR block (e.g., `10.0.0.0/16`). It provides up to 65,536 private IP addresses.

### 2. Public Subnets (`aws_subnet`)
*   **Purpose:** Hold resources that MUST face the public internet (Application Load Balancers, Bastion Hosts).
*   **Terraform Definition:** A subnet becomes "Public" when it has an `aws_route_table` that explicitly routes `0.0.0.0/0` (all internet traffic) to an `aws_internet_gateway` (IGW).

### 3. Private Subnets
*   **Purpose:** Hold your compute resources (EC2, ECS containers, private Lambdas).
*   **Terraform Definition:** A subnet becomes "Private" when it has no direct route to an Internet Gateway. However, servers often need to download patches or talk to external APIs. To allow *outbound* internet access without allowing *inbound* internet connections, you route `0.0.0.0/0` to an `aws_nat_gateway` deployed inside the Public Subnet.

### 4. Isolated Subnets (Data Tier)
*   **Purpose:** Hold databases (RDS, Aurora, Elasticache).
*   **Terraform Definition:** These subnets have absolutely no routes to an Internet Gateway or a NAT Gateway. They are completely cut off from the outside world and can only talk to servers in the Private or Public subnets.

---

## 2. Infrastructure Footprint of a Basic VPC

To fully provision a highly available network across Two Availability Zones (AZs) in Terraform, you must create a massive web of resources:
1.  **VPC** (1x `aws_vpc`)
2.  **Internet Gateway** (1x `aws_internet_gateway`)
3.  **Subnets** (2x Public, 2x Private, 2x Isolated)
4.  **NAT Gateways** (1x or 2x `aws_nat_gateway` + `aws_eip` Elastic IPs)
5.  **Route Tables** (1x Public RT, 2x Private RTs, 1x Isolated RT)
6.  **Route Table Associations** (`aws_route_table_association` tying Subnets to Route Tables).

*(Note: Because raw VPC networking requires 20+ resource blocks, almost the entire industry uses the official `terraform-aws-modules/vpc/aws` module rather than writing this from scratch every time).*

---

## 3. Security Groups (`aws_security_group`)

Security Groups act as virtual firewalls at the *instance* level.

In Terraform, always write Security Group rules as separate resources (`aws_security_group_rule`) instead of embedding them directly inside the `aws_security_group` block. This prevents circular dependency crashes.

**Crucial Concept: Stateful Inspection**
AWS Security Groups are "Stateful". If you write an Inbound (Ingress) rule allowing traffic on Port 443, the Security Group automatically allows the return (Egress) traffic corresponding to that request, regardless of outbound rules.
