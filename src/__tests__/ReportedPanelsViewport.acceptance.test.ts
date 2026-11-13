/** Real component styles in Chrome; host chrome/insets are explicit fixtures, not iPhone acceptance. */
import { describeWithChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";

const css = (...files: string[]) => files.map(file => unscope(svelteStyle(file)));
const reset = "*{box-sizing:border-box}body{margin:0;font:16px sans-serif}*{animation:none!important;transition:none!important}";

describeWithChrome("reported panel geometry", () => {
  test("desktop widget settings can use their preferred width beyond the old 24rem cap", () => {
    const result = renderProbe({width:1200,height:800,
      css:[reset,...css("ui/components/FloatingPopup/FloatingPopup.svelte")],
      html:'<div id="popup" class="ppp-popup--floating" style="width:44rem;--ppp-popup-max-w:44rem"><input value="price * 2"></div>',
      measure:[{id:"popup",props:["boxWidth","max-width"]}],
    });
    expect(Number(result["popup"]!["boxWidth"])).toBe(704);
    expect(result["popup"]!["max-width"]).toBe("704px");
  });
  test.each([[390, 844], [320, 568], [844, 390]])("computed results remain in the panel scroll flow at %sx%s", (width, height) => {
    const result = renderProbe({ width, height,
      css: [reset, ...css("ui/components/SlideInPanel/SlideInPanel.svelte", "ui/components/RecordCardView/RecordCardView.svelte"),
        ".ppp-slide-in-panel{width:min(28rem,100%);transform:none}.ppp-slide-in-body{overflow-anchor:none}"],
      html: `<aside id="panel" class="ppp-slide-in-panel"><header class="ppp-slide-in-header">Note</header><div id="body" class="ppp-slide-in-body"><section id="properties" style="height:900px">Properties</section><details id="computed" class="ppp-rcv-computed" open><summary id="summary">Computed</summary><dl id="values" class="ppp-rcv-computed-values">${Array.from({length:40}, (_, i) => `<div class="ppp-rcv-fm-row"><dt>Field ${i}</dt><dd>${"long result ".repeat(10)}</dd></div>`).join("")}</dl></details></div></aside>`,
      evaluate: `const body=document.getElementById('body'),details=document.getElementById('computed'),values=document.getElementById('values');probe.expandedHeight=String(details.getBoundingClientRect().height);probe.valuesHeight=String(values.getBoundingClientRect().height);body.scrollTop=body.scrollHeight;document.getElementById('properties').style.display='none';details.open=false;details.open=true;document.getElementById('summary').scrollIntoView({block:'start'});const s=document.getElementById('summary').getBoundingClientRect(),b=body.getBoundingClientRect();probe.summaryVisible=String(s.top>=b.top-1&&s.bottom<=b.bottom+1);body.scrollTop=body.scrollHeight;probe.canReachEnd=String(values.getBoundingClientRect().bottom<=b.bottom+1);`,
      measure: [{id:"body",props:["boxHeight","overflow-y"]}, {id:"computed",props:["contain"]}, {id:"values",props:["overflow-y"]}],
    });
    expect(Number(result["__probe"]!["expandedHeight"])).toBeGreaterThan(Number(result["__probe"]!["valuesHeight"]));
    expect(Number(result["__probe"]!["valuesHeight"])).toBeGreaterThan(500);
    expect(result["__probe"]!["summaryVisible"]).toBe("true");
    expect(result["__probe"]!["canReachEnd"]).toBe("true");
    expect(result["values"]!["overflow-y"]).toBe("visible");
  });

  test("inline palette and all favorites expand inside the form's one scroll area", () => {
    const result = renderProbe({width:390,height:500,
      css:[reset,...css("ui/components/ColorPicker/ColorPicker.svelte"),"#form{height:300px;overflow:auto}#after{height:44px}"],
      html:`<div id="form"><div id="palette" class="color-picker color-picker--inline"><div class="palette-section"><div class="sat-light-picker"></div><div class="hue-slider"></div></div><div id="favorites" class="favorites-grid">${Array.from({length:60},()=>'<button class="color-swatch">Color</button>').join("")}</div></div><button id="after">Next field</button></div>`,
      evaluate:"const form=document.getElementById('form');form.scrollTop=form.scrollHeight;probe.reachable=String(document.getElementById('after').getBoundingClientRect().bottom<=form.getBoundingClientRect().bottom+1);probe.expands=String(form.scrollHeight>form.clientHeight);",
      measure:[{id:"palette",props:["overflow-y","max-block-size","boxWidth"]},{id:"favorites",props:["overflow-y","max-height"]}],
    });
    expect(result["palette"]!["overflow-y"]).toBe("visible");
    expect(result["favorites"]!["overflow-y"]).toBe("visible");
    expect(result["favorites"]!["max-height"]).toBe("none");
    expect(result["__probe"]!["reachable"]).toBe("true");
    expect(result["__probe"]!["expands"]).toBe("true");
  });

  test.each([[390,844,0,844],[390,844,80,240],[320,568,40,210],[568,320,0,320]])("agenda actions fit the safe visible viewport %sx%s top %s height %s", (width,height,top,visibleHeight) => {
    const result=renderProbe({width,height,
      css:[reset,...css("ui/views/Calendar/components/Timeline/AgendaSidebar.svelte","ui/views/Calendar/agenda/AgendaListEditor.svelte"),":root{--safe-area-inset-top:47px;--safe-area-inset-bottom:34px}"],
      html:`<div id="overlay" class="ppp-list-editor-overlay" style="top:${top}px;left:0;width:${width}px;height:${visibleHeight}px"><div id="modal" class="ppp-list-editor-modal"><div id="editor" class="agenda-list-editor"><header id="header" class="editor-header"><button class="header-cancel">Cancel</button><h3 class="editor-title">Edit list</h3><div class="header-actions"><button class="header-save">Save</button></div></header><div id="content" class="ppp-agenda-editor-body"><div style="height:1200px;flex:none">Fields</div></div></div></div></div>`,
      evaluate:`const overlay=document.getElementById('overlay').getBoundingClientRect(),header=document.getElementById('header').getBoundingClientRect(),modal=document.getElementById('modal').getBoundingClientRect(),content=document.getElementById('content'),body=content.getBoundingClientRect();probe.safe=String(header.top>=${top+47}-1);probe.headerFits=String(header.bottom<=${top+visibleHeight-34}+1);probe.modalFits=String(modal.bottom<=overlay.bottom-34+1);probe.bodyStartsBelowHeader=String(body.top>=header.bottom-1);probe.bodyFillsModal=String(body.bottom>=modal.bottom-2);content.scrollTop=content.scrollHeight;probe.bodyScrollable=String(content.scrollTop>0&&content.firstElementChild.getBoundingClientRect().bottom<=body.bottom+1);`,
      measure:[{id:"content",props:["boxHeight","overflow-y"]}],
    });
    expect(result["__probe"]!["safe"]).toBe("true");
    expect(result["__probe"]!["headerFits"]).toBe("true");
    expect(result["__probe"]!["modalFits"]).toBe("true");
    expect(result["__probe"]!["bodyStartsBelowHeader"]).toBe("true");
    expect(result["__probe"]!["bodyFillsModal"]).toBe("true");
    expect(result["__probe"]!["bodyScrollable"]).toBe("true");
    expect(Number(result["content"]!["boxHeight"])).toBeGreaterThan(20);
  });
});
