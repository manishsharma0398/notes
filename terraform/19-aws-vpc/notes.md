# Chapter 14: VPC Networking Cheatsheet

### 1. `aws_vpc`
**Purpose:** Defines the core network boundary.
```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}
```

### 2. `aws_subnet`
**Purpose:** Slices the VPC CIDR into smaller networks tied to a specific Availability Zone (AZ).
```hcl
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true # Typical for Public Subnets
}
```

### 3. `aws_internet_gateway` (IGW)
**Purpose:** Provides a door to the public internet. Attached linearly to the VPC.

### 4. `aws_route_table` & `aws_route`
**Purpose:** Defines where network traffic should go.
```hcl
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route" "internet_route" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}
```

### 5. `aws_route_table_association`
**Purpose:** Binds a Subnet to a Route Table. If you forget to attach this, AWS silently assigns your subnet to the hidden "Default" VPC route table, which often breaks network isolation assumptions.

### 6. `aws_security_group`
**Best Practice:** Use distinct ingress and egress rules. The default behavior of a newly created AWS Security Group prevents ALL inbound traffic, but allows ALL OUTBOUND (`0.0.0.0/0`) traffic. In highly secure environments, you must explicitly rewrite the egress rule.

```hcl
resource "aws_security_group" "web" {
  vpc_id      = aws_vpc.main.id
  name        = "web-sg"
}

resource "aws_vpc_security_group_ingress_rule" "allow_https" {
  security_group_id = aws_security_group.web.id
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"
}
```
