import copy
import datetime as dt
import hashlib
from pathlib import Path
import unittest

from ios_signing import BUNDLE_ID, export_options, validate_profile

TEAM = "TESTTEAM01"
CERTIFICATE = b"synthetic certificate fixture, not a credential"
FINGERPRINT = hashlib.sha1(CERTIFICATE).hexdigest().upper()
NOW = dt.datetime(2026, 9, 22, tzinfo=dt.timezone.utc)
PROFILE_UUID = "D6B131BA-D9B9-422C-8C61-8F273BFE7068"
IDENTITIES = f'  1) {FINGERPRINT} "Apple Distribution: Fixture"\n     1 valid identities found'
PROFILE = {
    "TeamIdentifier": [TEAM],
    "UUID": PROFILE_UUID,
    "Name": "LC_AppStore_fixture",
    "Platform": ["iOS"],
    "ExpirationDate": NOW + dt.timedelta(days=365),
    "DeveloperCertificates": [CERTIFICATE],
    "Entitlements": {
        "application-identifier": f"{TEAM}.{BUNDLE_ID}",
        "com.apple.developer.team-identifier": TEAM,
        "get-task-allow": False,
    },
}


class ProfileTests(unittest.TestCase):
    def test_matching_distribution_profile(self):
        self.assertEqual(validate_profile(PROFILE, TEAM, IDENTITIES, NOW), (PROFILE_UUID, FINGERPRINT))

    def test_naive_plist_expiration_is_utc(self):
        profile = copy.deepcopy(PROFILE)
        profile["ExpirationDate"] = profile["ExpirationDate"].replace(tzinfo=None)
        self.assertEqual(validate_profile(profile, TEAM, IDENTITIES, NOW)[0], PROFILE_UUID)

    def test_rejects_profile_and_identity_mismatches(self):
        cases = [
            {"TeamIdentifier": ["OTHERTEAM1"]},
            {"TeamIdentifier": None},
            {"Entitlements": None},
            {"ExpirationDate": NOW},
            {"ExpirationDate": "invalid"},
            {"Platform": ["OSX"]},
            {"Platform": "iOS"},
            {"ProvisionedDevices": ["fixture-device"]},
            {"ProvisionsAllDevices": True},
            {"UUID": "../../unexpected"},
            {"Name": None},
            {"Name": "invalid\ninjected"},
            {"DeveloperCertificates": []},
            {"DeveloperCertificates": ["invalid"]},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                profile = {**copy.deepcopy(PROFILE), **changes}
                with self.assertRaises(ValueError):
                    validate_profile(profile, TEAM, IDENTITIES, NOW)
        with self.assertRaises(ValueError):
            validate_profile(PROFILE, TEAM, "0 valid identities found", NOW)
        with self.assertRaises(ValueError):
            validate_profile(PROFILE, "INVALID", IDENTITIES, NOW)

    def test_rejects_wrong_bundle_team_or_debug_entitlements(self):
        for key, value in [
            ("application-identifier", f"{TEAM}.com.scheduleboardMobile.app"),
            ("com.apple.developer.team-identifier", "OTHERTEAM1"),
            ("get-task-allow", True),
            ("get-task-allow", None),
        ]:
            with self.subTest(key=key, value=value):
                profile = copy.deepcopy(PROFILE)
                profile["Entitlements"][key] = value
                with self.assertRaises(ValueError):
                    validate_profile(profile, TEAM, IDENTITIES, NOW)

    def test_rejects_ambiguous_signing_identity(self):
        other = b"other fixture certificate"
        fingerprint = hashlib.sha1(other).hexdigest().upper()
        profile = copy.deepcopy(PROFILE)
        profile["DeveloperCertificates"].append(other)
        identities = f'{IDENTITIES}\n  2) {fingerprint} "Apple Distribution: Other Fixture"'
        with self.assertRaises(ValueError):
            validate_profile(profile, TEAM, identities, NOW)

    def test_export_never_uploads_or_rewrites_version(self):
        options = export_options(TEAM, PROFILE_UUID, FINGERPRINT)
        self.assertEqual(options["method"], "app-store-connect")
        self.assertEqual(options["destination"], "export")
        self.assertFalse(options["manageAppVersionAndBuildNumber"])
        self.assertEqual(options["provisioningProfiles"], {BUNDLE_ID: PROFILE_UUID})
        self.assertEqual(options["signingCertificate"], FINGERPRINT)

    def test_archive_recipe_scopes_signing_to_app_target(self):
        recipe = (Path(__file__).resolve().parents[1] / "workflows" / "ios-beta-archive.yml").read_text(encoding="utf-8")
        archive = recipe.split("- name: Archive staging application", 1)[1].split("- name:", 1)[0]
        for global_setting in [
            "PROVISIONING_PROFILE_SPECIFIER=", "PROVISIONING_PROFILE=",
            "CODE_SIGN_STYLE=", "CODE_SIGN_IDENTITY=", "DEVELOPMENT_TEAM=",
        ]:
            with self.subTest(setting=global_setting):
                self.assertNotIn(global_setting, archive)
        self.assertIn("target.name == 'App'", recipe)
        self.assertIn("config.name == 'Release'", recipe)
        self.assertIn("'PROVISIONING_PROFILE_SPECIFIER' => ENV.fetch('PROFILE_NAME')", recipe)
        self.assertIn("Library/Developer/Xcode/UserData/Provisioning Profiles", recipe)
        self.assertNotIn("Library/MobileDevice/Provisioning Profiles", recipe)


if __name__ == "__main__":
    unittest.main()
