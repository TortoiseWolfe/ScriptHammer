# Stage card: ScriptHammer, forked live

Slot: day, time and length to be confirmed from the camp schedule.

## Before the talk

- Open deck.html from disk in a browser on screen 1.
- Terminal full screen on screen 2, at 28 point or larger.
- Start the terminal in an empty folder, never inside a copy of ScriptHammer. If the first line fails, the lines after it still run in the folder you are in.
- Open each tour page once, so no first visit happens live.
- Storybook is not on the tour.
- Docker images already pulled.
- The fallback clip is on the desktop.

## Screen 1: the deck

1. Title
2. What are we building? Type name, owner, description. Copy the block.
3. Wireframe first
4. Progress: the big clock and the stage strip
5. While it builds: wireframes
6. While it builds: Spec Kit
7. The tour: eight pages that work on fork
8. Dark until you plug it in: five things need a service
9. The developer side (skip if the build is early)
10. The reveal: open the new app
11. Take it home

## Screen 2: the terminal

- Paste the copied block.
- Press Enter.
- Leave it visible.

## Keys

| Key                           | Does                                                   |
| ----------------------------- | ------------------------------------------------------ |
| Right arrow, Space, Page Down | next slide                                             |
| Left arrow, Page Up           | previous slide                                         |
| Home, End                     | first, last slide                                      |
| ]                             | next stage on the strip (first press starts the clock) |
| [                             | back one stage                                         |
| 0                             | reset the strip and the clock                          |
| F                             | full screen                                            |
| Escape                        | leave a text field                                     |

Keys do not navigate while you type in a field.

## If something fails

- No internet: skip 3D Chattanooga. Everything else is local.
- The fork command refuses: a repository of that name already exists. Pick another name.
- The build runs long: stay on the tour, then show the fallback clip.
- The port is not 3000: run the port command on the reveal slide and type the number in the box.
