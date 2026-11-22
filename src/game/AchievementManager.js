const STORAGE_KEY = "apex_achievements_v1";
const ACHIEVEMENTS = [
 { id:"first-race", name:"Lights Out", description:"Complete your first race", reward:250, test:p=>p.races>=1 },
 { id:"first-win", name:"Winner's Circle", description:"Win your first race", reward:500, test:p=>p.wins>=1 },
 { id:"three-podiums", name:"Consistent Performer", description:"Earn three podium finishes", reward:600, test:p=>p.podiums>=3 },
 { id:"drift-1000", name:"Sideways Starter", description:"Earn 1,000 lifetime drift points", reward:400, test:p=>p.totalDriftPoints>=1000 },
 { id:"drift-10000", name:"Drift Specialist", description:"Earn 10,000 lifetime drift points", reward:1000, test:p=>p.totalDriftPoints>=10000 },
 { id:"ten-races", name:"Track Regular", description:"Complete ten races", reward:750, test:p=>p.races>=10 }
];
class AchievementManager {
 constructor(profile){ this.profile=profile; this.unlocked=this.load(); }
 load(){
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); return Array.isArray(value)?[...new Set(value.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)))]:[]; }
  catch { return []; }
 }
 save(){ try { localStorage.setItem(STORAGE_KEY,JSON.stringify(this.unlocked)); } catch(error){ console.warn("APEX achievements could not be saved.",error); } }
 evaluate(){
  const newlyUnlocked=ACHIEVEMENTS.filter(a=>!this.unlocked.includes(a.id)&&a.test(this.profile.data));
  if(!newlyUnlocked.length)return [];
  newlyUnlocked.forEach(a=>{this.unlocked.push(a.id);this.profile.data.credits+=a.reward;});
  this.save();this.profile.save();return newlyUnlocked;
 }
 get all(){return ACHIEVEMENTS.map(a=>({...a,unlocked:this.unlocked.includes(a.id)}));}
}
export { AchievementManager };
