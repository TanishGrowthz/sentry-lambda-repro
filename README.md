# Manual Deployment Instructions

This README provides instructions for manually deploying the Lambda function using Docker and Amazon Elastic Container Registry (ECR).

## Prerequisites

*   Docker installed and running.
*   AWS CLI installed and configured with appropriate credentials.
*   An AWS account.

## Deployment Steps

1.  **Build the Docker Image:**

    Navigate to the root of your project and build the Docker image using the `Dockerfile` in the `infra` directory:

    ```bash
    docker build -t <image-name> -f infra/Dockerfile .
    ```

    Replace `<image-name>` with a desired name for your Docker image.

2.  **Authenticate with ECR:**

    Authenticate your Docker client to the Amazon ECR registry. Replace `<region>` with your AWS region and `<account-id>` with your AWS account ID.

    ```bash
    aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
    ```

3.  **Create an ECR Repository (if it doesn't exist):**

    If you don't have an ECR repository for your image, create one. Replace `<repository-name>` with your desired repository name.

    ```bash
    aws ecr create-repository --repository-name <repository-name> --region <region>
    ```

4.  **Tag the Docker Image:**

    Tag your built Docker image with the ECR repository URI. Replace `<image-name>`, `<account-id>`, `<region>`, and `<repository-name>` with your respective values.

    ```bash
    docker tag <image-name> <account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest
    ```

5.  **Push the Docker Image to ECR:**

    Push the tagged Docker image to your ECR repository.

    ```bash
    docker push <account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest
    ```

6.  **Create a Lambda Function:**

    You can create a Lambda function using the AWS Management Console, AWS CLI, or an infrastructure as code tool like Pulumi or CloudFormation. When creating the function, select "Container image" as the package type and specify the ECR image URI.

    *   **Using AWS CLI:**

        ```bash
        aws lambda create-function --function-name <function-name> --package-type Image --code ImageUri=<account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest --role <lambda-execution-role-arn> --region <region>
        ```

        Replace `<function-name>` with your desired Lambda function name and `<lambda-execution-role-arn>` with the ARN of an IAM role that has permissions to execute Lambda functions and access ECR.

7.  **Configure Lambda Function:**

    Configure your Lambda function with necessary environment variables, memory, timeout, and other settings as required by your application.

    *   **Using AWS CLI (example for setting environment variables):**

        ```bash
        aws lambda update-function-configuration --function-name <function-name> --environment '{"Variables": {"SENTRY_DSN": "<your-sentry-dsn>"}}' --region <region>
        ```

        Replace `<function-name>` and `<your-sentry-dsn>` with your respective values.

Now your Lambda function is deployed and configured to use the Docker image from ECR.

