# /tasks - Generate Actionable Tasks

Convert the implementation plan from `plan.md` into concrete, actionable tasks in `TASKS.md`.

## Task Generation Process

1. **Analyze Plan**
   - Review implementation phases
   - Identify deliverables
   - Understand dependencies

2. **Create Task Breakdown**
   - Convert phases to task groups
   - Define specific actions
   - Establish clear outcomes

3. **Prioritize and Sequence**
   - Order by dependencies
   - Group by sprint/iteration
   - Mark critical path items

## Task Structure

Generate or update `TASKS.md` with:

### Task Format

```markdown
- [ ] TASK-001: Task title
  - Description: What needs to be done
  - Acceptance Criteria: How to verify completion
  - Dependencies: Prerequisites
  - Estimated Effort: Time/complexity
  - Priority: High/Medium/Low
```

### Task Categories

1. **Setup & Configuration**
   - Environment setup
   - Dependency installation
   - Configuration tasks

2. **Core Implementation**
   - Feature development
   - Component creation
   - Integration work

3. **Testing & Quality**
   - Unit test creation
   - Integration testing
   - Performance testing

4. **Documentation**
   - API documentation
   - User guides
   - Technical docs

5. **Deployment & Release**
   - Build configuration
   - Deployment setup
   - Release preparation

## Output Requirements

- Each task must be:
  - **Specific**: Clear action and outcome
  - **Measurable**: Defined completion criteria
  - **Achievable**: Realistic scope
  - **Relevant**: Aligned with plan
  - **Time-bound**: Estimated effort

- Include task metadata:
  - Task ID for tracking
  - Priority level
  - Dependencies
  - Estimated effort

## Progress Tracking

Include summary section:

- Total tasks by category
- Tasks by priority
- Dependency graph
- Critical path identification
