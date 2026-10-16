# 0224 — The image is layered, so a deploy pushes only what changed

- **Date:** 2026-10-17
- **Status:** built, **not pushed, not deployed**. Backend `feat/layered-image` `38be7e8` (worktree
  `kaam/worktrees/invotick-apis-layers`, off `origin/stage` `6908d3f`). Gradle not run by the builder.
- **Owner's order (2026-10-17):** "deploy tez karo".
- **Decision:** build the backend image from the boot jar's four Spring Boot layers, each its own image layer with a
  digest that stays the same while its content does, so a deploy uploads only our own classes.

## The numbers that started it

- A `stage` pipeline took 18-22 min. The registry **push** alone was ~510-675 s.
- The image was ~208 MB, and the jar was **one ~90 MB layer, new on every commit**. Kaniko builds on the owner's Mac
  without a cache and pushes over a home line, so every deploy sent those ~90 MB again.
- Codlytics got its push to ~8 s by keeping its base and dependency layers unchanged between builds.

## What was decided

1. **The test job extracts the layers** (it has Java; kaniko's image has none). After `./gradlew test bootJar`,
   `deploy/image-layers.sh extract` runs Spring Boot 3.5's own tool:
   `java -Djarmode=tools -jar app.jar extract --layers --launcher --destination ci/layers`.
   - It gives four directories: `dependencies`, `spring-boot-loader`, `snapshot-dependencies` and `application`.
   - The flags were read from the tool's own help text in the 3.5.5 jar. The old `layertools` mode is gone in 3.5.
   - Every file then gets one time (1980-01-01) and one mode (`u=rwX,go=rX`).
   - The artifact is `ci/layers/` only. **The jar is no longer saved beside it**, or the upload would double.
2. **The Dockerfile copies the four layers, one COPY each**, from least to most often changed.
   - **The entrypoint keeps every JVM flag.** It starts `org.springframework.boot.loader.launch.JarLauncher` from
     `/app` instead of `-jar app.jar`.
   - That is the same loader and the same class path order (`BOOT-INF/classpath.idx`) that `-jar` ran through the
     jar's manifest.
   - The `builder` stage (a plain `docker build .`) makes the same four directories with the same script.
3. **`build:docker` runs `normalise` again, then kaniko with `--reproducible`.**
   - The log lists every layer's size and digest, so two deploys can be compared.
   - The amd64 check, the label check and the dry run on other branches (built and checked, never pushed) are
     unchanged. So are `deploy:new-server`'s registry architecture check and its ssh/script contract.
4. **`ImageLayersGuardTest` fails the build if any of this is lost:**
   - a fat COPY, or the four COPYs merged;
   - `-jar` back in the entrypoint, or a JVM flag gone;
   - the times or modes not normalised;
   - the jar back in the artifact;
   - `--reproducible` dropped;
   - a kaniko `--cache`.

## How "the same bytes" was made true, and measured

A registry is asked for each layer's digest before the upload, so a layer whose bytes are unchanged is never sent
again. The bytes of a layer's tar are:

| What | How it is kept the same |
|:--|:--|
| content | The nested jars come out of the boot jar unchanged; Gradle copies them from its cache. |
| file order | Kaniko walks the directory in sorted order. |
| owner | Kaniko writes uid/gid 0 for a COPY with no `--chown`. |
| mode | `image-layers.sh` sets it, in the test job and again in `build:docker` after the artifact zip. |
| time | **`--reproducible`.** Normalising the files alone is **not enough**, measured below. |

Measured on 2026-10-17 on the owner's Mac, with the same kaniko (v1.23.2-debug), flags and Docker Desktop as CI.
- The jar was a stand-in Spring Boot 3.5.5 boot jar, built without Gradle from the loader and libraries in the Gradle
  cache.
- **Without `--reproducible`:** two builds of identical, time-normalised files gave a **different digest for every
  one of our layers**. Kaniko writes the time of its own copy into each tar header: mtime, and atime/ctime as PAX
  records. The source file's time never reaches the layer.
- **With it:**
  - the base, `dependencies` and `spring-boot-loader` digests were identical across builds;
  - `application` was identical for identical code, and different for changed code.
- **Pushing to a local registry:** the first build uploaded 11 blobs. The next build, with changed code, uploaded
  **2**: the application layer and the image config.
- **The built amd64 image ran** as `999:987`, through `JarLauncher`'s `LaunchedClassLoader`, with `user.timezone=UTC`
  and working directory `/app`. A BuildKit build of the same Dockerfile works too.
- **Not measured:** the real app's boot. The stand-in had no Spring context, and Gradle was not run.

## Risks, written down before the first deploy

- **The entrypoint changes in production for the first time.** Watch the first `stage` deploy of this shape.
  - If `/actuator/health/deploy` does not answer 200, `deploy-invotick` puts the previous tag back on its own.
  - Every older image carries its own `-jar app.jar` entrypoint and its jar, so a rollback starts as it always did.
  - Going back for good is reverting the commit. Nothing on the box changes.
- **The first `stage` pipeline is slow.** It pushes every layer once, including the base image's:
  `--reproducible` rewrites those, so their digests are ours, not Docker Hub's. **The second pipeline is the proof:**
  only the last digest in `layers (bytes, digest):` should differ from the first's.
- **Every time in the image is zero**, its `created` date included (`docker images` shows 0001 or 1970).
  - The weekly prune (`ops/vps-n/cron/docker-prune`, `--filter until=168h`, no `-a`) removes only dangling images
    of ours. Tagged ones are never touched.
  - If the box's copy ever carries `-a`, unused images, the rollback target included, would go every Sunday. The
    rollback's `compose up` would then pull the image again.
- **The libraries go up again whenever `build.gradle.kts` changes them**, and the base whenever
  `eclipse-temurin:21-jre-alpine` moves. Each is a one-off ~60-80 MB push, as before.
- **Not solved here: the artifact.** The test job still uploads `ci/layers/` (~90 MB, the same size the jar was) to
  GitLab, and `build:docker` downloads it. If that upload is as slow as the push was (read "Uploading artifacts" in
  the test job's log), it is the next cut.
  - The way: a dependencies image tagged by the hash of `ci/layers/dependencies`, pushed only when it is new.
  - The test job would then leave `dependencies` out of the artifact whenever the registry already has that tag.

## Rejected

- **GitLab's shared runner for the build.** It spends shared minutes, which ran out on 2026-09-28 (0162); since
  2026-10-07 every CI job runs on the Mac. It would also move the problem rather than remove it: a fat layer that
  changes every commit still has to be pushed from somewhere, every deploy.
- **buildx on Docker Desktop.** It needs the Mac's Docker socket mounted into the job, or privileged
  docker-in-docker. Either one lets a CI job start any container on the owner's Mac. Kaniko was chosen on 2026-10-07
  for exactly that reason.
- **The fat jar as it is.** That is the ~90 MB push on every deploy, the thing being fixed.
- **Kaniko's cache only (`--cache=true --cache-repo=…`).**
  - The shipped stage has no RUN, so there is nothing to cache.
  - Caching COPY layers needs `--cache-copy-layers`, which is unreliable across stages.
  - A cache repo is a **second** upload of every layer from the Mac.
  - Without stable layers the cache would hold a fat layer that changes every commit.
  - The registry's own digest check already skips everything a cache would.
- **The extract without `--launcher`** (Spring's other layout: a thin `app.jar` plus `lib/`, started with `-jar`).
  It would keep the entrypoint's text. But the class loader under every class would change to the JDK's own.
  `--launcher` keeps the loader production has always run on.
- **Normalising file times without `--reproducible`.** Measured above: kaniko does not carry a file's time into the
  layer.
