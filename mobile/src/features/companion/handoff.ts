/** Patient-written, explicitly approved recap only. Never accepts app transcript state. */
export async function carryApprovedRecap(
 input:{text:string;confirmation:boolean},
 connect:()=>Promise<void>,
 send:(text:string)=>void,
){
 if(input.confirmation!==true||!input.text.trim()||input.text.length>1500)throw new Error('Review and confirm a recap of 1–1500 characters first.');
 await connect();
 send(`Recap I chose to share with this voice conversation:\n${input.text.trim()}`);
}
