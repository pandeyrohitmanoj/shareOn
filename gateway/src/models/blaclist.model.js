 

 const { google } = require('googleapis');
 const path = require('path')
 const fs = require('fs');
const { jsonDB, } = require('./blacklist.mongo')


 const { JWT } = require('google-auth-library');


 let counter = 0
 const logFilePath = path.join(__dirname,'..','logs','combined.log')
 
 async function uploadFile() {
  const keys = await jsonDB.find({})
  const keypath = keys[0].key
   const auth = new JWT({
     keyFile: keypath,
     scopes: ['https://www.googleapis.com/auth/drive'],
   });
 
   const drive = google.drive({ version: 'v3', auth });
 
   
   const parentFolderId = '11PKTJl_KEvwjYwxfJYq6prc4ssSbvFzF'
   
   const fileMetadata = {
     name: `combined${counter}.log`,
     parents: [parentFolderId],
   };
 
   const media = {
     mimeType: 'text/plain',
     body: fs.createReadStream(logFilePath),
   };
 
   drive.files.create(
     {
       resource: fileMetadata,
       media: media,
       fields: 'id',
     },
     (err, file) => {
       if (err) {
         console.error('Error uploading file:', err);
       } else {
         console.log('File ID:', file.data.id);
       }
     }
   );
 }

 
 module.exports = {
    uploadFile,
 }