
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const morgan = require('morgan')
const jwt = require('jsonwebtoken')


let requestCounter = 0
const secretKey = '*!06hp9bZ15l!87xrta^'



const { blacklistDb, serverlistDb, jsonDB, } = require('./models/blacklist.mongo')
const { uploadFile,  } = require('./models/blaclist.model')


const logDirectory = path.join(__dirname,'logs')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)
const logFilePath = path.join(logDirectory, 'combined.log')
const logStream = fs.createWriteStream( logFilePath, {flags: 'a'} )



let activeProfiles = {}
let localBlacklist = new Set()
let servers = []
let currentServer
const MONGOURI = 'mongodb+srv://rohitpandey20002017:vfBFng5GFv0FWsQP@cluster0.3a5eymc.mongodb.net/?retryWrites=true&w=majority'


app.use(express.json())

app.use( morgan( 'combined', {
    stream: logStream,
}) )


function handleLogs() {

    return new Promise( async () => {
        try{
            requestCounter++ 
            if( !requestCounter%1000 ) {
                await uploadFile()
                fs.open( logFilePath, 'w', (err, fileDescriptor) => {
                    if(err) {
                        throw new Error(`Could not get the file: ${err.message}`)
                    }
                    fs.ftruncate( fileDescriptor, 0, (err) => {
        
                        if(err) {
                            throw new Error(`Error while removing content: ${err.message}`)
                        }
                        
                        fs.close( fileDescriptor, (err) => {
                            if(err){
                                throw new Error(`Error while closing the file: ${err.message}`)
                            }
                        })
                    } ) 
                } )
                requestCounter = 0
            }

        }catch(err) {
            throw new Error(`Error in handleLogs(): ${err.message} `)
        }
        
    } )
    
}

app.use(async ( req, res, next) => {
     const { ip, } = req
    if( localBlacklist.has( req.ip ) ){
        console.log('this is where problem occured') 
        res.status(503).json({message: 'you are not allowed'}) 
        console.log('first') 
        return
    }

    Promise.all([handleLogs(),requestLimiter(ip,req,res)])    
    next()
})       

function requestLimiter(ip,req,res) {
    return new Promise(async () => {
        try{
            
            if( !activeProfiles[ip] ){     
                const newUser = { 
                    count: 1,   
                    lastRequest: Date.now(),
                    token: null,
                }
                activeProfiles[ip] = newUser
                return
            }
            
            const now = Date.now()
            
            const difference = now-activeProfiles[ip].lastRequest
            console.log(`difference: ${difference}`)
            if( difference < 1300 ) {
                if( !localBlacklist.has(ip) ){
                    localBlacklist.add(ip)
                    console.log(`happened`)  
                    await updataBlacklistDb(req.ip)
                }
                res.status(401).json({message:'you are not allowed'})
                console.log('2')
                return
            }
            activeProfiles[ip].lastRequest = now
            activeProfiles[ip].count += 1
    
        }catch(err) {
            throw new Error(`Error in requestLimiter(): ${err.message}`)
        }
    } )
}


// app.use(async (req, res, next) => {

//     try{
//         let { ip, } = req
        
//         if( !activeProfiles[ip] ){
//             const newUser = { 
//                 count: 1,
//                 lastRequest: Date.now(),
//                 token: null,
//             }
//             activeProfiles[ip] = newUser
            
//             next()
//             return
//         }
        
//         const now = Date.now()
        
//         const difference = now-activeProfiles[ip].lastRequest
        
//         if( difference < 1000 ) {
//             if( !localBlacklist.has(ip) ){
//                 localBlacklist.add(ip)
//                 await updataBlacklistDb(req.ip)
//             }
//             res.status(401).send('you are not allowed')
//             return
//         }
//         activeProfiles[ip].lastRequest = now
//         activeProfiles[ip].count += 1
//         next()

//     }catch(error){
//         throw new Error(`error is in request monitoring middleware: ${error.message}`)
//     }
// })



// function updateLogs( requestStatus, ip, responseLink, email ) {
//     fs.readFile( jsonFilePath, 'utf-8', async( err, data ) => {
//         if(err) {
//             throw new Error(`Error while reading logs ${err.message}`)
//         }
//         try{ 
//             data = JSON.parse(data) || {}
//             const userHistory = data[email] || []
//             const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
//             const newObject = { date: timestamp, request: requestStatus, link: responseLink, ip } 
//             userHistory.push(newObject)   
//             console.log(userHistory)  
//             data[email]=userHistory
//             await fs.writeFile( jsonFilePath, JSON.stringify(data), 'utf-8', ( error ) => {
//                 if(error) {
//                     throw new Error(`Error while writing JSON File: ${error.message}`)
//                 }
//                 console.log('logged the request')
//             } )
//         }
//         catch(error) {
//             throw new Error(`error parsing JSON: ${error.message}`)
//         }
//     } )
// }


async function verifyToken( req, res, next) {

    const { ip, } = req
    const { email, } = req.body
    const { authorization, } =  req.headers
    const payload = { ip, email}


    if( activeProfiles[ip].count > 1 && !authorization ) {
        await updataBlacklistDb(ip)
        res.status(401).json({messsage: 'You are not authenticated'})
        return
    }
    else if( activeProfiles[ip].count == 1 ){  
         
        await jwt.sign( payload, secretKey, { expiresIn: '1h'}, ( err, token ) => {
            if( err ) {
                throw new Error(`Error While creating JWT: ${err.message}`) 
            }
            activeProfiles[ip].token = token
            
        } )      
    } 
    else if( authorization ) {
        
        const token = authorization.replace("Bearer","").trim()
        
        if(!token) { 
            res.status( 401 ).json({message: 'Unauthorized'})
            return       
        }
    
        await jwt.verify( token, secretKey, (err,decoded) => {
            if(err) { 
                throw new Error(`Invalid token: ${err.message}`)
            }
        } )
    }

    next()  
}


let currentRequestingServer = 0


//allocate server

function loadBalancer() {
    const serverCount = servers.length
    currentRequestingServer = (currentRequestingServer+1)%serverCount
    currentServer = servers[ currentRequestingServer ]
}







app.post( '/', verifyToken, (req,res) => {
    const { ip, } = req
    const token = activeProfiles[ip].token
    loadBalancer()
    
    res.json({ response: 'good request', token, })
    return
})












mongoose.connection.once( 'open', () => {
    console.log('mongodb connection is established')
} )

mongoose.connection.on( 'error', () => {
    console.log(` Something went wrong,mongodb could not be connected`)
} )


function updataBlacklistDb(ip) {
    return new Promise( async ( res, rej ) => {
        try{
            const result = await blacklistDb.updateOne( { ip,}, { $set: { date: new Date(), } }, { upsert: true } )
            res(result)
        }catch( err ) {
            console.log(`error in updateBlaclistDb: ${err.message}`)
        }
    } )
}


function updateBlaclist() {
    return new Promise( async ( res, rej ) => {
        try{            
            let blacklist = await blacklistDb.find({}, { ip: 1, _id:0,})
            blacklist = blacklist.map( element => {
                return element['ip']
            } ) 
            localBlacklist = new Set(blacklist)
            res()
         
        }catch( err ) {
            throw new Error(`Error in updateBlaclist: ${err.message}`)
        }
    } )
    
} 
 
function updateServerlist() {
    return new Promise( async (req, res) => {
        try{ 
            const result = await serverlistDb.find( {}, { _id:0, serverAddress:1 } )
            if( result == undefined ){
                throw new Error(`No servers were available`)
            }
            servers = result.serverAddress
        }
        catch( err ) {
            throw new Error(`Error in updateServerList: ${err.message}`)
        }
    } )
}

function connectMongoose() {
    return new Promise( async ( res, rej ) => {
        try{ 
            await mongoose.connect( MONGOURI, {
                useNewUrlParser: true,
            })
            res()
        }catch(err) {
            throw new Error(`Error in connectMongoose: ${err.message}`)
        }
    } )
}

function updateLocalServerList() {
    return new Promise( async ( res, rej ) => {
        try{
            const result = await serverlistDb.find( {}, { _id:0, serverAddress:1 } )
            if( result == undefined ){
                throw new Error(`No servers were available`)
            }
            servers = result[0].serverAddress
            res()
        }catch(err) {
            throw new Error(`Error in updatelocalServerList: ${err.message}`)
        }
    } ) 
} 

function jobForUpdatingBlackistDb() {
    return new Promise(( res, rej ) => {
        try{
            setInterval( async () => {
                for(let user in activeProfiles ) {
                    if(activeProfiles[user].count >125) {
                        await updataBlacklistDb( user )
                        delete activeProfiles[user]
                    }
                    if(Date.now()-activeProfiles[user].lastRequest > 1000*60*10){
                        delete activeProfiles[user]
                    }                
                }
            }, 1000*60*15 )
            res()
        }catch(err) {
            throw new Error(`Error in jobForUpdatingBlackistDb: ${err.message}`)
        }
    } )
}


function jobForUpdatingLocalBlackistDb() {
    return new Promise(( res, rej ) => {
        try{                         
            setInterval( async () => {       
                await Promise.all( [ updateBlaclist(), updateServerlist() ] )     
            }, 1000*60*60)
            res()
        }catch(err) {
            throw new Error(`Error in jobForUpdatingLocalBlackistDb: ${err.message}`)
        }
    } )
}



function startServer() {
    return new Promise( async () => {
        try{       
            await connectMongoose()  
            app.listen( 8000, async () => {
                console.log("server has started")
                await updateBlaclist()           
            } )
        }catch(err) {
            throw new Error(`Error while starting server`)
        }
    } ) 
} 

Promise.all( [ updateLocalServerList(), startServer(), jobForUpdatingBlackistDb(), jobForUpdatingLocalBlackistDb ] )
