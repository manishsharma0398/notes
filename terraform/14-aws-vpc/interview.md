# Chapter 14: AWS VPC - Interview Questions

### Q1: In Terraform, what dictates whether an `aws_subnet` is "Public" or "Private"? Is there a specific argument inside the `aws_subnet` resource that defines this?
**Answer:**
No, there is no "type" argument on the `aws_subnet` itself. In AWS, a subnet is defined entirely by its Route Table. 

In Terraform, you must create an `aws_route_table`, attach a route (`aws_route`) pointing `0.0.0.0/0` to an `aws_internet_gateway`, and then tie that route table to your specific subnet using an `aws_route_table_association`. That explicit routing path to the IGW is the sole factor that makes a subnet "Public." If it lacks that route (or routes internet traffic to a NAT Gateway instead), it is considered "Private."

### Q2: You are writing Terraform for an EC2 instance that lives in a Private Subnet. It needs to download security patches from `ubuntu.com`, but it should never accept incoming web connections. What specific resources must you build to allow this?
**Answer:**
You need a NAT Gateway. In Terraform, you must provision an `aws_eip` (Elastic IP address) and an `aws_nat_gateway`. Crucially, the NAT Gateway must be deployed *inside a Public Subnet*. 

Then, you create a dedicated Private Route Table (`aws_route_table`), define a route (`aws_route`) that sends all outbound internet traffic (`0.0.0.0/0`) to the ID of the NAT Gateway, and explicitly associate it with your Private Subnet. 

### Q3: You deploy two security groups: `App_SG` (for EC2 servers) and `DB_SG` (for RDS databases). What is the most secure way to permit `App_SG` to talk to `DB_SG` on port 5432 using Terraform? 
**Answer:**
You should never use raw IP addresses/CIDR blocks to link internal resources. Instead, you reference the Security Groups against each other. 

You write an ingress rule (`aws_vpc_security_group_ingress_rule`) for the `DB_SG` on port 5432, and for the `referenced_security_group_id`, you dynamically input the ID of `App_SG` via `${aws_security_group.app_sg.id}`. This ensures that any EC2 instance holding the `App_SG` identity automatically gains access to the database, regardless of what dynamic IP address AWS assigns to the EC2 server.

### Q4: Explain why Network Access Control Lists (NACLs) are rarely written heavily in modern Terraform, whereas Security Groups are everywhere.
**Answer:**
NACLs (`aws_network_acl`) are stateless firewalls that operate at the massive Subnet boundary level, meaning you have to explicitly define both inbound AND outbound rules for ephemeral return ports (which is a colossal headache in IaC). 

Security Groups (`aws_security_group`) act at the granular Instance level and are stateful. Because they automatically allow return traffic for valid inbound requests, they are vastly easier to manage in Terraform code and align perfectly with microservice architectures. NACLs are usually just left at their default "Allow All" state in IaC setups, acting only as a break-glass absolute blocklist for known bad IPs.
