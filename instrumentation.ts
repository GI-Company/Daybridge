export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.VERCEL_ENV==='production'&&process.env.SUPABASE_SERVICE_ROLE_KEY){
  try{const {releasePersonalSignIn}=await import('./lib/admin/release-personal-signin');await releasePersonalSignIn();}
  catch{console.error('DayBridge personal sign-in migration needs reconciliation; records remain intact');}
 }
}
