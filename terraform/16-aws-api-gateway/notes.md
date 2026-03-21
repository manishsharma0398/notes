# Chapter 11: AWS API Gateway Cheatsheet (HTTP API v2)

### 1. `aws_apigatewayv2_api`
**Purpose:** Creates the HTTP API.
```hcl
resource "aws_apigatewayv2_api" "http" {
  name          = "my-proxy-api"
  protocol_type = "HTTP"
}
```

### 2. `aws_apigatewayv2_stage`
**Purpose:** Creates a deployment stage. For simple APIs, use the `$default` stage with `auto_deploy = true`.
```hcl
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}
```

### 3. `aws_apigatewayv2_integration`
**Purpose:** Connects the API Gateway to your backend compute (the Lambda).
**Crucial Field:** `integration_uri` must be the Lambda's **Invoke ARN**, *not* its standard ARN.
```hcl
resource "aws_apigatewayv2_integration" "lambda_proxy" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST" 
  
  # AWS_PROXY requires the invoke_arn
  integration_uri    = aws_lambda_function.my_lambda.invoke_arn 
}
```

### 4. `aws_apigatewayv2_route`
**Purpose:** Maps an HTTP Path string to the Integration created above.
```hcl
resource "aws_apigatewayv2_route" "catch_all" {
  api_id    = aws_apigatewayv2_api.http.id
  # You can route specific paths like "POST /upload", 
  # or use ANY /{proxy+} to send all traffic to the Lambda router.
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}
```

### 5. `aws_lambda_permission`
**Purpose:** Resource Policy granting API Gateway the right to invoke the Lambda.
**Crucial Field:** `source_arn` should be locked down to the specific API Gateway Execution ARN.
```hcl
resource "aws_lambda_permission" "api_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.my_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  
  # Allow any stage/method/path inside this specific API to invoke
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
```
