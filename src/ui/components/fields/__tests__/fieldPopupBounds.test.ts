import { fieldPopupBounds } from "../fieldPopupBounds";
import { aboveFieldPlacement } from "../aboveFieldPlacement";

it("keeps agenda suggestions under its fixed header and above the keyboard", () => {
  const body=document.createElement("div"),field=document.createElement("input");
  body.setAttribute("data-ppp-popup-boundary","");body.append(field);
  body.getBoundingClientRect=()=>({top:160,bottom:650,left:10,right:390,width:380,height:490} as DOMRect);
  const bounds=fieldPopupBounds(field,{top:44,bottom:500,left:0,right:400,width:400,height:456});
  const placement=aboveFieldPlacement({top:280,bottom:316,left:20,right:360,width:340,height:36},192,340,bounds,16);
  expect(placement.visible).toBe(true);
  expect(placement.top).toBeGreaterThanOrEqual(160);
  expect(placement.top+placement.height).toBeLessThanOrEqual(500);
  expect(bounds).toMatchObject({top:160,bottom:500});
  const underHeader=aboveFieldPlacement({top:162,bottom:198,left:20,right:360,width:340,height:36},192,340,bounds,16);
  expect(underHeader.visible).toBe(false);
});

it("does not constrain ordinary fields outside the modal body", () => {
  const bounds={top:0,bottom:500,left:0,right:400,width:400,height:500};
  expect(fieldPopupBounds(document.createElement("input"),bounds)).toBe(bounds);
});
