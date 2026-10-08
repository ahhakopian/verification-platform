import type {Page} from '@playwright/test';
export interface PermissionObservation {source:'navigator.permissions';origin:string;name:PermissionName;state:PermissionState;observedAt:number;limits:string[]}
export async function observePermission(page:Page,origin:string,name:PermissionName):Promise<PermissionObservation>{
 const raw=await page.evaluate(async ({origin,name})=>{if(location.origin!==origin)throw Error('Permission observation origin mismatch');const status=await navigator.permissions.query({name});if(location.origin!==origin)throw Error('Permission observation origin changed');return {origin:location.origin,state:status.state};},{origin,name});
 return {source:'navigator.permissions',...raw,name,observedAt:performance.now(),limits:['Current execution-context snapshot only; no prompt/action or extension-permission proof','No automatic grant, deny or event coverage; unsupported names reject']};
}
