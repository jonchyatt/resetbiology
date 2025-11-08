---
name: code-generator
description: Generates code following ResetBiology.com patterns and conventions
version: 1.0.0
triggers:
  - generate code for
  - implement feature
  - create component
---

# Code Generator Skill

## Purpose
Generates production-ready code following ResetBiology.com conventions.

## When to Use
- Implementing approved features
- Creating new components
- Building API endpoints

## Operations

### generate_component
Creates React component
Parameters: component_name, props, styling

### generate_api_route
Creates Next.js API route
Parameters: endpoint_name, methods, auth_required

### generate_database_model
Creates Prisma model
Parameters: model_name, fields

## Usage Examples
- "Use code-generator to create a new peptide tracking component"
- "Use code-generator to implement checkout API endpoint"
