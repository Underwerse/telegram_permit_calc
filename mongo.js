import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()
const MONGO_URI = process.env.MONGO_URI
const connection = {}

export const dbConnect = async () => {
  if (connection.isConnected) {
    console.info('DB has already been connected')
    return
  }

  mongoose.set('strictQuery', false)
  mongoose.set('strictPopulate', false)

  const connectionString = `${MONGO_URI}`

  try{
    const db = await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
  
    connection.isConnected = db.connections[0].readyState
    
    console.info(`DB connected`)

    return db
  } catch(error) {
    console.error(`dbConnect: ${error.message}`)
  }
  
}

