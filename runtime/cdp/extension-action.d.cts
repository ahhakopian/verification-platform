import type {Browser,CDPSession} from '@playwright/test';
export interface Target {targetId:string;type:string;url?:string;title?:string;[key:string]:unknown}
export interface TargetFilter {type?:string;exclude:boolean}
export function browserCDP(browser:Browser):Promise<CDPSession>;
export function discoverTargets(cdp:CDPSession,filter:TargetFilter[]):Promise<Target[]>;
export function selectTarget(targets:Target[],criteria:Partial<Target>):Target;
export function discoverExtension(cdp:CDPSession,extensionId:string):Promise<unknown>;
export function triggerExtensionAction(browser:Browser,options:{extensionId:string;target:{filter:TargetFilter[];criteria:Partial<Target>}}):Promise<unknown>;
export function renderRunCode(options:unknown):string;
