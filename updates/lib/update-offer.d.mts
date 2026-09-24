export interface MobileUpdateRequest {
  app_id?: string;
  platform?: string;
  version_build?: string;
  version_name?: string;
  is_prod?: boolean;
  is_emulator?: boolean;
}

export interface ReleaseOffer {
  enabled: boolean;
  channel: string;
  version: string;
  releaseSequence: number;
  compatibleNativeVersions: string[];
  platforms: string[];
  allowProductionBuilds: boolean;
  allowDevelopmentBuilds: boolean;
  allowEmulators: boolean;
  capgo: {
    url: string;
    checksum: string;
    session_key: string;
  };
}

export type UpdateResponse =
  | { version: string; url: string; checksum: string; session_key: string }
  | { message: string; error?: string };

export function validateReleaseOffer(release: ReleaseOffer, expectedChannel?: string): string | null;
export function evaluateUpdateOffer(
  request: MobileUpdateRequest,
  release: ReleaseOffer,
  expectedChannel?: string,
): UpdateResponse;
