import{o as U}from"./main.localfix3.js";class R{constructor(a,i,r,n,s=null,l=null){this.blueGlobe=a,this.satelliteData=i,this.oe=r,this.detailedData=n,this.ui=s,this.controller=l,this.contentArea=null}async initialize(a){this.contentArea=a;const i=this.blueGlobe.preferences.homeLat,r=this.blueGlobe.preferences.homeLon;if(!i||!r){a.innerHTML=`
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 class="font-bold">Location not set</h3>
                        <div class="text-xs">Please set your home location in Settings to calculate overflights.</div>
                    </div>
                </div>
            `;return}this._buildUI(),this._setupFilterHandler(),await this.calculateTransits()}_setupFilterHandler(){const a=document.getElementById("transits_filter_toggle");a&&a.addEventListener("change",()=>{if(this.allOverflights){const i=document.getElementById("transits_table_body");this._populateTransitsTableFromWorker(i,this.allOverflights)}})}_buildUI(){const a=this.blueGlobe.preferences.homeLat,i=this.blueGlobe.preferences.homeLon,r=new Date().toISOString().substring(0,16).replace("T"," "),n=a>=0?`${Math.abs(a).toFixed(2)}°N`:`${Math.abs(a).toFixed(2)}°S`,s=i>=0?`${Math.abs(i).toFixed(2)}°E`:`${Math.abs(i).toFixed(2)}°W`;this.contentArea.innerHTML=`
            <div class="mb-3 text-sm text-gray-400 leading-relaxed">
                <p>Find satellites visible tonight from your location. This pass predictor calculates upcoming overflights for the next 7 days, showing elevation, direction, and viewing conditions. See when the ISS, Starlink, and other bright satellites pass overhead.</p>
            </div>
            <div class="mb-3">
                <div class="text-sm text-gray-400">
                    Calculating overflights from ${r} UTC
                </div>
                <div class="text-sm text-gray-400">
                    Observer location: ${n} / ${s}
                </div>
            </div>
            
            <div id="transits_loading">
                <div class="loading loading-spinner loading-lg mx-auto block"></div>
                <p class="text-center mt-4">Calculating overflights for the next 7 days...</p>
            </div>

            <div id="transits_filter_container" style="display: none;">
                <label class="label cursor-pointer inline-flex items-center gap-2 mb-2">
                    <span class="label-text">🌟 Show Excellent Only</span>
                    <input type="checkbox" class="toggle toggle-primary" id="transits_filter_toggle" checked>
                    <span class="text-xs text-gray-400 ml-2">
                        (≥20° elevation + dark sky)
                    </span>
                </label>
            </div>

            <div id="transits_filtered_message" class="mb-2 p-2 bg-yellow-900 bg-opacity-20 text-yellow-300 text-xs rounded" style="display: none;">
                No excellent viewing opportunities found. Showing all transits.
            </div>

            <div class="overflow-x-auto" id="transits_table_container" style="display: none;">
                <table class="table table-zebra table-compact text-xs leading-none">
                    <thead>
                        <tr class="text-xs h-8">
                            <th class="py-1 px-2"></th>
                            <th class="py-1 px-2">Local Date</th>
                            <th class="py-1 px-2">Start UTC</th>
                            <th class="py-1 px-2">Start Local</th>
                            <th class="py-1 px-2">Peak UTC</th>
                            <th class="py-1 px-2">Peak Local</th>
                            <th class="py-1 px-2">El</th>
                            <th class="py-1 px-2">Az (start→end)</th>
                            <th class="py-1 px-2">Min</th>
                            <th class="py-1 px-2">Vis</th>
                            <th class="py-1 px-2">☀</th>
                        </tr>
                    </thead>
                    <tbody id="transits_table_body" class="text-xs leading-tight">
                    </tbody>
                </table>
                <div id="flare_explanation" class="mt-3 p-3 bg-blue-900 bg-opacity-20 rounded-lg text-xs" style="display: none;">
                    <div class="flex items-center mb-1">
                        <span class="text-lg mr-2">✨</span>
                        <span class="font-semibold">Sun-lit Viewing Conditions</span>
                    </div>
                    <p class="text-gray-300">
                        The sparkle icon indicates the satellite is sunlit while your location is in darkness. 
                        These events may offer the chance to see the object reflecting light from the sun.
                    </p>
                </div>
            </div>
        `}async calculateTransits(){const a=document.getElementById("transits_loading"),i=document.getElementById("transits_table_container"),r=document.getElementById("transits_table_body");if(!this.satelliteData&&!this.detailedData){a.style.display="none",i.style.display="block",this._populateTransitsTableFromWorker(r,[]);return}try{const n=this.blueGlobe.preferences.homeLat,s=this.blueGlobe.preferences.homeLon,l=this.blueGlobe.preferences.homeAlt||0;let o,e;if(this.satelliteData&&this.satelliteData.tleData&&this.satelliteData.tleData.raw_tle)o=this.satelliteData.tleData.raw_tle.tle_line1,e=this.satelliteData.tleData.raw_tle.tle_line2;else if(this.oe&&this.oe.tle_line1&&this.oe.tle_line2)o=this.oe.tle_line1,e=this.oe.tle_line2;else if(this.oe&&this.oe.line1&&this.oe.line2)o=this.oe.line1,e=this.oe.line2;else if(this.satelliteData&&this.satelliteData.tle_line1&&this.satelliteData.tle_line2)o=this.satelliteData.tle_line1,e=this.satelliteData.tle_line2;else if(this.satelliteData&&this.satelliteData.tleData&&this.satelliteData.tleData.line1&&this.satelliteData.tleData.line2)o=this.satelliteData.tleData.line1,e=this.satelliteData.tleData.line2;else throw new Error("No valid TLE data found in satelliteData or oe objects");const t=new Worker(new URL("/assets/calculation-worker-8nVDzzH1.js",import.meta.url)),c=await new Promise((m,u)=>{const b=Date.now();t.addEventListener("message",p=>{const{type:h,data:v,messageId:T}=p.data;T===b&&(t.terminate(),h==="TRANSITS_RESULT"?m(v.transits):h==="ERROR"&&u(new Error(v.error)))}),t.addEventListener("error",p=>{t.terminate(),u(p)});const g=new Date,y=this._calculateSunTransitions(g,n,s);t.postMessage({type:"CALCULATE_TRANSITS",data:{tle_line1:o,tle_line2:e,observer:{lat:n,lng:s,alt:l},startTime:g,durationDays:7,visibilityArray:y},messageId:b})});console.log("Overflights calculated via worker:",c),a.style.display="none",i.style.display="block",this.allOverflights=c;const d=document.getElementById("transits_filter_container");d&&(d.style.display="block"),this._populateTransitsTableFromWorker(r,c)}catch(n){console.error("Error calculating overflights:",n),a.innerHTML=`
                <div class="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Error calculating overflights: ${n.message}</span>
                </div>
            `}}_calculateSunTransitions(a,i,r){console.log("Calculating visibility array for:",{date:a,lat:i,lng:r});const n=new Date(a);n.setUTCHours(0,0,0,0);const s=[];for(let l=0;l<1440;l+=5){const o=new Date(n.getTime()+l*6e4),e=U(o,i,r);let t;e>=0?t="Day":e>=-6?t="Civil":e>=-12?t="Naut":e>=-18?t="Astro":t="Night",s.push(t),(l%60===0||s.length>1&&t!==s[s.length-2])&&console.log(`${Math.floor(l/60).toString().padStart(2,"0")}:${(l%60).toString().padStart(2,"0")} UTC - elevation: ${e.toFixed(2)}°, visibility: ${t}`)}return console.log(`Visibility array created with ${s.length} entries`),s}_populateTransitsTableFromWorker(a,i){a.innerHTML="";const r=document.getElementById("transits_filter_toggle"),n=document.getElementById("transits_filtered_message"),s=r&&r.checked;let l=i,o=!1;if(s){const e=i.filter(t=>t.peakElevation>=20&&(t.visibility==="Night"||t.visibility==="Astro"));o=e.length>0,l=o?e:i,n&&(n.style.display=o?"none":"block")}else n&&(n.style.display="none");if(l.length===0){const t=a.insertRow().insertCell();t.colSpan=11,t.className="text-center text-gray-500 py-8",t.textContent="No overflights found for the next 7 days (≥1° elevation)";return}l.forEach(e=>{var S,D,L;const t=a.insertRow(),c=new Date(e.startTime),d=new Date(e.peakTime),m=new Date(e.endTime);if(isNaN(c.getTime())||isNaN(d.getTime())||isNaN(m.getTime())){console.error("Invalid transit times:",e);return}const u=c.toLocaleDateString(),b=c.toISOString().substring(11,19),g=d.toISOString().substring(11,19),y=c.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),p=d.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),h=Math.round((m-c)/6e4),v=`${Math.floor(h/60)}:${(h%60).toString().padStart(2,"0")}`,T=`${Math.round(e.startAzimuth)}°→${Math.round(e.endAzimuth)}°`,x=t.insertCell();x.className="py-0 px-1 h-6 text-center";const f=document.createElement("a");f.className="text-blue-400 hover:text-blue-300 text-lg cursor-pointer",f.textContent="🔭",f.title="Simulate in Photo-bomb tool";const C=this.blueGlobe.preferences.homeLat,N=this.blueGlobe.preferences.homeLon;let w;const k=e.startAzimuth,M=(e.endAzimuth-k+540)%360-180;w=(k+M/2+360)%360,w=Math.round(w);const I=Math.round(e.peakElevation);let _="";(S=this.satelliteData)!=null&&S.norad_id?_=this.satelliteData.norad_id:(D=this.detailedData)!=null&&D.norad_id?_=this.detailedData.norad_id:(L=this.oe)!=null&&L.norad_id&&(_=this.oe.norad_id);const A=c.toISOString().substring(0,19).replace("T","Z"),$=new URLSearchParams({mode:"localsky",lat:C,lon:N,alt:"10",az:w,elev:I,focal:"35",sensor:"36",utc:A,cmode:"long",dur:h,norad:_});f.href=`/satellite-photobomb?${$.toString()}`,f.target="_blank",x.appendChild(f),[u,b,y,g,p,Math.round(e.peakElevation)+"°",T,v,e.visibility||"Unknown",""].forEach(z=>{const E=t.insertCell();E.textContent=z,E.className="py-0 px-2 h-6"}),t.className="h-6 leading-none",e.peakElevation>=70?t.classList.add("bg-green-900","bg-opacity-30"):e.peakElevation>=40?t.classList.add("bg-yellow-900","bg-opacity-20"):e.peakElevation>=20&&t.classList.add("bg-orange-900","bg-opacity-20")})}_populateTransitsTable(a,i){if(a.innerHTML="",i.length===0){const l=a.insertRow().insertCell();l.colSpan=11,l.className="text-center text-gray-500 py-8",l.textContent="No overflights found for the next 7 days (≥20° elevation, dark sky)";return}let r=!1;i.forEach(s=>{const l=a.insertRow(),o=new Date(s.startTime),e=new Date(s.peakTime),t=new Date(s.endTime);if(isNaN(o.getTime())||isNaN(e.getTime())||isNaN(t.getTime())){console.error("Invalid transit times:",s);return}const c=o.toLocaleDateString(),d=o.toISOString().substring(11,19),m=e.toISOString().substring(11,19),u=o.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),b=e.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),g=Math.round((t-o)/6e4),y=`${Math.floor(g/60)}:${(g%60).toString().padStart(2,"0")}`,p=`${Math.round(s.startAzimuth)}°→${Math.round(s.endAzimuth)}°`,h=s.isSunlit?"✨":"";s.isSunlit&&(r=!0),[c,d,u,m,b,Math.round(s.peakElevation)+"°",p,y,s.visibility||"N/A",h].forEach(T=>{const x=l.insertCell();x.textContent=T,x.className="py-0 px-2 h-6"}),l.className="h-6 leading-none",s.peakElevation>=70?l.classList.add("bg-green-900","bg-opacity-30"):s.peakElevation>=40?l.classList.add("bg-yellow-900","bg-opacity-20"):s.peakElevation>=20&&l.classList.add("bg-orange-900","bg-opacity-20")});const n=document.getElementById("flare_explanation");n&&(n.style.display=r?"block":"none")}cleanup(){}}export{R as TransitsCalculator};
