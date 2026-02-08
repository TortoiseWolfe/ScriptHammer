#!/bin/bash
# Dynamic status-right color based on current window role
# All colors are PASTEL for max readability with black text
#
# Color Palette (pastel - colorblind accessible):
#   Council:   colour229 (#ffffaf) Pale Gold
#   Wireframe: colour159 (#afffff) Pale Cyan
#   Implement: colour225 (#ffd7ff) Pale Pink
#   Support:   colour254 (#e4e4e4) Pale Gray

WIN_NAME=$(tmux display-message -p '#{window_name}')

case "$WIN_NAME" in
  CTO|Architect|Security|Toolsmith|DevOps|ProductOwner)
    GROUP="COUNCIL"; COLOR="colour229" ;;
  Planner|WireframeGenerator*|PreviewHost|WireframeQA|Validator|Inspector)
    GROUP="WIREFRAME"; COLOR="colour159" ;;
  Developer|TestEngineer|Auditor)
    GROUP="IMPLEMENT"; COLOR="colour225" ;;
  *)
    GROUP="SUPPORT"; COLOR="colour254" ;;
esac

tmux set status-right "#[bg=$COLOR,fg=black,bold] $GROUP #[bg=colour236,fg=white] #W  %H:%M "
