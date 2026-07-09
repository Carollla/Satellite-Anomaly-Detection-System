import{o as Y}from"./main.localfix3.js";class ie{constructor(e,a,n,r,s=null,i=null){this.blueGlobe=e,this.satelliteData=a,this.oe=n,this.detailedData=r,this.ui=s,this.controller=i,this.contentArea=null}async initialize(e){this.contentArea=e,this.blueGlobe.showTrains(!0);const a=this.blueGlobe.preferences.homeLat,n=this.blueGlobe.preferences.homeLon;if(!a||!n){e.innerHTML=`
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 class="font-bold">Location not set</h3>
                        <div class="text-xs">Please set your home location in Settings to calculate overflights.</div>
                    </div>
                </div>
            `;return}this._loadAlertSettings(),this._buildUI(),this._setupFilterHandler(),this._setupAlertsHandlers(),await this.calculateTrains()}_loadAlertSettings(){if(this.alertSettings={enabled:!1,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,minSats:5,excludeStart:"01:00",excludeEnd:"05:00"},this.blueGlobe.sessionManager){const e=this.blueGlobe.sessionManager.getData();e&&e.email_trains&&(this.alertSettings.enabled=e.email_trains.enabled||!1,this.alertSettings.timezone=e.email_trains.timezone||this.alertSettings.timezone,this.alertSettings.minSats=e.email_trains.min_sats||5,this.alertSettings.excludeStart=e.email_trains.exclude_start||"01:00",this.alertSettings.excludeEnd=e.email_trains.exclude_end||"05:00")}}_saveAlertSettings(){if(this.blueGlobe.sessionManager){let e=this.blueGlobe.sessionManager.getData();e.email_trains||(e.email_trains={}),e.email_trains.enabled=this.alertSettings.enabled,e.email_trains.timezone=this.alertSettings.timezone,e.email_trains.min_sats=this.alertSettings.minSats,e.email_trains.exclude_start=this.alertSettings.excludeStart,e.email_trains.exclude_end=this.alertSettings.excludeEnd,this.blueGlobe.sessionManager.saveData(e)}}_setupAlertsHandlers(){const e=document.getElementById("trains_alerts_enabled"),a=document.getElementById("trains_alerts_min_sats"),n=document.getElementById("trains_alerts_exclude_start"),r=document.getElementById("trains_alerts_exclude_end");e&&e.addEventListener("change",()=>{this.alertSettings.enabled=e.checked,this._saveAlertSettings()}),a&&a.addEventListener("change",()=>{this.alertSettings.minSats=parseInt(a.value)||5,this._saveAlertSettings()}),n&&n.addEventListener("change",()=>{this.alertSettings.excludeStart=n.value,this._saveAlertSettings()}),r&&r.addEventListener("change",()=>{this.alertSettings.excludeEnd=r.value,this._saveAlertSettings()})}_setupFilterHandler(){const e=document.getElementById("trains_filter_toggle"),a=document.getElementById("trains_optimal_toggle"),n=()=>{if(this.allOverflights){const r=document.getElementById("trains_table_body");this._populateTrainsTableFromWorker(r,this.allOverflights)}};e&&e.addEventListener("change",n),a&&a.addEventListener("change",n)}_buildUI(){var l,c;const e=this.blueGlobe.preferences.homeLat,a=this.blueGlobe.preferences.homeLon,n=new Date().toISOString().substring(0,16).replace("T"," "),r=e>=0?`${Math.abs(e).toFixed(2)}°N`:`${Math.abs(e).toFixed(2)}°S`,s=a>=0?`${Math.abs(a).toFixed(2)}°E`:`${Math.abs(a).toFixed(2)}°W`,i=((c=(l=this.blueGlobe.sessionManager)==null?void 0:l.isLoggedIn)==null?void 0:c.call(l))||!1;let d="";i?d=`
                <div id="trains_alerts_box" class="bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm">
                    <div class="flex items-center gap-2 mb-3">
                        <input type="checkbox" id="trains_alerts_enabled" class="checkbox checkbox-sm checkbox-primary" ${this.alertSettings.enabled?"checked":""}>
                        <label for="trains_alerts_enabled" class="text-gray-200 cursor-pointer">Receive train alerts</label>
                    </div>

                    <div id="trains_alerts_settings" class="space-y-2 text-xs">
                        <div class="flex items-center gap-2">
                            <label class="text-gray-400 w-20">Timezone:</label>
                            <input type="text" id="trains_alerts_tz" value="${this.alertSettings.timezone}"
                                   class="input input-xs input-bordered bg-gray-700 text-gray-200 flex-1" readonly>
                        </div>

                        <div class="flex items-center gap-2">
                            <label class="text-gray-400 w-20">Min sats:</label>
                            <input type="number" id="trains_alerts_min_sats" value="${this.alertSettings.minSats}" min="1" max="50"
                                   class="input input-xs input-bordered bg-gray-700 text-gray-200 w-16">
                            <span class="text-gray-500">satellites per train</span>
                        </div>

                        <div class="flex items-center gap-2">
                            <label class="text-gray-400 w-20">Exclude:</label>
                            <input type="time" id="trains_alerts_exclude_start" value="${this.alertSettings.excludeStart}"
                                   class="input input-xs input-bordered bg-gray-700 text-gray-200 w-24">
                            <span class="text-gray-500">to</span>
                            <input type="time" id="trains_alerts_exclude_end" value="${this.alertSettings.excludeEnd}"
                                   class="input input-xs input-bordered bg-gray-700 text-gray-200 w-24">
                        </div>
                    </div>
                </div>
            `:d=`
                <div id="trains_alerts_box" class="bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm">
                    <div class="text-gray-300">
                        <a href="/login" class="text-blue-400 hover:text-blue-300 underline">Login</a> to get train sighting alerts
                    </div>
                </div>
            `,this.contentArea.innerHTML=`
            <div class="mb-3 text-sm text-gray-400 leading-relaxed">
                <p>Track Starlink satellite trains visible from your location. After a SpaceX launch, newly deployed satellites travel in a close formation — a bright "train" of lights crossing the night sky. This tracker calculates when the next satellite train passes overhead and whether it will be visible tonight.</p>
            </div>
            <div class="mb-3 flex justify-between items-start gap-4">
                <div>
                    <div class="text-sm text-gray-400">
                        Satellite trains from ${n} UTC
                    </div>
                    <div class="text-sm text-gray-400">
                        Observer location: ${r} / ${s}
                    </div>
                </div>
                ${d}
            </div>

            <div id="trains_loading">
                <div class="loading loading-spinner loading-lg mx-auto block"></div>
                <p class="text-center mt-4">Calculating overflights for the next 7 days...</p>
            </div>

            <div id="trains_filter_container" style="display: none;">
                <label class="label cursor-pointer inline-flex items-center gap-2 mb-2">
                    <span class="label-text">🌙 Show Night Only</span>
                    <input type="checkbox" class="toggle toggle-primary" id="trains_filter_toggle" checked>
                    <span class="text-xs text-gray-400 ml-2">
                        (≥10° elevation + dark sky)
                    </span>
                </label>
                <label class="label cursor-pointer inline-flex items-center gap-2 mb-2">
                    <span class="label-text">☀️ Show Optimal Lit Only</span>
                    <input type="checkbox" class="toggle toggle-primary" id="trains_optimal_toggle">
                    <span class="text-xs text-gray-400 ml-2">
                        (sunlit with sun behind observer)
                    </span>
                </label>
            </div>

            <div id="trains_filtered_message" class="mb-2 p-2 bg-yellow-900 bg-opacity-20 text-yellow-300 text-xs rounded" style="display: none;">
                No night viewing opportunities found. Showing all trains.
            </div>

            <div class="overflow-x-auto" id="trains_table_container" style="display: none;">
                <table class="table table-zebra table-compact text-xs leading-none">
                    <thead>
                        <tr class="text-xs h-8">
                            <th class="py-1 px-2"></th>
                            <th class="py-1 px-2">#</th>
                            <th class="py-1 px-2">Local Date</th>
                            <th class="py-1 px-2">Start UTC</th>
                            <th class="py-1 px-2">Start Local</th>
                            <th class="py-1 px-2">Peak Local</th>
                            <th class="py-1 px-2">El</th>
                            <th class="py-1 px-2">Az (start→end)</th>
                            <th class="py-1 px-2">Vis</th>
                            <th class="py-1 px-2">☀</th>
                        </tr>
                    </thead>
                    <tbody id="trains_table_body" class="text-xs leading-tight">
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
        `}async calculateTrains(){var r,s,i,d,l,c;const e=document.getElementById("trains_loading"),a=document.getElementById("trains_table_container"),n=document.getElementById("trains_table_body");if(!this.blueGlobe.trains||!this.blueGlobe.trains.trains){e.innerHTML=`
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Loading trains data...</span>
                </div>
            `;const t=1e4,o=Date.now();for(;(!this.blueGlobe.trains||!((s=(r=this.blueGlobe.dots)==null?void 0:r.movingPoints)!=null&&s.length))&&Date.now()-o<t;)await new Promise(g=>setTimeout(g,100));if(!this.blueGlobe.trains||!this.blueGlobe.trains.trains){e.innerHTML=`
                    <div class="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Failed to load trains data</span>
                    </div>
                `;return}}try{const t=this.blueGlobe.preferences.homeLat,o=this.blueGlobe.preferences.homeLon,g=this.blueGlobe.preferences.homeAlt||0,y=this.blueGlobe.trains.trains.filter(h=>h.satellites&&h.satellites.length>0).map(h=>({train:h,leadSat:h.satellites[0],trainNoradIds:h.satellites.map(m=>m.norad_id)}));if(console.log(`Found ${y.length} trains with lead satellites`),y.length===0){e.style.display="none",a.style.display="block",this._populateTrainsTableFromWorker(n,[]);return}const p=[];for(const{train:h,leadSat:m,trainNoradIds:k}of y){const u=this.blueGlobe.dots.movingPoints.findIndex(b=>b.norad_id===m.norad_id);if(u>=0){const b=this.blueGlobe.dots.movingPoints[u];(d=(i=b.tleData)==null?void 0:i.raw_tle)!=null&&d.tle_line1&&((c=(l=b.tleData)==null?void 0:l.raw_tle)!=null&&c.tle_line2)&&p.push({train:h,noradId:m.norad_id,tle_line1:b.tleData.raw_tle.tle_line1,tle_line2:b.tleData.raw_tle.tle_line2,trainNoradIds:k})}}if(console.log(`Found TLE data for ${p.length} lead satellites`),p.length===0){e.innerHTML=`
                    <div class="alert alert-warning">
                        <span>No TLE data available for train lead satellites. Please load satellites first.</span>
                    </div>
                `;return}const L=new Date,N=this._calculateSunTransitions(L,t,o),I=p.map(async({train:h,noradId:m,tle_line1:k,tle_line2:u,trainNoradIds:b})=>{const _=new Worker(new URL("/assets/calculation-worker-8nVDzzH1.js",import.meta.url));try{return await new Promise((C,B)=>{const $=Date.now()+Math.random();_.addEventListener("message",M=>{const{type:v,data:z,messageId:F}=M.data;if(F===$)if(_.terminate(),v==="TRANSITS_RESULT"){const G=z.transits.map(w=>({...w,trainNoradIds:b,trainConstellation:h.constellation_name,leadNoradId:m}));C(G)}else v==="ERROR"&&B(new Error(z.error))}),_.addEventListener("error",M=>{_.terminate(),B(M)}),_.postMessage({type:"CALCULATE_TRANSITS",data:{tle_line1:k,tle_line2:u,observer:{lat:t,lng:o,alt:g},startTime:L,durationDays:7,visibilityArray:N},messageId:$})})}catch(S){return console.error(`Error calculating transits for NORAD ${m}:`,S),[]}}),f=(await Promise.all(I)).flat().sort((h,m)=>new Date(h.startTime)-new Date(m.startTime));console.log(`Combined ${f.length} train transits from ${p.length} trains`),e.style.display="none",a.style.display="block",this.allOverflights=f;const x=document.getElementById("trains_filter_container");x&&(x.style.display="block"),this._populateTrainsTableFromWorker(n,f)}catch(t){console.error("Error calculating train overflights:",t),e.innerHTML=`
                <div class="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Error calculating train overflights: ${t.message}</span>
                </div>
            `}}_calculateSunTransitions(e,a,n){console.log("Calculating visibility array for:",{date:e,lat:a,lng:n});const r=new Date(e);r.setUTCHours(0,0,0,0);const s=[];for(let i=0;i<1440;i+=5){const d=new Date(r.getTime()+i*6e4),l=Y(d,a,n);let c;l>=0?c="Day":l>=-6?c="Civil":l>=-12?c="Naut":l>=-18?c="Astro":c="Night",s.push(c),(i%60===0||s.length>1&&c!==s[s.length-2])&&console.log(`${Math.floor(i/60).toString().padStart(2,"0")}:${(i%60).toString().padStart(2,"0")} UTC - elevation: ${l.toFixed(2)}°, visibility: ${c}`)}return console.log(`Visibility array created with ${s.length} entries`),s}_populateTrainsTableFromWorker(e,a){e.innerHTML="";const n=document.getElementById("trains_filter_toggle"),r=document.getElementById("trains_optimal_toggle"),s=document.getElementById("trains_filtered_message"),i=n&&n.checked,d=r&&r.checked;let l=a,c=!1;if(i){const t=a.filter(o=>o.peakElevation>=10&&(o.visibility==="Night"||o.visibility==="Astro"));c=t.length>0,l=c?t:a,s&&(s.style.display=c?"none":"block")}else s&&(s.style.display="none");if(d&&(l=l.filter(t=>t.isSunlit&&t.sunOrientation==="behind")),l.length===0){const o=e.insertRow().insertCell();o.colSpan=10,o.className="text-center text-gray-500 py-8",o.textContent="No overflights found for the next 7 days (≥1° elevation)";return}l.forEach(t=>{var R,U,H;const o=e.insertRow(),g=new Date(t.startTime),T=new Date(t.peakTime),y=new Date(t.endTime);if(isNaN(g.getTime())||isNaN(T.getTime())||isNaN(y.getTime())){console.error("Invalid transit times:",t);return}const p=g.getDate(),N=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][g.getMonth()],I=`${p} ${N}`,O=g.toISOString().substring(11,19),f=g.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),x=T.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),h=t.trainNoradIds?t.trainNoradIds.length:1,m=`${Math.round(t.startAzimuth)}°→${Math.round(t.endAzimuth)}°`,k=o.insertCell();k.className="py-0 px-1 h-6 text-center";const u=document.createElement("a");u.className="text-blue-400 hover:text-blue-300 text-lg cursor-pointer",u.textContent="🔭",u.title="Simulate in Photo-bomb tool";const b=this.blueGlobe.preferences.homeLat,_=this.blueGlobe.preferences.homeLon;let S;const C=t.startAzimuth,$=(t.endAzimuth-C+540)%360-180;S=(C+$/2+360)%360,S=Math.round(S);const M=Math.round(t.peakElevation);let v="";t.trainNoradIds&&t.trainNoradIds.length>0?v=t.trainNoradIds.join(","):(R=this.satelliteData)!=null&&R.norad_id?v=this.satelliteData.norad_id:(U=this.detailedData)!=null&&U.norad_id?v=this.detailedData.norad_id:(H=this.oe)!=null&&H.norad_id&&(v=this.oe.norad_id);const z=T.toISOString().substring(0,19).replace("T","Z"),F=new URLSearchParams({mode:"localsky",lat:b,lon:_,alt:"10",az:S,elev:M,focal:"23",sensor:"36",utc:z,cmode:"video",dur:10,norad:v});u.href=`/satellite-photobomb?${F.toString()}`,u.target="_blank",k.appendChild(u);const G=o.insertCell();G.textContent=h,G.className="py-0 px-2 h-6 text-center";let w="",E="";t.isSunlit?t.sunOrientation==="behind"?(w="☀️",E="Sunlit satellite, sun behind observer (optimal visibility)"):t.sunOrientation==="front"?(w="🌅",E="Back-lit satellite (sun in front of observer)"):(w="☀️",E="Sunlit satellite"):(w="🌑",E="Satellite in Earth shadow (not visible)");const W=[I,O,f,x,Math.round(t.peakElevation)+"°",m,t.visibility||"Unknown",w];if(W.forEach((P,A)=>{const D=o.insertCell();D.textContent=P,D.className="py-0 px-2 h-6",A===W.length-1&&E&&(D.title=E)}),o.className="h-6 leading-none",t.peakElevation>=70?o.classList.add("bg-green-900","bg-opacity-30"):t.peakElevation>=40?o.classList.add("bg-yellow-900","bg-opacity-20"):t.peakElevation>=20&&o.classList.add("bg-orange-900","bg-opacity-20"),t.isSunlit&&t.sunOrientation==="behind"){const A=e.insertRow().insertCell();A.colSpan=10,A.className="py-2 px-8 text-sm text-gray-300 bg-blue-900 bg-opacity-10";const D=y-g,V=Math.round(D/6e4),j=q=>{const K=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"],Q=Math.round(q/22.5)%16;return K[Q]};j(t.startAzimuth);const J=j((t.startAzimuth+t.endAzimuth)/2),Z=(t.endAzimuth-t.startAzimuth+540)%360-180>0?"left to right":"right to left",X=g.toLocaleDateString("en-US",{day:"numeric",month:"long",year:"numeric"});A.innerHTML=`<span style="margin-right: 8px;">↳</span><span class="train-description">On ${X}, at ${f} local time, if you look ${J} and at an elevation of ${Math.round(t.peakElevation)}°, there will be a train of ${h} satellites passing from ${Z}. They are sun-lit from approximately behind your position, despite your sky being in ${t.visibility} darkness. They will take approximately ${V} minutes to pass by. Click the telescope icon for a simulation of the event.</span>`}})}_populateTrainsTable(e,a){if(e.innerHTML="",a.length===0){const i=e.insertRow().insertCell();i.colSpan=11,i.className="text-center text-gray-500 py-8",i.textContent="No overflights found for the next 7 days (≥20° elevation, dark sky)";return}let n=!1;a.forEach(s=>{const i=e.insertRow(),d=new Date(s.startTime),l=new Date(s.peakTime),c=new Date(s.endTime);if(isNaN(d.getTime())||isNaN(l.getTime())||isNaN(c.getTime())){console.error("Invalid transit times:",s);return}const t=d.toLocaleDateString(),o=d.toISOString().substring(11,19),g=l.toISOString().substring(11,19),T=d.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),y=l.toLocaleTimeString("en-GB",{hour12:!1}).substring(0,8),p=Math.round((c-d)/6e4),L=`${Math.floor(p/60)}:${(p%60).toString().padStart(2,"0")}`,N=`${Math.round(s.startAzimuth)}°→${Math.round(s.endAzimuth)}°`,I=s.isSunlit?"✨":"";s.isSunlit&&(n=!0),[t,o,T,g,y,Math.round(s.peakElevation)+"°",N,L,s.visibility||"N/A",I].forEach(f=>{const x=i.insertCell();x.textContent=f,x.className="py-0 px-2 h-6"}),i.className="h-6 leading-none",s.peakElevation>=70?i.classList.add("bg-green-900","bg-opacity-30"):s.peakElevation>=40?i.classList.add("bg-yellow-900","bg-opacity-20"):s.peakElevation>=20&&i.classList.add("bg-orange-900","bg-opacity-20")});const r=document.getElementById("flare_explanation");r&&(r.style.display=n?"block":"none")}cleanup(){}}export{ie as TrainsCalculator};
