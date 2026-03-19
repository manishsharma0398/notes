# Chapter 11: AWS API Gateway - Interview Questions

### Q1: When integrating API Gateway with a Lambda function, why must you configure an `aws_lambda_permission` resource? Couldn't we just give API Gateway an IAM Instance Role like we do with EC2?
**Answer:**
API Gateway uses **Resource Policies**, not Identity Policies, for executing Lambda functions. 
While you can theoretically assign a cross-service IAM Role to API Gateway (known as Execution Roles), the standard, scalable AWS serverless pattern is to attach a Resource Policy directly to the target Lambda function that implicitly trusts `apigateway.amazonaws.com` coming from a specific API ID. This keeps the authorization logic tightly coupled with the target compute resource in Terraform, preventing complex, global IAM role sprawl for hundreds of different microservice endpoints.

### Q2: You are writing Terraform for an API Gateway that expects 10,000 requests per second. Which Terraform resource prefix should you try to use, `aws_api_gateway_` or `aws_apigatewayv2_`? 
**Answer:**
You should default to `aws_apigatewayv2_` (HTTP APIs). HTTP APIs bypass the legacy API Gateway v1 processing engine. They are significantly faster (lower latency code paths) and cost roughly a third of the price of REST APIs. You only drop back to v1 REST APIs (`aws_api_gateway_`) if you need strict AWS WAF (Web Application Firewall) integration or complex request validation at the edge before hitting your Lambda.

### Q3: A junior engineer created an API Gateway REST API (`aws_api_gateway_...`) in Terraform. They added a new `aws_api_gateway_resource` and a new `aws_api_gateway_method`. Terraform applied successfully, but the new endpoint returns 404 Not Found in the browser. What is missing from the Terraform code?
**Answer:**
The missing piece is the API Stage Deployment lifecycle. 
In REST APIs (v1), creating routes and methods does not automatically expose them. You must create an `aws_api_gateway_deployment` resource, and that deployment must be triggered by a change in the API's hash. If the deployment resource isn't explicitly triggered to redeploy, the live API stage continues serving the old, cached route map (resulting in a 404 for the new route). 

*(Note: This headache is largely solved by HTTP APIs (v2) which support the `auto_deploy = true` flag on the Stage).*

### Q4: Explain the difference between `AWS_PROXY` and `AWS` integration types in API Gateway Terraform.
**Answer:**
*   **AWS_PROXY** is the modern standard. API Gateway takes the entire HTTP request (headers, path, query parameters, body) and dumps it into a massive JSON object, passing it wholesale to the Lambda function. The Lambda handles routing and payload parsing.
*   **AWS** (Custom Integration) requires you to use Apache Velocity Templates (VTL) inside your API Gateway Terraform to manually extract specific headers or URL parameters and format them into a custom JSON payload before passing it to Lambda. It is highly complex to manage in IaC and mostly deprecated for greenfield deployments.
