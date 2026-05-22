import mongoose from 'mongoose'
import { DB_NAME } from '../utils/contact.js'

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log(`\n Mongodb connected Successfully ! DB HOST !!!! ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MongoDb connection faild !!", error)
        process.exit(1)
    }
}


export default connectDB;