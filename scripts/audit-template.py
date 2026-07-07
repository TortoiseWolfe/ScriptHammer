#!/usr/bin/env python3
"""
Audit Template Generator - Consistent audit file structure

Reduces AI formatting overhead with standardized templates.
Usage: python3 scripts/audit-template.py <role> <topic> [options]

Commands:
  generate <role> <topic>  Generate audit template
  list                     List available templates

Options:
  --output <path>          Write to file (default: print)
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/audit-template.py toolsmith skills
  python3 scripts/audit-template.py architect deps
  python3 scripts/audit-template.py generate devops ci
  python3 scripts/audit-template.py list
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Output directory
AUDITS_DIR = PROJECT_ROOT / "docs" / "interoffice" / "audits"

# Templates by role
TEMPLATES = {
    "toolsmith": {
        "skills": {
            "title": "Skill Review",
            "sections": [
                ("## Executive Summary", "Brief overview of findings."),
                ("## Skills Analyzed", "| Skill | Purpose | Issues |\n|-------|---------|--------|\n| | | |"),
                ("## Recommendations", "1. \n2. \n3. "),
                ("## Action Items", "- [ ] \n- [ ] "),
            ]
        },
        "scripts": {
            "title": "Script Audit",
            "sections": [
                ("## Executive Summary", "Overview of script analysis."),
                ("## Scripts Reviewed", "| Script | LOC | Status |\n|--------|-----|--------|\n| | | |"),
                ("## Issues Found", "1. \n2. "),
                ("## Recommended Changes", "- [ ] \n- [ ] "),
            ]
        },
        "automation": {
            "title": "Automation Review",
            "sections": [
                ("## Executive Summary", "Token-burning operations analysis."),
                ("## Identified Opportunities", "| Operation | Token Cost | Script Alternative |\n|-----------|------------|--------------------|\n| | | |"),
                ("## Priority Matrix", "| Priority | Script | Estimated Savings |\n|----------|--------|-------------------|\n| | | |"),
                ("## Implementation Plan", "1. \n2. "),
            ]
        }
    },
    "architect": {
        "deps": {
            "title": "Dependency Analysis",
            "sections": [
                ("## Executive Summary", "Dependency graph analysis."),
                ("## Dependency Issues", "| Feature | Issue | Impact |\n|---------|-------|--------|\n| | | |"),
                ("## Circular Dependencies", "None found / List here"),
                ("## Recommendations", "1. \n2. "),
            ]
        },
        "patterns": {
            "title": "Pattern Review",
            "sections": [
                ("## Executive Summary", "Architecture pattern analysis."),
                ("## Patterns Identified", "| Pattern | Usage | Compliance |\n|---------|-------|------------|\n| | | |"),
                ("## Anti-Patterns", "1. \n2. "),
                ("## Recommendations", "- [ ] \n- [ ] "),
            ]
        }
    },
    "security": {
        "auth": {
            "title": "Authentication Audit",
            "sections": [
                ("## Executive Summary", "Auth implementation review."),
                ("## OWASP Checklist", "| Category | Status | Notes |\n|----------|--------|-------|\n| A01 Broken Access Control | | |\n| A02 Cryptographic Failures | | |"),
                ("## Vulnerabilities", "None found / List here"),
                ("## Recommendations", "1. \n2. "),
            ]
        },
        "secrets": {
            "title": "Secrets Audit",
            "sections": [
                ("## Executive Summary", "Secrets management review."),
                ("## Scan Results", "| Severity | Count | Examples |\n|----------|-------|----------|\n| | | |"),
                ("## Exposed Secrets", "None found / List here"),
                ("## Remediation Steps", "1. \n2. "),
            ]
        }
    },
    "devops": {
        "ci": {
            "title": "CI/CD Review",
            "sections": [
                ("## Executive Summary", "Pipeline analysis."),
                ("## Workflow Status", "| Workflow | Status | Issues |\n|----------|--------|--------|\n| | | |"),
                ("## Performance Metrics", "- Build time: \n- Test time: "),
                ("## Recommendations", "1. \n2. "),
            ]
        },
        "docker": {
            "title": "Docker Configuration Review",
            "sections": [
                ("## Executive Summary", "Container configuration analysis."),
                ("## Images Reviewed", "| Image | Size | Layers | Issues |\n|-------|------|--------|--------|\n| | | | |"),
                ("## Security Scan", "- Vulnerabilities: \n- Recommendations: "),
                ("## Optimization Opportunities", "1. \n2. "),
            ]
        }
    },
    "auditor": {
        "compliance": {
            "title": "Compliance Audit",
            "sections": [
                ("## Executive Summary", "Constitution compliance review."),
                ("## Principle Compliance", "| Principle | Score | Issues |\n|-----------|-------|--------|\n| I. Component Structure | | |\n| II. Test-First | | |"),
                ("## Critical Issues", "1. \n2. "),
                ("## Recommendations", "- [ ] \n- [ ] "),
            ]
        },
        "code": {
            "title": "Code Quality Audit",
            "sections": [
                ("## Executive Summary", "Code quality analysis."),
                ("## Metrics", "| Metric | Value | Target |\n|--------|-------|--------|\n| | | |"),
                ("## Issues", "| Severity | Count | Examples |\n|----------|-------|----------|\n| | | |"),
                ("## Action Items", "1. \n2. "),
            ]
        }
    }
}


def generate_template(role: str, topic: str) -> str:
    """Generate audit template"""
    if role not in TEMPLATES:
        return None
    if topic not in TEMPLATES[role]:
        return None

    template = TEMPLATES[role][topic]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    lines = [
        f"# {role.title()} Audit: {template['title']}",
        "",
        f"**Date**: {today}",
        f"**Author**: {role.title()}",
        f"**Scope**: {topic.title()} review",
        "",
        "---",
        "",
    ]

    for heading, content in template["sections"]:
        lines.append(heading)
        lines.append("")
        lines.append(content)
        lines.append("")

    lines.extend([
        "---",
        "",
        "## Related Documents",
        "",
        "- ",
        "",
    ])

    return "\n".join(lines)


def list_templates() -> dict:
    """List all available templates"""
    result = {}
    for role, topics in TEMPLATES.items():
        result[role] = list(topics.keys())
    return result


# Command handlers

def cmd_generate(role: str, topic: str, args):
    """Generate audit template"""
    template = generate_template(role.lower(), topic.lower())

    if not template:
        print(f"Error: No template for role '{role}' topic '{topic}'", file=sys.stderr)
        print(f"Available: {json.dumps(list_templates(), indent=2)}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        output = {
            "role": role,
            "topic": topic,
            "template": template
        }
        print(json.dumps(output, indent=2))
        return

    if args.output:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = AUDITS_DIR / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(template)
        print(f"Template written to: {output_path}")
    else:
        print(template)


def cmd_list(args):
    """List all templates"""
    templates = list_templates()

    if args.json:
        print(json.dumps(templates, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print("| AUDIT TEMPLATES" + " " * 62 + "|")
    print("+" + "-" * 78 + "+")

    for role, topics in templates.items():
        topics_str = ", ".join(topics)
        print(f"| {role.upper():<15} | {topics_str:<58} |")

    print("+" + "=" * 78 + "+")
    print()
    print("Usage: audit-template.py <role> <topic>")
    print("Example: audit-template.py toolsmith skills")


def to_summary(args) -> str:
    """Generate one-line summary"""
    templates = list_templates()
    total = sum(len(topics) for topics in templates.values())
    return f"Audit Templates: {len(templates)} roles | {total} templates"


def main():
    parser = argparse.ArgumentParser(
        description="Audit Template Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="list",
                       help="Command or role name")
    parser.add_argument("args", nargs="*", help="Topic or additional args")
    parser.add_argument("--output", type=str, help="Output file path")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Handle summary
    if args.summary:
        print(to_summary(args))
        return

    # Handle commands
    if args.command == "list":
        cmd_list(args)
    elif args.command == "generate":
        if len(args.args) < 2:
            print("Error: generate requires <role> <topic>", file=sys.stderr)
            sys.exit(1)
        cmd_generate(args.args[0], args.args[1], args)
    elif args.command in TEMPLATES:
        # Role name provided directly
        if not args.args:
            print(f"Error: Please specify topic for {args.command}", file=sys.stderr)
            print(f"Available topics: {list(TEMPLATES[args.command].keys())}", file=sys.stderr)
            sys.exit(1)
        cmd_generate(args.command, args.args[0], args)
    else:
        print(f"Error: Unknown command '{args.command}'", file=sys.stderr)
        cmd_list(args)
        sys.exit(1)


if __name__ == "__main__":
    main()
