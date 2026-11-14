/** Publish each independent section promptly; ignore results from a prior auth epoch. */
export async function loadSection<T>(
 pending:Promise<T>,
 current:()=>boolean,
 publish:(value:T)=>void,
 settled?:()=>void,
):Promise<T>{
 try {const value=await pending;if(current())publish(value);return value;}
 finally {if(current())settled?.();}
}
