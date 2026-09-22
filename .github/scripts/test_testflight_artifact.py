import copy
import io
import json
import plistlib
import unittest
import zipfile
from testflight_artifact import BUNDLE_ID, validate_ipa, validate_run

RUN = {"id": 123, "run_attempt": 1, "head_sha": "a" * 40, "conclusion": "success",
       "event": "workflow_dispatch", "head_branch": "main", "path": ".github/workflows/ios-beta-archive.yml"}
META = {"runId": "123", "runAttempt": "1", "workflowCommit": "a" * 40, "sourceCommit": "b" * 40,
        "sourceBranch": "staging", "bundleId": BUNDLE_ID, "version": "1.0", "build": "456",
        "concept2Environment": "development", "uploaded": False}


def ipa(bundle=BUNDLE_ID, build="456", remote=False):
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w") as archive:
        archive.writestr("Payload/App.app/Info.plist", plistlib.dumps({
            "CFBundleIdentifier": bundle, "CFBundleVersion": build, "CFBundleShortVersionString": "1.0"}))
        archive.writestr("Payload/App.app/capacitor.config.json", json.dumps({
            "appId": BUNDLE_ID, "server": {"url": "https://example.invalid"} if remote else {}}))
    return result.getvalue()


class ArtifactTests(unittest.TestCase):
    def test_verified_archive(self):
        validate_run(RUN, "123")
        validate_ipa(META, ipa(), RUN, "123", "456")

    def test_rejects_untrusted_run(self):
        for field, value in [("id", 999), ("event", "pull_request"), ("conclusion", "failure"),
                             ("head_branch", "feature/unreviewed"), ("path", "other.yml")]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_run({**RUN, field: value}, "123")

    def test_rejects_wrong_provenance(self):
        for field, value in [("build", "999"), ("runId", "999"), ("uploaded", True),
                             ("sourceBranch", "main"), ("sourceCommit", "bad"),
                             ("workflowCommit", "c" * 40), ("runAttempt", "2"),
                             ("bundleId", "other"), ("concept2Environment", "production")]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_ipa({**copy.deepcopy(META), field: value}, ipa(), RUN, "123", "456")

    def test_rejects_modified_ipa(self):
        for payload in [ipa(bundle="other"), ipa(build="999"), ipa(remote=True)]:
            with self.assertRaises(ValueError):
                validate_ipa(META, payload, RUN, "123", "456")


if __name__ == "__main__":
    unittest.main()
