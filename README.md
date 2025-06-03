# Deployment Instructions

## Automatic Deployment

### Prerequisites
*   Docker installed and running
*   AWS CLI installed and configured with appropriate credentials
*   An AWS account
*   Pulumi installed and configured

### Deployment Steps

1. **Navigate to infra folder and configure stack:**
   ```bash
   cd infra
   export PULUMI_CONFIG_PASSPHRASE='superstrongpassphrase'
   pulumi config set test-service-infra:sentryDsn "https://<something>.ingest.us.sentry.io/<something>" --secret
   ```
   *Note: If prompted to create a stack, create one named `dev`*

2. **Deploy:**
   ```bash
   pulumi up --non-interactive --skip-preview
   ```

### Cleanup
```bash
pulumi destroy --non-interactive --skip-preview
```

---

## Manual Deployment

### Prerequisites
*   Docker installed and running
*   AWS CLI installed and configured with appropriate credentials
*   An AWS account

### Deployment Steps

1.  **Create Lambda Execution Role:**

    Create a trust policy file:
    ```bash
    cat > lambda-trust-policy.json << EOF
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": "lambda.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }
    EOF
    ```

    Create the IAM role:
    ```bash
    aws iam create-role --role-name lambda-execution-role --assume-role-policy-document file://lambda-trust-policy.json
    ```

    Attach the basic Lambda execution policy:
    ```bash
    aws iam attach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    ```

2.  **Build the Docker Image for x86_64:**
    ```bash
    docker build --platform linux/amd64 -t <image-name> .
    ```
    *Note: The `--platform linux/amd64` flag ensures compatibility with AWS Lambda's default x86_64 architecture, regardless of your host machine (including Apple Silicon Macs).*

3.  **Authenticate with ECR:**
    ```bash
    aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
    ```

4.  **Create an ECR Repository:**
    ```bash
    aws ecr create-repository --repository-name <repository-name> --region <region>
    ```

5.  **Tag the Docker Image:**
    ```bash
    docker tag <image-name> <account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest
    ```

6.  **Push the Docker Image to ECR:**
    ```bash
    docker push <account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest
    ```

7.  **Create Lambda Function:**
    ```bash
    aws lambda create-function \
        --function-name <function-name> \
        --package-type Image \
        --code ImageUri=<account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest \
        --role arn:aws:iam::<account-id>:role/lambda-execution-role \
        --region <region>
    ```

8.  **Create Function URL:**
    ```bash
    aws lambda create-function-url-config \
        --function-name <function-name> \
        --auth-type NONE \
        --cors '{
            "AllowCredentials": false,
            "AllowHeaders": ["date", "keep-alive"],
            "AllowMethods": ["*"],
            "AllowOrigins": ["*"],
            "ExposeHeaders": ["date", "keep-alive"],
            "MaxAge": 86400
        }' \
        --region <region>
    ```

9.  **Add Function URL Permission:**
    ```bash
    aws lambda add-permission \
        --function-name <function-name> \
        --statement-id FunctionURLAllowPublicAccess \
        --action lambda:InvokeFunctionUrl \
        --principal "*" \
        --function-url-auth-type NONE \
        --region <region>
    ```

10. **Configure Lambda Function (Optional):**
    ```bash
    aws lambda update-function-configuration \
        --function-name <function-name> \
        --environment '{"Variables": {"SENTRY_DSN": "<your-sentry-dsn>"}}' \
        --timeout 30 \
        --memory-size 512 \
        --region <region>
    ```

### Test Your Function
```bash
curl -X GET <function-url>/health
```

### Cleanup
Delete all resources when no longer needed:

```bash
# Delete function URL
aws lambda delete-function-url-config --function-name <function-name> --region <region>

# Remove function URL permission
aws lambda remove-permission --function-name <function-name> --statement-id FunctionURLAllowPublicAccess --region <region>

# Delete Lambda function
aws lambda delete-function --function-name <function-name> --region <region>

# Delete ECR repository and all images
aws ecr delete-repository --repository-name <repository-name> --force --region <region>

# Detach policy and delete IAM role
aws iam detach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name lambda-execution-role

# Clean up local files
rm lambda-trust-policy.json
```

Your Lambda function is now deployed and accessible via the function URL.
