/** Loaded only through the production legacy Concept2 module. */
export function legacyConcept2Credentials() {
  return { clientId: import.meta.env.VITE_CONCEPT2_CLIENT_ID, clientSecret: import.meta.env.VITE_CONCEPT2_CLIENT_SECRET };
}
