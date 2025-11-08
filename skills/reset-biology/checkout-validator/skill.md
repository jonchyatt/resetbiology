---
name: reset-biology-checkout-validator
description: Tests complete checkout flow with Stripe integration
version: 1.0.0
triggers:
  - test checkout flow
  - validate payment processing
  - check Stripe integration
---

# ResetBiology Checkout Validator

## Purpose
Tests end-to-end checkout process including Stripe payment.

## Required Tools
- playwright_mcp
- Stripe test mode credentials

## Operations

### test_full_checkout
Tests complete checkout flow
Parameters: test_card, product_id

### validate_stripe_webhook
Tests webhook handling
Parameters: webhook_event

### test_order_creation
Validates order is created in database
Parameters: checkout_session

## Usage Examples
- "Use reset-biology-checkout-validator to test checkout with test card"
- "Use reset-biology-checkout-validator to validate order creation"
