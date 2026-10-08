import {test,expect} from '../../runtime/fixtures.js';
test('unavailable assigned runtime',{annotation:{type:'testKey',description:'version-key'}},async({assignedPage})=>{
 expect(assignedPage).toBeDefined(); // Body cannot run without the assigned runtime.
});
