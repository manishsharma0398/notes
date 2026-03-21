# Chapter 11: AWS API Gateway

API Gateway is the managed routing layer for AWS serverless architectures. It acts as the "front door" for applications to access data, business logic, or functionality extending from your backend services, most commonly AWS Lambda.

In Terraform, the complexity of configuring API Gateway depends entirely on which *version* of the API Gateway you choose to deploy.

---

## 1. HTTP APIs (v2) vs. REST APIs (v1)

AWS offers two primary flavors of API Gateway. Knowing the difference is critical before you write any infrastructure code.

### REST APIs (API Gateway v1)
*   **Terraform Resources:** Prefixed with `aws_api_gateway_` (e.g., `aws_api_gateway_rest_api`).
*   **Pros:** Supports massive enterprise features (Request validation, WAF integration, Edge-optimization, usage plans/API keys).
*   **Cons:** Extremely verbose to write in Terraform. You have to independently define the API, the Resource (path), the Method (GET/POST), the Integration (Lambda), the Integration Response, and finally the Deployment mechanism.

### HTTP APIs (API Gateway v2)
*   **Terraform Resources:** Prefixed with `aws_apigatewayv2_` (e.g., `aws_apigatewayv2_api`).
*   **Pros:** Up to 71% cheaper and up to 60% lower latency than REST APIs. Incredibly easy to configure in Terraform. Native OIDC/OAuth2 support.
*   **Cons:** Missing some high-end features (like AWS WAF integration).
*   **Best Practice:** Always use HTTP APIs (v2) for standard Serverless/Lambda applications unless you explicitly require a feature only available in REST APIs.

---

## 2. The HTTP API Components in Terraform

To expose a Lambda function to the internet using the modern HTTP API (v2), you need four resources:

1.  **The API Shell (`aws_apigatewayv2_api`)**: Defines the name and protocol (HTTP).
2.  **The Stage (`aws_apigatewayv2_stage`)**: Defines the deployment lifecycle (e.g., `$default` or `v1`).
3.  **The Integration (`aws_apigatewayv2_integration`)**: Tells the API *where* to send the traffic. For Lambda, you point this at the Lambda's Invoke ARN using `integration_type = "AWS_PROXY"`.
4.  **The Route (`aws_apigatewayv2_route`)**: Maps a specific HTTP path (e.g., `POST /upload`) to the Integration.

---

## 3. The `aws_lambda_permission` Requirement

When you link an API Gateway to a Lambda function, **Terraform will deploy successfully, but the API will return HTTP 500 errors when you hit it.**

Why?
As covered in Chapter 08, AWS operates on a model of absolute Least Privilege. Just because API Gateway *knows* about the Lambda does not mean it is *allowed* to run it.

You must explicitly grant the API Gateway service permission to execute your specific Lambda function. You do this using an AWS Resource Policy via the `aws_lambda_permission` resource in Terraform.

```hcl
resource "aws_lambda_permission" "api_gateway_invoke_permission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.my_lambda.function_name # The Chapter 10 Lambda
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.my_api.execution_arn}/*/*"
}
```
