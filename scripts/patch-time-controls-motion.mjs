import { readFileSync, writeFileSync } from "node:fs";

const uiPath = "assets/blueglobe-ui.Cm_H4t79.js";
const mainPath = "assets/main.localfix3.js";

function patchUi() {
  let s = readFileSync(uiPath, "utf8");

  if (s.includes("SPACEMAN_TIME_CONTROL_MOTION_PATCH")) {
    console.log("time control motion patch is already installed");
    return;
  }

  const oldBlock = 'b=="time_pause"&&(this.parent.wallclock.getSpeed()==0?(this.parent.wallclock.setSpeed(this.save_ff_speed),this.parent.wallclock.resume(),this._showButtonLabel(b,null)):(this.save_ff_speed=this.parent.wallclock.getSpeed(),this.parent.wallclock.setSpeed(0),this.parent.wallclock.pause(),this._showButtonLabel(b,null))),b=="time_fastforward"||b=="time_rewind"){const _=b=="time_rewind"?-1:1;let k=this.parent.wallclock.getSpeed();k==0?k=_:Math.sign(k)!=Math.sign(_)?k*=-1:k==500*_?this.save_ff_speed=k=1*_:k==1*_?this.save_ff_speed=k=10*_:k==10*_?this.save_ff_speed=k=100*_:k==100*_&&(this.save_ff_speed=k=500*_),this.parent.wallclock.setSpeed(k),this.parent.wallclock.resume(),this._showButtonLabel(b,this.parent.wallclock.getSpeed())}if(b=="time_reset"&&(this.parent.timewarp(new Date).then(_=>{this.parent.dots.need_recalc=!0}),this.parent.wallclock.reset(),this.parent.dots.need_recalc=!0,this.parent.wallclock.setSpeed(this.save_ff_speed=1),this._showButtonLabel(b,null),this.datePicker)){';

  const newBlock = 'b=="time_pause"&&(this.parent.wallclock.getSpeed()==0?(this.parent.setClockSpeed?this.parent.setClockSpeed(this.save_ff_speed||1):(this.parent.wallclock.setSpeed(this.save_ff_speed||1),this.parent.wallclock.resume()),this.parent.resumeRendering&&this.parent.resumeRendering(),this.parent.dots&&(this.parent.dots.need_recalc=!0),this.parent.segment_progress=2,this._showButtonLabel(b,null)):(this.save_ff_speed=this.parent.wallclock.getSpeed()||1,this.parent.setClockSpeed?this.parent.setClockSpeed(0):(this.parent.wallclock.setSpeed(0),this.parent.wallclock.pause()),this.parent.dots&&(this.parent.dots.need_recalc=!0),this._showButtonLabel(b,null))),b=="time_fastforward"||b=="time_rewind"){/* SPACEMAN_TIME_CONTROL_MOTION_PATCH */const _=b=="time_rewind"?-1:1;let k=this.parent.wallclock.getSpeed();k==0?k=_:Math.sign(k)!=Math.sign(_)?k=Math.abs(k)*_:Math.abs(k)>=5e3?k=1*_:Math.abs(k)>=500?k=5e3*_:Math.abs(k)>=100?k=500*_:Math.abs(k)>=10?k=100*_:k=10*_,this.save_ff_speed=k,this.parent.setClockSpeed?this.parent.setClockSpeed(k):(this.parent.wallclock.setSpeed(k),this.parent.wallclock.resume()),this.parent.resumeRendering&&this.parent.resumeRendering(),this.parent.dots&&(this.parent.dots.need_recalc=!0),this.parent.segment_progress=2,this._showButtonLabel(b,this.parent.wallclock.getSpeed())}if(b=="time_reset"&&(this.parent.timewarp(new Date).then(_=>{this.parent.dots&&(this.parent.dots.need_recalc=!0)}),this.parent.wallclock.reset(),this.parent.dots&&(this.parent.dots.need_recalc=!0),this.parent.segment_progress=2,this.parent.resumeRendering&&this.parent.resumeRendering(),this.parent.wallclock.setSpeed(this.save_ff_speed=1),this._showButtonLabel(b,null),this.datePicker)){';

  const count = s.split(oldBlock).length - 1;
  if (count !== 1) {
    throw new Error(`Expected one time control handler block, found ${count}`);
  }
  s = s.replace(oldBlock, newBlock);
  writeFileSync(uiPath, s, "utf8");
  console.log("Patched time controls to force satellite motion recalculation");
}

function patchLabels() {
  let s = readFileSync(mainPath, "utf8");
  const replacements = [
    [
      'time_rewind:{0:"Rewind","-1":"Rewind","-10":"10x","-100":"100x","-500":"500x"}',
      'time_rewind:{0:"Rewind","-1":"Rewind","-10":"10x","-100":"100x","-500":"500x","-5000":"5000x"}'
    ],
    [
      'time_fastforward:{0:"Fast Forward",1:"Fast Forward",10:"10x",100:"100x",500:"500x"}',
      'time_fastforward:{0:"Fast Forward",1:"Fast Forward",10:"10x",100:"100x",500:"500x",5000:"5000x"}'
    ]
  ];

  let changed = false;
  for (const [from, to] of replacements) {
    if (s.includes(to)) continue;
    const count = s.split(from).length - 1;
    if (count !== 1) {
      throw new Error(`Expected one label block for ${from.slice(0, 30)}, found ${count}`);
    }
    s = s.replace(from, to);
    changed = true;
  }
  if (changed) {
    writeFileSync(mainPath, s, "utf8");
    console.log("Patched time control labels for 5000x");
  } else {
    console.log("time control labels already include 5000x");
  }
}

patchUi();
patchLabels();
