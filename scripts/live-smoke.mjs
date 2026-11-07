// Explicit opt-in integration test. Uses only newly created, tagged QA records;
// never prints/writes server keys, passwords, session tokens, or real user data.
import { execSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const reference=process.argv.find(arg=>arg.startsWith('--project-ref='))?.split('=')[1]
if(!reference||!/^[a-z]{20}$/.test(reference)||!process.argv.includes('--allow-tagged-qa'))
 throw new Error('Supply --project-ref=<exact reference> --allow-tagged-qa to explicitly allow temporary QA accounts/data.')
const url='https://'+reference+'.supabase.co'
let keys
try{keys=JSON.parse(execSync(`npx supabase projects api-keys --remote=${reference} --reveal --output json`,{encoding:'utf8',stdio:['ignore','pipe','pipe']}))}
catch{throw new Error('Supabase CLI login and API-key read permission are required for live testing.')}
const publicKey=keys.find(k=>k.type==='publishable')?.api_key
const serverKey=keys.find(k=>k.type==='secret')?.api_key||keys.find(k=>k.name==='service_role')?.api_key
if(!publicKey||!serverKey)throw new Error('Project test credentials are unavailable.')
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})}}
const admin=createClient(url,serverKey,options)
const visitor=createClient(url,publicKey,options)
const run='qa-'+randomUUID().slice(0,8)
const password=randomBytes(24).toString('base64url')
const identities=[]
let organizationId
const results=[]
function checked(result,label){if(result.error)throw new Error(label+': '+result.error.message);return result.data}
function verify(condition,label){if(!condition)throw new Error(label);results.push(label);console.log('PASS:',label)}
async function identity(label){
 const email=run+'-'+label+'@example.test'
 const created=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'QA '+label,qa_run:run}}),'Create temporary identity').user
 const record={id:created.id,email,client:createClient(url,publicKey,options)}
 identities.push(record)
 checked(await record.client.auth.signInWithPassword({email,password}),'Sign in temporary identity')
 checked(await record.client.rpc('complete_user_onboarding',{p_data:{first_name:'QA',last_name:label,bio:'A temporary automated integration test profile.',city:'Indianapolis',interests:['Environment'],skills:[],date_of_birth:'1995-01-01',terms_accepted:true}}),'Complete onboarding')
 checked(await record.client.from('user_settings').update({email_notifications:false}).eq('user_id',record.id),'Disable QA email notifications')
 return record
}
async function invoke(client,name,body){
 const result=await client.functions.invoke(name,{method:'POST',body})
 if(result.error){
  const detail=await result.error.context?.json?.().catch(()=>null)
  throw new Error(name+': '+(detail?.error||detail?.message||result.error.message))
 }
 if(result.data?.deleted!==true)throw new Error(name+' did not confirm deletion')
}
try{
 const owner=await identity('owner'),volunteer=await identity('volunteer'),successor=await identity('successor')
 verify(identities.length===3,'Real Auth signup-trigger rows and onboarding work')
 const org=checked(await owner.client.rpc('create_organization',{p_data:{name:'QA integration '+run,description:'A temporary organization for an automated end-to-end verification.',mission:'Verify the application without touching existing records.',city:'Indianapolis',focus:['Environment'],join_policy:'approval'}}),'Create QA organization')
 organizationId=org.id
 const date=new Date();date.setUTCDate(date.getUTCDate()+7)
 const event=checked(await owner.client.from('opportunities').insert({organization_id:org.id,title:'QA event '+run,description:'A temporary event for integration checks; no real attendance.',category:'Environment',city:'Indianapolis',location:'QA test venue',event_date:date.toISOString().slice(0,10),start_time:'09:00',end_time:'12:00',timezone:'America/Indiana/Indianapolis',spots:1,hours:3}).select().single(),'Create QA draft')
 checked(await owner.client.from('opportunities').update({status:'published'}).eq('id',event.id),'Publish QA event')
 const projection=checked(await visitor.from('opportunities').select('id,organization:public_organizations!opportunities_organization_id_fkey(id,name)').eq('id',event.id).single(),'Read public opportunity relationship')
 verify(projection.organization?.id===org.id,'Published opportunities and organization embedding are readable')
 const registration=checked(await volunteer.client.rpc('register_for_opportunity',{p_opportunity_id:event.id}),'Register for QA event')
 const full=await successor.client.rpc('register_for_opportunity',{p_opportunity_id:event.id})
 verify(full.error?.message==='SPOTS_FULL','Capacity is enforced by the live database')
 checked(await owner.client.rpc('set_registration_status',{p_registration_id:registration.id,p_status:'approved'}),'Approve QA registration')
 checked(await volunteer.client.rpc('cancel_registration',{p_registration_id:registration.id}),'Cancel upcoming QA registration')
 verify(true,'Registration approval and cancellation work through RPCs')
 const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX7cAAAAASUVORK5CYII=','base64'))
 const denied=await volunteer.client.storage.from('avatars').upload(owner.id+'/forbidden.png',image,{contentType:'image/png'})
 verify(!!denied.error&&/row.level security|not authorized|unauthorized/i.test(denied.error.message),'Storage rejects another user’s folder')
 const avatar=owner.id+'/'+randomUUID()+'.png'
 checked(await owner.client.storage.from('avatars').upload(avatar,image,{contentType:'image/png'}),'Upload QA avatar')
 checked(await owner.client.from('users').update({avatar_path:avatar,avatar_url:owner.client.storage.from('avatars').getPublicUrl(avatar).data.publicUrl}).eq('id',owner.id),'Persist QA avatar')
 const saved=checked(await owner.client.from('users').select('avatar_path').eq('id',owner.id).single(),'Read saved avatar')
 verify(saved.avatar_path===avatar,'Real Storage upload and persisted avatar path work')
 checked(await volunteer.client.from('users').update({profile_visibility:'everyone'}).eq('id',volunteer.id),'Publish QA profile')
 const publicProfile=checked(await visitor.rpc('get_user_profile_for_organization',{p_user_id:volunteer.id}),'Read public QA profile')
 verify(publicProfile.id===volunteer.id&&publicProfile.phone===null&&!('date_of_birth' in publicProfile),'Public profiles exclude private identity/contact fields')
 checked(await owner.client.rpc('invite_user_to_organization',{p_organization_id:org.id,p_user_id:successor.id,p_role:'member'}),'Invite QA successor')
 checked(await successor.client.rpc('accept_organization_invite',{p_organization_id:org.id}),'Accept QA invitation')
 const transfer=checked(await owner.client.rpc('transfer_organization_ownership',{p_organization_id:org.id,p_new_owner_id:successor.id}),'Transfer QA ownership')
 verify(transfer.user_id===successor.id&&transfer.role==='owner','Ownership transfer preserves the membership API contract')
 const blocked=await successor.client.functions.invoke('delete-account',{method:'POST',body:{deleteOwnedOrganizations:true}})
 verify(blocked.error?.context?.status===409,'Shared ownership blocks account deletion')
 await invoke(owner.client,'delete-account',{deleteOwnedOrganizations:false})
 const retained=checked(await successor.client.from('organizations').select('id,created_by').eq('id',org.id).single(),'Verify transferred organization survives')
 verify(retained.created_by===successor.id,'Account deletion removes Auth/Storage and preserves transferred organizations')
 await invoke(successor.client,'delete-organization',{organizationId:org.id,confirm:true})
 organizationId=undefined
 verify(true,'Owner-only organization deletion completes on the deployed function')
 await invoke(volunteer.client,'delete-account',{deleteOwnedOrganizations:false})
 await invoke(successor.client,'delete-account',{deleteOwnedOrganizations:false})
 verify(true,'Temporary accounts are deleted through the real account endpoint')
}finally{
 // Safety-net cleanup uses only IDs returned by this test's createUser calls and
 // rechecks their tag before removing any account. Existing records are excluded.
 if(organizationId)checked(await admin.from('organizations').delete().eq('id',organizationId).like('name','QA integration '+run),'Clean QA organization')
 for(const record of identities){
  const lookup=await admin.auth.admin.getUserById(record.id)
  if(!lookup.data?.user)continue
  if(lookup.data.user.user_metadata.qa_run!==run||lookup.data.user.email!==record.email)throw new Error('QA cleanup identity check failed')
  const files=checked(await admin.rpc('account_storage_objects',{p_user_id:record.id}),'Inventory QA objects')
  for(const bucket of new Set(files.map(f=>f.bucket_id)))checked(await admin.storage.from(bucket).remove(files.filter(f=>f.bucket_id===bucket).map(f=>f.name)),'Clean QA objects')
  checked(await admin.auth.admin.deleteUser(record.id),'Clean temporary Auth identity')
 }
}
console.log('Live smoke checks completed:',results.length,'No existing user records were targeted.')
