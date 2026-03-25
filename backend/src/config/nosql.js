/**
 * Optional MongoDB (NoSQL) configuration.
 * Enabled only when ENABLE_MONGO=true and MONGO_URI is provided.
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

let mongoClient = null;
let mongoDb = null;

const isMongoEnabled = () => {
  const enabled = String(process.env.ENABLE_MONGO || 'false').toLowerCase() === 'true';
  return enabled && Boolean(String(process.env.MONGO_URI || '').trim());
};

export const connectMongo = async () => {
  if (!isMongoEnabled()) {
    return false;
  }

  if (mongoClient && mongoDb) {
    return true;
  }

  const uri = String(process.env.MONGO_URI || '').trim();
  const dbName = String(process.env.MONGO_DB_NAME || process.env.DB_NAME || 'ClinicManagement').trim();

  mongoClient = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
  });

  await mongoClient.connect();
  mongoDb = mongoClient.db(dbName);
  console.log(`✅ Connected to MongoDB database: ${dbName}`);

  return true;
};

export const getMongoDb = async () => {
  const connected = await connectMongo();
  if (!connected) return null;
  return mongoDb;
};

export const getMongoStatus = () => ({
  enabled: isMongoEnabled(),
  connected: Boolean(mongoClient && mongoDb),
  database: mongoDb?.databaseName || null,
});

export const closeMongoClient = async () => {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
    console.log('MongoDB connection closed');
  }
};

export default {
  connectMongo,
  getMongoDb,
  getMongoStatus,
  closeMongoClient,
};
