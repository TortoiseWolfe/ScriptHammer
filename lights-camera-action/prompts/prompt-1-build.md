# NEW BUILD — Prompt 1, v2 (DRAFT — revised from the Producer's critique, Nov 7.
# Nothing is sent until Jonathan has read and approved this exact text.)

Build "ScriptHammer: Build the Show" — a free, browser-based music game for kids (roughly ages 6–12). No login, no downloads: it loads straight into play on a single page, made for tablets and phones. No accounts, no uploads, no outside scripts and no analytics — nothing leaves the device, and the 3D library is bundled with the game, not loaded from outside.

THE PAGE: the page shows only the game's title, "ScriptHammer: Build the Show", as a heading, and below it the 3D scene filling the screen. No buttons, no menus, no text panels.

THE SCENE — real-time 3D (Three.js / WebGL), ONE fixed camera (a named part, "camera"): the view from the soundboard spot at the back of the concert lawn at Ross's Landing in Chattanooga, Tennessee, facing north across the river at golden hour. The soundboard is a place we stand, not an object — nothing of it is visible. We stay in this one spot for the whole game, but everything in view has real perspective depth — no flat 2D artwork anywhere in the scene. Landscape view, sized for a tablet screen, low-poly and light: a steady 30 to 60 frames per second, no heavy effects. Leave the bottom strip of the screen empty — a soundboard panel will live there in a later build.

Get the geography right; this is a real place:
- The camera sits on the riverfront lawn on the SOUTH (downtown) bank of the Tennessee River, facing the stage, with the river directly BEHIND the stage.
- Across the river is the North Shore: low, tree-covered hills with scattered houses — distant, simple silhouettes (no reference photos exist for them).
- To the LEFT of the view, the Market Street bridge crosses the river; to the RIGHT, the blue Walnut Street pedestrian bridge. Both distant and simple.
- The Tennessee Aquarium and the downtown towers are behind the camera — leave that space empty and build nothing there.
- The sky is a realistic golden-hour sky: soft gradient, a few soft-edged natural clouds with warm sunlight on them — photographic, not cartoon shapes.
- Lighting: ONE sun light plus the sky are the only light in the scene; no lighting painted into textures. The sun is a named part, "sun", and sits low in the west — behind the camera and to its left — so it lights the fronts of the stage and the robots.
- I am attaching photos of the real stage at Ross's Landing. Build the stage to match them, taking its proportions from the photos, not inventing them: a named part, "stage" — flat canopy roof over an open deck, plain back wall, a row of stage lights under the canopy (props — they give off no light in this build), speaker stacks on both sides.

THE BAND — on stage stand 8 friendly robot musicians, the band ScriptHammer. The scene is realistic; the robots are stylised. I am attaching the band's turnaround sheets — build each robot as its own named part, a simple rounded 3D figure that matches its sheet: if a sheet's shape and a simple form disagree, the sheet wins on look. Each instrument is a separate named prop, held by or standing with its robot, not merged into the robot's body. Placement: Crash and his drum kit sit center-back on a low riser; the other seven stand in a line across the front of the deck, all facing the camera, left to right: Timber (upright bass), Chops (guitar), Reed (saxophone), Chorus (singer with a microphone), Ivory (piano), Brass (trumpet), Switch (synth board).

Each robot has two states, idle and playing, even though nothing plays yet. Idling means a gentle bob — about 2 cm, one bob per beat at a tempo value the code holds, each robot offset from the others so they never move in lockstep. The bob runs from that tempo value, not from a looping animation clip. In the code, reserve a named "start tap" part — the first tap anywhere will unlock sound in a later build; it shows nothing on screen now.

Build the scene from named parts — camera, stage, sun, sky, and one per robot — kept in separate code sections, so later builds attach to them instead of rebuilding.

That is all for this build: the scene and the band, done right. No editors, no menus, no points or scoring — not even empty placeholders for them.

Naming: the game's name is "ScriptHammer: Build the Show", and that name is final for this build. The band is ScriptHammer — that is the band's name. The words "Band Wagon" appear nowhere in the game.

Attachments (10, at the cap): ross-stage-fullres.jpg, ross-stage-closeup.jpg, crash.webp, timber.webp, chops.webp, reed.webp, ivory.webp, brass.webp, chorus.webp, switch.webp
