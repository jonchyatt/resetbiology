---
name: test-driven-dev
description: Implements features using test-driven development approach
version: 1.0.0
triggers:
  - implement with TDD
  - create tests first
  - test-driven implementation
---

# Test-Driven Development Skill

## Purpose
Ensures implementer follows TDD: write tests, watch them fail, make them pass.

## When to Use
- All new feature implementation
- Bug fixes with regression prevention
- Refactoring with safety net

## Operations

### write_failing_test
Creates test that fails initially
Parameters: feature_description

### implement_minimal_code
Implements minimum code to pass test
Parameters: test_file

### refactor_with_safety
Refactors while keeping tests green
Parameters: code_file

## Usage Examples
- "Use test-driven-dev to implement new nutrition calculator"
- "Use test-driven-dev to fix login bug with regression test"
