# ------------------------------------------------------------------------------
# GENERIC EXAMPLE: AWS VPC 3-TIER ARCHITECTURE
# This example demonstrates creating a highly available network spanning two
# Availability Zones, including Public Subnets, Private Subnets, and Gateways.
# ------------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "The overarching IPv4 range for the entire network"
  default     = "10.0.0.0/16" 
  # Provides 65,536 Total IPs
}

# ------------------------------------------------------------------------------
# STEP 1: The VPC and Internet Gateway
# ------------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "main-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "main-igw" }
}

# ------------------------------------------------------------------------------
# STEP 2: Public Subnets (For Load Balancers & Bastions)
# These get a Route Table that explicitly points 0.0.0.0/0 to the IGW.
# ------------------------------------------------------------------------------
resource "aws_subnet" "public_az1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24" # 256 IPs
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true          # CRITICAL for public subnets
  tags                    = { Name = "public-us-east-1a" }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public_az1_assoc" {
  subnet_id      = aws_subnet.public_az1.id
  route_table_id = aws_route_table.public_rt.id
}

# ------------------------------------------------------------------------------
# STEP 3: NAT Gateway (For Outbound Private Internet Access)
# NAT Gateways MUST live inside a Public Subnet so they can reach the IGW.
# ------------------------------------------------------------------------------
resource "aws_eip" "nat_ip" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat_ip.id
  subnet_id     = aws_subnet.public_az1.id # Lives in public
  tags          = { Name = "main-nat-gateway" }

  depends_on = [aws_internet_gateway.igw]
}

# ------------------------------------------------------------------------------
# STEP 4: Private Subnets (For EC2 Compute / DBs)
# These get a Route Table pointing 0.0.0.0/0 to the NAT Gateway!
# ------------------------------------------------------------------------------
resource "aws_subnet" "private_az1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24" # 256 IPs
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = false         # CRITICAL for private subnets
  tags                    = { Name = "private-us-east-1a" }
}

resource "aws_route_table" "private_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
}

resource "aws_route_table_association" "private_az1_assoc" {
  subnet_id      = aws_subnet.private_az1.id
  route_table_id = aws_route_table.private_rt.id
}

# ------------------------------------------------------------------------------
# BEST PRACTICE WARNING:
# While writing this manually is excellent for studying for the AWS certification, 
# in the real world, you should ALWAYS use the official Terraform AWS VPC Module:
# source = "terraform-aws-modules/vpc/aws"
# It reduces this 100-line file into a 15-line block.
# ------------------------------------------------------------------------------
