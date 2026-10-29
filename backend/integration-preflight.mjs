import mongoose from 'mongoose';
import {v2 as cloudinary} from 'cloudinary';
import {loadConfig} from './src/config/env.js';
import {User} from './src/modules/users/user.model.js';
import {Category} from './src/modules/catalog/category.model.js';
import {WorkerProfile} from './src/modules/workers/worker.model.js';
const c=loadConfig();
try {await mongoose.connect(c.MONGODB_URI,{serverSelectionTimeoutMS:15000,autoIndex:false});const hello=await mongoose.connection.db.admin().command({hello:1});console.log(JSON.stringify({atlasConnected:true,replicaSet:!!hello.setName,adminAccounts:await User.countDocuments({role:'ADMIN'}),categories:await Category.countDocuments(),workerProfiles:await WorkerProfile.countDocuments()}));}catch(e){console.log(JSON.stringify({atlasConnected:false,errorType:e.name,code:e.code}));}finally{await mongoose.disconnect();}
if(c.MEDIA_PROVIDER==='cloudinary')try{const r=await cloudinary.api.ping({cloud_name:c.CLOUDINARY_CLOUD_NAME,api_key:c.CLOUDINARY_API_KEY,api_secret:c.CLOUDINARY_API_SECRET,timeout:15000});console.log(JSON.stringify({cloudinaryAuthenticated:r.status==='ok'}));}catch(e){console.log(JSON.stringify({cloudinaryAuthenticated:false,code:e.http_code||e.name}));}
