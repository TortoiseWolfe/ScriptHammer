# Stage card: ScriptHammer, forked live

Slot: Saturday 14 November 2026, 2:00 to 2:45 PM, room "Javascript 435 Classroom". Talking stops at 40 minutes. Questions take the last 5.

The talk's title is its first slide: "Why build one app when we can build them all?"

The fork starts first and is the opening beat, not the spine: on the stage laptop it takes about two minutes. The tour of ScriptHammer itself comes next and fills most of the talk. Then the fork comes back: a wireframe drawn inside it, the reveal, and a walk through its pages.

## Before the talk

- Open deck.html from disk in a browser on screen 1.
- Press Shift+T once, so no talk clock is left over from a rehearsal.
- The tour runs on scripthammer.com, which has its services connected, so sign-in, checkout, messaging and admin work on their tour stops (slides 17 to 21).
- Sign in on scripthammer.com before the talk, so the Messaging and Admin stops (slides 19 and 21) open signed in.
- The Offline app stop (slide 12) installs the site with Safari's File menu, Add to Dock. That needs macOS Sonoma 14 or later. Check the laptop's macOS version, or skip the install and show the offline page alone.
- Check that port 3000 is free on this laptop. The new copy always answers on http://localhost:3000, because the copied block pins it there. Anything else answering there would also light the green banner (see "The banner" below).
- Terminal full screen on screen 2, at 28 point or larger.
- Start the terminal in an empty folder, never inside a copy of ScriptHammer. The new copy lands in the folder you are in. Each line of the block ends in `&&`, so the block stops at the first line that fails.
- In that terminal, check that `docker compose version` answers. The rebrand runs inside the container, so the laptop needs Docker and no Node.js.
- Open each tour page once, so no first visit happens live. The new copy's pages get the same treatment by themselves: see "The warm-up" below.
- Build the image once before the talk: in any fresh copy of ScriptHammer, run `docker compose build`. That keeps the large system downloads off the venue network. The two quiet builds on stage still run, because the rename changes the package file, but the first takes seconds when the image was built ahead.
- The fallback clip is on the desktop.

## Screen 1: the deck

Each slide but the title shows a pace line at the bottom: how long this slide gets and the minute the next one is due. The right-hand column below is that minute.

| Slide | What it is                                                                | Leave it at |
| ----- | ------------------------------------------------------------------------- | ----------- |
| 1     | Title: Why build one app when we can build them all?                      | 1:00        |
| 2     | What are we building? Type name, owner, description. Copy the block.      | 5:00        |
| 3     | Progress: the big clock and the stage strip                               | 6:00        |
| 4     | The tour map: nineteen ScriptHammer pages                                 | 7:00        |
| 5     | Tour 1 of 19: Home                                                        | 9:00        |
| 6     | Tour 2 of 19: Themes                                                      | 10:30       |
| 7     | Tour 3 of 19: Wireframes                                                  | 12:00       |
| 8     | Tour 4 of 19: Storybook                                                   | 13:30       |
| 9     | Tour 5 of 19: 3D Chattanooga                                              | 15:00       |
| 10    | Tour 6 of 19: Map                                                         | 16:00       |
| 11    | Tour 7 of 19: 3D game                                                     | 17:00       |
| 12    | Tour 8 of 19: Offline app                                                 | 18:30       |
| 13    | Tour 9 of 19: Pricing                                                     | 19:00       |
| 14    | Tour 10 of 19: Docs                                                       | 19:30       |
| 15    | Tour 11 of 19: Accessibility                                              | 20:30       |
| 16    | Tour 12 of 19: Status                                                     | 21:00       |
| 17    | Tour 13 of 19: Sign-in                                                    | 22:00       |
| 18    | Tour 14 of 19: Checkout                                                   | 23:00       |
| 19    | Tour 15 of 19: Messaging                                                  | 24:00       |
| 20    | Tour 16 of 19: Privacy controls                                           | 24:30       |
| 21    | Tour 17 of 19: Admin                                                      | 25:30       |
| 22    | Tour 18 of 19: Contact (send while offline)                               | 26:30       |
| 23    | Tour 19 of 19: Blog                                                       | 27:00       |
| 24    | The developer side (skip if you are behind)                               | 28:30       |
| 25    | Wireframe first, now in the fork: the drawing is made in the new copy     | 32:30       |
| 26    | Spec Kit: words before code                                               | 34:00       |
| 27    | The reveal: the backup run command on top, then open the app at port 3000 | 36:00       |
| 28    | Walk the fork: 22 buttons in four groups, each opens one page             | 39:00       |
| 29    | Take it home: the copy block, and a QR code that opens the repository     | 40:00       |
| 30    | Stay in touch: booking QR code, repo address, the fork on GitHub Pages    | questions   |

The grey text in the boxes on slide 2 is the rehearsal app (PotluckPlanner). Until you type, the whole deck shows that example: the copy block, the build line on slide 3, the wireframe words, the Spec Kit line and the reveal. A line on slide 2 says so while any of the three boxes is empty. The Copy buttons stay off until the three boxes are filled, so the example is never the block you paste. An empty Icon box still means no icon.

On slide 2 you can start typing without clicking: the letters go into the first empty box, in the order name, owner, description. Press Enter to leave a box, then type again for the next one. To change a box that already has text, click it.

Each tour slide (5 to 23) names one page, lists what to show there, and has one button that opens that page of ScriptHammer in a new tab. The slide is the checklist: read it, open the page, show the points, come back, press the right arrow. Messaging and Admin also carry small buttons for their subpages.

The tour stops added on 13 November:

- Storybook (slide 8): every component, live. Click one story to show it is the real component.
- Map (slide 10): a street map with no key. It asks before it uses your location.
- 3D game (slide 11): a scene built in code, with no files to download.
- Offline app (slide 12): the button opens scripthammer.com/offline.html, the page a visitor sees with no connection. Install the site with File, then Add to Dock (macOS Sonoma 14 or later).

The tour stops added on 14 November come after Status, at the end of the tour, and replace the old "Built in, waiting for your keys" slide:

- Sign-in (slide 17): email, GitHub or Google. Sign in here, because Messaging and Admin need it.
- Checkout (slide 18): Stripe and PayPal, connected here. A fresh fork shows a setup banner until its owner adds the keys. Never pay.
- Messaging (slide 19), with Set up and New group.
- Privacy controls (slide 20): consent, export and delete. It works on a fresh fork with nothing connected.
- Admin (slide 21), with its six pages: payments, orders, audit trail, users, messaging and email. Only an admin account gets in.
- Contact (slide 22): go offline and send a message. The form says it is queued, and it sends itself once you are back online.
- Blog (slide 23): 20 posts, each one a Markdown file.

Slide 25 is the wireframe beat, and it happens in the fork. A coding agent in the new copy's folder writes the spec and draws the screen; the website only shows drawings. The button on that slide opens the fork's own wireframes page, http://localhost:3000/wireframes/.

Slide 27, the reveal, opens with the backup run command: `docker compose up -d`, the same last line as the fork's README, with a Copy button. The copied block already starts the fork, so you only need it when the Open button gets no answer. Paste it in the new copy's folder. If the fork is already running, Docker says so and changes nothing.

Where the buttons go: before the fork they open scripthammer.com (the tour, slides 5 to 23). After it they open the new copy on this laptop, http://localhost:3000 (slides 25, 27 and 28). At the end, slide 30 opens the fork's own GitHub Pages address: the deck asks that address every 15 seconds and turns the button on once Pages answers.

The four groups on slide 28, in the order to walk them:

- Yours now: home and themes.
- Works today: wireframes, docs, accessibility, status, blog, the game, the 3D game, the map and privacy controls.
- My demo content: 3D Chattanooga, band, pricing, terms and credits. Say plainly that the fork keeps these until its owner deletes them.
- Waiting for your keys: sign-in, checkout, payments, messaging, admin and contact. Each shows a setup banner.

A button gets a tick once you have pressed it, so you can see what is left.

The walk is by hand, on one screen: you click through the live app yourself. The first two clicks are the New Year Special card and the cookie banner. Close both before showing anything else.

## The banner

Once the three boxes on slide 2 are filled, the deck asks http://localhost:3000 every 5 seconds, whatever slide is showing. The first time the new copy answers, a green banner appears at the top of the screen: "PotluckPlanner is answering on localhost:3000", with the name you typed. It goes away at the next slide change. That is your cue that the fork is up, so you can say so and carry on with the tour.

- No sound, only the banner.
- It shows again only if the fork stops answering and then comes back.
- While it is up, the deck asks every 15 seconds instead of every 5.

## The talk clock

- The clock starts by itself the first time you leave the title slide. T restarts it from zero. Shift+T clears it.
- With the clock running, the pace line reads "clock 12:40 · next slide at 14:00".
- The pace line changes colour when the clock has passed the minute that slide was due.
- Behind? Skip slide 24, then shorten the tour stops you care least about.

## Screen 2: the terminal

- Paste the copied block.
- Press Enter.
- Leave it visible.
- Nothing to type later: the block writes SH_PORT=3000 into the new copy's settings, so it always answers on http://localhost:3000.
- Only if the reveal's Open button gets no answer: paste `docker compose up -d` from the backup card at the top of slide 27, in the new copy's folder.

## The warm-up

A new development server builds each page the first time anyone asks for it, and that takes 9 to 18 seconds a page. So the deck asks for all 22 pages itself, in the background, one at a time.

- It starts by itself when you reach the wireframe slide (25). You press nothing and type nothing.
- It needs a few minutes to get through 22 pages, which is why it starts three slides before the walk.
- Slide 28 shows how far it has got, for example "Warming the fork’s pages: 7 of 22."
- If nothing answers, the line says so at once ("No answer from localhost:3000/ yet") and the deck keeps asking every 5 seconds for about two minutes before it gives up.
- The Warm the pages button on slide 28 runs it again.
- These requests, and the banner's, go to the new copy on your own laptop and nowhere else. They are the only requests the deck ever makes.

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
- The build runs long: stay on the tour, then show the fallback clip. The green banner tells you when the fork is up.
- The Open, wireframes or walk buttons give "can't connect to the server": the new copy is not up yet, or something else held port 3000 on this laptop. Run `docker compose ps` in the new copy's folder. Free port 3000 before the talk so this cannot happen.
- Slide 28 says "No answer from localhost:3000": the new copy's container has not started. Run the backup command at the top of slide 27, wait for the terminal to say it started, then press Warm the pages.
- A page of the new copy is slow to open: the warm-up had not reached it. Say "the server is building this page for the first time" and wait. It opens at normal speed after that.
- The drawing on slide 25 is not ready in its four minutes: show the fork's wireframes page as it is, say the agent is still drawing, and move to slide 26. Come back to it during the walk.
- Add to Dock is missing from Safari's File menu: the laptop runs a macOS older than Sonoma 14. Show the offline page and move on.
