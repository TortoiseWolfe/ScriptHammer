# Stage card: ScriptHammer, forked live

Slot: Saturday 14 November 2026, 2:00 to 2:45 PM, room "Javascript 435 Classroom". Talking stops at 40 minutes. Questions take the last 5.

The fork starts first and is the opening beat, not the spine: on the stage laptop it takes about two minutes. The tour of ScriptHammer itself comes next and fills most of the talk. Then the fork comes back: a wireframe drawn inside it, the reveal, and a walk through its pages.

## Before the talk

- Open deck.html from disk in a browser on screen 1.
- Press Shift+T once, so no talk clock is left over from a rehearsal.
- The tour runs on scripthammer.com, which has its services connected, so sign-in, checkout and messaging work on slide 17.
- Sign in on scripthammer.com before the talk if you will open slide 17's pages.
- The Offline app stop (slide 12) installs the site with Safari's File menu, Add to Dock. That needs macOS Sonoma 14 or later. Check the laptop's macOS version, or skip the install and show the offline page alone.
- Check that port 3000 is free on this laptop. The new copy always answers on http://localhost:3000, because the copied block pins it there.
- Terminal full screen on screen 2, at 28 point or larger.
- Start the terminal in an empty folder, never inside a copy of ScriptHammer. The new copy lands in the folder you are in. Each line of the block ends in `&&`, so the block stops at the first line that fails.
- In that terminal, check that `docker compose version` answers. The rebrand runs inside the container, so the laptop needs Docker and no Node.js.
- Open each tour page once, so no first visit happens live. The new copy's pages get the same treatment by themselves: see "The warm-up" below.
- Build the image once before the talk: in any fresh copy of ScriptHammer, run `docker compose build`. That keeps the large system downloads off the venue network. The two quiet builds on stage still run, because the rename changes the package file, but the first takes seconds when the image was built ahead.
- The fallback clip is on the desktop.

## Screen 1: the deck

Each slide but the title shows a pace line at the bottom: how long this slide gets and the minute the next one is due. The right-hand column below is that minute.

| Slide | What it is                                                                     | Leave it at |
| ----- | ------------------------------------------------------------------------------ | ----------- |
| 1     | Title                                                                          | 1:00        |
| 2     | What are we building? Type name, owner, description. Copy the block.           | 5:00        |
| 3     | Progress: the big clock and the stage strip                                    | 6:00        |
| 4     | The tour map: twelve ScriptHammer pages                                        | 7:00        |
| 5     | Tour 1 of 12: Home                                                             | 9:00        |
| 6     | Tour 2 of 12: Themes                                                           | 11:00       |
| 7     | Tour 3 of 12: Wireframes                                                       | 12:30       |
| 8     | Tour 4 of 12: Storybook                                                        | 14:00       |
| 9     | Tour 5 of 12: 3D Chattanooga                                                   | 15:30       |
| 10    | Tour 6 of 12: Map                                                              | 16:30       |
| 11    | Tour 7 of 12: 3D game                                                          | 18:00       |
| 12    | Tour 8 of 12: Offline app                                                      | 20:00       |
| 13    | Tour 9 of 12: Pricing                                                          | 21:00       |
| 14    | Tour 10 of 12: Docs                                                            | 22:00       |
| 15    | Tour 11 of 12: Accessibility                                                   | 23:30       |
| 16    | Tour 12 of 12: Status                                                          | 24:30       |
| 17    | Built in, waiting for your keys: six things, shown working on scripthammer.com | 27:30       |
| 18    | The developer side (skip if you are behind)                                    | 29:00       |
| 19    | Wireframe first, now in the fork: the drawing is made in the new copy          | 33:00       |
| 20    | Spec Kit: words before code                                                    | 34:30       |
| 21    | The reveal: open the new app at localhost:3000                                 | 36:00       |
| 22    | Walk the fork: 22 buttons in four groups, each opens one page                  | 39:00       |
| 23    | Take it home: the copy block, and a QR code that opens the repository          | 40:00       |
| 24    | Stay in touch: booking QR code, repo address, the fork on GitHub Pages         | questions   |

The grey text in the boxes on slide 2 is the rehearsal app (PotluckPlanner). Until you type, the whole deck shows that example: the copy block, the build line on slide 3, the wireframe words, the Spec Kit line and the reveal. A line on slide 2 says so while any of the three boxes is empty. The Copy buttons stay off until the three boxes are filled, so the example is never the block you paste. An empty Icon box still means no icon.

On slide 2 you can start typing without clicking: the letters go into the first empty box, in the order name, owner, description. Press Enter to leave a box, then type again for the next one. To change a box that already has text, click it.

Each tour slide (5 to 16) names one page, lists what to show there, and has one button that opens that page of ScriptHammer in a new tab. The slide is the checklist: read it, open the page, show the points, come back, press the right arrow.

The tour stops added on 13 November:

- Storybook (slide 8): every component, live. Click one story to show it is the real component.
- Map (slide 10): a street map with no key. It asks before it uses your location.
- 3D game (slide 11): a scene built in code, with no files to download.
- Offline app (slide 12): the button opens scripthammer.com/offline.html, the page a visitor sees with no connection. Install the site with File, then Add to Dock (macOS Sonoma 14 or later).

Slide 17 has six buttons: sign-in, checkout (Stripe and PayPal), messaging, privacy controls, the admin dashboard and the contact form. A fresh fork draws all six and shows a setup banner until its owner connects a service. Privacy controls is the one that works on a fresh fork with nothing connected.

Slide 19 is the wireframe beat, and it happens in the fork. A coding agent in the new copy's folder writes the spec and draws the screen; the website only shows drawings. The button on that slide opens the fork's own wireframes page, http://localhost:3000/wireframes/.

Where the buttons go: before the fork they open scripthammer.com (the tour, slides 5 to 17). After it they open the new copy on this laptop, http://localhost:3000 (slides 19, 21 and 22). At the end, slide 24 opens the fork's own GitHub Pages address: the deck asks that address every 15 seconds and turns the button on once Pages answers.

The four groups on slide 22, in the order to walk them:

- Yours now: home and themes.
- Works today: wireframes, docs, accessibility, status, blog, the game, the 3D game, the map and privacy controls.
- My demo content: 3D Chattanooga, band, pricing, terms and credits. Say plainly that the fork keeps these until its owner deletes them.
- Waiting for your keys: sign-in, checkout, payments, messaging, admin and contact. Each shows a setup banner.

A button gets a tick once you have pressed it, so you can see what is left.

The walk is by hand, on one screen: you click through the live app yourself. The first two clicks are the New Year Special card and the cookie banner. Close both before showing anything else.

## The talk clock

- The clock starts by itself the first time you leave the title slide. T restarts it from zero. Shift+T clears it.
- With the clock running, the pace line reads "clock 12:40 · next slide at 14:00".
- The pace line changes colour when the clock has passed the minute that slide was due.
- Behind? Skip slide 18, then shorten the tour stops you care least about.

## Screen 2: the terminal

- Paste the copied block.
- Press Enter.
- Leave it visible.
- Nothing to type later: the block writes SH_PORT=3000 into the new copy's settings, so it always answers on http://localhost:3000.

## The warm-up

A new development server builds each page the first time anyone asks for it, and that takes 9 to 18 seconds a page. So the deck asks for all 22 pages itself, in the background, one at a time.

- It starts by itself when you reach the wireframe slide (19). You press nothing and type nothing.
- It needs a few minutes to get through 22 pages, which is why it starts three slides before the walk.
- Slide 22 shows how far it has got, for example "Warming the fork’s pages: 7 of 22."
- If the server is still starting, the deck keeps asking for about two minutes before it gives up.
- The Warm the pages button on slide 22 runs it again.
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
| F                             | full screen (every slide has a Full screen button)           |
| Enter, Escape                 | leave a text field                                           |

Slide 1 shows the main keys, and every slide has a Full screen button at the bottom right, so nothing has to be remembered to start.

If slide 1 also shows an amber line that starts "This is a preview panel", the deck is open inside another app's panel and not in a browser window. Keys reach it only after a click inside, and full screen may be refused. Open the file in a browser. A viewer that runs no scripts shows one white sentence saying the same thing, and no slides.

Keys do not navigate while you type in a field. Enter leaves the field and never adds a line, so it cannot break the copy block. In full screen, use Enter to leave a field: Escape leaves the field and full screen together.

On slide 2 the letter keys are answers, never deck keys: T and F do nothing there except type. The arrows, Space and the bracket keys work as on every other slide.

## If something fails

- No internet: the tour opens scripthammer.com, so it needs the venue network, and so do the fork and its build. 3D Chattanooga, Map and Status (slides 9, 10 and 16) need it most: skip them first. If the network drops during the build, stay on the tour and show the fallback clip.
- The fork command refuses: a repository of that name already exists. Pick another name.
- The build runs long: stay on the tour, then show the fallback clip.
- The Open, wireframes or walk buttons give "can't connect to the server": the new copy is not up yet, or something else held port 3000 on this laptop. Run `docker compose ps` in the new copy's folder. Free port 3000 before the talk so this cannot happen.
- Slide 22 says "No answer from localhost:3000": the new copy's container has not started. Wait for the terminal to say it started, then press Warm the pages.
- A page of the new copy is slow to open: the warm-up had not reached it. Say "the server is building this page for the first time" and wait. It opens at normal speed after that.
- The drawing on slide 19 is not ready in its four minutes: show the fork's wireframes page as it is, say the agent is still drawing, and move to slide 20. Come back to it during the walk.
- Add to Dock is missing from Safari's File menu: the laptop runs a macOS older than Sonoma 14. Show the offline page and move on.
