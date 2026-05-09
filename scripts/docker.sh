#!/usr/bin/env bash
#
# docker.sh — run monorepo commands inside the pinned build container.
#
# The host-glibc mismatch documented in `docker/Dockerfile` means a
# subset of the toolchain only loads in a modern-libc environment.
# This wrapper hides the docker invocation behind a `./scripts/docker.sh
# <npm-script-or-command>` entry point so contributors do not have to
# construct long `docker run` invocations.
#
# On first run, the image is built with the host's uid/gid so files
# written to the bind mount carry host ownership. Subsequent runs
# reuse the cached image unless `docker/Dockerfile` has changed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${STREAMD_BUILD_IMAGE:-streamd/build}"
IMAGE_TAG="${STREAMD_BUILD_TAG:-local}"
DOCKERFILE="${REPO_ROOT}/docker/Dockerfile"

# If the Dockerfile has changed since the last build, rebuild. The
# sentinel compares against the image's label rather than a separate
# cache file so `docker system prune` cannot desync them.
dockerfile_hash() {
    sha256sum "$DOCKERFILE" | awk '{print $1}'
}

image_hash() {
    docker image inspect --format '{{ index .Config.Labels "streamd.dockerfile.sha256" }}' \
        "${IMAGE_NAME}:${IMAGE_TAG}" 2>/dev/null || true
}

ensure_image() {
    local expected; expected="$(dockerfile_hash)"
    local actual; actual="$(image_hash)"
    if [ "$expected" = "$actual" ]; then
        return
    fi
    echo "==> Building ${IMAGE_NAME}:${IMAGE_TAG} (glibc 2.36, Node 22)…" >&2
    docker build \
        --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
        --build-arg "USER_ID=$(id -u)" \
        --build-arg "GROUP_ID=$(id -g)" \
        --label "streamd.dockerfile.sha256=${expected}" \
        --file "$DOCKERFILE" \
        "$REPO_ROOT/docker"
}

run_in_image() {
    # The host's workspace is bind-mounted read/write at /work. The
    # npm cache lives inside the workspace at `.cache/docker-npm/`
    # (gitignored) so it inherits host ownership via the bind mount
    # and persists across invocations.
    mkdir -p "${REPO_ROOT}/.cache/docker-npm"
    docker run \
        --rm \
        --interactive \
        $( [ -t 0 ] && echo --tty ) \
        --volume "${REPO_ROOT}:/work" \
        --workdir /work \
        --env "CI=${CI:-true}" \
        --env "npm_config_cache=/work/.cache/docker-npm" \
        "${IMAGE_NAME}:${IMAGE_TAG}" \
        "$@"
}

main() {
    ensure_image
    if [ "$#" -eq 0 ]; then
        run_in_image /bin/bash -l
        return
    fi

    case "$1" in
        ci)
            run_in_image /bin/bash -lc "npm ci && npm run ci"
            ;;
        build)
            run_in_image /bin/bash -lc "npm ci && npm run build"
            ;;
        test)
            run_in_image /bin/bash -lc "npm ci && npm run test"
            ;;
        check:perf)
            run_in_image /bin/bash -lc "npm ci && npm run check:perf"
            ;;
        check:spec)
            run_in_image /bin/bash -lc "npm ci && npm run check:spec"
            ;;
        shell)
            run_in_image /bin/bash -l
            ;;
        *)
            # Forward the full argv — lets callers run arbitrary
            # scripts inside the container, e.g.
            # `scripts/docker.sh npm run -w @streamd/parser test`.
            run_in_image "$@"
            ;;
    esac
}

main "$@"
