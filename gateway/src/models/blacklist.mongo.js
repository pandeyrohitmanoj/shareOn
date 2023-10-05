
const mongoose = require('mongoose')

const blacklistSchema = new mongoose.Schema({ 
    ip: { required: true, type: String, unique: true, },
    date: { required: true, type: Date, },
 })

const profileSchema = new mongoose.Schema({
    email: { required: true, type: String, unique: true },
    password: { required: false, type: String, unique: true },
    salt: { required: false, type: String, unique: true },
    oauth: { required: false, type: Boolean },
    jwt: { required: true, type: String, unique: true },
    
})

const serverListSchema = new mongoose.Schema( {
    serverAddress: { type: Array, required:true, unique: true },
} ) 

const jsonFileSchema = new mongoose.Schema( {
    key: { type: Object, required:true, unique: true,  }
} )

const profileDb = mongoose.model( 'profile', profileSchema )

const blacklistDb = mongoose.model( 'blacklist', blacklistSchema )

const serverlistDb = mongoose.model( 'server-address', serverListSchema )

const jsonDB = mongoose.model( 'key', jsonFileSchema )

module.exports = {
    profileDb,
    blacklistDb,
    serverlistDb,
    jsonDB,
}