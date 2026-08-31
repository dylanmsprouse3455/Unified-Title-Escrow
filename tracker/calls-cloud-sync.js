(function(){
"use strict";

var OWNER_EMAIL="dylan.sprouse@unifiedtitle.net";
var STORAGE_KEY="utei.dylan.callTracker.v1";
var TABLE="dylan_call_records";
var SUPABASE_URL="https://hdqmcjlpyjpfeltmxfax.supabase.co";
var SUPABASE_KEY="sb_publishable_lC2M8fZGmJQt6bWKgfiDnw_4Nx1TwHD";
var cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var user=null;
var lastSnapshot="";
var busy=false;
var pollTimer=0;

function clean(value){return String(value==null?"":value).trim();}
function parseList(raw){try{var value=JSON.parse(raw||"[]");return Array.isArray(value)?value:[];}catch(_error){return[];}}
function readLocal(){return parseList(localStorage.getItem(STORAGE_KEY));}
function recordTime(record){var parsed=Date.parse(record&&record.updatedAt||record&&record.createdAt||"");return Number.isFinite(parsed)?parsed:0;}
function deletedTime(row){var parsed=Date.parse(row&&row.deleted_at||"");return Number.isFinite(parsed)?parsed:0;}
function rowTime(row){return Math.max(recordTime(row&&row.payload),Date.parse(row&&row.updated_at||"")||0);}
function serialize(records){return JSON.stringify(records);}
function writeLocal(records){var value=serialize(records);localStorage.setItem(STORAGE_KEY,value);lastSnapshot=value;}
function mapById(records){var map=new Map();records.forEach(function(record){if(record&&clean(record.id))map.set(clean(record.id),record);});return map;}

async function getVerifiedUser(){
  var sessionResult=await cloud.auth.getSession();
  var session=sessionResult.data&&sessionResult.data.session;
  if(!session)return null;
  var userResult=await cloud.auth.getUser();
  var verified=userResult.data&&userResult.data.user;
  if(userResult.error||!verified||clean(verified.email).toLowerCase()!==OWNER_EMAIL)return null;
  return verified;
}

async function readCloudRows(){
  var result=await cloud.from(TABLE).select("id,payload,created_at,updated_at,deleted_at").eq("user_id",user.id);
  if(result.error)throw result.error;
  return Array.isArray(result.data)?result.data:[];
}

async function upsertRecords(records){
  if(!records.length)return;
  var rows=records.map(function(record){
    var created=record.createdAt||record.updatedAt||new Date().toISOString();
    var updated=record.updatedAt||created;
    return {id:clean(record.id),user_id:user.id,payload:record,created_at:created,updated_at:updated,deleted_at:null};
  }).filter(function(row){return row.id;});
  if(!rows.length)return;
  var result=await cloud.from(TABLE).upsert(rows,{onConflict:"id"});
  if(result.error)throw result.error;
}

async function tombstoneIds(ids){
  if(!ids.length)return;
  var stamp=new Date().toISOString();
  for(var i=0;i<ids.length;i++){
    var result=await cloud.from(TABLE).update({deleted_at:stamp,updated_at:stamp}).eq("id",ids[i]).eq("user_id",user.id);
    if(result.error)throw result.error;
  }
}

async function initialMerge(){
  var local=readLocal();
  var cloudRows=await readCloudRows();
  var localMap=mapById(local);
  var merged=new Map(localMap);
  var upload=[];

  cloudRows.forEach(function(row){
    var id=clean(row.id),localRecord=localMap.get(id),payload=row.payload&&typeof row.payload==="object"?row.payload:null;
    if(!id)return;
    if(row.deleted_at){
      if(localRecord&&recordTime(localRecord)>deletedTime(row))upload.push(localRecord);
      else merged.delete(id);
      return;
    }
    if(!payload)return;
    if(!localRecord||rowTime(row)>recordTime(localRecord))merged.set(id,payload);
    else if(recordTime(localRecord)>rowTime(row))upload.push(localRecord);
  });

  cloudRows.forEach(function(row){
    var id=clean(row.id);
    if(id)localMap.delete(id);
  });
  localMap.forEach(function(record){upload.push(record);});

  var mergedList=Array.from(merged.values()).sort(function(a,b){return String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""));});
  writeLocal(mergedList);
  await upsertRecords(upload);
  return mergedList.length;
}

async function syncLocalChanges(){
  if(!user||busy)return;
  var raw=localStorage.getItem(STORAGE_KEY)||"[]";
  if(raw===lastSnapshot)return;
  busy=true;
  try{
    var previous=parseList(lastSnapshot),current=parseList(raw);
    var previousMap=mapById(previous),currentMap=mapById(current),removed=[];
    previousMap.forEach(function(_record,id){if(!currentMap.has(id))removed.push(id);});
    await tombstoneIds(removed);
    await upsertRecords(current);
    lastSnapshot=raw;
    setStorageNote(true,current.length);
  }catch(error){
    console.warn("Calls cloud sync failed",error&&error.message?error.message:"unknown error");
    setStorageNote(false,readLocal().length);
  }finally{busy=false;}
}

function setStorageNote(online,count){
  var note=document.querySelector(".storage-note");
  if(!note)return;
  var strong=note.querySelector("strong"),span=note.querySelector("span");
  if(online){
    if(strong)strong.textContent="Saved to your account with a browser backup.";
    if(span)span.textContent=count+" call record"+(count===1?"":"s")+" available here. Changes sync automatically when connected.";
  }else{
    if(strong)strong.textContent="Working from this browser backup.";
    if(span)span.textContent="Cloud sync is temporarily unavailable. Your local records are still available and will retry automatically.";
  }
}

async function initialize(){
  try{
    user=await getVerifiedUser();
    if(!user){lastSnapshot=localStorage.getItem(STORAGE_KEY)||"[]";return false;}
    busy=true;
    var count=await initialMerge();
    busy=false;
    setStorageNote(true,count);
    pollTimer=setInterval(syncLocalChanges,1200);
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")syncLocalChanges();});
    window.addEventListener("beforeunload",function(){if(pollTimer)clearInterval(pollTimer);});
    return true;
  }catch(error){
    busy=false;
    lastSnapshot=localStorage.getItem(STORAGE_KEY)||"[]";
    console.warn("Calls cloud sync unavailable; using browser backup",error&&error.message?error.message:"unknown error");
    setStorageNote(false,readLocal().length);
    pollTimer=setInterval(syncLocalChanges,2000);
    return false;
  }
}

window.__dylanCallCloudReady=initialize();
window.__dylanCallCloudSyncNow=syncLocalChanges;
})();
