# Stage card: ScriptHammer, forked live

Slot: Saturday 14 November 2026, 2:00 to 2:45 PM, room "Javascript 435 Classroom". Talking stops at 40 minutes. Questions take the last 5.

The fork starts first. The tour is of ScriptHammer itself while the fork builds. The fork comes back only at the end, for the reveal.

## Before the talk

- Open deck.html from disk in a browser on screen 1.
- On slide 7, set the Template address to the ScriptHammer you are touring. Use a copy with its services connected, so sign-in, payments and messaging work on slide 8.
- Sign in on that copy before the talk if slide 8's stops are on the tour.
- Terminal full screen on screen 2, at 28 point or larger.
- Start the terminal in an empty folder, never inside a copy of ScriptHammer. The new copy lands in the folder you are in. Each line of the block ends in `&&`, so the block stops at the first line that fails.
- In that terminal, check that `docker compose version` answers. The rebrand runs inside the container, so the laptop needs Docker and no Node.js.
- Open each tour page once, so no first visit happens live. The new copy's pages get the same treatment by themselves: see "The warm-up" below.
- Storybook is not on the tour.
- Build the image once before the talk: in any fresh copy of ScriptHammer, run `docker compose build`. That keeps the large system downloads off the venue network. The two quiet builds on stage still run, because the rename changes the package file.
- The fallback clip is on the desktop.

## Screen 1: the deck

1. Title
2. What are we building? Type name, owner, description. Copy the block.
3. Wireframe first
4. Progress: the big clock and the stage strip
5. While it builds: wireframes
6. While it builds: Spec Kit
7. The tour: eight ScriptHammer pages that need no service
8. Built in, dark on a fresh fork: five things need a service, shown working on ScriptHammer
9. The developer side (skip if the build is early)
10. The reveal: type the port, open the new app
11. Walk the fork: 18 buttons in four groups, each opens one page of the new app
12. Take it home: the copy block, and a QR code that opens the ScriptHammer repository on a phone

The four groups on slide 11, in the order to walk them:

- Yours now: home and themes.
- Works today: wireframes, docs, accessibility, status, blog and the game.
- My demo content: 3D Chattanooga, band, pricing, terms and credits. Say plainly that the fork keeps these until its owner deletes them.
- Dark until you connect a service: sign-in, payments, messaging, admin and contact. Each shows a setup banner.

A button gets a tick once you have pressed it, so you can see what is left.

## Screen 2: the terminal

- Paste the copied block.
- Press Enter.
- Leave it visible.
- For the reveal, paste the port command from slide 10. It prints an address that ends in a colon and a number. Type that number into Port on slide 10, then press Open.

## The warm-up

A new development server builds each page the first time anyone asks for it, and that takes 9 to 18 seconds a page. So the deck asks for all 18 pages itself, in the background, one at a time.

- It starts a second and a half after you stop typing in Port. You press nothing.
- Type the port as early as you can: the moment the terminal says the container started, even if you are still on the tour. Then go back to the slide you were on. The warm-up needs a few minutes to get through 18 pages.
- Slide 11 shows how far it has got, for example "Warming the pages on port 32772: 7 of 18."
- If the server is still starting, the deck keeps asking for about two minutes before it gives up.
- The Warm the pages button on slide 11 runs it again.
- These requests go to the new copy on your own laptop and nowhere else. They are the only requests the deck ever makes.

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
- The Open button on the reveal slide does nothing: the Port box is empty. A fresh copy gets a new port on every start, so run the port command on that slide and type the number after the colon into the box.
- A button on slide 11 jumps back to slide 10: same cause, the Port box is empty. Type the number and go forward again.
- Slide 11 says "No answer from" a page: the new copy is not up, or the port is wrong. Check the number against the terminal, wait for the container to start, then press Warm the pages.
- A page of the new copy is slow to open: the warm-up had not reached it. Say "the server is building this page for the first time" and wait. It opens at normal speed after that.
