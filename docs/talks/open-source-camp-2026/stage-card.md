# Stage card: ScriptHammer, forked live

Slot: Saturday 14 November 2026, 2:00 to 2:45 PM, room "Javascript 435 Classroom". Talking stops at 40 minutes. Questions take the last 5.

The fork starts first and is the opening beat, not the spine: on the stage laptop it takes about two minutes. The tour of ScriptHammer itself comes next and fills most of the talk. Then the fork comes back: a wireframe drawn inside it, the reveal, and a walk through its pages.

## Before the talk

- Open deck.html from disk in a browser on screen 1.
- Press Shift+T once, so no talk clock is left over from a rehearsal.
- On slide 4, set the Template address to the ScriptHammer you are touring. Use a copy with its services connected, so sign-in, payments and messaging work on slide 13.
- Sign in on that copy before the talk if slide 13's stops are on the tour.
- Terminal full screen on screen 2, at 28 point or larger.
- Start the terminal in an empty folder, never inside a copy of ScriptHammer. The new copy lands in the folder you are in. Each line of the block ends in `&&`, so the block stops at the first line that fails.
- In that terminal, check that `docker compose version` answers. The rebrand runs inside the container, so the laptop needs Docker and no Node.js.
- Open each tour page once, so no first visit happens live. The new copy's pages get the same treatment by themselves: see "The warm-up" below.
- Storybook is not on the tour.
- Build the image once before the talk: in any fresh copy of ScriptHammer, run `docker compose build`. That keeps the large system downloads off the venue network. The two quiet builds on stage still run, because the rename changes the package file, but the first takes seconds when the image was built ahead.
- The fallback clip is on the desktop.

## Screen 1: the deck

Each slide but the title shows a pace line at the bottom: how long this slide gets and the minute the next one is due. The right-hand column below is that minute.

| Slide | What it is                                                                 | Leave it at |
| ----- | -------------------------------------------------------------------------- | ----------- |
| 1     | Title                                                                      | 1:00        |
| 2     | What are we building? Type name, owner, description. Copy the block.       | 5:00        |
| 3     | Progress: the big clock and the stage strip                                | 6:00        |
| 4     | The tour map: eight ScriptHammer pages, and the Template address           | 7:00        |
| 5     | Tour 1 of 8: Home                                                          | 9:00        |
| 6     | Tour 2 of 8: Themes                                                        | 11:30       |
| 7     | Tour 3 of 8: Wireframes                                                    | 13:30       |
| 8     | Tour 4 of 8: 3D Chattanooga                                                | 15:30       |
| 9     | Tour 5 of 8: Pricing                                                       | 17:00       |
| 10    | Tour 6 of 8: Docs                                                          | 18:30       |
| 11    | Tour 7 of 8: Accessibility                                                 | 20:30       |
| 12    | Tour 8 of 8: Status                                                        | 22:00       |
| 13    | Built in, dark on a fresh fork: five things need a service, shown working  | 25:00       |
| 14    | The developer side (skip if you are behind)                                | 27:00       |
| 15    | Wireframe first, now in the fork: the drawing is made in the new copy      | 31:00       |
| 16    | Spec Kit: words before code                                                | 33:00       |
| 17    | The reveal: type the port, open the new app                                | 35:00       |
| 18    | Walk the fork: 18 buttons in four groups, each opens one page              | 39:00       |
| 19    | Take it home: the copy block, and a QR code that opens the repository      | 40:00       |
| 20    | Stay in touch: a QR code that opens the booking page, and the repo address | questions   |

The example text in the boxes on slide 2 is the rehearsal app (PotluckPlanner). It is only an example: the copy block uses what you type, and a box you leave empty falls back to a neutral name.

Each tour slide (5 to 12) names one page, lists what to show there, and has one button that opens that page of ScriptHammer in a new tab. The slide is the checklist: read it, open the page, show the points, come back, press the right arrow.

Slide 15 is the wireframe beat, and it happens in the fork. A coding agent in the new copy's folder writes the spec and draws the screen; the website only shows drawings. The button on that slide opens the fork's own wireframes page, and needs the port (see "Screen 2").

The four groups on slide 18, in the order to walk them:

- Yours now: home and themes.
- Works today: wireframes, docs, accessibility, status, blog and the game.
- My demo content: 3D Chattanooga, band, pricing, terms and credits. Say plainly that the fork keeps these until its owner deletes them.
- Dark until you connect a service: sign-in, payments, messaging, admin and contact. Each shows a setup banner.

A button gets a tick once you have pressed it, so you can see what is left.

The walk is by hand, on one screen: you click through the live app yourself. The first two clicks are the New Year Special card and the cookie banner. Close both before showing anything else.

## The talk clock

- The clock starts by itself the first time you leave the title slide. T restarts it from zero. Shift+T clears it.
- With the clock running, the pace line reads "clock 12:40 · next slide at 13:30".
- The pace line changes colour when the clock has passed the minute that slide was due.
- Behind? Skip slide 14, then shorten the tour stops you care least about.

## Screen 2: the terminal

- Paste the copied block.
- Press Enter.
- Leave it visible.
- When the terminal says the container started, paste the port command from slide 17. It prints an address that ends in a colon and a number.
- Press P on any slide. The deck jumps to the Port box on slide 17. Type the number, press Escape, then press B to return to the slide you were on.

## The warm-up

A new development server builds each page the first time anyone asks for it, and that takes 9 to 18 seconds a page. So the deck asks for all 18 pages itself, in the background, one at a time.

- It starts a second and a half after you stop typing in Port. You press nothing.
- Type the port as early as you can: the moment the terminal says the container started, even if you are still on the tour. The warm-up needs a few minutes to get through 18 pages.
- Slide 18 shows how far it has got, for example "Warming the pages on port 32772: 7 of 18."
- If the server is still starting, the deck keeps asking for about two minutes before it gives up.
- The Warm the pages button on slide 18 runs it again.
- These requests go to the new copy on your own laptop and nowhere else. They are the only requests the deck ever makes.

## Keys

| Key                           | Does                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| Right arrow, Space, Page Down | next slide                                                   |
| Left arrow, Page Up           | previous slide                                               |
| Home, End                     | first, last slide                                            |
| ]                             | next stage on the strip (first press starts the build clock) |
| [                             | back one stage                                               |
| 0                             | reset the strip and the build clock                          |
| T                             | start the talk clock again from zero                         |
| Shift+T                       | clear the talk clock                                         |
| P                             | jump to the Port box on the reveal slide                     |
| B                             | back to the slide you left for the Port box                  |
| F                             | full screen                                                  |
| Escape                        | leave a text field                                           |

Keys do not navigate while you type in a field. In the description box, Enter does nothing, so it cannot break the copy block.

## If something fails

- No internet: skip 3D Chattanooga (slide 8). Everything else is local.
- The fork command refuses: a repository of that name already exists. Pick another name.
- The build runs long: stay on the tour, then show the fallback clip.
- The Open button on the reveal slide does nothing: the Port box is empty. A fresh copy gets a new port on every start, so run the port command on that slide and type the number after the colon into the box.
- The wireframes button on slide 15 jumps to slide 17: same cause, the Port box is empty. Type the number, press Escape, press B.
- A button on slide 18 jumps back to slide 17: same cause again. Type the number and go forward again.
- Slide 18 says "No answer from" a page: the new copy is not up, or the port is wrong. Check the number against the terminal, wait for the container to start, then press Warm the pages.
- A page of the new copy is slow to open: the warm-up had not reached it. Say "the server is building this page for the first time" and wait. It opens at normal speed after that.
- The drawing on slide 15 is not ready in its four minutes: show the fork's wireframes page as it is, say the agent is still drawing, and move to slide 16. Come back to it during the walk.
