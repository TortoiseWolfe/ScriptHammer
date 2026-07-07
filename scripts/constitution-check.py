#!/usr/bin/env python3
"""
Constitution Check - Compliance validation against constitution.md principles

Automates compliance checks that were previously done by AI parsing.
Usage: python3 scripts/constitution-check.py [file|directory] [options]

Commands:
  check <path>             Check file or directory for compliance
  principles               List all checkable principles
  report                   Full compliance report for project

Options:
  --principle <num>        Check specific principle only (I, II, III, etc.)
  --json                   Output as JSON
  --summary                One-line summary

Examples:
  python3 scripts/constitution-check.py features/foundation/000-rls/spec/spec.md
  python3 scripts/constitution-check.py features/ --principle I
  python3 scripts/constitution-check.py report --json
"""

import argparse
import json
import re
import sys
from pathlib import Path
from collections import defaultdict

# Find project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Key paths
CONSTITUTION_FILE = PROJECT_ROOT / ".specify" / "memory" / "constitution.md"
FEATURES_DIR = PROJECT_ROOT / "features"

# Constitution Principles (checkable rules)
PRINCIPLES = {
    "I": {
        "name": "Component Structure (5-file pattern)",
        "description": "Each UI component must have 5 files",
        "checks": [
            {"name": "index.tsx exists", "pattern": r"index\.tsx"},
            {"name": "Component.tsx exists", "pattern": r"[A-Z][a-zA-Z]+\.tsx"},
            {"name": ".test.tsx exists", "pattern": r"\.test\.tsx"},
            {"name": ".stories.tsx exists", "pattern": r"\.stories\.tsx"},
            {"name": ".accessibility.test.tsx exists", "pattern": r"\.accessibility\.test\.tsx"},
        ],
        "file_types": [".tsx", ".ts"]
    },
    "II": {
        "name": "Test-First Development",
        "description": "Tests must be written before implementation",
        "checks": [
            {"name": "Has test file", "pattern": r"\.test\.(ts|tsx)"},
            {"name": "Coverage target mentioned", "pattern": r"(25%|coverage|test)"},
        ],
        "spec_keywords": ["test", "coverage", "vitest", "playwright"]
    },
    "III": {
        "name": "SpecKit Workflow",
        "description": "Complete specification workflow required",
        "checks": [
            {"name": "Has spec.md", "file": "spec.md"},
            {"name": "Has plan.md", "file": "plan.md"},
            {"name": "Has tasks.md", "file": "tasks.md"},
        ],
        "required_files": ["spec.md", "plan.md", "tasks.md"]
    },
    "IV": {
        "name": "Docker-First Development",
        "description": "No local installs, all via Docker",
        "checks": [
            {"name": "No npm install", "anti_pattern": r"npm install(?!\s+--save)"},
            {"name": "No local node", "anti_pattern": r"node_modules"},
            {"name": "Uses Docker", "pattern": r"docker|container"},
        ],
        "anti_patterns": ["npm install -g", "brew install", "apt install", "pip install"]
    },
    "V": {
        "name": "Progressive Enhancement",
        "description": "PWA, accessibility, mobile-first",
        "checks": [
            {"name": "Mentions accessibility", "pattern": r"(a11y|accessibility|wcag|aria)"},
            {"name": "Mobile-first", "pattern": r"(mobile|responsive|breakpoint)"},
            {"name": "PWA features", "pattern": r"(pwa|service.worker|offline)"},
        ],
        "keywords": ["accessibility", "mobile", "pwa", "responsive"]
    },
    "VI": {
        "name": "Privacy First",
        "description": "GDPR compliance, consent before tracking",
        "checks": [
            {"name": "Consent mention", "pattern": r"(consent|gdpr|privacy|opt.in)"},
            {"name": "No tracking without consent", "anti_pattern": r"(analytics|tracking)(?!.*consent)"},
        ],
        "keywords": ["consent", "gdpr", "privacy", "analytics"]
    }
}


def load_constitution() -> str:
    """Load constitution.md content"""
    if CONSTITUTION_FILE.exists():
        return CONSTITUTION_FILE.read_text()
    return ""


def check_file_content(content: str, principle_id: str) -> dict:
    """Check file content against a principle"""
    principle = PRINCIPLES.get(principle_id, {})
    result = {
        "principle": principle_id,
        "name": principle.get("name", ""),
        "passed": [],
        "failed": [],
        "warnings": []
    }

    for check in principle.get("checks", []):
        check_name = check.get("name", "")

        # Pattern match
        if "pattern" in check:
            if re.search(check["pattern"], content, re.IGNORECASE):
                result["passed"].append(check_name)
            else:
                result["failed"].append(check_name)

        # Anti-pattern match
        if "anti_pattern" in check:
            if re.search(check["anti_pattern"], content, re.IGNORECASE):
                result["failed"].append(f"Violates: {check_name}")
            else:
                result["passed"].append(f"No violation: {check_name}")

    return result


def check_feature_directory(feature_dir: Path, principle_id: str = None) -> dict:
    """Check a feature directory for compliance"""
    result = {
        "feature": feature_dir.name,
        "path": str(feature_dir.relative_to(PROJECT_ROOT)),
        "principles": {},
        "overall_score": 0,
        "issues": []
    }

    # Find spec directory
    spec_dir = feature_dir / "spec"
    spec_content = ""
    if (spec_dir / "spec.md").exists():
        spec_content = (spec_dir / "spec.md").read_text()

    # Check each principle or specific one
    principles_to_check = [principle_id] if principle_id else PRINCIPLES.keys()

    total_passed = 0
    total_checks = 0

    for pid in principles_to_check:
        if pid not in PRINCIPLES:
            continue

        principle = PRINCIPLES[pid]
        principle_result = {
            "name": principle["name"],
            "passed": [],
            "failed": [],
            "score": 0
        }

        # Check for required files (Principle III)
        if "required_files" in principle:
            for req_file in principle["required_files"]:
                if (spec_dir / req_file).exists():
                    principle_result["passed"].append(f"Has {req_file}")
                else:
                    principle_result["failed"].append(f"Missing {req_file}")
                total_checks += 1

        # Check spec content
        if spec_content:
            content_result = check_file_content(spec_content, pid)
            principle_result["passed"].extend(content_result["passed"])
            principle_result["failed"].extend(content_result["failed"])

        # Calculate score
        checks_count = len(principle_result["passed"]) + len(principle_result["failed"])
        if checks_count > 0:
            principle_result["score"] = len(principle_result["passed"]) / checks_count * 100
            total_passed += len(principle_result["passed"])
            total_checks += checks_count

        result["principles"][pid] = principle_result

        # Add issues for failures
        for failure in principle_result["failed"]:
            result["issues"].append({
                "principle": pid,
                "issue": failure
            })

    # Overall score
    if total_checks > 0:
        result["overall_score"] = round(total_passed / total_checks * 100, 1)

    return result


def check_project_compliance() -> dict:
    """Check entire project for compliance"""
    report = {
        "timestamp": "",
        "features_checked": 0,
        "overall_score": 0,
        "by_principle": {},
        "issues": [],
        "features": []
    }

    from datetime import datetime, timezone
    report["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Initialize principle stats
    for pid, principle in PRINCIPLES.items():
        report["by_principle"][pid] = {
            "name": principle["name"],
            "passed": 0,
            "failed": 0,
            "score": 0
        }

    # Check all features
    for category in FEATURES_DIR.iterdir():
        if not category.is_dir():
            continue

        for feature_dir in category.iterdir():
            if not feature_dir.is_dir():
                continue

            result = check_feature_directory(feature_dir)
            report["features"].append(result)
            report["features_checked"] += 1

            # Aggregate stats
            for pid, principle_result in result.get("principles", {}).items():
                report["by_principle"][pid]["passed"] += len(principle_result.get("passed", []))
                report["by_principle"][pid]["failed"] += len(principle_result.get("failed", []))

            # Collect issues
            report["issues"].extend(result.get("issues", []))

    # Calculate principle scores
    total_score = 0
    for pid, stats in report["by_principle"].items():
        total = stats["passed"] + stats["failed"]
        if total > 0:
            stats["score"] = round(stats["passed"] / total * 100, 1)
            total_score += stats["score"]

    if report["by_principle"]:
        report["overall_score"] = round(total_score / len(report["by_principle"]), 1)

    return report


# Command handlers

def cmd_check(path: str, args):
    """Check file or directory"""
    target = Path(path)
    if not target.is_absolute():
        target = PROJECT_ROOT / target

    if not target.exists():
        print(f"Error: Path not found: {path}", file=sys.stderr)
        sys.exit(1)

    if target.is_file():
        content = target.read_text()
        results = {}
        principles_to_check = [args.principle] if args.principle else PRINCIPLES.keys()

        for pid in principles_to_check:
            if pid in PRINCIPLES:
                results[pid] = check_file_content(content, pid)

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            for pid, result in results.items():
                print(f"\nPrinciple {pid}: {result['name']}")
                print(f"  Passed: {len(result['passed'])}")
                for p in result['passed']:
                    print(f"    ✓ {p}")
                print(f"  Failed: {len(result['failed'])}")
                for f in result['failed']:
                    print(f"    ✗ {f}")

    elif target.is_dir():
        # Check as feature directory
        result = check_feature_directory(target, args.principle)

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Feature: {result['feature']}")
            print(f"Overall Score: {result['overall_score']}%")
            print()

            for pid, principle_result in result["principles"].items():
                print(f"Principle {pid}: {principle_result['name']} ({principle_result['score']:.0f}%)")
                for p in principle_result['passed']:
                    print(f"  ✓ {p}")
                for f in principle_result['failed']:
                    print(f"  ✗ {f}")


def cmd_principles(args):
    """List all principles"""
    if args.json:
        output = {pid: {"name": p["name"], "description": p["description"]}
                  for pid, p in PRINCIPLES.items()}
        print(json.dumps(output, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print("| CONSTITUTION PRINCIPLES" + " " * 53 + "|")
    print("+" + "-" * 78 + "+")

    for pid, principle in PRINCIPLES.items():
        print(f"| {pid}. {principle['name']:<70} |"[:80])
        print(f"|    {principle['description']:<72} |"[:80])
        print("+" + "-" * 78 + "+")


def cmd_report(args):
    """Generate full compliance report"""
    report = check_project_compliance()

    if args.json:
        # Slim down for JSON output
        slim_report = {
            "timestamp": report["timestamp"],
            "features_checked": report["features_checked"],
            "overall_score": report["overall_score"],
            "by_principle": report["by_principle"],
            "issue_count": len(report["issues"])
        }
        print(json.dumps(slim_report, indent=2))
        return

    print("+" + "=" * 78 + "+")
    print(f"| CONSTITUTION COMPLIANCE REPORT{' ' * 46}|"[:80])
    print("+" + "-" * 78 + "+")
    print(f"| Features Checked: {report['features_checked']:<58} |"[:80])
    print(f"| Overall Score: {report['overall_score']}%{' ' * 58}|"[:80])
    print("+" + "-" * 78 + "+")

    print("| BY PRINCIPLE" + " " * 65 + "|")
    print("+" + "-" * 78 + "+")

    for pid, stats in report["by_principle"].items():
        name = stats["name"][:40]
        score = f"{stats['score']}%"
        print(f"| {pid}. {name:<40} | {stats['passed']:3} pass | {stats['failed']:3} fail | {score:>6} |")

    print("+" + "-" * 78 + "+")

    if report["issues"]:
        print(f"| TOP ISSUES ({len(report['issues'])} total){' ' * 54}|"[:80])
        print("+" + "-" * 78 + "+")

        # Group by principle
        by_principle = defaultdict(list)
        for issue in report["issues"]:
            by_principle[issue["principle"]].append(issue["issue"])

        for pid in sorted(by_principle.keys()):
            issues = by_principle[pid]
            print(f"| Principle {pid}: {len(issues)} issues{' ' * 55}|"[:80])
            for issue in issues[:3]:
                print(f"|   - {issue[:70]:<70} |"[:80])
            if len(issues) > 3:
                print(f"|   ... and {len(issues) - 3} more{' ' * 58}|"[:80])

    print("+" + "=" * 78 + "+")


def to_summary(args) -> str:
    """Generate one-line summary"""
    report = check_project_compliance()

    status = "PASS" if report["overall_score"] >= 80 else "WARN" if report["overall_score"] >= 50 else "FAIL"

    return f"Constitution: {status} | Score: {report['overall_score']}% | {report['features_checked']} features | {len(report['issues'])} issues"


def main():
    parser = argparse.ArgumentParser(
        description="Constitution Compliance Check",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("command", nargs="?", default="report",
                       help="Command (check, principles, report)")
    parser.add_argument("args", nargs="*", help="Command arguments")
    parser.add_argument("--principle", type=str, help="Check specific principle (I, II, etc.)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--summary", action="store_true", help="One-line summary")

    args = parser.parse_args()

    # Handle summary
    if args.summary:
        print(to_summary(args))
        return

    # Handle commands
    if args.command == "principles":
        cmd_principles(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "check":
        if not args.args:
            print("Error: check requires a path", file=sys.stderr)
            sys.exit(1)
        cmd_check(args.args[0], args)
    else:
        # Assume it's a path
        cmd_check(args.command, args)


if __name__ == "__main__":
    main()
