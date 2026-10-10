export type Digest = string;
export type Verdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE';
export type Phase = 'readiness' | 'action' | 'observation' | 'cleanup';
export interface ReleaseIdentity { repository: string; tag: string; sourceCommit: string }
export interface Binding extends ReleaseIdentity {
  schemaVersion: 1;
  index: { asset: string; sha256: Digest };
  resources: { integration: string; planSchema: string; descriptors: string };
}
export interface Resource { id: string; path: string; sha256: Digest; formatVersion: 1; kind: 'normative' | 'runtime' | 'frontend'; dependencies: string[]; entry?: string }
export interface ResourceIndex extends ReleaseIdentity { schemaVersion: 1; resources: Resource[] }
export interface SourceReference { id: string; path: string; reference: string }
export interface ConfigurationReference { id: string; path: string; disposition: 'planned' | 'realized'; purpose: 'fixture' | 'provider-declaration' | 'setup' }
export interface Proof { id: string; source: string; description: string; mandatory: boolean; acceptedSources: {source:string;providerId:string}[]; capabilityId?: string; capabilityVersion?: string }
export interface Claim { id: string; sourceRefs: string[]; expected: string; proof: Proof[]; environmentIds: string[]; prerequisiteIds: string[]; mode: 'automated' | 'assisted' | 'human'; allowedEffects: string[]; timing: { deadlineMs: number; observationWindowMs?: number; completionBoundary?: string }; support: { disposition: 'generic' | 'project-planned' | 'project-existing' | 'unavailable'; reason: string; configurationRefs: string[] } }
export interface Plan { schemaVersion: 1; planId: string; sourceReferences: SourceReference[]; environments: { id: string; topology: 'wsl-windows'; description: string }[]; prerequisites: { id: string; description: string; dependsOn: string[] }[]; configurationReferences: ConfigurationReference[]; claims: Claim[] }
export interface Capability { id: string; contractVersion: string; export: string; inputType: string; outputType: string; support: 'unestablished' | 'established' | 'unavailable'; constraints: string[]; observations: string[]; limits: string[]; effects: string[]; ownership: string; prerequisites: string[]; deadlineMs: number; evidenceRefs: string[] }
export interface Provider { schemaVersion: 1; id: string; version: string; entry: string; declarations: string; capabilities: Capability[] }
export interface Readiness { schemaVersion:1; capabilityId: string; environmentId: string; status: 'available' | 'unavailable'; reason: string; evidenceRefs: string[] }
export interface Assignment { schemaVersion: 1; planDigest: Digest; bindingDigest: Digest; authorization: { reference: string; planDigest: Digest; bindingDigest: Digest; allowedEffects: string[] }; environments: { id: string; build: string; runtimeConfig: string; powershell: string; launch: boolean; selection: { pageUrl: string }; exclusive: boolean }[]; fixtureEntry: string; runnerConfig: string; providers: { id: string; version: string; entry: string }[]; outputDirectory: string; ownership: { borrowed: string[]; disposable: string[]; cleanup: string[] }; evidenceConstraints: string[] }
export interface ProviderSourceIdentity {id:string;version:string;entry:string;entryDigest:Digest;declarations:string;declarationsDigest:Digest}
export interface ExecutionIdentity { executionId: string; attempt: number; planDigest: Digest; bindingDigest: Digest; assignmentDigest: Digest; generatedSourceDigest: Digest; fixtureDigest:Digest;providerSources:ProviderSourceIdentity[]; providers: { id: string; version: string }[]; provenance: { runtime: string; build: string; tools: Record<string, string> } }
export interface CoverageEntry { claimId: string; environmentId: string; sourceRefs: string[]; proofIds: string[]; mode: Claim['mode']; testKey?: string; source?: string; title?: string; assertions: string[]; steps: string[]; capabilityIds: string[]; capabilityVersions: Record<string,string>; blocker?: string }
export interface Manifest { schemaVersion: 1; identity: ExecutionIdentity; entries: CoverageEntry[] }
export interface Evidence { schemaVersion: 1; testKey:string; executionId: string; evidenceId: string; claimId: string; environmentId: string; proofIds: string[]; source: string; provider: { id: string; version: string }; sequence: number; identities: { namespace: string; value: string }[]; window: { start: string; end: string; complete: boolean; loss: string[] }; attachment: { path: string; sha256: Digest }; facts: unknown }
export interface ClaimRecord { schemaVersion: 1; testKey:string; identity: ExecutionIdentity; claimId: string; environmentId: string; attempted: boolean; outcome: 'proved' | 'contradicted' | 'unresolved' | 'blocked'; evidenceIds: string[]; assertions: string[]; reason: string; errors: { category: string; phase: Phase; detail: string }[]; proofRelevantCleanupFailed: boolean }
export interface Result { schemaVersion: 1; identity: ExecutionIdentity; verdict: Verdict; claims: { claimId: string; environmentId: string; verdict: Verdict; reason: string; evidenceIds: string[] }[]; counts: Record<Verdict, number>; runner: { exitCode: number | null; status: string }; limitations: string[] }
export interface Invocation { schemaVersion: 1; planPath: string; planDigest: Digest; binding: Binding; assignment: Assignment }
export interface InvocationReturn { schemaVersion:1;status: 'generated' | 'generation-blocked' | 'complete'; bundle?: string[]; manifest?: string; result?: string; evidence: string[]; runnerExitCode: number | null; acceptanceExitCode: number; diagnostics: string[] }
export interface OwnedSession { endpoint: string; provenance: unknown; revalidate(): Promise<void>; dispose(): Promise<void> }
export interface Observer<T> { ready: Promise<void>; observations: T[]; loss: string[]; dispose(): Promise<void> }
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};
export interface ProjectPreflightHookReference {contractVersion:1;entry:string;sha256:Digest;deadlineMs:number;input:JsonValue}
export interface BrowserProvenance {binary:string;profile:string;version:string;process_id:number;started_at:string;webSocketDebuggerUrl:string;launched?:boolean}
export interface ProjectPreflightContext {
 contractVersion:1;projectRoot:string;environmentId:string;executionIdentity:ExecutionIdentity;
 browser:import('@playwright/test').Browser;browserProvenance:BrowserProvenance;input:JsonValue;
 evidenceDirectory:string;deadlineMs:number;signal:AbortSignal;
}
export interface ProjectPreflightResult {contractVersion:1;status:'READY'|'NEEDS_HITL'|'BLOCKED';reason:string;evidence:{path:string;sha256:Digest}[];hitl?:{action:string;reason:string}}
export interface PreflightRecord {
 schemaVersion:1;identity:ExecutionIdentity;environmentId:string;workerIndex:number;testKey?:string;sequence:number;
 stage:'browser'|'project'|'target'|'gate';status:string;reason:string;observations:JsonValue;
 evidence:{path:string;sha256:Digest}[];cleanupErrors:string[];
}
