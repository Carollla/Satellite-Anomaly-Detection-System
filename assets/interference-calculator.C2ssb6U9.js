import"./main.localfix3.js";class k{constructor(e,s,n,o,t=null,a=null){console.warn("sd",s),console.warn("dd",o),this.blueGlobe=e,this.satelliteData=s,this.oe=n,this.detailedData=o,this.ui=t,this.controller=a,this.contentArea=null,this.satrecCache=new Map,this.chunkMinutes=60,this.minimumElevationDeg=10,this.lastCalculationParams=null,this.lastEvents=null}async initialize(e){this.contentArea=e;const s=this.blueGlobe.preferences.homeLat,n=this.blueGlobe.preferences.homeLon;if(!s||!n){e.innerHTML=`
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 class="font-bold">Location not set</h3>
                        <div class="text-xs">Please set your home location in Settings to calculate interference.</div>
                    </div>
                </div>
            `;return}e.querySelector("#interference_time_range")?this._attachEventListeners():(this._buildUI(),this._checkForStoredResults()),this.detailedData&&(this._showToast("Loading all functional satellites"),await this.blueGlobe.setSatellites(void 0,"all_functional",[this.detailedData.norad_id]))}_buildUI(){const e=this.blueGlobe.preferences.homeLat,s=this.blueGlobe.preferences.homeLon;e>=0?`${Math.abs(e).toFixed(2)}`:`${Math.abs(e).toFixed(2)}`,s>=0?`${Math.abs(s).toFixed(2)}`:`${Math.abs(s).toFixed(2)}`,this.contentArea.innerHTML=`
            <div class="mb-4">
                <div class="text-sm text-gray-400 mb-3">
                    Calculate interference events for <u>line of sight</u> to target satellite from home
                </div>
                
                <!-- Configuration options on one line -->
                <div class="flex flex-wrap gap-2 mb-4 items-end">
                    <div class="form-control min-w-0 flex-1">
                        <label class="label pb-1">
                            <span class="label-text text-xs">Time Range</span>
                        </label>
                        <select id="interference_time_range" class="select select-bordered select-sm w-full">
                            <option value="-24">Past 24 hours</option>
                            <option value="-12">Past 12 hours</option>
                            <option value="-6">Past 6 hours</option>
                            <option value="-1">Past 1 hour</option>
                            <option disabled>──────────</option>
                            <option value="1">Next 1 hour</option>
                            <option value="6">Next 6 hours</option>
                            <option value="24" selected>Next 24 hours</option>
                            <option value="72">Next 3 days</option>
                            <option value="168">Next 7 days</option>
                        </select>
                    </div>
                    
                    <div class="form-control min-w-0 flex-1">
                        <label class="label pb-1">
                            <span class="label-text text-xs">Angular Threshold</span>
                        </label>
                        <select id="interference_threshold" class="select select-bordered select-sm w-full">
                            <option value="300">5 arc-minutes</option>
                            <option value="600">10 arc-minutes</option>
                            <option value="1800">30 arc-minutes</option>
                            <option value="3600" selected>1 degree</option>
                        </select>
                    </div>
                    
                    <button id="start_interference_calc" class="btn btn-primary btn-sm">
                        Calculate
                    </button>

                    <button id="download_interference_report" class="btn btn-secondary btn-sm" style="display: none;">
                        Download Report
                    </button>
                </div>
                
                <div id="tle_warning" class="alert alert-warning text-xs mb-4" style="display: none;">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Past propagation uses current TLEs which may be less accurate for historical positions</span>
                </div>
            </div>
            
            <div id="interference_loading" style="display: none;">
                <p class="text-center mt-4">Analyzing satellite positions...</p>
                <div class="w-full bg-gray-700 rounded-full h-2 mt-4 mx-auto max-w-md">
                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" id="interference_progress_bar" style="width: 0%"></div>
                </div>
                <p class="text-center text-sm text-gray-400 mt-2" id="interference_progress">0%</p>
            </div>
            
            <div class="overflow-x-auto" id="interference_table_container" style="display: none;">
                <div class="text-sm text-gray-400 mb-2" id="interference_summary"></div>
                <table class="table table-zebra table-compact text-xs leading-none">
                    <thead>
                        <tr class="text-xs h-8">
                            <th class="py-1 px-2">Date</th>
                            <th class="py-1 px-2">Local Time</th>
                            <th class="py-1 px-2">UTC Time</th>
                            <th class="py-1 px-2">Duration</th>
                            <th class="py-1 px-2">Interferer</th>
                            <th class="py-1 px-2">Min Sep</th>
                            <th class="py-1 px-2">Impact</th>
                        </tr>
                    </thead>
                    <tbody id="interference_table_body" class="text-xs leading-tight">
                    </tbody>
                </table>
                <div id="interference_notes" class="mt-3 p-3 bg-blue-900 bg-opacity-20 rounded-lg text-xs" style="display: none;">
                    <div class="flex items-center mb-2">
                        <span class="text-lg mr-2">ℹ️</span>
                        <span class="font-semibold">Interference Analysis (assuming Ku band to geostationary)</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p class="text-gray-300 mb-2">
                                Events show when satellites pass within the angular threshold of your line of sight to the target satellite.
                            </p>
                        </div>
                        <div>
                            <table class="table-auto text-xs">
                                <thead>
                                    <tr class="text-gray-400">
                                        <th class="text-left pr-3">Region</th>
                                        <th class="text-left pr-3">Angular Distance</th>
                                        <th class="text-left pr-3">Symbol</th>
                                        <th class="text-left">Disruption</th>
                                    </tr>
                                </thead>
                                <tbody class="text-gray-300">
                                    <tr>
                                        <td class="pr-3">Main lobe</td>
                                        <td class="pr-3">≤ 850"</td>
                                        <td class="pr-3">●●●</td>
                                        <td>Very likely</td>
                                    </tr>
                                    <tr>
                                        <td class="pr-3">-3 dB beamwidth</td>
                                        <td class="pr-3">≤ 1700"</td>
                                        <td class="pr-3">●●○</td>
                                        <td>Likely</td>
                                    </tr>
                                    <tr>
                                        <td class="pr-3">Sidelobe region</td>
                                        <td class="pr-3">1700-3000"</td>
                                        <td class="pr-3">●○○</td>
                                        <td>Possible</td>
                                    </tr>
                                    <tr>
                                        <td class="pr-3">Beyond sidelobes</td>
                                        <td class="pr-3">> 3000"</td>
                                        <td class="pr-3">○○○</td>
                                        <td>Unlikely</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `,this._attachEventListeners()}_attachEventListeners(){const e=document.getElementById("start_interference_calc");e&&(e.removeEventListener("click",this._boundCalculateInterference),this._boundCalculateInterference=()=>this.calculateInterference(),e.addEventListener("click",this._boundCalculateInterference));const s=document.getElementById("download_interference_report");s&&(s.removeEventListener("click",this._boundDownloadReport),this._boundDownloadReport=()=>this._downloadReport(),s.addEventListener("click",this._boundDownloadReport));const n=document.getElementById("interference_time_range");n&&(n.removeEventListener("change",this._boundTimeRangeChange),this._boundTimeRangeChange=o=>{const t=document.getElementById("tle_warning");t&&(t.style.display=parseInt(o.target.value)<0?"flex":"none")},n.addEventListener("change",this._boundTimeRangeChange))}async calculateInterference(){const e=document.getElementById("interference_loading"),s=document.getElementById("interference_table_container"),n=document.getElementById("interference_table_body"),o=document.getElementById("interference_progress"),t=document.getElementById("interference_summary"),a=parseInt(document.getElementById("interference_time_range").value),p=parseInt(document.getElementById("interference_threshold").value),m=a<0,h=Math.abs(a);this._updateProgress(0,o),e.style.display="block",s.style.display="none";try{const l=this.blueGlobe.preferences.homeLat,u=this.blueGlobe.preferences.homeLon,g=this.blueGlobe.preferences.homeAlt||0,i=this.blueGlobe.getLoadedSatellites();if(!i||i.length===0)throw new Error("No satellites loaded in the simulation");o.textContent=`Analyzing ${i.length} satellites...`;const r=await this._calculateInterferenceEventsWithWorker(l,u,g,i,h,p,m,o);console.log("Interference events found:",r.length),e.style.display="none",s.style.display="block";const c=m?`past ${h}`:`next ${h}`;t.textContent=`Found ${r.length} interference events in the ${c} hours (threshold: ${p} arc-seconds)`,this.lastCalculationParams={timeRangeHours:a,absoluteHours:h,isBackward:m,thresholdArcSec:p,timeDescription:c,homeLat:l,homeLng:u},this.lastEvents=r;const d=document.getElementById("download_interference_report");d&&(d.style.display=r.length>0?"inline-flex":"none"),this._populateInterferenceTable(n,r);const f=document.getElementById("interference_notes");f&&(f.style.display=r.length>0?"block":"none"),this.controller&&this.controller.onCalculationComplete&&this.controller.onCalculationComplete("interference",r.length,r)}catch(l){console.error("Error calculating interference:",l),e.innerHTML=`
                <div class="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Error calculating interference: ${l.message}</span>
                </div>
            `}}async _calculateInterferenceEventsWithWorker(e,s,n,o,t,a,p,m){return new Promise((h,l)=>{const u=new Worker(new URL("/assets/calculation-worker-8nVDzzH1.js",import.meta.url)),g=Date.now();u.addEventListener("message",i=>{const{type:r,data:c,messageId:d}=i.data;d===g?(u.terminate(),r==="INTERFERENCE_RESULT"?(this._updateProgress(100,m),h(c.events)):r==="ERROR"&&l(new Error(c.error))):r==="PROGRESS_UPDATE"&&this._updateProgress(c.progress,m)}),u.addEventListener("error",i=>{u.terminate(),l(i)}),console.log("Asking worker to calculate interference"),u.postMessage({type:"CALCULATE_INTERFERENCE",data:{observerLat:e,observerLng:s,observerAlt:n,allSatellites:o,targetSatelliteData:this.satelliteData,targetOe:this.oe,timeRangeHours:t,thresholdArcSec:a,isBackward:p,chunkMinutes:this.chunkMinutes,minimumElevationDeg:this.minimumElevationDeg},messageId:g}),console.log("msg sent")})}_populateInterferenceTable(e,s){if(e.innerHTML="",s.length>0&&console.log("First 3 events to populate table:",s.slice(0,3).map(n=>({interfererName:n.interfererName,minSep:n.minSeparationArcSec}))),s.length===0){const o=e.insertRow().insertCell();o.colSpan=7,o.className="text-center text-gray-500 py-8",o.textContent="No interference events found for the specified parameters";return}s.forEach(n=>{const o=e.insertRow(),t=new Date(n.startTime),a=new Date(n.peakTime),p=new Date(n.endTime);if(isNaN(t.getTime())||isNaN(a.getTime())||isNaN(p.getTime())){console.error("Invalid event times:",n);return}const m=t.toLocaleDateString(),h=a.toLocaleTimeString("en-GB",{hour12:!1,hour:"2-digit",minute:"2-digit",second:"2-digit",fractionalSecondDigits:2}),l=a.toISOString().substring(11,23),i=`${((n.duration||p-t)/1e3).toFixed(3)}s`,r=n.minSeparationArcSec<60?`${n.minSeparationArcSec.toFixed(1)}"`:`${(n.minSeparationArcSec/60).toFixed(1)}'`;let c="",d="";n.minSeparationArcSec<=850?(c="●●●",d="Main lobe - Very likely disruption"):n.minSeparationArcSec<=1700?(c="●●○",d="-3 dB beamwidth - Likely disruption"):n.minSeparationArcSec<=3e3?(c="●○○",d="Sidelobe region - Possible disruption"):(c="○○○",d="Beyond sidelobes - Unlikely disruption");const f=n.interfererName.length>25?n.interfererName.substring(0,25)+"...":n.interfererName;[m,h,l,i,f,r,c].forEach(y=>{const b=o.insertCell();b.textContent=y,b.className="py-0 px-2 h-6",b.title=y,y===f&&n.interfererName.length>25?b.title=n.interfererName:y===c&&(b.title=d,b.className+=" text-center")}),o.className="h-6 leading-none",n.minSeparationArcSec<=5?o.classList.add("bg-red-900","bg-opacity-30"):n.minSeparationArcSec<=15?o.classList.add("bg-orange-900","bg-opacity-20"):n.minSeparationArcSec<=30&&o.classList.add("bg-yellow-900","bg-opacity-20")})}_updateProgress(e,s){const n=document.getElementById("interference_progress_bar");n&&(n.style.width=`${e}%`),s&&(s.textContent=`${e}%`)}async _yieldControl(){return new Promise(e=>{typeof requestIdleCallback<"u"?requestIdleCallback(()=>e()):setTimeout(()=>e(),0)})}_checkForStoredResults(){if(this.controller&&this.controller.functionResults){const e=this.controller.functionResults.get("interference");if(e&&e.length>0){console.log("Found stored interference results:",e.length);const s=document.getElementById("interference_loading"),n=document.getElementById("interference_table_container"),o=document.getElementById("interference_table_body"),t=document.getElementById("interference_summary");if(s&&n&&o&&t){s.style.display="none",n.style.display="block",t.textContent=`${e.length} interference events (from previous calculation)`,this._populateInterferenceTable(o,e);const a=document.getElementById("interference_notes");a&&(a.style.display=e.length>0?"block":"none")}}}}_showToast(e,s="info",n=4e3){this.ui&&this.ui._showToast?this.ui._showToast(e,s,n):console.log(`Toast: ${e}`)}_downloadReport(){if(!this.lastEvents||!this.lastCalculationParams){this._showToast("No calculation results available","warning");return}const e=this.lastCalculationParams,s=this.lastEvents,n=e.homeLat>=0?`${Math.abs(e.homeLat).toFixed(4)}°N`:`${Math.abs(e.homeLat).toFixed(4)}°S`,o=e.homeLng>=0?`${Math.abs(e.homeLng).toFixed(4)}°E`:`${Math.abs(e.homeLng).toFixed(4)}°W`,t=[];t.push("═".repeat(120)),t.push("SATELLITE INTERFERENCE ANALYSIS REPORT".padStart(80)),t.push("═".repeat(120)),t.push(""),t.push(`Target Satellite: ${this.satelliteData.name||"Unknown"} (NORAD ${this.satelliteData.norad_id||"N/A"})`),t.push(`Observer Location: ${n}, ${o}`),t.push(`Time Period: ${e.timeDescription} hours (${e.isBackward?"Historical":"Predictive"})`);let a="";e.thresholdArcSec<60?a=`${e.thresholdArcSec}" (arc-seconds)`:e.thresholdArcSec<3600?a=`${(e.thresholdArcSec/60).toFixed(0)} arc-minutes`:a=`${(e.thresholdArcSec/3600).toFixed(1)} degree${e.thresholdArcSec===3600?"":"s"}`,t.push(`Angular Threshold: ${a}`),t.push(`Generated: ${new Date().toISOString()}`),t.push(""),t.push(`Total Interference Events: ${s.length}`),t.push("─".repeat(120)),t.push(""),s.length===0?t.push("No interference events detected within the specified parameters."):(t.push("Date       │ Local Time    │ UTC Time      │ Duration │ Interfering Satellite                         │ Min Sep │ Impact"),t.push("───────────┼───────────────┼───────────────┼──────────┼───────────────────────────────────────────────┼─────────┼────────"),s.forEach(i=>{const r=new Date(i.startTime),c=new Date(i.peakTime),d=new Date(i.endTime),f=r.toLocaleDateString("en-GB"),w=c.toLocaleTimeString("en-GB",{hour12:!1,hour:"2-digit",minute:"2-digit",second:"2-digit",fractionalSecondDigits:2}),y=c.toISOString().substring(11,23),S=`${((i.duration||d-r)/1e3).toFixed(3)}s`,v=i.minSeparationArcSec<60?`${i.minSeparationArcSec.toFixed(1)}"`:`${(i.minSeparationArcSec/60).toFixed(1)}'`;let _="";i.minSeparationArcSec<=850?_="●●●":i.minSeparationArcSec<=1700?_="●●○":i.minSeparationArcSec<=3e3?_="●○○":_="○○○";const x=i.interfererName.substring(0,45).padEnd(45),E=[f.padEnd(10),w.padEnd(13),y.padEnd(13),S.padEnd(8),x,v.padEnd(7),_].join(" │ ");t.push(E)})),t.push(""),t.push("─".repeat(120)),t.push(""),t.push("IMPACT LEGEND:"),t.push('  ●●● = Main lobe (≤850") - Very likely disruption'),t.push('  ●●○ = -3dB beamwidth (≤1700") - Likely disruption'),t.push('  ●○○ = Sidelobe region (1700-3000") - Possible disruption'),t.push('  ○○○ = Beyond sidelobes (>3000") - Unlikely disruption'),t.push(""),t.push("NOTE: Analysis assumes Ku-band communications to geostationary satellite."),t.push("      Actual interference depends on antenna characteristics, signal strength,"),t.push("      and frequency coordination."),t.push(""),t.push("Calculated by "),t.push("═".repeat(120));const p=t.join(`
`),m=new Blob([p],{type:"text/plain"}),h=URL.createObjectURL(m),l=document.createElement("a");l.href=h;const u=new Date().toISOString().replace(/[:.]/g,"-").substring(0,19),g=(this.satelliteData.name||"satellite").replace(/[^a-zA-Z0-9]/g,"_").substring(0,30);l.download=`interference_report_${g}_${u}.txt`,document.body.appendChild(l),l.click(),document.body.removeChild(l),URL.revokeObjectURL(h),this._showToast("Report downloaded","success")}cleanup(){const e=document.getElementById("start_interference_calc");e&&this._boundCalculateInterference&&e.removeEventListener("click",this._boundCalculateInterference);const s=document.getElementById("download_interference_report");s&&this._boundDownloadReport&&s.removeEventListener("click",this._boundDownloadReport);const n=document.getElementById("interference_time_range");n&&this._boundTimeRangeChange&&n.removeEventListener("change",this._boundTimeRangeChange)}}export{k as InterferenceCalculator};
