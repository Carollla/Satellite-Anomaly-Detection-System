import{a as T}from"./main.localfix3.js";function m(_){var n,s;const e=((n=window.globe)==null?void 0:n.currentLanguage)||"en",o=(s=window.SYSTEM_LABELS)==null?void 0:s[e];if(!o)return console.warn(`No translations found for language: ${e}`),_;const t=_.split(".");let r=o;for(const i of t)if(r=r==null?void 0:r[i],r===void 0)break;return r!==void 0?r:_}class L{constructor(e,o){this.parent=e,this.apiBaseUrl=o}packVisualizationState(){var e,o,t,r;try{let n={version:"1.0.0",timestamp:new Date().toISOString(),camera:{eye:this.parent.eye?[...this.parent.eye]:null,eyeDistance:this.parent.eyeDistance||null,rotationX:this.parent.rotationX??null,rotationY:this.parent.rotationY??null,standingYaw:this.parent.standingYaw??null,standingPitch:this.parent.standingPitch??null,standing_view:this.parent.standing_view||!1,riding_view:this.parent._mode("pov")?this.parent._povIdentifier():!1,show_rotating:this.parent.show_rotating??0,pov_mode:this.parent.povCameraMode||"travel",pov_viewMode:((e=this.parent.pov)==null?void 0:e.viewMode)||"boom",fov:((o=this.parent.sphereControls)==null?void 0:o.currentFov)||null,fovRubber:((t=this.parent.sphereControls)==null?void 0:t.rubber)??!0,...(()=>{const s=document.getElementById("satellite-filter-key");return s?{filter_key_open:!s.classList.contains("filter-key-hide")}:{}})()},time:(()=>{const s=this.parent.wallclock,i=s?s.getSpeed():1,h=s?s.getPaused():!1,c=s?s.now():Date.now(),w=i===1&&!h&&Math.abs(c-Date.now())<5e3;return{realtime:w,currentTime:w?null:s?new Date(s.now()).toISOString():null,timeSpeed:i,paused:h}})(),filters:this.parent.filters?this.parent.filters.freezeState():null,satellites:{show_constellation:this.parent.show_type?null:this.parent.show_constellation||null,show_type:this.parent.show_type||null,...(()=>{var a,u;const s=((a=this.parent.dots)==null?void 0:a.movingPoints)||[],i={};s.length>0&&s.length<=100&&(i.noradIds=s.map(p=>p==null?void 0:p.norad_id).filter(p=>p!=null));const h=[],c=[],w=(u=this.parent.dots)==null?void 0:u.dotBits,l=this.parent.highlightedOrbits||[];if(w&&s.length>0)for(let p=0;p<s.length;p++)w[p]&8&&h.push(s[p].norad_id);return l.forEach((p,f)=>{c.push(f)}),h.length>0&&(i.highlighted=h),c.length>0&&(i.orbits=c),i})()},trackedSatellite:((r=this.parent.trackedSatellite)==null?void 0:r.norad_id)||null,fullVisualizer:!!this.parent.long_press_hidden,view:{show_borders:this.parent.show_borders,show_latlon:this.parent.show_latlon,show_labels:this.parent.show_labels,show_clouds:this.parent.show_clouds,show_leoexplode:this.parent.show_leoexplode,show_trains:this.parent.show_trains,show_dotlighting:this.parent.show_dotlighting,show_texstyle:this.parent.show_texstyle,show_skybox:this.parent.show_skybox,shader_dots:this.parent.shader_dots||0}};return this.parent.standing_view&&(n.camera.standing_lat=this.parent.preferences.homeLat,n.camera.standing_lon=this.parent.preferences.homeLon),console.log("📦 Packed visualization state:",n),n}catch(n){throw console.error("❌ Error packing visualization state:",n),new Error("Failed to pack visualization state")}}unpackVisualizationState(e){try{if(console.log("📦 Unpacking visualization state:",e),!e||typeof e!="object")throw new Error("Invalid state data");const o={restored:[],skipped:[],errors:[]};if(e.camera)try{e.camera.eye&&Array.isArray(e.camera.eye)&&(o.camera=e.camera,o.restored.push("camera"))}catch(t){o.errors.push(`camera: ${t.message}`)}if(e.time)try{o.time={realtime:e.time.realtime||!1,currentTime:e.time.currentTime,timeSpeed:e.time.timeSpeed||1,paused:e.time.paused||!1,duration:e.time.duration||null,loop:e.time.loop||!1},o.restored.push("time")}catch(t){o.errors.push(`time: ${t.message}`)}if(e.filters)try{o.filters=e.filters,o.restored.push("filters")}catch(t){o.errors.push(`filters: ${t.message}`)}if(e.satellites)try{o.satellites={},e.satellites.noradIds&&Array.isArray(e.satellites.noradIds)?(o.satellites.noradIds=e.satellites.noradIds,console.log(`📦 Unpacked ${e.satellites.noradIds.length} NORAD IDs`)):(o.satellites.show_constellation=e.satellites.show_constellation,o.satellites.show_type=e.satellites.show_type),e.satellites.highlighted&&Array.isArray(e.satellites.highlighted)&&(o.satellites.highlighted=e.satellites.highlighted,console.log(`📦 Unpacked ${e.satellites.highlighted.length} highlighted satellites`)),e.satellites.orbits&&Array.isArray(e.satellites.orbits)&&(o.satellites.orbits=e.satellites.orbits,console.log(`📦 Unpacked ${e.satellites.orbits.length} satellites with orbits`)),o.restored.push("satellites")}catch(t){o.errors.push(`satellites: ${t.message}`)}if(e.view)try{o.view={show_borders:"show_borders"in e.view?e.view.show_borders:void 0,show_latlon:"show_latlon"in e.view?e.view.show_latlon:void 0,show_labels:"show_labels"in e.view?e.view.show_labels:void 0,show_clouds:"show_clouds"in e.view?e.view.show_clouds:void 0,show_leoexplode:"show_leoexplode"in e.view?e.view.show_leoexplode:void 0,show_trains:"show_trains"in e.view?e.view.show_trains:void 0,show_dotlighting:"show_dotlighting"in e.view?e.view.show_dotlighting:void 0,show_texstyle:"show_texstyle"in e.view?e.view.show_texstyle:void 0,show_skybox:"show_skybox"in e.view?e.view.show_skybox:void 0,shader_dots:"shader_dots"in e.view?e.view.shader_dots:void 0},o.restored.push("view")}catch(t){o.errors.push(`view: ${t.message}`)}return e.trackedSatellite&&(o.trackedSatellite=e.trackedSatellite,o.restored.push("trackedSatellite")),e.fullVisualizer&&(o.fullVisualizer=!0,o.restored.push("fullVisualizer")),console.log("✅ Unpacked visualization state:",o),o}catch(o){throw console.error("❌ Error unpacking visualization state:",o),new Error("Failed to unpack visualization state")}}captureCanvasPreview(){return new Promise(e=>{const o=this.parent.canvas;if(!o){e(null);return}requestAnimationFrame(()=>{try{const t=this.parent.render_decimation;this.parent.render_decimation=0,this.parent.fps60_lastTime=0,this.parent.renderFrame(performance.now(),!0),this.parent.gl&&(this.parent.gl.finish(),this.parent.gl.flush());const r=document.createElement("canvas");r.width=o.width,r.height=o.height,r.getContext("2d").drawImage(o,0,0),this.parent.render_decimation=t;const n=300,s=o.height/o.width,i=Math.min(n,o.width),h=i*s,c=document.createElement("canvas");c.width=i,c.height=h,c.getContext("2d").drawImage(r,0,0,i,h),e(c.toDataURL("image/jpeg",.8))}catch(t){console.warn("Failed to capture canvas preview:",t),e(null)}})})}async createShare(e={}){try{const{title:o=null,description:t=null,expiresInDays:r=null,previewImage:n=null,shareSpeed:s=null,shareDuration:i=null,shareLoop:h=!1}=e,c=this.packVisualizationState();s!=null&&(c.time.timeSpeed=s,s!==1&&(c.time.realtime=!1)),i!=null&&(c.time.duration=i),h&&(c.time.loop=!0);const w=n||await this.captureCanvasPreview(),l={config:c,title:o,description:t,expiresInDays:r,previewImage:w},a={"Content-Type":"application/json"};this.parent.options.apiKey&&(a.Authorization=`Bearer ${this.parent.options.apiKey}`);const u=await fetch(`${this.apiBaseUrl}/share`,{method:"POST",headers:a,body:JSON.stringify(l)});if(!u.ok){const f=await u.json().catch(()=>({}));throw new Error(f.error||`HTTP ${u.status}`)}const p=await u.json();if(!p.success)throw new Error(p.error||"Unknown error");return console.log("🔗 Share created successfully:",p),p}catch(o){throw console.error("❌ Error creating share:",o),o}}async validateShareId(e){var o,t;try{if(!e||typeof e!="string")return console.log("❌ Invalid share ID: not a string or empty"),!1;console.log(`🔍 Validating share ID: "${e}" (length: ${e.length})`);const r={};(t=(o=this.parent)==null?void 0:o.options)!=null&&t.apiKey&&(r.Authorization=`Bearer ${this.parent.options.apiKey}`);const n=await fetch(`${this.apiBaseUrl}/share/${e}`,{headers:r});return console.log(`📡 Share validation response: ${n.status} ${n.statusText}`),n.ok?(console.log("✅ Share ID is valid"),!0):(console.log("❌ Share ID validation failed:",n.status,n.statusText),!1)}catch(r){return console.warn("❌ Share ID validation network error:",r),!1}}async loadShare(e){var o,t;try{if(!e||typeof e!="string")throw new Error("Invalid share ID");console.log(`🔗 Loading share: ${e}`);const r={};(t=(o=this.parent)==null?void 0:o.options)!=null&&t.apiKey&&(r.Authorization=`Bearer ${this.parent.options.apiKey}`);const n=await fetch(`${this.apiBaseUrl}/share/${e}`,{headers:r});if(!n.ok){const h=await n.json().catch(()=>({}));throw new Error(h.error||`HTTP ${n.status}`)}const s=await n.json();if(!s.success)throw new Error(s.error||"Unknown error");const i=this.unpackVisualizationState(s.config);return console.log("✅ Share loaded successfully:",{shareInfo:{title:s.title,description:s.description,createdAt:s.createdAt,viewCount:s.viewCount},state:i}),{shareInfo:{title:s.title,description:s.description,createdAt:s.createdAt,expiresAt:s.expiresAt,viewCount:s.viewCount},state:i}}catch(r){throw console.error("❌ Error loading share:",r),r}}applyRestoredState(e,o){const t=o||this.parent;try{console.log("🔧 Applying restored state to BlueGlobe...");const r=[],n=[];if(t.clearSatellites(),e.filters&&t.filters)try{console.log("🎨 Restoring filter state"),t.filters.thawState(e.filters),r.push("filters")}catch(s){console.warn("⚠️ Failed to apply filter settings:",s.message),n.push("filters")}if(e.satellites,e.view){const s=e.view;try{s.show_borders!==void 0&&(t.show_borders=s.show_borders),s.show_latlon!==void 0&&(t.show_latlon=s.show_latlon),s.show_labels!==void 0&&(t.show_labels=s.show_labels),s.show_clouds!==void 0&&(t.show_clouds=s.show_clouds),s.show_leoexplode!==void 0&&(t.show_leoexplode=s.show_leoexplode),s.show_trains!==void 0&&(t.show_trains=s.show_trains),s.show_dotlighting!==void 0&&(t.show_dotlighting=s.show_dotlighting),s.show_texstyle!==void 0&&(t.show_texstyle=s.show_texstyle),s.show_skybox!==void 0&&(t.show_skybox=s.show_skybox,s.show_skybox===3?(t.show_catalogStars=!0,t.show_starThreshold=4.5):(t.show_catalogStars=!1,t.show_starThreshold=0)),s.shader_dots!==void 0&&(t.shader_dots=s.shader_dots),console.log("🌍 Would apply view settings:",e.view),r.push("view")}catch(i){console.warn("⚠️ Failed to apply view settings:",i.message),n.push("view")}}if(t._lastMoonYaw=void 0,t.eyeDistance=e.camera.eyeDistance,t.eye=e.camera.eye,console.warn("Set eye to ",t.eye),t.rotationX=e.camera.rotationX,t.rotationY=e.camera.rotationY,t.sphereControls.setCameraState({distance:t.eyeDistance,rotationX:t.rotationX,rotationY:t.rotationY}),console.warn("eye is still ",t.eye),console.warn("Called setCameraState() with ",t.eyeDistance,t.rotationX,t.rotationY),e.camera.standingPitch!=null&&(t.standingPitch=e.camera.standingPitch),e.camera.standingYaw!=null&&(t.standingYaw=e.camera.standingYaw),e.camera.standing_view&&(t.standing_view=!0,t.preferences.homeLat=e.camera.standing_lat,t.preferences.homeLon=e.camera.standing_lon,t._goToHomeStandingView(!0),console.warn("Restored standing view mode ",t.preferences,e.camera)),e.camera.riding_view&&(t.riding_view_request={type:"satellite",data:e.camera.riding_view}),e.camera.pov_mode&&(t.povCameraMode=e.camera.pov_mode,(e.camera.standingPitch!=null||e.camera.standingYaw!=null)&&(t._deferredPovRestore={mode:e.camera.pov_mode,pitch:e.camera.standingPitch||0,yaw:e.camera.standingYaw||0})),e.camera.pov_viewMode&&t.pov&&(t.pov.viewMode=e.camera.pov_viewMode),t.sphereControls&&(e.camera.fovRubber!==void 0&&(t.sphereControls.rubber=e.camera.fovRubber),e.camera.fov!=null&&(t.sphereControls.currentFov=e.camera.fov,t.sphereControls.rubber||(t.sphereControls.config.fov=e.camera.fov))),e.camera.filter_key_open!==void 0){const s=document.getElementById("satellite-filter-key");s&&s.classList.toggle("filter-key-hide",!e.camera.filter_key_open)}if(t.constellationIndex=void 0,e.satellites){const s=e.satellites;if(console.log("We gotta load sats",s,s.noradIds),s.noradIds||s.show_constellation||s.show_type){let i=t.riding_view_request,h=s.show_constellation?s.show_constellation:void 0,c=s.show_type?s.show_type:void 0;t._fire&&t._fire("loading",{loading:!0,constellation:null}),t.isloading=!0,t.loadsats(h,c,!0,s.noradIds?s.noradIds:[]).then(async w=>{if(t.show_constellation=h,t.show_type=c,t.requestOptimalZoom=!1,t._deploySatelliteData(w,!1),console.warn("Gate for initial load is now OPEN"),t._fire&&t._fire("loading",{loading:!1}),s.highlighted&&s.highlighted.length>0&&s.highlighted.forEach(l=>{const a=t.dots.movingPoints.findIndex(u=>u.norad_id==l);a>=0&&t._highlight(a,!1)}),i){const l=t.dots.movingPoints.find(a=>a.norad_id==i);l?(console.warn("found satellite"),t.riding_view_request={type:"satellite",data:l}):(console.warn("not found, so loading:",i),t.isloading=!0,await t.loadsats(void 0,void 0,!1,[i]).then(a=>{if(a){t._deploySatelliteData(a);const u=t.dots.movingPoints.find(p=>p.norad_id==i);u?(t.riding_view_request={type:"satellite",data:u},console.warn("set riding_view_request to ",u)):console.warn("still not found ",u)}}))}s.orbits&&s.orbits.length>0&&s.orbits.forEach(l=>{const a=t.dots.movingPoints.find(u=>u.norad_id==l);a&&t._calculateSatelliteOrbit(a)}),e.trackedSatellite&&t.trackSatellite(e.trackedSatellite),e.fullVisualizer&&(t.long_press_hidden=Array.from(document.body.children).filter(l=>l.tagName==="DIV"||l.tagName==="NAV").map(l=>{const a=l.style.visibility;return l.id!=="music-player-ui"&&l.id!=="bgtitle"&&(l.style.visibility="hidden"),{el:l,disp:a}}))});{let w=!1;if(t.wallclock.setSpeed(1),e.time.realtime)t.wallclock.reset(),w=!0,console.log("Restore sim to realtime at 1x");else{if(e.time.currentTime){const l=new Date(e.time.currentTime).getTime();t.wallclock.setTime(l),console.log("Restore sim to time ",l)}else t.wallclock.reset();e.time.timeSpeed&&(console.log("Restore speed "),t.wallclock.setSpeed(e.time.timeSpeed),t.wallclock.pause()),e.time.paused?(console.log("Restore paused state "),t.wallclock.pause()):(console.log("Restore playing state "),w=!0)}if(console.log("✅ State application complete:",{applied:r,skipped:n}),w){const l=e.time.timeSpeed||1,a=()=>{console.log("✅ Resume clock"),e.camera.show_rotating!=null&&(t.show_rotating=e.camera.show_rotating),t.dots.need_recalc=!0,t.requestOptimalZoom=!1,t.wallclock.setSpeed(l),t.wallclock.resume()};this._waitForSatellites(t,()=>{t.wallclock.setSpeed(.1),t.wallclock.resume(),this._showCountdown(5,a)})}}}}return{applied:r,skipped:n}}catch(r){throw console.error("❌ Error applying restored state:",r),r}}_waitForSatellites(e,o){var n,s;if(((s=(n=e.dots)==null?void 0:n.movingPoints)==null?void 0:s.length)>0){o();return}const t=document.createElement("div");t.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:9999;pointer-events:none;",t.innerHTML='<svg class="animate-spin" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M4 12a8 8 0 018-8" stroke-opacity="0.75"></path></svg>',document.body.appendChild(t);const r=setInterval(()=>{var i,h;((h=(i=e.dots)==null?void 0:i.movingPoints)==null?void 0:h.length)>0&&(clearInterval(r),t.remove(),o())},200)}_showCountdown(e,o){const t=document.createElement("div");t.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:9999;pointer-events:none;",document.body.appendChild(t);let r=e;const n=()=>{if(r<=0){t.remove(),o();return}const s=document.createElement("div");s.textContent=r,s.style.cssText="position:absolute;font-size:8rem;font-weight:700;color:white;opacity:1;transform:scale(1);transition:all 0.8s ease-out;text-shadow:0 0 40px rgba(0,0,0,0.8);",t.innerHTML="",t.appendChild(s),requestAnimationFrame(()=>{requestAnimationFrame(()=>{s.style.opacity="0",s.style.transform="scale(0.3)"})}),r--,setTimeout(n,1e3)};n()}async testShareSystem(){try{console.log("🧪 Testing share system...");const e=this.packVisualizationState();console.log("✅ Packing test passed");const o=this.unpackVisualizationState(e);console.log("✅ Unpacking test passed");const t=this.applyRestoredState(o);return console.log("✅ Application test passed"),{success:!0,packed:e,unpacked:o,applied:t}}catch(e){return console.error("❌ Share system test failed:",e),{success:!1,error:e.message}}}createShareModalHTML(){return`
        <dialog id="share-modal" class="modal rounded-lg border-0 bg-gray-800 text-white p-0">
            <form method="dialog" class="bg-gray-800 rounded-lg">
                <!-- Modal Header -->
                <div class="flex items-center justify-between p-4 border-b border-gray-600">
                    <h3 class="text-lg font-semibold text-white" id="share-modal-title">
                        ${m("share.title")}
                    </h3>
                    <button type="button" class="my-close-button" id="share-modal-close">
                        <span class="sr-only">Close modal</span>
                        <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Modal Body -->
                <div class="p-6">
                    <!-- Initial explanation screen -->
                    <div id="share-explanation" class="space-y-4">
                        <p class="text-sm text-gray-300" id="share-description">
                            ${m("share.description")}
                        </p>
                        <div class="flex flex-col gap-3 mt-6">
                            <button type="button" 
                                class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" 
                                id="create-share-button">
                                ${m("share.create_button")}
                            </button>
                            <button type="button" 
                                class="w-full text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600" 
                                id="cancel-share-button">
                                ${m("share.cancel_button")}
                            </button>
                        </div>
                    </div>
                    
                    <!-- Loading screen -->
                    <div id="share-loading" class="hidden text-center space-y-4">
                        <div class="flex justify-center">
                            <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <p class="text-sm text-gray-300" id="share-loading-text">
                            ${m("share.generating")}
                        </p>
                    </div>
                    
                    <!-- Success screen with URL -->
                    <div id="share-success" class="hidden space-y-4">
                        <div class="text-center space-y-2">
                            <div class="text-green-400 text-2xl">✓</div>
                            <h4 class="text-lg font-semibold text-white" id="share-success-title">
                                ${m("share.success_title")}
                            </h4>
                            <p class="text-sm text-gray-300" id="share-success-description">
                                ${m("share.success_description")}
                            </p>
                        </div>
                        
                        <div class="relative">
                            <input type="text" 
                                id="share-url-input" 
                                class="w-full p-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 pr-12"
                                readonly>
                            <button type="button" 
                                id="copy-url-button"
                                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <button type="button" 
                            class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" 
                            id="copy-url-main-button">
                            <span id="copy-button-text">${m("share.copy_button")}</span>
                        </button>
                    </div>
                    
                    <!-- Error screen -->
                    <div id="share-error" class="hidden space-y-4">
                        <div class="text-center space-y-2">
                            <div class="text-red-400 text-2xl">⚠</div>
                            <p class="text-sm text-red-300" id="share-error-text">
                                ${m("share.error")}
                            </p>
                        </div>
                        <button type="button" 
                            class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" 
                            id="retry-share-button">
                            ${m("share.create_button")}
                        </button>
                    </div>
                </div>
            </form>
        </dialog>
    `}async copyToClipboard(e){try{if(navigator.clipboard&&window.isSecureContext)return await navigator.clipboard.writeText(e),!0;{const o=document.createElement("textarea");o.value=e,o.style.position="fixed",o.style.left="-999999px",o.style.top="-999999px",document.body.appendChild(o),o.focus(),o.select();const t=document.execCommand("copy");return document.body.removeChild(o),t}}catch(o){return console.error("Failed to copy to clipboard:",o),!1}}showScreen(e){["share-explanation","share-loading","share-success","share-error"].forEach(t=>{const r=document.getElementById(t);r&&(t===e?r.classList.remove("hidden"):r.classList.add("hidden"))})}updateCopyButtonFeedback(e=!1){const o=document.getElementById("copy-button-text");o&&(e?(o.textContent=m("share.copied"),setTimeout(()=>{o.textContent=m("share.copy_button")},2e3)):o.textContent=m("share.copy_button"))}initializeShareModal(){const e=document.getElementById("share-modal");e&&e.remove();const o=createShareModalHTML();document.body.insertAdjacentHTML("beforeend",o);const t=document.getElementById("share-modal");if(!t)throw new Error("Failed to create share modal");const r=document.getElementById("share-description");r&&(r.innerHTML=r.innerHTML+' <span class="text-green-400">✓ Captures: constellation/satellites, camera, clock, visuals, filters</span>');const n=document.getElementById("share-modal-close");n==null||n.addEventListener("click",()=>{t.close()});const s=document.getElementById("cancel-share-button");s==null||s.addEventListener("click",()=>{t.close()});const i=document.getElementById("create-share-button");i==null||i.addEventListener("click",async()=>{showScreen("share-loading");try{if(!window.globe)throw new Error("BlueGlobe instance not found");let a=window.globe.shareInstance;if(!a){const v=window.globe.apiBaseUrl||"/local-api";a=new L(window.globe,v),window.globe.shareInstance=a}const p=`/s/${(await a.createShare({title:"Shared BlueGlobe View",description:"A shared satellite visualization view"})).shareId}`,f=document.getElementById("share-url-input");f&&(f.value=p),showScreen("share-success")}catch(a){console.error("Failed to create share URL:",a);const u=document.getElementById("share-error-text");u&&(u.textContent=a.message||m("share.error")),showScreen("share-error")}});const h=document.getElementById("retry-share-button");h==null||h.addEventListener("click",()=>{showScreen("share-explanation")});const c=document.getElementById("copy-url-button"),w=document.getElementById("copy-url-main-button"),l=async()=>{const a=document.getElementById("share-url-input");a&&a.value&&await copyToClipboard(a.value)&&updateCopyButtonFeedback(!0)};return c==null||c.addEventListener("click",l),w==null||w.addEventListener("click",l),t}async shareCurrentView(){try{if(!window.globe){console.error("BlueGlobe instance not found");return}initializeShareModal().showModal(),showScreen("share-explanation")}catch(e){console.error("Failed to open share modal:",e),alert(`Failed to open share dialog: ${e.message}`)}}async showShareDialog(){try{const e=g=>{var x;const d=this.parent.currentLanguage||"en",y=(x=T)==null?void 0:x[d];if(!y)return console.warn(`No translations found for language: ${d}`),g;const b=y[g];return b!==void 0?b:g},o=await this.captureCanvasPreview(),t=document.getElementById("share-modal");t&&t.remove();const r=`
        <div id="share-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-modal-open>
          <div class="bg-gray-800 rounded-lg text-white w-11/12" style="max-width:380px;">
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-3 border-b border-gray-600">
              <h3 class="text-sm font-semibold text-white">${e("share.title")}</h3>
              <button type="button" class="close-button-inline" id="share-modal-close">
                <span class="sr-only">Close modal</span>
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                </svg>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="p-4">
              <!-- Preview image + playback options side by side -->
              <div class="mb-4 flex gap-4">
                <!-- Playback options (left) -->
                <div class="space-y-2 shrink-0">
                  <p class="text-xs text-gray-400 uppercase tracking-wide">Playback</p>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-300 w-14">Speed</label>
                    <input type="number" id="share-speed" step="any" min="1" max="500"
                      value="${Math.min(500,Math.max(1,this.parent.wallclock?this.parent.wallclock.getSpeed():1))}"
                      class="p-1 text-xs bg-gray-700 border border-gray-600 rounded text-white" style="width:64px">
                    <span class="text-xs text-gray-400">x</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-300 w-14">Duration</label>
                    <input type="number" id="share-duration" min="0" step="1" placeholder="—"
                      class="p-1 text-xs bg-gray-700 border border-gray-600 rounded text-white" style="width:64px">
                    <span class="text-xs text-gray-400">s</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-300 w-14">Loop</label>
                    <input type="checkbox" id="share-loop" class="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600">
                  </div>
                </div>
                <!-- Canvas Preview Image (right) -->
                ${o?`
                  <div class="flex-1 flex justify-center">
                    <img id="share-preview-image" src="${o}" alt="Current view preview"
                         class="rounded-lg border border-gray-600 h-auto shadow-lg">
                  </div>
                `:""}
              </div>

              <!-- Initial explanation screen -->
              <div id="share-explanation" class="space-y-4">
                <p class="text-sm text-gray-300">${e("share.description")}</p>
                <p class="text-sm text-green-400">✓ Captures: constellation/satellites, camera, clock, visuals, filters</p>

                <div class="flex flex-col gap-3 mt-6">
                  <button type="button"
                    class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                    id="create-share-button">
                    ${e("share.create_button")}
                  </button>
                  <button type="button"
                    class="w-full text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
                    id="cancel-share-button">
                    ${e("share.cancel_button")}
                  </button>
                </div>
              </div>
              
              <!-- Loading screen -->
              <div id="share-loading" class="hidden text-center space-y-4">
                <div class="flex justify-center">
                  <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p class="text-sm text-gray-300">${e("share.generating")}</p>
              </div>
              
              <!-- Success screen with URL -->
              <div id="share-success" class="hidden space-y-4">
                <div class="text-center space-y-2">
                  <div class="text-green-400 text-2xl">✓</div>
                  <h4 class="text-lg font-semibold text-white">${e("share.success_title")}</h4>
                  <p class="text-sm text-gray-300">${e("share.success_description")}</p>
                </div>
                
                <div class="relative">
                  <input type="text" 
                    id="share-url-input" 
                    class="w-full p-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 pr-12"
                    readonly>
                  <button type="button" 
                    id="copy-url-button"
                    class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                    </svg>
                  </button>
                </div>
                
                <button type="button"
                  class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                  id="copy-url-main-button">
                  <span id="copy-button-text">${e("share.copy_button")}</span>
                </button>
                <button type="button"
                  class="w-full text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
                  id="close-share-success-button">
                  ${e("share.cancel_button")}
                </button>
              </div>

              <!-- Error screen -->
              <div id="share-error" class="hidden space-y-4">
                <div class="text-center space-y-2">
                  <div class="text-red-400 text-2xl">⚠</div>
                  <p class="text-sm text-red-300" id="share-error-text">${e("share.error")}</p>
                </div>
                <button type="button" 
                  class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" 
                  id="retry-share-button">
                  ${e("share.create_button")}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;document.body.insertAdjacentHTML("beforeend",r);const n=document.getElementById("share-modal");if(!n)throw new Error("Failed to create share modal");const s=g=>{["share-explanation","share-loading","share-success","share-error"].forEach(y=>{const b=document.getElementById(y);b&&(y===g?b.classList.remove("hidden"):b.classList.add("hidden"))})},i=async g=>{try{if(navigator.clipboard&&window.isSecureContext)return await navigator.clipboard.writeText(g),!0;{const d=document.createElement("textarea");d.value=g,d.style.position="fixed",d.style.left="-999999px",d.style.top="-999999px",document.body.appendChild(d),d.focus(),d.select();const y=document.execCommand("copy");return document.body.removeChild(d),y}}catch(d){return console.error("Failed to copy to clipboard:",d),!1}},h=(g=!1)=>{const d=document.getElementById("copy-button-text");d&&(g?(d.textContent=e("share.copied"),setTimeout(()=>{d.textContent=e("share.copy_button")},2e3)):d.textContent=e("share.copy_button"))},c=()=>n.remove();n.addEventListener("click",g=>{g.target===n&&c()});const w=g=>{g.key==="Escape"&&(c(),document.removeEventListener("keydown",w))};document.addEventListener("keydown",w);const l=document.getElementById("share-modal-close");l==null||l.addEventListener("click",c);const a=document.getElementById("cancel-share-button");a==null||a.addEventListener("click",c);const u=document.getElementById("create-share-button");u==null||u.addEventListener("click",async()=>{s("share-loading");try{const g=document.getElementById("share-speed"),d=document.getElementById("share-duration"),y=document.getElementById("share-loop"),b=g?parseFloat(g.value):null,x=b!=null&&!isNaN(b)?Math.min(500,Math.max(1,b)):null,I=d&&d.value?parseInt(d.value,10):null,$=y?y.checked:!1,B=`/s/${(await this.createShare({title:"Shared BlueGlobe View",description:"A shared satellite visualization view",previewImage:o,shareSpeed:x,shareDuration:I>0?I:null,shareLoop:$})).shareId}`,C=document.getElementById("share-url-input");C&&(C.value=B),s("share-success")}catch(g){console.error("Failed to create share URL:",g);const d=document.getElementById("share-error-text");d&&(d.textContent=g.message||e("share.error")),s("share-error")}});const p=document.getElementById("retry-share-button");p==null||p.addEventListener("click",()=>{s("share-explanation")});const f=document.getElementById("copy-url-button"),v=document.getElementById("copy-url-main-button"),E=async()=>{const g=document.getElementById("share-url-input");g&&g.value&&await i(g.value)&&h(!0)};f==null||f.addEventListener("click",E),v==null||v.addEventListener("click",E);const k=document.getElementById("close-share-success-button");k==null||k.addEventListener("click",c),s("share-explanation")}catch(e){console.error("Failed to open share modal:",e),alert(`Failed to open share dialog: ${e.message}`)}}}export{L as BlueGlobeShare};
