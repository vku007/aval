# Terraform Migration Checklist

## Pre-Migration ✓ (COMPLETED)

- [x] Analyzed current AWS infrastructure
- [x] Documented all existing resources
- [x] Created Terraform project structure
- [x] Generated modules for all resource types
- [x] Created import scripts
- [x] Created deployment documentation

## Phase 1: Backend Setup

- [ ] Run `./scripts/setup-backend.sh`
  - [ ] S3 bucket created: vkp-terraform-state-088455116440
  - [ ] Bucket versioning enabled
  - [ ] Bucket encryption enabled
  - [ ] Public access blocked
  - [ ] DynamoDB table created: vkp-terraform-locks
- [ ] Run `terraform init`
  - [ ] Backend initialized successfully
  - [ ] Providers downloaded
  - [ ] Modules initialized

## Phase 2: Resource Import

- [ ] Review `terraform/main.tf` configuration
- [ ] Verify variables in `terraform/variables.tf`
- [ ] Copy `terraform.tfvars.example` to `terraform.tfvars`
- [ ] Run `./scripts/import-resources.sh`

### Import Verification

- [ ] S3 buckets imported (3 buckets)
- [ ] Lambda functions imported (2 functions)
- [ ] IAM roles imported (2 roles)
- [ ] API Gateway imported (API + routes)
- [ ] CloudFront distribution imported
- [ ] Route53 records imported (4 records)

## Phase 3: Validation

- [ ] Run `terraform plan`
- [ ] Review plan output carefully
- [ ] Expected: **0 to add, 0 to change, 0 to destroy**
- [ ] If changes detected:
  - [ ] Review each change
  - [ ] Adjust Terraform configuration to match AWS
  - [ ] Re-run `terraform plan`
  - [ ] Repeat until plan shows 0 changes

## Phase 4: Testing

- [ ] Test small change (e.g., add tag to Lambda)
  ```bash
  # Edit terraform/main.tf, add tag
  terraform plan
  terraform apply
  ```
- [ ] Verify change in AWS console
- [ ] Test Lambda deployment
  ```bash
  cd apiv2
  npm run build
  npm run zip
  cd ../terraform
  terraform apply -target=module.lambda_api2.aws_lambda_function.main
  ```
- [ ] Test API endpoint
  ```bash
  curl https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/files
  ```
- [ ] Verify CloudFront distribution works
  ```bash
  curl https://vkp-consulting.fr
  ```

## Phase 5: Documentation Update

- [ ] Update `apiv2/README.md` with Terraform workflow
- [ ] Update deployment scripts to use Terraform
- [ ] Create team training materials
- [ ] Document rollback procedures

## Phase 6: CI/CD Integration

- [ ] Set up GitHub Actions workflow (if applicable)
- [ ] Configure AWS credentials in CI/CD
- [ ] Test automated deployment
- [ ] Set up notifications for failed deployments

## Phase 7: Cleanup

- [ ] Move old shell scripts to `legacy/` folder
  - [ ] `apiv2/buildAndDeploy.sh` → use Terraform
  - [ ] `apiv2/create_lambda.sh` → replaced by Terraform
  - [ ] Update scripts to reference Terraform
- [ ] Document what was moved and why
- [ ] Keep scripts as reference for 1 month

## Phase 8: Monitoring

- [ ] First week: Daily checks of `terraform plan`
- [ ] Monitor CloudWatch logs for errors
- [ ] Track any manual changes made outside Terraform
- [ ] Address any state drift immediately

## Rollback Plan (If Needed)

If something goes wrong:

1. **Lambda issues**:
   ```bash
   cd apiv2
   aws lambda update-function-code \
     --function-name vkp-api2-service \
     --zip-file fileb://lambda.zip \
     --region eu-north-1
   ```

2. **State corruption**:
   ```bash
   # S3 versioning is enabled, can restore previous state
   aws s3api list-object-versions \
     --bucket vkp-terraform-state-088455116440 \
     --prefix vkp-consulting/terraform.tfstate
   ```

3. **Complete rollback**:
   - Continue using AWS CLI/Console
   - Don't run `terraform apply`
   - Keep Terraform config for future attempt

## Success Criteria

- [x] All existing resources under Terraform management
- [ ] `terraform plan` shows 0 changes
- [ ] Lambda deployments work via Terraform
- [ ] Team trained on Terraform workflow
- [ ] Documentation complete
- [ ] Old scripts moved to legacy/

## Support

- Migration Plan: `TERRAFORM_MIGRATION_PLAN.md`
- Quick Start: `QUICK_START.md`
- Full README: `terraform/README.md`
- Infrastructure Data: `INFRASTRUCTURE_DATA.md`

---

**Start Date**: _______________  
**Completion Date**: _______________  
**Migration Lead**: _______________

## Notes

(Add any notes, issues, or observations during migration)

```

```

