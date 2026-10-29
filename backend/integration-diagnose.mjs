import {readFileSync,existsSync} from 'node:fs';
import {loadConfig} from './src/config/env.js';
import dotenv from 'dotenv';
let c;
try { c=loadConfig(); console.log(JSON.stringify({configuration:'valid',port:c.PORT,nodeEnv:c.NODE_ENV,origin:c.FRONTEND_ORIGIN,mediaProvider:c.MEDIA_PROVIDER,databaseType:c.MONGODB_URI.startsWith('mongodb+srv:')?'Atlas/SRV':'MongoDB',cloudinaryCredentialsConfigured:!!(c.CLOUDINARY_CLOUD_NAME&&c.CLOUDINARY_API_KEY&&c.CLOUDINARY_API_SECRET)})); }
catch(e){console.log(e.message.startsWith('Invalid environment')?e.message:'Configuration validation failed');process.exitCode=1;}
if(existsSync('../frontend/.env')) {const v=dotenv.parse(readFileSync('../frontend/.env')).VITE_API_URL;try {const u=new URL(v);console.log(JSON.stringify({frontendEnvironment:'present',apiBase:u.origin+u.pathname,hasCredentials:!!(u.username||u.password)}));}catch{console.log('Frontend API URL missing or invalid');}} else console.log('Frontend .env absent; client uses default http://localhost:5000/api');
for (const base of ['http://localhost:5000','http://127.0.0.1:5000']) {try{const r=await fetch(base+'/api/ready',{signal:AbortSignal.timeout(3000),headers:{Origin:'http://localhost:5173'}});console.log(JSON.stringify({api:base,status:r.status,corsOrigin:r.headers.get('access-control-allow-origin')}));}catch(e){console.log(JSON.stringify({api:base,reachable:false,code:e.cause?.code||e.name}));}}
