#!/usr/bin/env python3
"""
Terminal Router - Dispatch logic for /next command

Replaces 334 lines of Claude logic in /next.md with hardcoded Python.
Saves ~1,500-2,500 tokens per /next call.

Usage: python3 terminal-router.py <role>

Roles: manager, assistant-manager, planner, generator-1, generator-2,
       generator-3, viewer, reviewer, validator, inspector, author,
       tester, implementer, auditor
"""

import json
import os
import sys
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any

SCRIPT_DIR = Path(__file__).parent
STATUS_FILE = SCRIPT_DIR / ".terminal-status.json"
WIREFRAMES_DIR = SCRIPT_DIR
IMPLEMENTATION_ORDER = SCRIPT_DIR.parent.parent.parent / "features" / "IMPLEMENTATION_ORDER.md"
INTEROFFICE_DIR = SCRIPT_DIR.parent.parent / "interoffice"

GENERATORS = ["generator-1", "generator-2", "generator-3"]
ALL_ROLES = [
    "manager", "assistant-manager", "planner",
    "generator-1", "generator-2", "generator-3",
    "viewer", "reviewer", "validator", "inspector",
    "author", "tester", "implementer", "auditor",
    "cto", "architect", "security-lead", "toolsmith", "devops", "coordinator",
    "product-owner"
]

# Council members can create RFCs and vote
COUNCIL_MEMBERS = ["cto", "architect", "security-lead", "toolsmith", "devops", "product-owner"]

# Managers receive memos from contributors
MEMO_RECIPIENTS = {
    "cto": "to-cto.md",
    "architect": "to-architect.md",
    "security-lead": "to-security-lead.md",
    "toolsmith": "to-toolsmith.md",
    "devops": "to-devops.md",
    "coordinator": "to-coordinator.md",
    "product-owner": "to-product-owner.md",
    # Aliases for existing roles
    "manager": "to-coordinator.md",
    "assistant-manager": "to-toolsmith.md",
}


@dataclass
class QueueItem:
    feature: str
    svg: Optional[str]
    action: str
    reason: str
    assigned_to: Optional[str]


@dataclass
class TerminalStatus:
    status: str
    feature: Optional[str]
    task: Optional[str]


@dataclass
class RouterResult:
    """Result from a router's get_next_action"""
    status: str  # idle, working, etc.
    queue_count: int
    next_action: str
    auto_execute: Optional[str]  # Skill to auto-execute
    files: List[str]
    extra_info: Dict[str, Any]


def load_status() -> Dict[str, Any]:
    """Load .terminal-status.json"""
    if not STATUS_FILE.exists():
        return {"queue": [], "terminals": {}, "completedToday": []}
    with open(STATUS_FILE) as f:
        return json.load(f)


def get_queue_for_role(role: str, data: Dict) -> List[QueueItem]:
    """Get queue items assigned to a role"""
    items = []
    for item in data.get("queue", []):
        if item.get("assignedTo") == role:
            items.append(QueueItem(
                feature=item["feature"],
                svg=item.get("svg"),
                action=item.get("action", "GENERATE"),
                reason=item.get("reason", ""),
                assigned_to=item.get("assignedTo")
            ))
    return items


def get_unassigned_queue(data: Dict) -> List[QueueItem]:
    """Get unassigned queue items"""
    items = []
    for item in data.get("queue", []):
        if item.get("assignedTo") is None:
            items.append(QueueItem(
                feature=item["feature"],
                svg=item.get("svg"),
                action=item.get("action", "GENERATE"),
                reason=item.get("reason", ""),
                assigned_to=None
            ))
    return items


def get_terminal_status(role: str, data: Dict) -> TerminalStatus:
    """Get terminal status for a role"""
    terminal = data.get("terminals", {}).get(role, {})
    return TerminalStatus(
        status=terminal.get("status", "idle"),
        feature=terminal.get("feature"),
        task=terminal.get("task")
    )


def run_command(cmd: List[str], timeout: int = 30) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)"""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=SCRIPT_DIR
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)


def count_generator_items(data: Dict) -> Dict[str, int]:
    """Count queue items per generator"""
    counts = {gen: 0 for gen in GENERATORS}
    for item in data.get("queue", []):
        assignee = item.get("assignedTo")
        if assignee in GENERATORS:
            counts[assignee] += 1
    return counts


def find_least_loaded_generator(data: Dict) -> Optional[str]:
    """Find generator with fewest items, preferring idle ones"""
    counts = count_generator_items(data)

    # Prefer idle generators with no work
    for gen in GENERATORS:
        terminal = data.get("terminals", {}).get(gen, {})
        if terminal.get("status") == "idle" and counts[gen] == 0:
            return gen

    # Otherwise find least loaded
    min_count = min(counts.values())
    for gen in GENERATORS:
        if counts[gen] == min_count:
            return gen
    return None


def count_pending_memos(role: str) -> int:
    """Count pending memos for a manager role"""
    if role not in MEMO_RECIPIENTS:
        return 0

    memo_file = INTEROFFICE_DIR / "memos" / MEMO_RECIPIENTS[role]
    if not memo_file.exists():
        return 0

    try:
        content = memo_file.read_text()
        # Count memo entries (## YYYY-MM-DD lines before ## Archive)
        archive_pos = content.find("## Archive")
        if archive_pos == -1:
            search_content = content
        else:
            search_content = content[:archive_pos]

        # Count date-stamped memo headers
        import re
        return len(re.findall(r"^## \d{4}-\d{2}-\d{2}", search_content, re.MULTILINE))
    except Exception:
        return 0


def count_rfcs_awaiting_vote(role: str) -> int:
    """Count RFCs in voting state awaiting this council member's vote"""
    if role not in COUNCIL_MEMBERS and role not in ["manager", "assistant-manager"]:
        return 0

    rfcs_dir = INTEROFFICE_DIR / "rfcs"
    if not rfcs_dir.exists():
        return 0

    count = 0
    for rfc_file in rfcs_dir.glob("RFC-*.md"):
        try:
            content = rfc_file.read_text()
            # Check if status is voting
            if "**Status**: voting" not in content:
                continue

            # Map role to council member name for vote check
            role_to_stakeholder = {
                "cto": "CTO",
                "architect": "Architect",
                "security-lead": "Security Lead",
                "toolsmith": "Toolsmith",
                "devops": "DevOps",
                "product-owner": "Product Owner",
                "manager": "CTO",  # Manager acts as CTO for voting
                "assistant-manager": "Toolsmith",  # Assistant-manager acts as Toolsmith
            }
            stakeholder = role_to_stakeholder.get(role, "")

            # Check if this stakeholder's vote is still pending
            if f"| {stakeholder} | pending |" in content:
                count += 1
        except Exception:
            continue

    return count


def get_interoffice_info(role: str) -> Dict[str, Any]:
    """Get interoffice communication status for a role"""
    info = {}

    # Check for pending memos (managers only)
    pending_memos = count_pending_memos(role)
    if pending_memos > 0:
        info["PENDING_MEMOS"] = pending_memos

    # Check for RFCs awaiting vote (council members only)
    rfcs_awaiting = count_rfcs_awaiting_vote(role)
    if rfcs_awaiting > 0:
        info["RFCS_AWAITING_VOTE"] = rfcs_awaiting

    # Check for broadcasts (all roles)
    broadcasts_dir = INTEROFFICE_DIR / "broadcast"
    if broadcasts_dir.exists():
        broadcasts = [f for f in broadcasts_dir.glob("*.md") if f.name != ".gitkeep"]
        if broadcasts:
            info["BROADCASTS"] = len(broadcasts)

    return info


class BaseRouter(ABC):
    """Base class for terminal routers"""

    def __init__(self, role: str, data: Dict):
        self.role = role
        self.data = data
        self.queue = get_queue_for_role(role, data)
        self.terminal_status = get_terminal_status(role, data)

    @abstractmethod
    def get_next_action(self) -> RouterResult:
        """Determine next action for this terminal"""
        pass

    def format_output(self, result: RouterResult) -> str:
        """Format the output for display"""
        lines = [
            f"{self.role.upper()} Terminal",
            "━" * 30,
            f"Status: {result.status}",
            f"Queue:  {result.queue_count} items assigned to you",
        ]

        # Add interoffice communication status
        interoffice = get_interoffice_info(self.role)
        if interoffice:
            lines.append("")
            lines.append("INTEROFFICE")
            if "PENDING_MEMOS" in interoffice:
                lines.append(f"→ {interoffice['PENDING_MEMOS']} pending memo(s) in your inbox")
            if "RFCS_AWAITING_VOTE" in interoffice:
                lines.append(f"→ {interoffice['RFCS_AWAITING_VOTE']} RFC(s) awaiting your vote")
            if "BROADCASTS" in interoffice:
                lines.append(f"→ {interoffice['BROADCASTS']} broadcast(s) to read")

        lines.append("")
        lines.append("NEXT ACTION")
        lines.append(f"→ {result.next_action}")

        if result.auto_execute:
            lines.append(f"→ Auto-execute: {result.auto_execute}")

        if result.extra_info:
            lines.append("")
            for key, value in result.extra_info.items():
                lines.append(f"{key}: {value}")

        if result.files:
            lines.append("")
            lines.append(f"Files: {', '.join(result.files)}")

        return "\n".join(lines)


class ManagerRouter(BaseRouter):
    """Router for Primary Manager terminal"""

    def get_next_action(self) -> RouterResult:
        counts = count_generator_items(self.data)
        unassigned = get_unassigned_queue(self.data)

        # Build generator status info
        gen_status = {}
        for gen in GENERATORS:
            terminal = self.data.get("terminals", {}).get(gen, {})
            gen_status[gen] = {
                "status": terminal.get("status", "idle"),
                "items": counts[gen],
                "feature": terminal.get("feature", "-")
            }

        # Check if any generator needs work
        idle_gen = find_least_loaded_generator(self.data)

        if unassigned and idle_gen and counts[idle_gen] == 0:
            # Auto-assign to idle generator
            feature = unassigned[0].feature
            return RouterResult(
                status=self.terminal_status.status,
                queue_count=len(self.queue),
                next_action=f"Assign {feature} to {idle_gen}",
                auto_execute=f"queue_manager.py claim-feature {feature} {idle_gen}",
                files=[".terminal-status.json", "IMPLEMENTATION_ORDER.md"],
                extra_info={"GENERATOR_STATUS": gen_status, "UNASSIGNED": len(unassigned)}
            )

        if all(counts[g] > 0 or self.data.get("terminals", {}).get(g, {}).get("status") == "working" for g in GENERATORS):
            return RouterResult(
                status="coordinating",
                queue_count=len(self.data.get("queue", [])),
                next_action="All generators have work. Standing by.",
                auto_execute=None,
                files=[".terminal-status.json"],
                extra_info={"GENERATOR_STATUS": gen_status}
            )

        return RouterResult(
            status=self.terminal_status.status,
            queue_count=len(self.queue),
            next_action="Check queue for work to distribute",
            auto_execute="queue_manager.py summary",
            files=[".terminal-status.json"],
            extra_info={"GENERATOR_STATUS": gen_status}
        )


class AssistantManagerRouter(BaseRouter):
    """Router for Assistant Manager terminal"""

    def get_next_action(self) -> RouterResult:
        # Check if any skills need updates
        skills_dir = Path.home() / ".claude" / "commands"
        skill_files = list(skills_dir.glob("*.md")) if skills_dir.exists() else []

        return RouterResult(
            status=self.terminal_status.status,
            queue_count=len(self.queue),
            next_action="Check skill files for needed updates, assist Manager",
            auto_execute=None,
            files=["~/.claude/commands/*.md", "validate-wireframe.py"],
            extra_info={"SKILL_COUNT": len(skill_files)}
        )


class PlannerRouter(BaseRouter):
    """Router for Planner terminal"""

    def get_next_action(self) -> RouterResult:
        if self.queue:
            # Has assigned work
            feature = self.queue[0].feature
            return RouterResult(
                status="has_work",
                queue_count=len(self.queue),
                next_action=f"Plan wireframes for {feature}",
                auto_execute=f"/wireframe-plan {feature.split('-')[0]}",
                files=[f"features/*/{feature}/spec.md"],
                extra_info={}
            )

        # Check for next unplanned feature
        code, stdout, _ = run_command([
            "python3", str(SCRIPT_DIR / "implementation_order.py"), "next-unplanned"
        ])

        if code == 0 and stdout.strip():
            next_feature = stdout.strip()
            return RouterResult(
                status="self_assigning",
                queue_count=0,
                next_action=f"Self-assign next unplanned: {next_feature}",
                auto_execute=f"/wireframe-plan {next_feature}",
                files=["IMPLEMENTATION_ORDER.md"],
                extra_info={"NEXT_UNPLANNED": next_feature}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="All features have wireframe plans. Standing by.",
            auto_execute=None,
            files=[],
            extra_info={}
        )


class GeneratorRouter(BaseRouter):
    """Router for Generator terminals (1, 2, 3)"""

    def get_next_action(self) -> RouterResult:
        if self.queue:
            # Has assigned work
            item = self.queue[0]
            feature_num = item.feature.split("-")[0]
            return RouterResult(
                status="has_work",
                queue_count=len(self.queue),
                next_action=f"Generate {item.feature}/{item.svg or 'SVGs'}",
                auto_execute=f"/wireframe-prep {feature_num}",
                files=[f"{item.feature}/*.svg", f"{item.feature}/*.issues.md"],
                extra_info={"REASON": item.reason}
            )

        # Check for unassigned work to self-assign
        unassigned = get_unassigned_queue(self.data)
        if unassigned:
            feature = unassigned[0].feature
            feature_num = feature.split("-")[0]
            return RouterResult(
                status="self_assigning",
                queue_count=0,
                next_action=f"Self-assign unassigned: {feature}",
                auto_execute=f"queue_manager.py claim-feature {feature_num} {self.role}",
                files=[],
                extra_info={"UNASSIGNED_COUNT": len(unassigned)}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="No work available. Standing by.",
            auto_execute=None,
            files=[],
            extra_info={}
        )


class ViewerRouter(BaseRouter):
    """Router for Viewer terminal"""

    def get_next_action(self) -> RouterResult:
        # Check if viewer is running (port 3000)
        code, stdout, _ = run_command(["lsof", "-i", ":3000"], timeout=5)
        viewer_running = code == 0 and stdout.strip()

        if viewer_running:
            return RouterResult(
                status="running",
                queue_count=0,
                next_action="Viewer running at localhost:3000",
                auto_execute=None,
                files=["index.html"],
                extra_info={}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Start wireframe viewer",
            auto_execute="/hot-reload-viewer",
            files=["index.html"],
            extra_info={}
        )


class ReviewerRouter(BaseRouter):
    """Router for Reviewer terminal"""

    def get_next_action(self) -> RouterResult:
        if self.queue:
            feature = self.queue[0].feature
            feature_num = feature.split("-")[0]
            return RouterResult(
                status="has_work",
                queue_count=len(self.queue),
                next_action=f"Review wireframes for {feature}",
                auto_execute=f"/wireframe-screenshots --feature {feature_num}",
                files=[f"{feature}/*.issues.md"],
                extra_info={}
            )

        # Check for recent issues files
        issues_files = list(WIREFRAMES_DIR.glob("*/*.issues.md"))
        recent = sorted(issues_files, key=lambda f: f.stat().st_mtime, reverse=True)[:3]

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Run /wireframe-screenshots --all to find work",
            auto_execute=None,
            files=[str(f.name) for f in recent],
            extra_info={"RECENT_ISSUES": len(recent)}
        )


class ValidatorRouter(BaseRouter):
    """Router for Validator terminal"""

    def get_next_action(self) -> RouterResult:
        # Check for escalation candidates
        code, stdout, stderr = run_command([
            "python3", str(SCRIPT_DIR / "validate-wireframe.py"), "--check-escalation"
        ])

        # Count candidates from output
        candidates = 0
        if code == 0:
            candidates = stdout.lower().count("candidate")

        if candidates > 0:
            return RouterResult(
                status="has_work",
                queue_count=candidates,
                next_action=f"{candidates} escalation candidates found",
                auto_execute="validate-wireframe.py --check-escalation",
                files=["validate-wireframe.py", "GENERAL_ISSUES.md"],
                extra_info={"ESCALATION_OUTPUT": stdout[:200] if stdout else ""}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="No escalation candidates. Standing by for Generator output.",
            auto_execute=None,
            files=["validate-wireframe.py", "GENERAL_ISSUES.md"],
            extra_info={}
        )


class InspectorRouter(BaseRouter):
    """Router for Inspector terminal"""

    def get_next_action(self) -> RouterResult:
        # Count SVGs
        svg_files = list(WIREFRAMES_DIR.glob("*/*.svg"))
        svg_count = len(svg_files)

        if svg_count > 0:
            return RouterResult(
                status="has_work",
                queue_count=svg_count,
                next_action=f"Inspect {svg_count} SVGs for pattern violations",
                auto_execute="inspect-wireframes.py --all",
                files=["inspect-wireframes.py"],
                extra_info={"SVG_COUNT": svg_count}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="No SVGs to inspect. Standing by.",
            auto_execute=None,
            files=["inspect-wireframes.py"],
            extra_info={}
        )


class AuthorRouter(BaseRouter):
    """Router for Author terminal"""

    def get_next_action(self) -> RouterResult:
        return RouterResult(
            status=self.terminal_status.status,
            queue_count=len(self.queue),
            next_action="Generate session summary or write documentation",
            auto_execute="/session-summary",
            files=["docs/*.md"],
            extra_info={}
        )


class TesterRouter(BaseRouter):
    """Router for Tester terminal"""

    def get_next_action(self) -> RouterResult:
        # Check if src/ exists
        src_dir = SCRIPT_DIR.parent.parent.parent / "src"
        if not src_dir.exists():
            return RouterResult(
                status="blocked",
                queue_count=0,
                next_action="No src/ folder yet. Standing by for implementation phase.",
                auto_execute=None,
                files=[],
                extra_info={}
            )

        return RouterResult(
            status="ready",
            queue_count=len(self.queue),
            next_action="Run test suite",
            auto_execute="/test",
            files=["*.test.ts", "*.spec.ts"],
            extra_info={}
        )


class ImplementerRouter(BaseRouter):
    """Router for Implementer terminal"""

    def get_next_action(self) -> RouterResult:
        # Check for tasks.md files
        tasks_files = list((SCRIPT_DIR.parent.parent.parent / "features").rglob("tasks.md"))

        if tasks_files:
            return RouterResult(
                status="ready",
                queue_count=len(tasks_files),
                next_action=f"{len(tasks_files)} features with tasks.md ready",
                auto_execute="/speckit.implement",
                files=["features/*/tasks.md"],
                extra_info={}
            )

        return RouterResult(
            status="blocked",
            queue_count=0,
            next_action="No tasks.md files. Run /speckit.tasks first.",
            auto_execute=None,
            files=[],
            extra_info={}
        )


class AuditorRouter(BaseRouter):
    """Router for Auditor terminal"""

    def get_next_action(self) -> RouterResult:
        return RouterResult(
            status=self.terminal_status.status,
            queue_count=len(self.queue),
            next_action="Run cross-artifact consistency analysis",
            auto_execute="/speckit.analyze",
            files=["spec.md", "plan.md", "tasks.md"],
            extra_info={}
        )


class CTORouter(BaseRouter):
    """Router for CTO terminal - Strategic oversight"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)

        # Prioritize interoffice tasks
        if interoffice.get("RFCS_AWAITING_VOTE", 0) > 0:
            return RouterResult(
                status="has_rfcs",
                queue_count=interoffice["RFCS_AWAITING_VOTE"],
                next_action="Review and vote on pending RFCs",
                auto_execute=None,
                files=["docs/interoffice/rfcs/*.md"],
                extra_info={}
            )

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-cto.md"],
                extra_info={}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Strategic oversight - review IMPLEMENTATION_ORDER.md",
            auto_execute=None,
            files=["features/IMPLEMENTATION_ORDER.md"],
            extra_info={}
        )


class ArchitectRouter(BaseRouter):
    """Router for Architect terminal - System design"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)

        if interoffice.get("RFCS_AWAITING_VOTE", 0) > 0:
            return RouterResult(
                status="has_rfcs",
                queue_count=interoffice["RFCS_AWAITING_VOTE"],
                next_action="Review and vote on pending RFCs",
                auto_execute=None,
                files=["docs/interoffice/rfcs/*.md"],
                extra_info={}
            )

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-architect.md"],
                extra_info={}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Review system architecture - check constitution.md",
            auto_execute=None,
            files=[".specify/memory/constitution.md"],
            extra_info={}
        )


class SecurityLeadRouter(BaseRouter):
    """Router for Security Lead terminal"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)

        if interoffice.get("RFCS_AWAITING_VOTE", 0) > 0:
            return RouterResult(
                status="has_rfcs",
                queue_count=interoffice["RFCS_AWAITING_VOTE"],
                next_action="Review and vote on pending RFCs",
                auto_execute=None,
                files=["docs/interoffice/rfcs/*.md"],
                extra_info={}
            )

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-security-lead.md"],
                extra_info={}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Security review - check auth features",
            auto_execute=None,
            files=["features/foundation/003-user-authentication/spec.md"],
            extra_info={}
        )


class ToolsmithRouter(BaseRouter):
    """Router for Toolsmith terminal"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)

        if interoffice.get("RFCS_AWAITING_VOTE", 0) > 0:
            return RouterResult(
                status="has_rfcs",
                queue_count=interoffice["RFCS_AWAITING_VOTE"],
                next_action="Review and vote on pending RFCs",
                auto_execute=None,
                files=["docs/interoffice/rfcs/*.md"],
                extra_info={}
            )

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-toolsmith.md"],
                extra_info={}
            )

        # Check skill files
        skills_dir = Path.home() / ".claude" / "commands"
        skill_files = list(skills_dir.glob("*.md")) if skills_dir.exists() else []

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Check skill files for needed updates",
            auto_execute=None,
            files=["~/.claude/commands/*.md"],
            extra_info={"SKILL_COUNT": len(skill_files)}
        )


class DevOpsRouter(BaseRouter):
    """Router for DevOps terminal"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)

        if interoffice.get("RFCS_AWAITING_VOTE", 0) > 0:
            return RouterResult(
                status="has_rfcs",
                queue_count=interoffice["RFCS_AWAITING_VOTE"],
                next_action="Review and vote on pending RFCs",
                auto_execute=None,
                files=["docs/interoffice/rfcs/*.md"],
                extra_info={}
            )

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-devops.md"],
                extra_info={}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Check CI/CD configuration",
            auto_execute=None,
            files=["docker-compose.yml", ".github/workflows/"],
            extra_info={}
        )


class ProductOwnerRouter(BaseRouter):
    """Router for Product Owner terminal - User requirements and UX"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)

        if interoffice.get("RFCS_AWAITING_VOTE", 0) > 0:
            return RouterResult(
                status="has_rfcs",
                queue_count=interoffice["RFCS_AWAITING_VOTE"],
                next_action="Review and vote on pending RFCs",
                auto_execute=None,
                files=["docs/interoffice/rfcs/*.md"],
                extra_info={}
            )

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-product-owner.md"],
                extra_info={}
            )

        return RouterResult(
            status="idle",
            queue_count=0,
            next_action="Review feature specs for user requirements",
            auto_execute=None,
            files=["features/*/spec.md"],
            extra_info={}
        )


class CoordinatorRouter(BaseRouter):
    """Router for Coordinator terminal"""

    def get_next_action(self) -> RouterResult:
        interoffice = get_interoffice_info(self.role)
        counts = count_generator_items(self.data)
        unassigned = get_unassigned_queue(self.data)

        if interoffice.get("PENDING_MEMOS", 0) > 0:
            return RouterResult(
                status="has_memos",
                queue_count=interoffice["PENDING_MEMOS"],
                next_action="Review pending memos",
                auto_execute=None,
                files=["docs/interoffice/memos/to-coordinator.md"],
                extra_info={}
            )

        # Build generator status info
        gen_status = {}
        for gen in GENERATORS:
            terminal = self.data.get("terminals", {}).get(gen, {})
            gen_status[gen] = {
                "status": terminal.get("status", "idle"),
                "items": counts[gen],
                "feature": terminal.get("feature", "-")
            }

        if unassigned:
            idle_gen = find_least_loaded_generator(self.data)
            if idle_gen and counts[idle_gen] == 0:
                feature = unassigned[0].feature
                return RouterResult(
                    status="coordinating",
                    queue_count=len(unassigned),
                    next_action=f"Assign {feature} to {idle_gen}",
                    auto_execute=f"queue_manager.py claim-feature {feature} {idle_gen}",
                    files=[".terminal-status.json"],
                    extra_info={"GENERATOR_STATUS": gen_status}
                )

        return RouterResult(
            status="idle",
            queue_count=len(self.data.get("queue", [])),
            next_action="Check queue for work to distribute",
            auto_execute="queue_manager.py summary",
            files=[".terminal-status.json"],
            extra_info={"GENERATOR_STATUS": gen_status}
        )


# Router registry
ROUTERS = {
    "manager": ManagerRouter,
    "assistant-manager": AssistantManagerRouter,
    "planner": PlannerRouter,
    "generator-1": GeneratorRouter,
    "generator-2": GeneratorRouter,
    "generator-3": GeneratorRouter,
    "viewer": ViewerRouter,
    "reviewer": ReviewerRouter,
    "validator": ValidatorRouter,
    "inspector": InspectorRouter,
    "author": AuthorRouter,
    "tester": TesterRouter,
    "implementer": ImplementerRouter,
    "auditor": AuditorRouter,
    # Council members
    "cto": CTORouter,
    "architect": ArchitectRouter,
    "security-lead": SecurityLeadRouter,
    "toolsmith": ToolsmithRouter,
    "devops": DevOpsRouter,
    "product-owner": ProductOwnerRouter,
    "coordinator": CoordinatorRouter,
}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print(f"\nValid roles: {', '.join(ALL_ROLES)}")
        sys.exit(1)

    role = sys.argv[1].lower()

    if role not in ROUTERS:
        print(f"Error: Unknown role '{role}'", file=sys.stderr)
        print(f"Valid roles: {', '.join(ALL_ROLES)}", file=sys.stderr)
        sys.exit(1)

    # Load current status
    data = load_status()

    # Create router and get next action
    router_class = ROUTERS[role]
    router = router_class(role, data)
    result = router.get_next_action()

    # Output formatted result
    print(router.format_output(result))

    # Also output JSON for programmatic use
    if "--json" in sys.argv:
        print("\n--- JSON ---")
        print(json.dumps({
            "role": role,
            "status": result.status,
            "queue_count": result.queue_count,
            "next_action": result.next_action,
            "auto_execute": result.auto_execute,
            "files": result.files,
            "extra_info": result.extra_info
        }, indent=2))


if __name__ == "__main__":
    main()
