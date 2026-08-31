# Lambda packages

Two live packages. Infrastructure is Terraform; zip artifacts are built here.

```
lambda/
├── src/                 # vkp-simple-service (API v1)
├── cognito-triggers/    # User Pool pre-signup / post-confirmation / pre-token
├── package.json
└── README.md
```

CLI bootstrap scripts, original service plans, and unused Lambda@Edge live in [`../obsolete/lambda/`](../obsolete/lambda/).

## API v1 — `vkp-simple-service`

Handler: [`src/handler.ts`](src/handler.ts). Routes: `ANY /api`, `ANY /api/{proxy+}`.

It is a small HTTP API v2 demo (CORS, GET hello, POST echo). It is **not** S3 file CRUD — that is API v2 (`apiv2/`). No Cognito.

Deploy:

```bash
cd lambda
npm ci && npm test && npm run build && npm run zip
cd ../terraform
terraform apply -target=module.lambda_simple.aws_lambda_function.main
```

Zip path expected by Terraform: `lambda/lambda.zip`.

## Cognito triggers

Source: [`cognito-triggers/src/`](cognito-triggers/src/). Functions: `vkp-cognito-pre-signup`, `vkp-cognito-post-confirmation`, `vkp-cognito-pre-token-generation`.

After updating trigger code, re-attach the triggers on the user pool (Terraform cannot do that without a cycle). Full commands: [terraform/README.md](../terraform/README.md).

```bash
cd lambda/cognito-triggers
npm ci && npm run zip
cd ../../terraform
terraform apply \
  -target='module.cognito[0].aws_lambda_function.pre_signup' \
  -target='module.cognito[0].aws_lambda_function.post_confirmation' \
  -target='module.cognito[0].aws_lambda_function.pre_token_generation'
```

Auth behavior: [AUTH.md](../AUTH.md).
