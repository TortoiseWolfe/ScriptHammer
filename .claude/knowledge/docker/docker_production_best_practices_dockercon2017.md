# Docker Production Best Practices

**Bret Fisher - DockerCon 2017**
Source: https://youtu.be/V4f_sHTzvCI

---

## Overview

This talk covers:
- **Limiting simultaneous innovation** - Scope control for container projects
- **Dockerfile maturity model** - From working to production-ready
- **Dockerfile anti-patterns** - Common mistakes to avoid
- **Infrastructure decisions** - VMs vs bare metal, OS/kernel, base images
- **Swarm architectures** - Design patterns from 1 to 100+ nodes
- **Outsourcing decisions** - What to build vs buy
- **Tech stacks** - Example configurations for different needs

---

## Limiting Simultaneous Innovation

**Problem:** Teams want their first container project to replicate 20 years of VM infrastructure.

### Things You DON'T Need for Your First Container Project

| Feature | Why You Can Delay |
|---------|-------------------|
| **CI/CD** | Most CI platforms already support containers. Don't build CI infrastructure just for containers. |
| **Dynamic scaling** | Automatic scaling isn't built-in. Learn orchestration first before automating scale. |
| **Persistent data** | Databases are harder. Start with stateless apps—you're deploying code more often anyway. |
| **12-Factor compliance** | Treat it as a horizon, not a prerequisite. Implement distributed computing best practices over time. |
| **Code changes** | Legacy apps still work. The most common change is pulling hardcoded IPs/hostnames into environment variables. |

**Key insight:** You learn more on the first day of production than the last two months of the project.

---

## Dockerfile Maturity Model

**Focus on Dockerfiles first.** They're more important than fancy orchestration or CI/CD.

### Progression (In Order)

1. **Make it work** - App starts and stays running
2. **Get logs out** - Send to stdout/stderr, not log files. Remove app logging modules.
3. **Document it** - Comment each section. Others need to understand and test it.
4. **Make it lean** - But image size is NOT your #1 or #2 problem
5. **Make it scale** - Verify the app works with multiple container instances

### On Image Size

**Don't sweat image size early:**
- Images are stored once per version, even with 5 running containers
- A 500MB image is fine on day one
- Match your existing build documentation (apt-get works in Dockerfiles)
- Consider Alpine later as a separate project

---

## Dockerfile Anti-Patterns

### 1. Missing Volumes for Persistent Data

**Problem:** Forgetting to add volumes for debug logs, air dumps, static file uploads, or cache files.

**Solution:** If using official images, volumes are usually handled. Check your app for any file writes that should persist.

### 2. Using `latest` Tag

**Never type `latest`.** Always use explicit versions.

```dockerfile
# BAD
FROM php:latest

# GOOD
FROM php:7.1-apache
```

**Why:** Your Dockerfile could be built daily. Random dependency versions cause mysterious failures.

### 3. Not Pinning Package Versions

```dockerfile
# Document versions at the top
ENV NODE_VERSION=8.9.1 \
    NGINX_VERSION=1.13.6

# Pin apt-get packages
RUN apt-get install -y \
    libpq-dev=9.6.5-1 \
    imagemagick=6.9.7.4
```

**Why:** You don't deploy random code versions, so don't deploy random dependency versions.

### 4. Default Configs in Apps

**Problem:** PHP, MySQL, PostgreSQL, Java all have config defaults that need tuning for containers.

**Solutions:**
- Set configs via environment variables in the Dockerfile
- Use entrypoint scripts to configure at runtime (see official MySQL/Postgres images)
- Don't hardcode environment-specific settings into the build

### 5. Building Different Images Per Environment

**Anti-pattern:**
```dockerfile
# Building separate images for dev/staging/prod
COPY config.dev.json /app/config.json  # DON'T DO THIS
```

**Solution:** Build one image. Configure at runtime via environment variables.

```dockerfile
# Set defaults in Dockerfile
ENV DB_HOST=localhost \
    LOG_LEVEL=info

# Override at runtime
docker run -e DB_HOST=prod-db -e LOG_LEVEL=warn myapp
```

---

## Infrastructure Decisions

### VMs vs Bare Metal

**Recommendation:** Do what you're good at.

- If you're on VMs, stay on VMs initially
- Later, do performance testing on bare metal
- Test at scale (many containers on one host)

**Resources:** HPE + Docker white papers on workload comparisons (VM vs containers-in-VM vs containers-on-bare-metal)

**Key insight:** Higher container density changes I/O patterns, kernel scheduling, and network settings. Learn as you grow.

### OS and Kernel Selection

**Your kernel matters more than your distribution.**

| Recommendation | Details |
|----------------|---------|
| **Minimum kernel** | 3.10 (but just because it works doesn't mean you should use it) |
| **Recommended** | 4.x kernel |
| **Default choice** | Ubuntu (4.x kernel out of box, LTS support, well-documented, heavily tested by Docker) |
| **Advanced** | InfraKit + LinuxKit (will delay your project as you learn) |

**Warning:** Some distributions still ship 3.x kernels even in latest versions.

**Get Docker from the store:** Distribution package managers (apt-get, yum) have outdated versions. Use docker.com/store for current stable releases.

### Base Image Selection

**Three-tier approach:**

1. **Base image** - From Docker Hub/Store (official images)
2. **Intermediate image** - Your team's standard (like a "golden image")
3. **Application image** - Built on your intermediate

**Recommendation:** Match your existing VMs. If you use Ubuntu servers, use Ubuntu base images. Save Alpine for later.

---

## Swarm Architecture Patterns

### Baby Swarm (1 Node)

```bash
docker swarm init
```

**Use case:** Non-critical systems that don't need HA (CI systems, notification services).

**Benefits over docker run:**
- Secrets and configs
- Declarative services (auto-replace failed containers)
- Health checks
- Rolling updates

### 3-Node Swarm

**Minimum for fault tolerance.** All nodes are managers AND workers.

- Can lose 1 node
- Higher security risk (all nodes have raft database)
- Good for hobby/test projects

### 5-Node Swarm ("Biz Swarm")

**Recommended minimum for production.**

- Can lose 2 nodes (even during maintenance)
- All nodes are managers AND workers
- Still simple architecture

### Split Architecture (Dedicated Managers)

**For larger deployments:**

```
Managers (3-5)        Workers (N)
┌─────────────┐       ┌─────────────┐
│  Secure     │       │  Workloads  │
│  Enclave    │       │  Different  │
│  (VLAN)     │──────▶│  profiles   │
│             │       │             │
└─────────────┘       └─────────────┘
```

**Workers can have:**
- Different hardware profiles (SSDs, GPUs)
- Different network segments
- Different availability zones
- Security compliance scanners (PCI)
- VPN connections

**Use labels and constraints** to assign workloads to specific node types.

### Scaling to 100+ Nodes

- Same pattern, more workers
- Manager resources may need scaling (raft database grows with workload)
- Managers are easy to replace (two commands)

### Don't Make Cattle into Pets

**Anti-pattern:** Installing tools, cloning repos, running apt-get on host machines.

**Best practice:**
- Build server → Install Docker → Join swarm → Deploy containers
- Do everything through Docker API or SSH (no local storage)
- Troubleshoot in containers, not on hosts

---

## Reasons for Multiple Swarms

### Bad Reasons (Single Swarm Can Handle)

- Different apps/environments
- Scale concerns
- Team boundaries (without RBAC)

### Good Reasons

| Reason | Explanation |
|--------|-------------|
| **Ops learning environment** | Give ops team a real swarm to fail on before production |
| **Management boundaries** | Docker API is all-or-nothing without RBAC (use Docker EE or third-party tools for RBAC) |
| **Geographic/regulatory** | Different offices or compliance requirements |

---

## Windows + Linux Hybrid Swarms

**Windows Server 2016 enables hybrid swarms.**

### Considerations

- Many open-source monitoring/logging tools are Linux-only
- Consider Linux nodes even in Windows shops for ecosystem tools
- **License optimization:** Use Linux for manager-only nodes (no Windows license for non-workload nodes)

---

## Outsourcing Your Tech Stack

**Beware "not invented here" syndrome.**

### Good Candidates for SaaS/Commercial Products

| Category | DIY Option | Commercial Alternative |
|----------|-----------|------------------------|
| **Image registry** | Docker Distribution + Portus | Docker Hub, ECR, GCR, Quay |
| **Centralized logging** | ELK stack | Splunk, Datadog, Papertrail |
| **Monitoring** | Prometheus + Grafana | Datadog, New Relic |

**Trade-off:** Free (open source) vs convenient (commercial). Outsourcing accelerates projects.

**Resource:** CNCF landscape diagram shows ecosystem options for each category.

---

## Example Tech Stacks

### Pure Open Source Stack

```
Infrastructure:  InfraKit + Terraform
Runtime:         Docker CE
Orchestration:   Docker Swarm
Networking:      Overlay (built-in)
Storage:         REX-Ray
CI/CD:           Jenkins
Registry:        Docker Distribution + Portus
Layer 7 Proxy:   Flow Proxy or Traefik
Logging:         ELK
Monitoring:      Prometheus + Grafana
GUI:             Portainer
FaaS:            OpenFaaS
```

### Accelerated with SaaS

```
Infrastructure:  Docker for AWS/Azure (free templates)
Registry:        Docker Hub or cloud provider
Logging:         Commercial SaaS
Monitoring:      Commercial SaaS
```

### Docker Enterprise Edition

```
Infrastructure:  Docker for AWS/Azure
Runtime:         Docker EE
Registry:        Docker Trusted Registry (DTR)
Layer 7 Proxy:   Built-in (UCP)
GUI:             Universal Control Plane (UCP)
+ Image scanning, RBAC, image promotion, content trust
```

---

## One Container Per VM Pattern

**Alternative when you can't do full orchestration:**

- Use existing VM auto-scaling (ASGs in AWS)
- One container per VM
- Keeps VM boundaries you're used to

**Benefits:**
- Learn Dockerfiles and Docker in production
- Don't change existing infrastructure patterns
- Step toward full orchestration later

**Already happening:**
- Hyper-V containers (Windows)
- Intel Clear Containers
- LinuxKit minimal VMs
- Linux containers on Windows (LCOW)

---

## Summary

1. **Trim optional requirements** - CI/CD, dynamic scaling, and persistent data can wait
2. **Focus on Dockerfiles first** - They're your new build documentation
3. **Watch for anti-patterns** - Versions, configs, environment-specific builds
4. **Stick with familiar OS and images** - Change distributions later
5. **Grow swarm as you grow** - Start small, add workers
6. **Outsource plumbing** - Registries, logging, monitoring are good candidates
7. **Accept change** - Your first choice may not be your best choice
