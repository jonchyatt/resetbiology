---
name: test-generator
description: Generates comprehensive test suites for ResetBiology.com features
version: 1.0.0
triggers:
  - generate tests for
  - create test suite for
  - write tests for
---

# Test Generator Skill

## Purpose
Automatically generates test suites based on code analysis and user flows.

## When to Use
- Creating tests for new features
- Generating regression tests
- Building test coverage

## Operations

### analyze_code
Analyzes code to determine test needs
Parameters: file_path

### generate_unit_tests
Creates unit tests
Parameters: function_signature, expected_behavior

### generate_integration_tests
Creates integration tests
Parameters: feature_description, dependencies

## Usage Examples
- "Use test-generator to create tests for peptide calculator"
- "Use test-generator to generate checkout flow tests"
