import type {Locator,ElementHandle} from '@playwright/test';
export type GeometryObservation=Awaited<ReturnType<typeof geometry>>;
export async function geometry(locator:Locator,targetIdentity:{namespace:string;value:string}) {
 const box=await locator.boundingBox();
 const viewport=await locator.page().evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio}));
 return {targetIdentity,coordinateSpace:'css-viewport',viewport,box,observedAt:performance.now(),limits:['No mapping to Windows screen coordinates implied']};
}
export async function sameDomObject(left:ElementHandle,right:ElementHandle){return left.evaluate((node,other)=>node===other,right);}
