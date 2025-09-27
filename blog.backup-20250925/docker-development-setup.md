---
title: "Docker Development: Why I Never Say 'Works on My Machine' Anymore"
slug: 'docker-development-setup'
excerpt: 'Discover how Docker transformed my development workflow from setup nightmares to instant productivity. Learn why Docker-first development with ScriptHammer eliminates environment conflicts forever.'
author: 'TortoiseWolfe'
publishDate: 2025-10-03
status: 'published'
featured: false
categories:
  - Docker
  - DevOps
  - Development
tags:
  - docker
  - development
  - environment
  - devops
readTime: 12
ogImage: '/blog-images/2025-10-03-docker-development-setup.png'
---

# Docker Development: Why I Never Say 'Works on My Machine' Anymore

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Monday Morning Disaster Before Docker ☕💥

It was 9 AM Monday when I learned why Docker would become essential to my development workflow. Fresh coffee in hand and ready to code, I had just spent the weekend perfecting a new feature—clean code, comprehensive tests, and a beautiful UI (User Interface) that made me feel pretty good about myself.

Then Sarah messaged me: "Hey, the new developer can't run the project."

The classic response formed in my throat: "Works on my machine..." However, before I could type it, Mike jumped in: "I'm getting errors too. Just pulled latest main."

Furthermore, Lisa chimed in: "Same here. Something's broken." Then Tom reported issues, followed by James, and finally the intern who started today. When I checked Slack, I found 14 messages with different errors from the same project—a scenario that Docker would have completely prevented.

- **Sarah (Windows)**: "Module not found: Can't resolve 'fs'"
- **Mike (Mac M1)**: "Segmentation fault 11"
- **Lisa (Linux)**: "EACCES: permission denied, mkdir '/usr/local/lib'"
- **Tom (Mac Intel)**: "Error: Node Sass does not yet support your current environment"
- **New Guy (WSL)**: _[typed 400 lines of errors that looked like the Matrix]_

My perfectly working feature became worthless since nobody else could run it. Consequently, I spent the next six hours debugging five different development environments that Docker would have standardized instantly. Sarah needed Python 2.7 for node-gyp. Mike's M1 Mac couldn't compile native dependencies. Lisa had the wrong version of libssl. Tom's Node version was incompatible with our Sass compiler. The new guy... I still don't know what was wrong with his setup.

By 3 PM, I was ready to quit tech and become a farmer. That's when our DevOps engineer walked by, saw my screen full of terminal windows, and delivered three words that would change everything: "Use Docker, dummy." This simple advice introduced me to Docker, the solution that would eliminate these problems forever.

## The "Setup Instructions" Hall of Shame 📜

Before I discovered Docker, every project README I wrote turned into a novel—a horror novel, specifically. Moreover, here's an actual excerpt from one of my pre-Docker projects that shows why Docker became essential:

## The Novel (My Old README from Pre-Docker Hell)

```markdown
## Prerequisites

1. Install Node.js (v18.17.1 specifically! v18.17.0 has a bug, v18.17.2 breaks bcrypt)
2. Install PostgreSQL 14 (not 15! We use gen_random_uuid() which changed in 15)
3. Install Redis (minimum 6.2, maximum 7.1, 7.2 has breaking changes)
4. Install Python 2.7 (yes, in 2024, for node-gyp)
5. Install build-essential (Linux) or Xcode CLI tools (Mac) or Visual Studio Build Tools (Windows)
6. Install libpng-dev, libcairo2-dev, libjpeg-dev, libgif-dev (for Canvas)
7. Install PostgreSQL client libraries
8. Configure PostgreSQL to allow local connections
9. Create a database user with CREATEDB privileges
10. Set up your PATH to include PostgreSQL bin directory

## Setup Steps

1. Clone the repository
2. Copy .env.example to .env
3. Edit these 14 environment variables:
   - DB_HOST (probably localhost unless you know otherwise)
   - DB_PORT (5432 unless you changed it)
   - DB_NAME (create this database first!)
   - DB_USER (the user you created in prerequisites)
   - DB_PASS (hope you remember it)
   - REDIS_URL (format: redis://user:pass@host:port/db)
   - SESSION_SECRET (generate with openssl rand -hex 32)
   - JWT_SECRET (another one!)
   - API_KEY (get from our Slack channel)
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (good luck)
   - NODE_ENV (development, probably)

4. Install dependencies:
   npm install (will probably fail the first time)

5. If npm install failed (it did), try:
   - Clear npm cache: npm cache clean --force
   - Delete node_modules and package-lock.json
   - Try npm install again
   - If Sharp fails: npm install --platform=linux --arch=x64 sharp
   - If bcrypt fails: npm rebuild bcrypt --build-from-source
   - If canvas fails: See GitHub issue #1847

6. Run database migrations:
   npm run db:migrate (requires DB to be running)

7. Seed the database:
   npm run db:seed (might fail if migrations didn't run)

8. Build the project:
   npm run build (takes 5-10 minutes)

9. Start the development server:
   npm run dev

10. If it crashes immediately, check:
    - Is PostgreSQL running?
    - Is Redis running?
    - Are all env variables set?
    - Did migrations run successfully?
    - Try turning it off and on again
    - Sacrifice a goat to the programming gods

## Troubleshooting (You'll Need This)

- "Cannot find module": Delete node_modules, try again
- "Permission denied": Try with sudo (but you shouldn't need to?)
- "Port already in use": Find and kill the process
- "Database connection failed": Is PostgreSQL running? Check pg_hba.conf
- "Redis connection refused": Start Redis
- Segmentation fault: Wrong Node version or corrupted npm cache
- "Works on my machine": You're on your own

## Known Issues

- Doesn't work on Windows (use WSL, maybe?)
- M1 Macs need special treatment (Rosetta? Native? Both?)
- Linux users need 47 additional packages
- Sometimes it just doesn't work and we don't know why
```

I'm not exaggerating about this pre-Docker nightmare. This was real, this was my life before Docker transformed everything. Additionally, every new developer took 2-3 days just to get the project running without Docker, and some never succeeded at all.

## The ScriptHammer Docker Way (The Two-Liner Dream)

```markdown
## Setup

1. Clone the repo
2. Run: docker compose up

That's it. You're done. Go code. Seriously, that's all.
```

When I first saw this Docker-based setup in ScriptHammer, I didn't believe it. "Where's the real setup guide?" I asked. However, this WAS the real setup guide—Docker had reduced dozens of steps to just two commands, and my mind was completely blown.

## The Docker Magic Explained (Without the BS) 🐳

Let me explain what happens when you run that magical `docker compose up` command, and I mean REALLY explain it. Nobody ever explained Docker to me properly, which led to months of unnecessary fear about using Docker in my workflow.

Docker functions like a shipping container for your application. You know those big metal boxes on cargo ships? They're standardized, meaning a container that fits on a ship in Shanghai will fit on a truck in San Francisco. Furthermore, it doesn't matter what's inside—furniture, electronics, rubber ducks—the Docker container remains the same.

That's exactly what Docker does for software. Your application and ALL its dependencies go into a Docker container, which then runs identically on Windows, Mac, Linux, your laptop, AWS (Amazon Web Services), or even your refrigerator (if it runs Docker).

Here's what the magic looks like:

```yaml
# docker-compose.yml - Your entire universe in one file
version: '3.8'

services:
  scripthammer:
    build: .
    container_name: scripthammer-dev
    ports:
      - '3000:3000' # Next.js development server
      - '6006:6006' # Storybook component playground
    volumes:
      - .:/app # Your code, live-reloading
      - /app/node_modules # Dependencies, isolated
      - /app/.next # Build cache, persistent
    environment:
      - NODE_ENV=development
      - DOCKER_ENV=true
    healthcheck:
      test: curl -f http://localhost:3000 || exit 1
      interval: 30s
      timeout: 10s
      retries: 3
```

Let me break this down because every line is doing something magical:

**`version: '3.8'`** - This tells Docker which features we can use. It's like saying "I want the 2024 model with all the cool features, not the 1995 beater."

**`services:`** - Think of services as different computers working together. We only have one here (scripthammer), but you could add a database service, a Redis service, an email servic e, whatever you need. They all network together automatically.

**`build: .`** - This says "build an image from the Dockerfile in the current directory." An image is like a snapshot of a computer with everything installed. A container is a running instance of that image.

**`ports:`** - This maps ports from inside the container to your actual computer. Port 3000 inside the container becomes port 3000 on your laptop. That's why localhost:3000 works.

**`volumes:`** - This is the magic that makes development not suck. Volumes are shared folders between your computer and the container:

- `.:/app` means your current directory is available inside the container at `/app`. Change a file on your laptop, it changes in the container instantly.
- `/app/node_modules` is an anonymous volume. Docker manages this, which means no more permission errors, no more node_modules conflicts.
- `/app/.next` is the build cache. It persists between container restarts so rebuilds are fast.

**`environment:`** - Environment variables that get set inside the container. Your app reads these to know how to behave.

**`healthcheck:`** - Docker actually checks if your app is working! If it crashes, Docker knows. You can configure it to restart automatically.

## The Journey from Localhost Hell to Docker Heaven 🔥➡️☁️

Let me tell you about the exact moment I became a Docker convert. Initially, I resisted Docker completely. "I don't need another tool," I said. "My setup works fine," I lied to myself, unaware of how Docker would transform my development experience.

## Day 1: Docker Skepticism

Our DevOps engineer set up Docker for our project, and I remained skeptical. "Great, another thing to learn," I thought. "Another layer of complexity that can break." However, Docker would prove me completely wrong.

He walked me through it:

```bash
git clone https://github.com/company/project
cd project
docker compose up
```

"That's it?" I asked.

"That's it."

"But what about Node versions?"

"Handled."

"PostgreSQL setup?"

"Included."

"Redis?"

"Yep."

"Environment variables?"

"Preset for development."

"But what if—"

"Just try it."

## Day 2: The Docker Revelation

The next morning, coffee in hand, I decided to really test Docker's capabilities. Consequently, I deleted EVERYTHING from my system—Node, PostgreSQL, Redis, all of it—completely removing every development tool.

Then I ran `docker compose up`.

Everything worked perfectly with Docker.

Incredibly, I didn't have Node installed on my machine, yet Docker enabled me to run a Node application flawlessly. This wasn't just like magic—Docker WAS magic.

## Day 3: The Docker Conversion

The new intern started. Usually, getting an intern set up takes an entire day. Documentation, troubleshooting, installing things, configuring things, explaining things.

This time:

1. "Clone this repo"
2. "Run docker compose up"
3. "You're good to go"

Total time: 5 minutes.

The intern made their first commit before lunch. BEFORE LUNCH. An intern. On day one.

That's when I became a Docker evangelist.

## The Problems That Disappeared (Like My Stress) 🎩✨

## Problem 1: Node Version Conflicts (Solved by Docker)

This used to be my nightmare. I'd use NVM to switch Node versions constantly. "Oh, this project needs 16. That one needs 18. Production is on 20. My laptop is on fire."

**Before Docker**:

```bash
nvm install 18.17.1
nvm use 18.17.1
npm install
# Error: Some package needs Node 20
nvm install 20
nvm use 20
npm install
# Error: Some other package needs Node 18
# *throws laptop out window*
```

**With Docker**:

```dockerfile
# Development Dockerfile
FROM node:18-alpine
# Everything runs in Node 18

# Production Dockerfile
FROM node:20-alpine
# Everything runs in Node 20

# Your laptop doesn't even need Node installed
```

You can run both AT THE SAME TIME. Different projects, different Node versions, all running simultaneously, no conflicts. It's beautiful.

### Problem 2: "It worked yesterday!"

This phrase haunted my dreams. You know the scenario: Friday evening, everything works perfectly. Monday morning, nothing works. What changed? Nobody knows. Something, somewhere, updated itself.

Maybe your OS updated. Maybe npm updated. Maybe a dependency's dependency's dependency updated. Maybe cosmic rays flipped a bit. Who knows?

**Before Docker**:

- Spend hours investigating what changed
- Try to remember what you did over the weekend
- Check if any global packages updated
- Reinstall everything
- Still broken
- Cry

**With Docker**:

```bash
# Something's broken?
docker compose down
docker compose up --build
# Back to exactly how it was
```

The container is immutable. It doesn't change unless you explicitly change the Dockerfile. Friday's container is Monday's container is next year's container.

### Problem 3: "The new developer needs 2 days to set up"

I once onboarded a developer who spent THREE DAYS trying to get our application running. Three. Days. By the time they finally succeeded, they were so frustrated they almost quit. I didn't blame them.

**Before Docker**:

- Day 1: Install prerequisites, fight with PostgreSQL
- Day 2: Debug npm install failures, compile native dependencies
- Day 3: Configure environment, pray everything works
- Day 4: Maybe write some code?

**With Docker**:

```bash
# New developer, day 1, minute 5:
git clone <repo>
docker compose up
# "Where's the first ticket? I'm ready to code."
```

I've seen senior developers tear up when they realize they can start contributing immediately. It's that powerful.

## Real Developer Stories (Names Changed to Protect the Traumatized) 🗣️

### Sarah's Windows Nightmare Turned Dream

Sarah was our Windows developer. Yes, we had one. She was brave. She suffered so we could claim "cross-platform support."

**Before Docker**: "I spent a week trying to get PostgreSQL working on Windows. Path issues, permission problems, Windows Defender blocking ports, PowerShell vs CMD differences, backslash vs forward slash in paths. I installed WSL, but then had to figure out how to connect Windows tools to WSL services. I literally had a document called 'Windows Setup Guide' that was 47 pages long. FORTY-SEVEN PAGES."

**After Docker**: "I run `docker compose up`. It works. I code. I'm happy. I threw away the 47-page guide. I use the extra time to actually build features. Revolutionary."

### Mike's M1 Mac Adventures

Mike got the first M1 Mac on our team. We were excited. Then we tried to run our project.

**Before Docker**: "Half the npm packages didn't have ARM builds. Binary dependencies failed. Sharp needed special flags. Bcrypt wouldn't compile. Sass segfaulted. Canvas required Rosetta but then conflicted with native dependencies. I ran everything through Rosetta for a month, which defeated the purpose of having an M1. I became an expert in cpu architecture flags. I didn't want to be an expert in CPU architecture flags."

**After Docker**: "Docker Desktop handles the architecture translation automatically. I don't know how. I don't care how. It just works. My M1 Mac is actually fast now instead of running x86 emulation for everything. I can focus on coding instead of compiling."

### Lisa's Linux Permissions Saga

Lisa ran Ubuntu. She believed in open source. She suffered for her beliefs.

**Before Docker**: "Every npm install was a permissions nightmare. Do I use sudo? Do I change npm's default directory? Do I use a Node version manager? Why does npm want to write to /usr/local/lib? Why does it create root-owned files in my project? I spent more time fixing permissions than writing code. I had aliases for 'fix npm permissions' commands. Plural. Multiple aliases."

**After Docker**: "Docker handles all the permissions. The container runs as the right user. Files have the right ownership. I haven't typed 'sudo npm' in two years. I've forgotten what chown means. Life is good."

### The Intern Who Was Productive on Day One

We hired an intern, fresh out of bootcamp. Usually, interns spend the first week just trying to get things running.

**The Intern's Story**: "At my bootcamp, we spent two full days just setting up our development environment. When I started here, I expected the same. Maybe worse, because it's a 'real' company with 'real' complexity.

The senior dev sent me a GitHub link and said 'run docker compose up.' I thought it was a joke. Or a test. It wasn't.

Five minutes later, I was looking at the running application. By lunch, I had fixed my first bug. By the end of the day, I had submitted a PR. On my FIRST DAY.

My bootcamp friends didn't believe me. They thought I was lying about having an internship. I had to screen-share to prove the app was really running. They immediately started learning Docker."

## The Hidden Superpowers No One Tells You About 🦸

Docker isn't just about getting things running. It's about capabilities you didn't know you needed until you have them.

### Superpower 1: Parallel Environments (Time Travel for Code)

Imagine you're working on a feature in a branch. Big feature. Database migrations, new dependencies, the works. Then, URGENT: production bug. Need to switch to main branch immediately.

**Before Docker**:

```bash
# Stash everything
git stash
# Switch branch
git checkout main
# Oh no, different package-lock.json
npm install  # 5 minutes
# Oh no, different database schema
npm run db:rollback  # Hope this works
npm run db:migrate  # For main branch
# Fix bug
# Now switch back...
git checkout feature-branch
npm install  # Another 5 minutes
npm run db:migrate  # Back to feature schema
# What was I doing again?
```

**With Docker**:

```bash
# Terminal 1: Feature branch
docker compose up  # Port 3000

# Terminal 2: Main branch (in different directory)
git clone <repo> hotfix
cd hotfix
docker compose up  # Port 3001 (auto-assigns)

# Both running simultaneously
# Different schemas, different dependencies
# No conflicts
```

You can literally run every branch simultaneously if you want. It's like having multiple computers.

### Superpower 2: Clean Slate in Seconds (The Nuclear Option)

Sometimes, things get weird. Cache corrupted. Dependencies tangled. Database in an unknown state. The old solution was hours of debugging or a complete reinstall.

```bash
# The Nuclear Option
docker compose down -v  # Remove everything
docker compose up --build  # Start fresh

# 30 seconds to pristine environment
```

This has saved me so many times. Friday afternoon, something's weird, no time to debug? Nuclear option. Monday morning, fresh start, problem gone.

I once had a colleague spend an entire day debugging a weird issue. Cache? Dependencies? Database? Who knows. I suggested the nuclear option. "But I'll lose my database data!" So I showed them this:

```bash
# Backup local database first
docker compose exec scripthammer pg_dump mydb > backup.sql

# Nuclear option
docker compose down -v
docker compose up --build

# Restore database
docker compose exec scripthammer psql mydb < backup.sql

# Total time: 2 minutes
# Debugging time saved: 7 hours
```

### Superpower 3: Production Parity (Dev/Prod Twins)

The scariest phrase in development: "But it works in development!"

Your dev machine runs MacOS. Production runs Ubuntu. Your PostgreSQL is 14.2. Production is 14.8. Your Node is 18.17.1. Production is 18.19.0. Small differences, big problems.

```dockerfile
# The SAME Dockerfile for development AND production
FROM node:18.19-alpine AS base

# Development stage
FROM base AS development
RUN apk add --no-cache git
WORKDIR /app
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

Same Linux distribution. Same Node version. Same everything. If it works in dev, it works in production. This confidence is priceless.

## The "But Docker is Slow!" Myth (Busted) 🐌➡️🚀

I hear this constantly. "Docker is slow on Mac!" "File syncing is laggy!" "Native is faster!"

Let me show you ScriptHammer's secret sauce:

```yaml
# The performance optimizations that make Docker fly
services:
  scripthammer:
    volumes:
      # Your code - uses native file system events
      - .:/app

      # Dependencies - cached in Docker, no syncing needed
      - /app/node_modules

      # Build output - Docker managed, ultra-fast
      - /app/.next

      # The secret: delegated consistency
      - .:/app:delegated # Mac specific optimization

    # Development optimizations
    environment:
      - NODE_ENV=development
      - NEXT_TELEMETRY_DISABLED=1 # Faster builds
      - WATCHPACK_POLLING=false # Use native file watching
```

Here's what's really happening:

1. **Your code** (`.:/app`) is mounted with live syncing. Changes appear instantly.

2. **node_modules** is NOT synced. It lives only in Docker. No more 50,000 files slowing down your file system. No more Spotlight indexing node_modules. No more antivirus scanning every package.

3. **Build cache** (`/app/.next`) is Docker-managed. Faster than your SSD because it's in Docker's optimized storage.

4. **Delegated consistency** on Mac means file changes batch efficiently. You won't notice any lag.

**Real performance numbers from my M1 Mac:**

- Native npm install: 45 seconds
- Docker npm install: 40 seconds (faster because no antivirus scanning)
- Native build: 28 seconds
- Docker build: 30 seconds (2 seconds difference)
- Hot reload: instantaneous in both

The "Docker is slow" myth comes from people who don't optimize their setup. ScriptHammer's Docker configuration is already optimized. You get native performance with none of the headaches.

## The Commands You Actually Use (The Greatest Hits) 🛠️

After two years of Docker development, here are the commands I actually use daily. Not the hundred Docker commands in the documentation. The real ones:

```bash
# The Daily Driver - Start developing
docker compose up
# That's it. This is 80% of your Docker usage.

# The Test Runner - Run tests
docker compose exec scripthammer pnpm test
# Runs in the container, uses container's Node, perfect isolation

# The Package Installer - Add dependencies
docker compose exec scripthammer pnpm add axios
# Installs in container, updates package.json on your host

# The Shell Access - When you need to poke around
docker compose exec scripthammer sh
# You're now inside the container, look around

# The Log Viewer - See what's happening
docker compose logs -f
# Shows all container output, follows in real-time

# The Restart - When things get weird
docker compose restart
# Faster than down && up

# The Fresh Start - New day, fresh container
docker compose down && docker compose up
# Clean start, preserves your data

# The Nuclear Option - Something is really broken
docker compose down -v && docker compose up --build
# Removes everything, rebuilds from scratch

# The Background Mode - Run without terminal
docker compose up -d
# Runs in background, use 'logs' to see output

# That's literally 99% of what you need
```

You don't need to memorize Docker documentation. You don't need to understand layers and registries and networks. These 9 commands will cover almost everything you do daily.

## The Permission Problem (Solved Forever) 🔐

This was my personal hell for MONTHS. Let me paint you a picture of the permission nightmare:

```bash
# The Classic Permission Dance
npm install something
# EACCES: permission denied

sudo npm install something
# Now root owns node_modules

npm run dev
# EACCES: can't read node_modules

sudo chown -R $(whoami) node_modules
npm run dev
# Builds files as user

npm run build
# EACCES: can't write to .next

# SCREAMING INTERNALLY
```

Docker volumes solved this forever. Here's how:

```yaml
volumes:
  # Named volume: Docker manages permissions
  - node_modules:/app/node_modules # Docker owns this

  # Anonymous volume: Docker manages permissions
  - /app/.next # Docker owns this too

  # Bind mount: Your permissions
  - .:/app # You own this
```

The magic? Docker manages permissions for Docker things. You manage permissions for your things. They never conflict.

**Real example that used to break everything:**

```bash
# Old way - permission nightmare
npm install sharp  # Needs to compile binaries
# EACCES: Can't write to /usr/local/lib

# Docker way - just works
docker compose exec scripthammer pnpm add sharp
# Installs in container, compiles with container's permissions
# Your host never sees the complexity
```

ScriptHammer takes this further with user mapping:

```dockerfile
# ScriptHammer's Dockerfile
ARG UID=1000
ARG GID=1000

RUN addgroup -g ${GID} appuser && \
    adduser -D -u ${UID} -G appuser appuser

USER appuser
# Container runs as YOUR user ID
# Files created in container have YOUR permissions
```

Result? Files created in Docker have the correct permissions on your host. No more permission errors. Ever.

## The Deployment Gift (Your Future Self Thanks You) 🎁

Here's the beautiful part: your Docker development setup isn't just for development. The same container that runs on your laptop runs in production.

```bash
# Development
docker compose up
# https://localhost:3000

# Build for production
docker build -t myapp .
# Container image ready

# Run production locally (test)
docker run -p 3000:3000 myapp
# Exact production environment on your laptop

# Deploy to ANY cloud
docker push myapp
# Same container runs on:
# - AWS ECS ✅
# - Google Cloud Run ✅
# - Azure Container Instances ✅
# - DigitalOcean App Platform ✅
# - Your raspberry pi ✅
# - That old laptop in your closet ✅
```

No more "it works in dev but not in production." If it works in the container, it works everywhere the container runs.

**Real story**: We once had a production bug that only happened on AWS. Couldn't reproduce locally. Guess why? Different Node version! Production was running Node installed via apt-get. Development used NVM.

After switching to Docker? Development container = production container. Bug reproduced instantly. Fixed in 5 minutes. Deployed with confidence.

## The Team Benefits (Everyone Wins) 👥

### For Senior Developers

You know what I DON'T do anymore?

- Debug environment issues for other developers
- Maintain setup documentation
- Explain why it works on my machine
- Manage multiple Node versions
- Fight with native dependencies

You know what I DO now?

- Write code
- Review code
- Ship features
- Go home on time

### For Junior Developers

The confidence boost is real. Imagine starting a new job and having everything working in 5 minutes. No imposter syndrome from not being able to set up the project. No asking for help every 30 minutes. Just pure coding from day one.

Junior developer quote: "I spent my first week at my last job just trying to get the project running. Here, I was reviewing code by day two. I learned more in my first month than the previous six months."

### For DevOps

- Dev/prod parity means fewer surprises
- CI/CD uses the same container
- Deployments are predictable
- "Works on my machine" tickets: zero

DevOps quote: "I used to spend 30% of my time debugging environment differences. Now I spend that time actually improving infrastructure."

### For That One Windows User

Every team has one. They suffer in silence, translating Unix commands to PowerShell, dealing with path separators, fighting with line endings.

Windows developer quote: "I actually enjoy development now. I'm not the 'problem child' who always has issues. Docker makes Windows a first-class citizen. I can finally contribute without apologizing for my OS choice."

### For Project Managers

"How long to onboard the new developer?"
"About 5 minutes."
"No, seriously."
"I am serious. They're already coding."

This conversation happens every time we hire someone new. PMs love Docker because it means developers start contributing immediately.

## The Docker-First Philosophy (A Religion, Really) 🐳

ScriptHammer is Docker-first. Not Docker-optional. Not Docker-recommended. Docker-FIRST.

**Never run npm/pnpm directly on your host.**
**Always use `docker compose exec scripthammer pnpm`.**

Why so strict? Because the moment you allow "just this once" to run something natively, you break the promise. The promise that it works the same for everyone.

I've seen it happen:

1. "I'll just run npm install natively, it's faster"
2. Installs different versions due to different npm version
3. Commits updated package-lock.json
4. Breaks Docker build
5. "Docker doesn't work!"

No. YOU broke the contract. Docker works when you use Docker.

The discipline pays off. When EVERYONE uses Docker, EVERYONE has the same experience. No exceptions, no edge cases, no special snowflakes.

## The Mistakes I Made So You Don't Have To 🤦

### Mistake 1: "I'll Dockerize it later"

Started a project without Docker. "I'll add Docker when we need it." Three months later, tried to add Docker. Spent a week debugging why the Docker version behaved differently. Never again. Start with Docker or suffer later.

### Mistake 2: "I'll just quickly test this outside Docker"

Installed a package natively to "quickly test" something. It worked. Committed it. Build broke for everyone else because I had a globally installed dependency I forgot about. The quick test cost us hours.

### Mistake 3: "Docker is overkill for a simple project"

No project stays simple. That "simple API" now has PostgreSQL, Redis, Elasticsearch, and three microservices. Guess what would have made scaling easier? Starting with Docker.

### Mistake 4: "I don't need volumes, I'll copy files"

Tried to avoid volumes by copying files into the container. Every change required a rebuild. 5-minute rebuilds for one-line changes. Volumes exist for a reason. Use them.

## The Bottom Line (Your Life, Improved) 💯

I used to spend 20% of my time fighting with environment issues. Setup problems, version conflicts, "works on my machine" debugging. That's one day per week. 52 days per year. Just... gone.

Now? Zero. Zero time on environment issues.

`docker compose up`

It just works. Every time. For everyone.

That's 52 days per year I get back. 52 days to write code, learn new things, build features, or just have a life.

**The ScriptHammer promise isn't just "it works."**
**It's "it works, so you can work on what matters."**

When someone asks me "What's the best thing about Docker?" I don't talk about containers or isolation or deployment. I tell them:

"I never have to say 'works on my machine' anymore. And neither will you."

---

_P.S. - Yes, you can still run it without Docker if you're stubborn. The code doesn't judge. But really, why would you? It's like choosing to walk to work when someone offers you a free car._

_P.P.S. - To the developer who's been fighting with their setup for three days: Stop. Download Docker. Run `docker compose up`. Your suffering can end in the next five minutes. You deserve better._

_P.P.P.S. - When someone says "works on my machine," you can now reply: "Works on EVERYONE'S machine." The look on their face is worth the entire Docker learning curve._
