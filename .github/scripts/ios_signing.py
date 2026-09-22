"""Validate an App Store profile against an imported signing identity."""
import argparse
import datetime as dt
import hashlib
import os
from pathlib import Path
import plistlib
import re
import uuid

BUNDLE_ID = "org.readyall.logbookcompanion"


def validate_profile(profile, team_id, identities, now):
    if not re.fullmatch(r"[A-Z0-9]{10}", team_id):
        raise ValueError("APPLE_TEAM_ID must be a ten-character team identifier.")
    if not isinstance(profile, dict):
        raise ValueError("The provisioning profile is invalid.")
    teams = profile.get("TeamIdentifier")
    if not isinstance(teams, list) or team_id not in teams:
        raise ValueError("The profile does not belong to APPLE_TEAM_ID.")
    entitlements = profile.get("Entitlements", {})
    if not isinstance(entitlements, dict):
        raise ValueError("The profile entitlements are invalid.")
    if entitlements.get("application-identifier") != f"{team_id}.{BUNDLE_ID}":
        raise ValueError("The profile does not match the registered LC bundle identifier.")
    if entitlements.get("com.apple.developer.team-identifier") != team_id:
        raise ValueError("The profile's team entitlement does not match APPLE_TEAM_ID.")
    if entitlements.get("get-task-allow") is not False:
        raise ValueError("A distribution profile with get-task-allow=false is required.")
    if "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices"):
        raise ValueError("Use an App Store Connect profile, not development, ad hoc, or enterprise.")
    platforms = profile.get("Platform")
    if not isinstance(platforms, list) or "iOS" not in platforms:
        raise ValueError("An iOS provisioning profile is required.")
    expires = profile.get("ExpirationDate")
    if not isinstance(expires, dt.datetime):
        raise ValueError("The profile has no valid expiration date.")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=dt.timezone.utc)
    if expires <= now:
        raise ValueError("The provisioning profile has expired.")
    try:
        profile_uuid = str(uuid.UUID(profile["UUID"])).upper()
    except (KeyError, TypeError, ValueError, AttributeError) as error:
        raise ValueError("The profile UUID is invalid.") from error
    name = profile.get("Name")
    if not isinstance(name, str) or not name or len(name) > 256 or any(ord(char) < 32 or ord(char) == 127 for char in name):
        raise ValueError("The profile name is missing or invalid.")
    certificates = profile.get("DeveloperCertificates", [])
    if not isinstance(certificates, list) or not certificates or not all(isinstance(value, bytes) for value in certificates):
        raise ValueError("The profile does not contain valid signing certificates.")
    fingerprints = {hashlib.sha1(value).hexdigest().upper() for value in certificates}
    valid_identities = set(re.findall(r'^\s*\d+\)\s+([A-Fa-f0-9]{40})\s+"', identities, re.MULTILINE))
    matches = fingerprints & {value.upper() for value in valid_identities}
    if len(matches) != 1:
        raise ValueError("Exactly one valid imported signing identity must match the profile.")
    return profile_uuid, matches.pop()


def export_options(team_id, profile_uuid, identity):
    return {
        "method": "app-store-connect",
        "destination": "export",
        "teamID": team_id,
        "signingStyle": "manual",
        "signingCertificate": identity,
        "provisioningProfiles": {BUNDLE_ID: profile_uuid},
        "manageAppVersionAndBuildNumber": False,
        "uploadSymbols": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, type=Path)
    parser.add_argument("--identities", required=True, type=Path)
    parser.add_argument("--export-options", required=True, type=Path)
    args = parser.parse_args()
    try:
        with args.profile.open("rb") as stream:
            profile = plistlib.load(stream)
        profile_uuid, identity = validate_profile(
            profile, os.environ.get("APPLE_TEAM_ID", ""),
            args.identities.read_text(encoding="utf-8"),
            dt.datetime.now(dt.timezone.utc),
        )
        with args.export_options.open("wb") as stream:
            plistlib.dump(export_options(os.environ["APPLE_TEAM_ID"], profile_uuid, identity), stream)
        with Path(os.environ["GITHUB_ENV"]).open("a", encoding="utf-8") as stream:
            stream.write(f"PROFILE_UUID={profile_uuid}\nPROFILE_NAME={profile['Name']}\nSIGNING_IDENTITY={identity}\n")
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(f"iOS signing preflight failed: {error}") from error
    print("PASS: distribution profile, bundle ID, team, expiry, and imported signing identity match.")


if __name__ == "__main__":
    main()
