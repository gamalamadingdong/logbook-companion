"""Download and verify an archive-only run's IPA without loading Apple credentials."""
import hashlib
import io
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import zipfile

BUNDLE_ID = "org.readyall.logbookcompanion"


def validate_run(run, run_id):
    if (str(run.get("id")) != run_id or run.get("conclusion") != "success"
            or run.get("event") != "workflow_dispatch" or run.get("head_branch") != "main"
            or run.get("path") != ".github/workflows/ios-beta-archive.yml"):
        raise ValueError("Select a successful manual iOS Beta Archive run from main.")


def validate_ipa(metadata, ipa_bytes, run, run_id, build):
    if (metadata.get("runId") != run_id or metadata.get("build") != build
            or metadata.get("runAttempt") != str(run["run_attempt"])
            or metadata.get("workflowCommit") != run["head_sha"]
            or metadata.get("bundleId") != BUNDLE_ID
            or metadata.get("concept2Environment") != "development"
            or metadata.get("sourceBranch") != "staging"
            or metadata.get("uploaded") is not False
            or not re.fullmatch(r"[a-f0-9]{40}", metadata.get("sourceCommit", ""))):
        raise ValueError("Archive provenance does not match the requested staging build.")
    with zipfile.ZipFile(io.BytesIO(ipa_bytes)) as ipa:
        manifests = [name for name in ipa.namelist()
                     if name.startswith("Payload/") and name.endswith(".app/Info.plist")
                     and name.count("/") == 2]
        if len(manifests) != 1:
            raise ValueError("Expected one application in the IPA.")
        info = plistlib.loads(ipa.read(manifests[0]))
        for field, expected in [
            ("CFBundleIdentifier", BUNDLE_ID), ("CFBundleVersion", build),
            ("CFBundleShortVersionString", metadata["version"]),
        ]:
            if info.get(field) != expected:
                raise ValueError("IPA identity/version differs from its archive provenance.")
        config = json.loads(ipa.read(manifests[0].removesuffix("Info.plist") + "capacitor.config.json"))
        if config.get("appId") != BUNDLE_ID or "url" in config.get("server", {}):
            raise ValueError("IPA must contain the registered identity and bundled assets.")


def main():
    run_id, build = os.environ["ARCHIVE_RUN_ID"], os.environ["EXPECTED_BUILD"]
    if not re.fullmatch(r"[1-9][0-9]*", run_id) or not re.fullmatch(r"[0-9]+(?:\.[0-9]+){0,2}", build):
        raise ValueError("Enter a numeric archive run ID and exact native build number.")
    repo = os.environ["GITHUB_REPOSITORY"]

    def api(path):
        return subprocess.check_output(["gh", "api", f"repos/{repo}/{path}"])

    run = json.loads(api(f"actions/runs/{run_id}"))
    validate_run(run, run_id)
    artifacts = json.loads(api(f"actions/runs/{run_id}/artifacts?per_page=100"))
    if artifacts["total_count"] != 1:
        raise ValueError("Expected exactly one archive artifact.")
    artifact = artifacts["artifacts"][0]
    if artifact["expired"] or not artifact["name"].startswith("lc-ios-staging-"):
        raise ValueError("The archive artifact is expired or unexpected.")
    archive_bytes = api(f"actions/artifacts/{artifact['id']}/zip")
    digest = "sha256:" + hashlib.sha256(archive_bytes).hexdigest()
    if artifact.get("digest") != digest:
        raise ValueError("Downloaded artifact digest does not match GitHub.")
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        files = [name for name in archive.namelist() if not name.endswith("/")]
        ipas = [name for name in files if name.endswith(".ipa")]
        if len(files) != 2 or len(ipas) != 1 or "build-metadata.json" not in files:
            raise ValueError("Artifact must contain exactly one IPA and its metadata.")
        metadata = json.loads(archive.read("build-metadata.json"))
        ipa_bytes = archive.read(ipas[0])
    validate_ipa(metadata, ipa_bytes, run, run_id, build)
    expected_name = f"lc-ios-staging-{metadata['sourceCommit']}-{run_id}-{run['run_attempt']}"
    if artifact["name"] != expected_name:
        raise ValueError("Artifact name does not match archive provenance.")
    destination = Path(os.environ["RUNNER_TEMP"]) / "lc-testflight"
    destination.mkdir(mode=0o700)
    (destination / "LogbookCompanion.ipa").write_bytes(ipa_bytes)
    (destination / "build-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as stream:
        stream.write(f"## Verified TestFlight input\n- Archive run: `{run_id}`\n")
        stream.write(f"- Bundle: `{BUNDLE_ID}`\n- Build: `{build}`\n")
        stream.write(f"- Artifact SHA-256: `{digest}`\n- IPA SHA-256: `{hashlib.sha256(ipa_bytes).hexdigest()}`\n")
    print("PASS: exact staging IPA and provenance verified; no rebuild or signing change.")


if __name__ == "__main__":
    main()
