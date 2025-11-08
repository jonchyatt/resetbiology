---
name: health-monitor
description: Monitors site health, uptime, and performance metrics
version: 1.0.0
triggers:
  - check site health
  - monitor performance
  - check system status
---

# Health Monitor Skill

## Purpose
Continuously monitors ResetBiology.com health, performance, and availability.

## When to Use
- Daily health checks
- Performance monitoring
- Uptime validation
- Error tracking

## Required Tools
- playwright_mcp (for page checks)
- network access to production site

## Operations

### check_uptime
Verifies site is accessible
Parameters: url

### measure_performance
Measures Core Web Vitals
Parameters: url

### check_api_health
Tests API endpoint responses
Parameters: endpoint_list

## Usage Examples
- "Use health-monitor to check site is up"
- "Use health-monitor to measure homepage performance"
