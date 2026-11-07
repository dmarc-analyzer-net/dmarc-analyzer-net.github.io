#!/usr/bin/env python3
"""Deploy dist/ to a Bunny.net Edge Storage zone and purge the pull zone in front of it.

Three passes, and the order matters:

  1. upload  every file in dist/ to the storage zone
  2. delete  every storage file that is no longer in dist/ (a set difference
             against the real storage listing, not a guess)
  3. purge   the pull zone

Purging last is what makes the first two visible. Bunny's CDN does not
invalidate on a storage write: a re-uploaded file keeps serving its old bytes
with `cdn-cachedat` unmoved, and a file deleted from storage keeps answering
200 with its old body. Both were measured under DMA-19. Purging first would
just re-cache the old tree on the next request.

Credentials are read from the environment at use time and never logged:

  BUNNY_API_KEY           account API key, used for the purge and -- unless
                          BUNNY_STORAGE_PASSWORD is set -- to look up the
                          storage zone password.
  BUNNY_STORAGE_PASSWORD  optional; the storage zone's own password. Set it to
                          avoid handing the deploy an account-wide key.

Nothing here uses the `bunny` CLI. `bunny storage files upload` takes one file
per invocation -- no directory sync, no --delete, no manifest diff -- so the
loop would be ours to write either way, and the CLI offers no listing or delete
primitive to build pass 2 out of. It also reads BUNNYNET_API_KEY while the
repository secret is named BUNNYNET_APIKEY, and on the mismatch it reports
"Not logged in", which reads like a revoked key rather than a typo.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import fnmatch
import hashlib
import json
import os
import random
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_STORAGE_ENDPOINT = "storage.bunnycdn.com"
DEFAULT_CONCURRENCY = 16
MAX_ATTEMPTS = 5

# dist/ is a GitHub Pages build. CNAME is a Pages artefact with no meaning on
# Bunny, and it is extensionless, so the slash-less Edge Rule would treat it as
# a route and 301 it.
DEFAULT_EXCLUDES = ("CNAME",)

# There is deliberately no Content-Type map here. Bunny ignores the header on
# upload -- a .css PUT as application/octet-stream stores ContentType "" and
# still leaves the edge serving `content-type: text/css`. The pull zone decides
# from the file extension, so a map in this script would be inert, and an inert
# map is worse than none: the next reader would trust it to be doing something.
# Verified on the staging zone, 2026-11-06. If a MIME type is ever wrong, the
# fix is an Edge Rule, not a change here.

_print_lock = threading.Lock()


def log(message: str) -> None:
    with _print_lock:
        print(message, flush=True)


def request(
    method: str,
    url: str,
    access_key: str,
    *,
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 120,
) -> tuple[int, bytes]:
    """One Bunny API call, retried on 429 and 5xx with exponential backoff."""
    all_headers = {"AccessKey": access_key, "Accept": "application/json"}
    if headers:
        all_headers.update(headers)

    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        req = urllib.request.Request(url, data=body, method=method, headers=all_headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            # 404 on a GET is a real answer (an empty or missing directory),
            # not a transport failure. Anything below 500 that is not 429 is a
            # verdict too -- retrying a 401 just spends the rate limit.
            if exc.code != 429 and exc.code < 500:
                return exc.code, payload
            last_error = exc
        except (urllib.error.URLError, ssl.SSLError, TimeoutError, ConnectionError) as exc:
            last_error = exc

        if attempt < MAX_ATTEMPTS:
            delay = min(2 ** (attempt - 1), 8) + random.uniform(0, 0.4)
            log(f"  retry {attempt}/{MAX_ATTEMPTS - 1} in {delay:.1f}s -- {method} {url} -- {last_error}")
            time.sleep(delay)

    raise RuntimeError(f"{method} {url} failed after {MAX_ATTEMPTS} attempts: {last_error}")


def sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def collect_local(dist: str, excludes: tuple[str, ...]) -> dict[str, dict]:
    """Every file under dist/, keyed by its storage path (posix, no leading slash)."""
    files: dict[str, dict] = {}
    for root, _dirs, names in os.walk(dist):
        for name in names:
            absolute = os.path.join(root, name)
            relative = os.path.relpath(absolute, dist).replace(os.sep, "/")
            if any(fnmatch.fnmatch(relative, pattern) for pattern in excludes):
                continue
            files[relative] = {
                "abs": absolute,
                "size": os.path.getsize(absolute),
                "sha256": sha256_of(absolute),
            }
    return files


def storage_url(endpoint: str, zone: str, path: str = "") -> str:
    quoted = urllib.parse.quote(path)
    return f"https://{endpoint}/{zone}/{quoted}"


def list_storage(endpoint: str, zone: str, password: str, concurrency: int) -> tuple[dict[str, dict], set[str]]:
    """Recursively list the storage zone.

    Returns (files keyed the same way as collect_local, set of directory
    prefixes each with a trailing slash).
    """
    files: dict[str, dict] = {}
    directories: set[str] = set()
    lock = threading.Lock()

    def walk(prefix: str) -> list[str]:
        status, payload = request("GET", storage_url(endpoint, zone, prefix), password)
        if status == 404:
            return []
        if status >= 300:
            raise RuntimeError(f"listing /{prefix} returned {status}: {payload[:300]!r}")
        subdirectories = []
        for entry in json.loads(payload or b"[]"):
            name = entry["ObjectName"]
            path = f"{prefix}{name}"
            if entry.get("IsDirectory"):
                subdirectories.append(f"{path}/")
            else:
                with lock:
                    files[path] = {
                        "size": entry.get("Length"),
                        # Bunny reports SHA256 as uppercase hex. Older objects
                        # can carry a null checksum; treat that as unknown.
                        "checksum": (entry.get("Checksum") or "").upper() or None,
                    }
        with lock:
            directories.update(subdirectories)
        return subdirectories

    pending = [""]
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        while pending:
            results = pool.map(walk, pending)
            pending = [child for group in results for child in group]
    return files, directories


def empty_directories(directories: set[str], surviving_files: set[str]) -> list[str]:
    """Directories left with no file under them, deepest first.

    Deleting a file does not remove the directory that held it -- Bunny keeps
    listing it as an empty directory -- so without this pass the zone collects
    one husk for every page we ever rename or retire. They answer 404 at the
    edge, so this is tidiness and an honest listing rather than a correctness
    fix. Deepest first, so a directory emptied only by this pass is itself
    removed on the same run.
    """
    occupied = set()
    for path in surviving_files:
        parts = path.split("/")[:-1]
        for depth in range(len(parts)):
            occupied.add("/".join(parts[: depth + 1]) + "/")
    return sorted((d for d in directories if d not in occupied), key=lambda d: d.count("/"), reverse=True)


def upload_one(endpoint: str, zone: str, password: str, path: str, info: dict) -> tuple[str, int]:
    with open(info["abs"], "rb") as handle:
        body = handle.read()
    status, payload = request(
        "PUT",
        storage_url(endpoint, zone, path),
        password,
        body=body,
        # Bunny verifies this server-side and refuses the write on a mismatch
        # ("Checksum missmatch, skipping commit", HTTP 400), which turns a
        # silently truncated upload into a failed deploy. Measured, not assumed.
        headers={"Checksum": info["sha256"]},
    )
    if status not in (200, 201):
        raise RuntimeError(f"upload {path} returned {status}: {payload[:300]!r}")
    return path, status


def delete_one(endpoint: str, zone: str, password: str, path: str) -> tuple[str, int]:
    status, payload = request("DELETE", storage_url(endpoint, zone, path), password)
    # A 404 means it is already gone, which is the state we wanted.
    if status not in (200, 404):
        raise RuntimeError(f"delete {path} returned {status}: {payload[:300]!r}")
    return path, status


def run_pool(concurrency: int, work, items, label) -> list[str]:
    """Run every item, then report the failures -- rather than raising on the first.

    Raising mid-pass would leave the zone holding whichever subset happened to
    finish, and say only which file lost the race. Finishing the pass converges
    the zone as far as it can, and names every file that failed so the re-run
    is informed. The caller decides what a non-empty return means.
    """
    failures: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {pool.submit(work, item): item for item in items}
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as error:  # noqa: BLE001 -- reported, not swallowed
                failures.append(f"{label(futures[future])}: {error}")
    return sorted(failures)


def lookup_storage_password(api_key: str, zone_name: str) -> str:
    status, payload = request("GET", "https://api.bunny.net/storagezone?page=1&perPage=1000", api_key)
    if status in (401, 403):
        raise RuntimeError(
            f"Bunny rejected the account API key ({status}). The key is read from BUNNY_API_KEY; "
            "in CI that is fed from the repository secret named BUNNYNET_APIKEY. A revoked key and "
            "an unset variable look the same from here -- check the variable is actually populated "
            "before assuming the key is bad."
        )
    if status >= 300:
        raise RuntimeError(f"storage zone lookup returned {status}")
    data = json.loads(payload)
    zones = data.get("Items", data) if isinstance(data, dict) else data
    for zone in zones:
        if zone.get("Name") == zone_name:
            return zone["Password"]
    raise RuntimeError(f"storage zone {zone_name!r} not found on this account")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dist", default="dist", help="build output directory (default: dist)")
    parser.add_argument("--storage-zone", required=True, help="storage zone name")
    parser.add_argument("--pull-zone", required=True, help="pull zone numeric id, for the purge")
    parser.add_argument("--endpoint", default=DEFAULT_STORAGE_ENDPOINT, help=f"storage endpoint (default: {DEFAULT_STORAGE_ENDPOINT})")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="glob kept out of the zone; repeatable. CNAME is always excluded. "
        "Excluded means absent, not merely unpublished: a matching file already in "
        "storage is deleted by pass 2, which is how the CNAME left behind by the "
        "GitHub Pages era was removed. Use it to retire a path, not to protect one.",
    )
    parser.add_argument("--skip-unchanged", action="store_true", help="upload only files whose sha256 differs from the storage listing")
    parser.add_argument("--dry-run", action="store_true", help="report the three passes without changing anything")
    parser.add_argument("--no-purge", action="store_true", help="run passes 1 and 2 but not the purge")
    args = parser.parse_args()

    api_key = os.environ.get("BUNNY_API_KEY", "").strip()
    storage_password = os.environ.get("BUNNY_STORAGE_PASSWORD", "").strip()
    if not api_key and not storage_password:
        print("error: set BUNNY_API_KEY (and optionally BUNNY_STORAGE_PASSWORD)", file=sys.stderr)
        return 2
    if not api_key and not args.no_purge and not args.dry_run:
        print("error: the purge needs BUNNY_API_KEY; pass --no-purge to skip it", file=sys.stderr)
        return 2

    if not os.path.isdir(args.dist):
        print(f"error: {args.dist}/ does not exist -- build first", file=sys.stderr)
        return 2

    excludes = DEFAULT_EXCLUDES + tuple(args.exclude)
    started = time.time()

    log(f"dist     {args.dist}")
    log(f"storage  {args.storage_zone} via {args.endpoint}")
    log(f"pullzone {args.pull_zone}")
    log(f"excludes {', '.join(excludes)}")
    log("")

    # Read the local tree before authenticating: the one input that can destroy
    # the zone is checked here, and a bad --dist should fail without a network
    # call to find out.
    local = collect_local(args.dist, excludes)
    total_bytes = sum(info["size"] for info in local.values())
    log(f"local:   {len(local)} files, {total_bytes / 1_048_576:.2f} MB")

    # Pass 2 is a set difference, so an empty dist/ is not "nothing to deploy"
    # -- it is "delete the entire site, then purge the zone so the deletion is
    # visible immediately". A build that produced nothing, a --dist pointing at
    # the wrong directory, or an --exclude that matched everything all arrive
    # here looking identical. Refuse; an empty zone is not a state any input to
    # this script should be able to ask for by accident.
    if not local:
        print(
            f"error: {args.dist}/ contains no deployable files after excludes "
            f"({', '.join(excludes)}) -- refusing to empty the storage zone",
            file=sys.stderr,
        )
        return 2

    if not storage_password:
        storage_password = lookup_storage_password(api_key, args.storage_zone)

    listing_started = time.time()
    remote, remote_dirs = list_storage(args.endpoint, args.storage_zone, storage_password, args.concurrency)
    log(f"storage: {len(remote)} files, {len(remote_dirs)} directories (listed in {time.time() - listing_started:.1f}s)")
    log("")

    # Pass 1 -- upload.
    if args.skip_unchanged:
        to_upload = {
            path: info
            for path, info in local.items()
            if remote.get(path, {}).get("checksum") != info["sha256"]
        }
    else:
        to_upload = local

    # Pass 2 -- delete: the set difference, computed against the real listing.
    to_delete = sorted(set(remote) - set(local))
    to_prune = empty_directories(remote_dirs, set(local))

    log(f"pass 1 upload: {len(to_upload)} files" + ("" if not args.skip_unchanged else f" ({len(local) - len(to_upload)} unchanged, skipped)"))
    log(f"pass 2 delete: {len(to_delete)} files, {len(to_prune)} emptied directories")
    for path in to_delete:
        log(f"  - {path}")
    for path in to_prune:
        log(f"  - {path} (directory)")
    log("")

    if args.dry_run:
        log(f"dry run -- nothing changed ({time.time() - started:.1f}s)")
        return 0

    upload_started = time.time()
    upload_failures: list[str] = []
    if to_upload:
        upload_failures = run_pool(
            args.concurrency,
            lambda item: upload_one(args.endpoint, args.storage_zone, storage_password, item[0], item[1]),
            sorted(to_upload.items()),
            lambda item: item[0],
        )
    upload_seconds = time.time() - upload_started
    uploaded_bytes = sum(local[path]["size"] for path in to_upload)
    log(f"pass 1 done: {len(to_upload) - len(upload_failures)} uploaded in {upload_seconds:.1f}s" + (f" ({uploaded_bytes / 1_048_576 / max(upload_seconds, 0.001):.1f} MB/s)" if uploaded_bytes else ""))

    # An incomplete upload is the one failure where stopping is better than
    # carrying on. Deleting now would prune files whose replacements never
    # landed, and purging would make the gap visible; leaving both undone
    # leaves the edge serving the previous tree, whole, until the re-run.
    if upload_failures:
        for failure in upload_failures:
            log(f"  ! {failure}")
        raise RuntimeError(
            f"{len(upload_failures)} of {len(to_upload)} uploads failed -- passes 2 and 3 skipped, "
            "the edge is still serving the previous tree"
        )

    delete_started = time.time()
    delete_failures: list[str] = []
    if to_delete:
        delete_failures = run_pool(
            args.concurrency,
            lambda path: delete_one(args.endpoint, args.storage_zone, storage_password, path),
            to_delete,
            lambda path: path,
        )
    # Serially and deepest-first: a parent is only removable once its children
    # are gone, which the ordering guarantees but a thread pool would not.
    prune_failures: list[str] = []
    for path in to_prune:
        try:
            delete_one(args.endpoint, args.storage_zone, storage_password, path)
        except RuntimeError as error:
            prune_failures.append(f"{path}: {error}")
    log(
        f"pass 2 done: {len(to_delete) - len(delete_failures)} files and "
        f"{len(to_prune) - len(prune_failures)} directories deleted in {time.time() - delete_started:.1f}s"
    )
    for failure in delete_failures + prune_failures:
        log(f"  ! {failure}")

    # Pass 3 -- purge, last, so the first two become visible.
    if args.no_purge:
        log("pass 3 skipped (--no-purge) -- the edge is still serving the old tree")
    else:
        purge_started = time.time()
        status, payload = request(
            "POST",
            f"https://api.bunny.net/pullzone/{args.pull_zone}/purgeCache",
            api_key,
            body=b"",
            headers={"Content-Type": "application/json"},
            timeout=300,
        )
        if status not in (200, 204):
            raise RuntimeError(f"purge returned {status}: {payload[:300]!r}")
        log(f"pass 3 done: pull zone {args.pull_zone} purged in {time.time() - purge_started:.1f}s (HTTP {status})")

    log("")
    # Unlike a failed upload, a failed delete is survivable: everything in
    # dist/ is live and correct, and the leftovers are stale paths nothing
    # links to. The purge above was worth running for the uploads. Still a
    # failed deploy, because the zone no longer matches dist/.
    if delete_failures or prune_failures:
        log(f"deploy FAILED in {time.time() - started:.1f}s -- "
            f"{len(delete_failures) + len(prune_failures)} deletions did not succeed; storage holds stale paths")
        return 1

    log(f"deploy complete in {time.time() - started:.1f}s")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as error:
        # A traceback here would only ever point at the request helper. The
        # message is the useful part, and a failed deploy should read as a
        # failed deploy rather than as a crash.
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
