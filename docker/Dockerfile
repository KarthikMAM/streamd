# syntax=docker/dockerfile:1.6
#
# Containerised build environment for streamd.
#
# Required because a subset of the build toolchain (`rolldown`, the
# `@biomejs/cli-linux-x64` glibc variant, Vite 6's native bindings) ship
# binaries linked against glibc 2.28 or newer. Linux distributions that
# still ship glibc 2.26 — notably Amazon Linux 2 — cannot load those
# binaries directly. This image pins glibc to 2.36 via Debian Bookworm
# and matches the Node.js version used in CI (22.22.2).
#
# Usage is orchestrated from `scripts/docker.sh`; most contributors
# should not invoke `docker build` directly.

FROM node:22-bookworm-slim AS base

# Core build prerequisites. `git` is needed by Changesets and
# `npm install`. `ca-certificates` is required for TLS. `python3` and
# `build-essential` exist for the rare case when a dependency falls
# back to `node-gyp`. `bash` becomes the default shell so the
# convenience wrapper can pipe multi-command one-liners.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        bash \
        python3 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-lc"]

# The image runs as a non-root user whose UID/GID is set at build time
# from the caller's host identity. This keeps file ownership on the
# bind mount consistent with the host — no `chown` churn after builds.
ARG USER_ID=1000
ARG GROUP_ID=1000
ARG USERNAME=builder
RUN set -eux; \
    existing_user="$(getent passwd "${USER_ID}" | cut -d: -f1 || true)"; \
    existing_group="$(getent group "${GROUP_ID}" | cut -d: -f1 || true)"; \
    if [ -n "$existing_user" ]; then \
        usermod -l "${USERNAME}" "$existing_user"; \
    else \
        if [ -z "$existing_group" ]; then \
            groupadd --gid "${GROUP_ID}" "${USERNAME}"; \
            existing_group="${USERNAME}"; \
        fi; \
        useradd --uid "${USER_ID}" --gid "$existing_group" --create-home --shell /bin/bash "${USERNAME}"; \
    fi

# npm respects `$npm_config_cache`. Pointing it at a volume-friendly
# path inside the user's home means the host's `~/.npm` is not touched
# and repeated builds can share the cache across invocations.
ENV npm_config_cache=/home/${USERNAME}/.npm
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV CI=true

WORKDIR /work
USER ${USERNAME}

# Default command is a shell so `docker run -it ...` drops into a
# ready-to-use environment; the convenience wrapper overrides this
# with a specific command (`npm ci`, `npm run build`, …).
CMD ["/bin/bash", "-l"]
