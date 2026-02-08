# PNG Batch QC Workflow

## Purpose

This workflow enables visual QC review of wireframe screenshots. The human (turtle_wolfe) hand-annotates PNG screenshots with visual markers that automated validators cannot detect.

**Why PNGs instead of just running validators?**

- Validators check SVG source code (syntax, structure, attributes)
- PNGs show how wireframes actually LOOK when rendered
- Human annotations mark visual issues: missing callouts, wrong positions, mapping problems
- Some issues only visible when viewing the complete wireframe

## Annotation Types

| Annotation         | Meaning                           |
| ------------------ | --------------------------------- |
| Blue arrows        | Desktop-to-mobile callout mapping |
| Circled numbers    | Verified/approved callouts        |
| "?" marks          | Missing or wrong callouts         |
| Hand-drawn numbers | Where callouts SHOULD be          |
| Red circles        | Problem areas                     |

## Batch Folder Structure

```
docs/design/wireframes/png/
├── overviews_001_Signature_Blocks_Are_Not_Aligned/  # Descriptive batch
├── overviews_002_Footer_Nav_Missing_Rounded_Corners/
├── overviews_003/                                    # General batch
├── overviews_004/
└── ...
```

Batch names often describe the issue type being reviewed.

## Workflow Steps

### 1. Prime as QC-Operator

```
/prime qc-operator
```

Or manually read: `.claude/roles/qc-operator.md`

### 2. Check QC Terminal Health

```bash
for win in WireframeQA Validator Inspector Auditor; do
  echo "=== $win ===";
  tmux capture-pane -t scripthammer:$win -p 2>/dev/null | grep "% free" | tail -1
done
```

Clear/prime any terminal below 30%:

```bash
tmux send-keys -t scripthammer:[terminal] '/clear' Enter
tmux send-keys -t scripthammer:[terminal] Enter  # Select from autocomplete
sleep 3
tmux send-keys -t scripthammer:[terminal] '/prime [role]' Enter
tmux send-keys -t scripthammer:[terminal] Enter
```

### 3. Identify Current Batch

```bash
ls docs/design/wireframes/png/ | grep overviews
```

### 4. Dispatch to All QC Terminals

Each QC terminal reviews ALL PNGs in the batch (not split):

```bash
tmux send-keys -t scripthammer:WireframeQA 'Review PNG batch: docs/design/wireframes/png/overviews_XXX/ - View each annotated PNG and log visual issues to .issues.md files.' Enter
tmux send-keys -t scripthammer:WireframeQA Enter
```

Repeat for: Validator, Inspector, Auditor

### 5. Monitor Progress

Check every 5 minutes:

```bash
for win in WireframeQA Validator Inspector Auditor; do
  echo "=== $win ===";
  tmux capture-pane -t scripthammer:$win -p 2>/dev/null | tail -8
done
```

### 6. Handle Low Context

When a terminal drops below 30%:

1. Let it finish current PNG
2. Clear and prime
3. Re-dispatch remaining PNGs

## Troubleshooting

### Commands not executing

**Symptom:** Command appears in prompt but nothing happens
**Fix:** Send extra Enter key

```bash
tmux send-keys -t scripthammer:[terminal] Enter
```

### Autocomplete menu blocking /clear

**Symptom:** /clear shows menu instead of executing
**Fix:** Press Enter to select from menu

```bash
tmux send-keys -t scripthammer:[terminal] '/clear' Enter
tmux send-keys -t scripthammer:[terminal] Enter  # Extra Enter for menu
```

### Terminal stuck at low %

**Symptom:** /clear executed but % didn't reset
**Fix:** Sometimes need multiple attempts

```bash
tmux send-keys -t scripthammer:[terminal] '/clear' Enter
sleep 2
tmux send-keys -t scripthammer:[terminal] Enter
# Check result
tmux capture-pane -t scripthammer:[terminal] -p | grep "% free"
```

### Terminal not responding

**Symptom:** No output from tmux capture
**Fix:** Check if window exists

```bash
tmux list-windows -t scripthammer | grep [terminal]
```

## Best Practices

1. **Always check health first** - Don't dispatch to exhausted terminals
2. **Monitor regularly** - Check every 5 minutes during batch processing
3. **Don't split batches** - Each QC role should see every PNG
4. **Persist findings** - Ensure terminals write to files, not just output
5. **Double-Enter habit** - When in doubt, send an extra Enter

## Related Files

- Role: `.claude/roles/qc-operator.md`
- Batch folders: `docs/design/wireframes/png/overviews_XXX/`
- Issues files: `docs/design/wireframes/NNN-feature/*.issues.md`
- Audit logs: `docs/interoffice/audits/`
