import{_ as L}from"./main.localfix3.js";class S{constructor(e,s,n,o,d=null,r=null){this.blueGlobe=e,this.satelliteData=s,this.oe=n,this.detailedData=o,this.ui=d,this.controller=r,this.contentArea=null,this.chartInstance=null,this.isUPlotLoaded=!1}async initialize(e){this.contentArea=e,await this.loadUPlot(),this._buildUI(),this.checkAndLoadFromUrlParams()}async loadUPlot(){if(!this.isUPlotLoaded)try{const e=document.createElement("link");e.rel="stylesheet",e.href="/assets/vendor/uPlot.min.css",document.head.appendChild(e);const s=await L(()=>import("/assets/vendor/uPlot.esm.js"),[]);window.uPlot=s.default||s,this.isUPlotLoaded=!0,console.log("uPlot loaded successfully for altitude history")}catch(e){throw console.error("Failed to load uPlot:",e),e}}_buildUI(){var s,n;const e=((s=this.detailedData)==null?void 0:s.norad_id)||((n=this.satelliteData)==null?void 0:n.norad_id);this.contentArea.innerHTML=`
            <div class="space-y-4">
                <div class="bg-base-200/50 rounded-lg p-4">
                    <p class="text-sm text-base-content/90 leading-relaxed">
                        Track satellite orbital decay and altitude changes over time. 
                        Enter NORAD IDs to compare orbital lifetimes across multiple satellites.
                    </p>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 space-y-3">
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">NORAD IDs (comma or newline separated)</span>
                        </label>
                        <textarea id="satellite-norads"
                                  class="textarea textarea-sm textarea-bordered resize-none"
                                  rows="2"
                                  placeholder="Paste or enter NORAD IDs:&#10;25544, 43013, 20580&#10;or paste multiple lines">${e||""}</textarea>
                    </div>
                    
                    <div class="flex gap-2">
                        <button id="load-altitude-data-btn" class="btn btn-sm btn-primary">
                            <svg class="w-4 h-4 refresh-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            <span class="loading loading-spinner loading-sm hidden"></span>
                            <span class="button-text">Plot</span>
                        </button>
                        
                        <button id="load-recent-data-btn" class="btn btn-sm btn-primary">
                            <svg class="w-4 h-4 recent-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span class="loading loading-spinner loading-sm hidden"></span>
                            <span class="button-text">Plot Recent</span>
                        </button>
                    </div>
                    
                    <div class="text-xs text-base-content/60">
                        <p><strong>Maximum 20 satellites</strong> per chart. Supports comma-separated or line-separated NORAD IDs.</p>
                    </div>
                </div>

                <div id="altitude-status" class="text-center py-8 hidden">
                    <div class="loading loading-spinner loading-md"></div>
                    <p class="text-sm text-base-content/70 mt-2">Loading altitude history...</p>
                </div>

                <div id="altitude-chart-container" class="bg-base-300/60 rounded-lg p-4 hidden">
                    <div id="altitude-chart" style="width: 100%; height: 400px;"></div>
                    <div id="altitude-chart-labels" class="flex justify-between px-10 text-[10px]">
                        <span class="text-white">Y: Altitude (km)</span>
                        <span id="period-axis-label" class="text-amber-400 hidden">Y1: Period (min)</span>
                    </div>
                </div>
                
                <div id="altitude-summary" class="space-y-2 p-4 hidden">
                </div>
            </div>
        `,this._setupEventListeners()}checkAndLoadFromUrlParams(){const s=new URLSearchParams(window.location.search).get("norad");if(s){const n=this.contentArea.querySelector("#satellite-norads");n&&(n.value=s,setTimeout(()=>{console.log(`🚀 Auto-loading altitude data from URL parameter: ${s}`),this.loadAltitudeDataFromUI(!1)},100))}}_setupEventListeners(){const e=this.contentArea.querySelector("#load-altitude-data-btn"),s=this.contentArea.querySelector("#load-recent-data-btn"),n=this.contentArea.querySelector("#satellite-norads");e.addEventListener("click",()=>{this.loadAltitudeDataFromUI(!1)}),s.addEventListener("click",()=>{this.loadAltitudeDataFromUI(!0)}),n.addEventListener("keypress",o=>{o.key==="Enter"&&this.loadAltitudeDataFromUI(!1)})}async loadAltitudeDataFromUI(e=!1){const n=this.contentArea.querySelector("#satellite-norads").value.trim();if(!n){this.showToast("Please enter at least one NORAD ID","warning"),this.showEmptyChart();return}const o=n.split(/[,\n\r]/).map(d=>parseInt(d.trim())).filter(d=>!isNaN(d)&&d>0);if(o.length===0){this.showToast("No valid NORAD IDs provided","error"),this.showEmptyChart();return}o.length>20&&(this.showToast("Maximum 20 satellites allowed. Using first 20.","warning"),o.splice(20)),await this.loadAltitudeData(o,e)}async loadAltitudeData(e,s=!1){if(!e||e.length===0){this.showToast("No NORAD IDs provided","error");return}const n=this.contentArea.querySelector("#altitude-status"),o=this.contentArea.querySelector("#altitude-chart-container"),d=this.contentArea.querySelector("#altitude-summary"),r=s?this.contentArea.querySelector("#load-recent-data-btn"):this.contentArea.querySelector("#load-altitude-data-btn"),g=r==null?void 0:r.querySelector(s?".recent-icon":".refresh-icon"),m=r==null?void 0:r.querySelector(".loading-spinner"),c=r==null?void 0:r.querySelector(".button-text");n.classList.remove("hidden"),o.classList.add("hidden"),d.classList.add("hidden"),g&&g.classList.add("hidden"),m&&m.classList.remove("hidden"),c&&(c.textContent="Loading..."),r&&(r.disabled=!0);try{let p=`${this.blueGlobe.apiBaseUrl||"/local-api"}/api/satellite-lifetime?norad_ids=${e.join(",")}`;s&&(p+="&days=90"),console.log(`📊 Fetching ${s?"recent (90 days)":"all"} altitude data for: ${e.join(", ")}`);const f=await fetch(p,{headers:this.blueGlobe.getAuthHeaders?this.blueGlobe.getAuthHeaders():{}});if(!f.ok)throw new Error(`HTTP ${f.status}: ${f.statusText}`);const y=await f.json();if(!y.success)throw new Error(y.error||"Failed to load altitude data");console.log(`✅ Loaded altitude data for ${y.satellite_count} satellites with ${y.total_data_points} data points`),y.total_data_points==0&&this.showToast("No altitude history available for this satellite","info"),n.classList.add("hidden"),o.classList.remove("hidden"),d.classList.remove("hidden"),this.renderChart(y)}catch(h){console.error("Failed to load altitude data:",h),this.showToast(`Failed to load data: ${h.message}`,"error"),n.innerHTML=`
                <div class="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h3 class="font-bold">Failed to load altitude data</h3>
                        <div class="text-xs">${h.message}</div>
                    </div>
                </div>
            `}finally{g&&g.classList.remove("hidden"),m&&m.classList.add("hidden"),c&&(c.textContent=s?"Plot Recent":"Plot"),r&&(r.disabled=!1)}}renderChart(e){const s=this.contentArea.querySelector("#altitude-chart");if(!s||!window.uPlot||!e.satellites||e.satellites.length===0)return;this.chartInstance&&(this.chartInstance._resizeListener&&window.removeEventListener("resize",this.chartInstance._resizeListener),this.chartInstance.destroy(),this.chartInstance=null);const n=new Set;e.satellites.forEach(a=>{a.altitude_data.forEach(t=>n.add(t.date))});const o=Array.from(n).sort(),d=o.map(a=>Math.floor(new Date(a).getTime()/1e3)),r=[{label:"Date",value:(a,t,u,_)=>t==null?"----------":new Date(t*1e3).toISOString().split("T")[0]}],g=[d],m=["#3B82F6","#EF4444","#10B981","#F59E0B","#8B5CF6","#EC4899","#06B6D4","#84CC16","#F97316","#6366F1"];if(e.satellites.length===1){const a=e.satellites[0];r.push({label:`Apogee (${a.norad_id})`,stroke:"#EF4444",width:2,points:{show:!1},scale:"altitude",gaps:(l,i,k,A)=>!0,value:(l,i)=>i==null?"---.-- km":i.toFixed(2)+" km"}),r.push({label:`Perigee (${a.norad_id})`,stroke:"#10B981",width:2,points:{show:!1},scale:"altitude",gaps:(l,i,k,A)=>!0,value:(l,i)=>i==null?"---.-- km":i.toFixed(2)+" km"}),r.push({label:`Period (${a.norad_id})`,stroke:"#F59E0B",width:2,points:{show:!1},scale:"period",gaps:(l,i,k,A)=>!0,value:(l,i)=>i==null?"---.-- min":i.toFixed(2)+" min"});const t=new Array(d.length).fill(null),u=new Array(d.length).fill(null),_=new Array(d.length).fill(null);a.altitude_data.forEach(l=>{const i=o.indexOf(l.date);if(i>=0&&(l.h_apogee_km!==void 0&&(t[i]=l.h_apogee_km),l.h_perigee_km!==void 0&&(u[i]=l.h_perigee_km),l.mean_motion_rev_day!==void 0&&l.mean_motion_rev_day>0)){const k=1440/l.mean_motion_rev_day;_[i]=k}}),g.push(t),g.push(u),g.push(_)}else e.satellites.forEach((a,t)=>{const u=m[t%m.length];r.push({label:`${a.norad_id}`,stroke:u,width:1,points:{show:!1},gaps:(l,i,k,A)=>!0,value:(l,i)=>i==null?"---.-- km":i.toFixed(2)+" km"});const _=new Array(d.length).fill(null);a.altitude_data.forEach(l=>{const i=o.indexOf(l.date);i>=0&&(_[i]=l.altitude_km)}),g.push(_)});let c=1/0,h=-1/0,p=1/0,f=-1/0;e.satellites.length===1?e.satellites[0].altitude_data.forEach(t=>{if(t.h_apogee_km!==void 0&&t.h_apogee_km<c&&(c=t.h_apogee_km),t.h_apogee_km!==void 0&&t.h_apogee_km>h&&(h=t.h_apogee_km),t.h_perigee_km!==void 0&&t.h_perigee_km<c&&(c=t.h_perigee_km),t.h_perigee_km!==void 0&&t.h_perigee_km>h&&(h=t.h_perigee_km),t.mean_motion_rev_day!==void 0&&t.mean_motion_rev_day>0){const u=1440/t.mean_motion_rev_day;u<p&&(p=u),u>f&&(f=u)}}):e.satellites.forEach(a=>{a.altitude_range&&(a.altitude_range.min<c&&(c=a.altitude_range.min),a.altitude_range.max>h&&(h=a.altitude_range.max))});const x=(h-c)*.05;c=Math.floor(c-x),h=Math.ceil(h+x);const b=e.satellites.length===1?`Orbital Parameters - ${e.satellites[0].norad_id}`:"Mean semi-major-axis–derived altitude - history";let v,w;e.satellites.length===1&&p!==1/0&&f!==-1/0?(v={x:{time:!0},altitude:{auto:!1,range:[c,h]},period:{auto:!1,range:[p,f]}},w=[{stroke:"#fff",grid:{stroke:"#444",width:1},ticks:{stroke:"#fff"}},{scale:"altitude",stroke:"#fff",grid:{stroke:"#444",width:1},ticks:{stroke:"#fff"},size:40},{side:1,scale:"period",stroke:"#F59E0B",grid:{show:!1},ticks:{stroke:"#F59E0B"},size:40}]):(v={x:{time:!0},y:{auto:!1,range:[c,h]}},w=[{stroke:"#fff",grid:{stroke:"#444",width:1},ticks:{stroke:"#fff"}},{stroke:"#fff",grid:{stroke:"#444",width:1},ticks:{stroke:"#fff"},size:40}]);const D=e.satellites.length===1&&p!==1/0&&f!==-1/0?[10,10,40,10]:[10,10,40,10],I={width:s.clientWidth,height:400,padding:D,title:b,scales:v,axes:w,series:r,legend:{show:!0,live:!0,markers:{show:!1},values:[]},cursor:{drag:{x:!0,y:!1}},hooks:{drawClear:[a=>{const t=a.ctx,{left:u,top:_,width:l,height:i}=a.bbox;t.save(),t.fillStyle="#000000",t.fillRect(u,_,l,i),t.restore()}],ready:[a=>{const t=a.root.querySelector(".u-legend");t&&(t.style.fontFamily='monospace, "Courier New", Courier',t.style.fontSize="12px",t.style.lineHeight="0.8",t.style.paddingBottom="3em",t.querySelectorAll(".u-series").forEach((_,l)=>{if(_.style.lineHeight="0.8",_.style.padding="0",_.style.margin="0",l>0&&a.series[l]){const i=_.querySelector(".u-label");i&&(i.style.color=a.series[l].stroke,i.style.fontWeight="bold")}}))}]}};try{const a=s.querySelector(".uplot");a&&a.remove(),this.chartInstance=new window.uPlot(I,g,s);const t=this.contentArea.querySelector("#period-axis-label");if(t){const u=e.satellites.length===1&&g.length>3;t.classList.toggle("hidden",!u)}if(this.chartInstance&&!this.chartInstance._resizeListener){const u=()=>{this.chartInstance&&s.clientWidth>0&&s.clientHeight>0&&this.chartInstance.setSize({width:s.clientWidth,height:s.clientHeight})};window.addEventListener("resize",u),this.chartInstance._resizeListener=u}}catch(a){console.error("Failed to create altitude chart:",a),this.showToast("Failed to create chart","error")}}renderSummary(e){var o,d,r,g;const s=this.contentArea.querySelector("#altitude-summary");if(!s||!e.satellites)return;let n=`
            <div class="bg-base-200/50 rounded-lg p-4">
                <h4 class="font-semibold mb-3">Altitude Data Summary</h4>
                <div class="overflow-x-auto">
                    <table class="table table-zebra table-compact text-xs">
                        <thead>
                            <tr>
                                <th>Satellite</th>
                                <th>Data Points</th>
                                <th>Date Range</th>
                                <th>Alt Range (km)</th>
                                <th>Current Trend</th>
                            </tr>
                        </thead>
                        <tbody>
        `;e.satellites.forEach(m=>{var f,y,x,b,v,w;const c=this.calculateTrend(m.altitude_data),h=c>0?"↗️":c<0?"↘️":"→",p=c>0?"text-green-400":c<0?"text-red-400":"text-gray-400";n+=`
                <tr>
                    <td class="font-mono">${m.norad_id}</td>
                    <td>${m.data_points.toLocaleString()}</td>
                    <td class="text-xs">${(f=m.date_range)==null?void 0:f.start} to ${(y=m.date_range)==null?void 0:y.end}</td>
                    <td>${(b=(x=m.altitude_range)==null?void 0:x.min)==null?void 0:b.toFixed(1)} - ${(w=(v=m.altitude_range)==null?void 0:v.max)==null?void 0:w.toFixed(1)}</td>
                    <td class="${p}">${h} ${Math.abs(c).toFixed(2)} km/day</td>
                </tr>
            `}),n+=`
                        </tbody>
                    </table>
                </div>
                <div class="text-xs text-base-content/60 mt-3">
                    <p><strong>Total Data Points:</strong> ${e.total_data_points.toLocaleString()}</p>
                    <p><strong>Altitude Range:</strong> ${(d=(o=e.altitude_range)==null?void 0:o.min)==null?void 0:d.toFixed(1)} - ${(g=(r=e.altitude_range)==null?void 0:r.max)==null?void 0:g.toFixed(1)} km</p>
                </div>
            </div>
        `,s.innerHTML=n}calculateTrend(e){if(!e||e.length<2)return 0;const s=e.length,n=Math.max(1,Math.floor(s*.1)),o=e.slice(0,n),d=e.slice(-n),r=o.reduce((p,f)=>p+f.altitude_km,0)/o.length,g=d.reduce((p,f)=>p+f.altitude_km,0)/d.length,m=new Date(o[0].date),h=(new Date(d[d.length-1].date)-m)/(1e3*60*60*24);return h>0?(g-r)/h:0}showEmptyChart(){const e=this.contentArea.querySelector("#altitude-chart-container"),s=this.contentArea.querySelector("#altitude-summary");this.contentArea.querySelector("#altitude-status").classList.add("hidden"),e.classList.remove("hidden"),s.classList.add("hidden");const o=this.contentArea.querySelector("#altitude-chart");o&&(this.chartInstance&&(this.chartInstance._resizeListener&&window.removeEventListener("resize",this.chartInstance._resizeListener),this.chartInstance.destroy(),this.chartInstance=null),o.innerHTML="")}showToast(e,s="info"){this.ui&&typeof this.ui._showToast=="function"?this.ui._showToast(e,s):console.log(`${s.toUpperCase()}: ${e}`)}}export{S as AltitudeHistory};
